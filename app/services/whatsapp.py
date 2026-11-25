"""WhatsApp brief: Paisa Radar on the owner's phone every morning, and replies that run commands.

Messages go out through Meta's WhatsApp Cloud API when WHATSAPP_TOKEN and
WHATSAPP_PHONE_NUMBER_ID are set. Without them the app is in preview mode: every message is
stored and shown in the in-app phone, and taps or replies there run through exactly the same
code as real WhatsApp webhooks.

WhatsApp rules this follows:
  - A business may send free-form messages only within 24 hours of the person's last message.
    Outside that window the morning brief goes as an approved template (WHATSAPP_BRIEF_TEMPLATE)
    with two quick-reply buttons; a tap reopens the window and the full brief follows.
  - Interactive messages: body up to 1024 characters, at most 3 reply buttons, titles up to 20.

Replies reuse the command bar (services/commands.py): the same preview, the same Confirm step,
the same undo and the same action log, marked as coming from WhatsApp.
"""
import asyncio
import hashlib
import hmac
import json
import logging
import re
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.schema import AppSetting, AssistantAction, Sale, User, WhatsAppBrief, WhatsAppMessage
from app.services import commands
from app.services.commands import inr
from app.services.radar import LOCAL_TZ, compute_radar

logger = logging.getLogger(__name__)

REORDER_ALL = "reorder everything running low"
WINDOW = timedelta(hours=23, minutes=50)    # WhatsApp's 24-hour customer service window, with a margin
APPROVE_MAX_AGE = timedelta(hours=36)       # a one-tap approve trusts the brief's numbers this long
BODY_LIMIT = 1024                           # interactive message body
TEXT_LIMIT = 4096
DEFAULTS = {"brief_enabled": False, "brief_time": "09:00", "brief_days": "daily", "language": "en"}
MANAGERS = ("admin", "manager")

# Tests swap this for httpx.MockTransport.
_transport: httpx.AsyncBaseTransport | None = None


# ------------------------------------------------------------------ settings & helpers

def mode() -> str:
    return "live" if settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID else "preview"


async def get_settings(db: AsyncSession) -> dict:
    rows = (await db.execute(select(AppSetting).where(AppSetting.key.in_(DEFAULTS)))).scalars().all()
    out = dict(DEFAULTS)
    for r in rows:
        try:
            out[r.key] = json.loads(r.value)
        except (TypeError, ValueError):
            pass
    return out


async def save_settings(db: AsyncSession, patch: dict) -> dict:
    for key, value in patch.items():
        if key not in DEFAULTS or value is None:
            continue
        row = await db.get(AppSetting, key)
        if row:
            row.value = json.dumps(value)
        else:
            db.add(AppSetting(key=key, value=json.dumps(value)))
    await db.flush()
    return await get_settings(db)


def normalise_phone(raw: str | None) -> str | None:
    """Digits with country code, the form WhatsApp uses (919876543210). Ten digits are taken as Indian."""
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return None
    if digits.startswith("00"):
        digits = digits[2:]
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 10:
        digits = "91" + digits
    if not 11 <= len(digits) <= 15:
        raise ValueError("Enter a mobile number with country code, like +91 98765 43210.")
    return digits


def rupees_short(n) -> str:
    n = float(n or 0)
    a = abs(n)
    if a >= 1e7:
        return re.sub(r"\.0$", "", f"₹{n / 1e7:.1f}") + "Cr"
    if a >= 1e5:
        return re.sub(r"\.0$", "", f"₹{n / 1e5:.1f}") + "L"
    return inr(n)


def _time_label(hhmm: str) -> str:
    h, m = (int(x) for x in hhmm.split(":"))
    return f"{(h % 12) or 12}:{m:02d} {'am' if h < 12 else 'pm'}"


def _date_label(d) -> str:
    return f"{d:%a}, {d.day} {d:%b}"


def _first_name(user: User) -> str:
    return (user.name or "").split()[0] if user and user.name else "there"


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def _app_link(page: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/#{page}"


def webhook_url(base_url: str | None = None) -> str:
    if settings.PUBLIC_API_URL:
        base = settings.PUBLIC_API_URL
    elif settings.RAILWAY_PUBLIC_DOMAIN:
        base = f"https://{settings.RAILWAY_PUBLIC_DOMAIN}"
    else:
        base = base_url or "http://localhost:8000"
    return base.rstrip("/") + "/api/v1/whatsapp/webhook"


def verify_signature(raw: bytes, header: str | None) -> bool:
    """Meta signs every webhook with the app secret (X-Hub-Signature-256: sha256=<hex>)."""
    secret = settings.WHATSAPP_APP_SECRET
    if not secret or not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header[len("sha256="):])


# ------------------------------------------------------------------ words

TEXT = {
    "en": {
        "hello": "*Good morning, {name}*\nYour shop on {date}.",
        "stock": "*{v}* in stock at cost.",
        "risk": "*{v}* of sales at risk: {n} will run out before the next delivery.",
        "stuck": "*{v}* stuck: no sale in 60+ days ({names}).",
        "all_good": "All good: nothing runs out before its next delivery and nothing is stuck.",
        "reorder": "*Reorder today* · {v}",
        "more": "+ {n} more",
        "on_order": "{n} already on an open order.",
        "yesterday": "Yesterday: {n} · {v}.",
        "no_sales": "No sales yesterday.",
        "cta_order": "Tap *Approve order* to draft these purchase orders, or reply with any command, like \"sold 2 Galaxy S24\".",
        "cta": "Reply with any command, like \"what's running low?\", or *help* to see what I can do.",
        "b_approve": "Approve order", "b_stuck": "Stuck stock", "b_skip": "Not today",
        "product": "product", "sale": "sale",
        "skip": "Okay, no order today. Tomorrow's brief comes at {time}.",
        "changed": "The numbers changed since the brief, so here is the order as it stands now:",
        "stuck_link": "Ideas to free this cash are on Paisa Radar: {link}",
        "help": ("*StockWaves on WhatsApp*\nSend a command the way you'd tell your staff:\n"
                 "• reorder iPhone 15 Pro\n• add 20 USB-C Hub at 2200\n• sold 2 Galaxy S24\n• what's running low?\n"
                 "• set price of iPad Air 5 to 61900\n\n"
                 "You'll see exactly what will change, and nothing happens until you tap *Confirm*. "
                 "Reply *brief* for today's numbers, *undo* to reverse your last action, *stop* to pause the morning brief."),
        "stopped": "Morning brief paused. Reply *start* to turn it back on. Commands still work.",
        "started": "Morning brief is on. It comes every day at {time}.",
        "unknown": "This number isn't linked to a StockWaves account. Ask the shop admin to add it on the WhatsApp page of the app.",
        "voice": "Voice notes aren't supported yet. Please type the command, like \"sold 2 Galaxy S24\".",
        "media": "I can only read text for now. To add stock from a bill photo, use Stock in in the app: {link}",
        "nothing_to_undo": "There's nothing to undo from WhatsApp in the last day.",
        "nothing_pending": "There's nothing waiting for your OK. Send a command first.",
        "not_found": "That message is too old or wasn't for you. Reply *brief* for today's numbers.",
        "expired": "That preview was more than 15 minutes old, so here are fresh numbers:",
        "failed": "Couldn't do that: {e}",
        "cancelled": "Cancelled. Nothing changed.",
        "confirm_hint": "Tap *Confirm* to go ahead, or reply *yes*.",
        "open": "Open it in the app: {link}",
        "b_confirm": "Confirm", "b_cancel": "Cancel", "b_undo": "Undo",
        "done_po": "Done: drafted {numbers} · {v} at cost. They're drafts: send them to suppliers from Purchase orders: {link}",
        "done": "Done: {title}.",
        "undone": "Undone: {title}.",
    },
    "hi": {
        "hello": "*Good morning, {name}*\nAaj ka hisaab, {date}.",
        "stock": "Dukaan mein *{v}* ka maal hai (cost pe).",
        "risk": "*{v}* ki sale khatre mein: {n} agli delivery se pehle khatam ho jayenge.",
        "stuck": "*{v}* ka maal atka hai: 60+ din se nahi bika ({names}).",
        "all_good": "Sab theek hai: koi item delivery se pehle khatam nahi hoga, aur kuch atka nahi hai.",
        "reorder": "*Aaj mangao* · {v}",
        "more": "+ {n} aur",
        "on_order": "{n} pehle se open order mein hai.",
        "yesterday": "Kal: {n} · {v}.",
        "no_sales": "Kal koi sale nahi hui.",
        "cta_order": "PO banane ke liye *Order approve* dabao, ya koi bhi command bhejo, jaise \"2 Galaxy S24 beche\".",
        "cta": "Koi bhi command bhejo, jaise \"kya khatam hone wala hai?\", ya *help* likho.",
        "b_approve": "Order approve", "b_stuck": "Atka maal", "b_skip": "Aaj nahi",
        "product": "item", "sale": "sale",
        "skip": "Theek hai, aaj order nahi. Kal ka hisaab {time} baje aayega.",
        "changed": "Brief ke baad numbers badal gaye, isliye abhi ka order yeh hai:",
        "stuck_link": "Yeh paisa nikalne ke ideas Paisa Radar pe hain: {link}",
        "help": ("*StockWaves WhatsApp pe*\nCommand waise hi bhejo jaise staff ko bolte ho:\n"
                 "• iPhone 15 Pro mangao\n• 20 USB-C Hub aaye\n• 2 Galaxy S24 beche\n• kya khatam hone wala hai?\n"
                 "• set price of iPad Air 5 to 61900\n\n"
                 "Pehle dikhega kya badlega, aur *Confirm* dabane tak kuch nahi hoga. "
                 "*brief* likho aaj ke numbers ke liye, *undo* pichla kaam wapas lene ke liye, *stop* subah ka brief rokne ke liye."),
        "stopped": "Subah ka brief band. Wapas chalu karne ke liye *start* likho. Commands chalte rahenge.",
        "started": "Subah ka brief chalu hai. Roz {time} baje aayega.",
        "unknown": "Yeh number kisi StockWaves account se juda nahi hai. Admin se app ke WhatsApp page pe number add karwao.",
        "voice": "Voice note abhi nahi samajh sakta. Command likh ke bhejo, jaise \"2 Galaxy S24 beche\".",
        "media": "Abhi sirf text samajh sakta hoon. Bill ki photo se stock add karne ke liye app mein Stock in kholo: {link}",
        "nothing_to_undo": "Pichle ek din mein WhatsApp se undo karne ke liye kuch nahi hai.",
        "nothing_pending": "Abhi kuch bhi aapke OK ka intezaar nahi kar raha. Pehle command bhejo.",
        "not_found": "Yeh message purana hai ya aapke liye nahi tha. Aaj ke numbers ke liye *brief* likho.",
        "expired": "Woh preview 15 minute se purana tha, isliye naye numbers yeh hain:",
        "failed": "Nahi ho paya: {e}",
        "cancelled": "Cancel kar diya. Kuch nahi badla.",
        "confirm_hint": "Aage badhne ke liye *Confirm* dabao, ya *haan* likho.",
        "open": "App mein kholo: {link}",
        "b_confirm": "Confirm", "b_cancel": "Cancel", "b_undo": "Undo",
        "done_po": "Ho gaya: {numbers} draft ban gaye · {v} cost pe. Yeh drafts hain: supplier ko Purchase orders se bhejo: {link}",
        "done": "Ho gaya: {title}.",
        "undone": "Wapas le liya: {title}.",
    },
}

HELP_WORDS = {"help", "hi", "hello", "hey", "menu", "namaste", "hii", "?"}
BRIEF_WORDS = {"brief", "report", "summary", "hisab", "hisaab", "today", "aaj ka hisaab", "aaj ka hisab"}
UNDO_WORDS = {"undo", "wapas", "wapas lo", "undo karo"}
STOP_WORDS = {"stop", "unsubscribe", "pause", "band karo"}
START_WORDS = {"start", "resume", "chalu karo"}
YES_WORDS = {"yes", "y", "haan", "han", "ha", "ok", "okay", "confirm", "done", "theek hai", "kar do"}
NO_WORDS = {"no", "n", "nahi", "nahin", "cancel", "mat karo", "rehne do"}


def _t(lang: str, key: str, **kw) -> str:
    return TEXT.get(lang, TEXT["en"])[key].format(**kw)


# ------------------------------------------------------------------ the brief

async def compose_brief(db: AsyncSession, user: User, lang: str, brief_id: int | None = None) -> dict:
    """The morning message: what's in stock, what runs out, what's stuck, what to order, yesterday's sales."""
    radar = await compute_radar(db)
    po = await commands.plan_purchase(db, REORDER_ALL, {"kind": "draft_purchase_order", "all_low": True})
    lines = po.get("lines") or []
    t = radar["totals"]
    today = datetime.now(timezone.utc).astimezone(LOCAL_TZ).date()

    since = datetime.now(timezone.utc) - timedelta(days=3)
    rows = (await db.execute(select(Sale.date, Sale.total_price).where(Sale.date >= since))).all()
    y_rows = [total for d, total in rows
              if (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).astimezone(LOCAL_TZ).date() == today - timedelta(days=1)]

    word = TEXT.get(lang, TEXT["en"])
    parts = [_t(lang, "hello", name=_first_name(user), date=_date_label(today)), ""]
    parts.append(_t(lang, "stock", v=rupees_short(t["inventory_value"])))
    if radar["reorder"]:
        parts.append(_t(lang, "risk", v=rupees_short(t["at_risk_value"]), n=_plural(len(radar["reorder"]), word["product"])))
    if radar["dead"]:
        names = ", ".join(d["name"] for d in radar["dead"][:2]) + (f" +{len(radar['dead']) - 2}" if len(radar["dead"]) > 2 else "")
        parts.append(_t(lang, "stuck", v=rupees_short(t["stuck_value"]), names=names))
    if not radar["reorder"] and not radar["dead"]:
        parts.append(_t(lang, "all_good"))

    if lines:
        total = sum(l["total"] for l in lines)
        parts += ["", _t(lang, "reorder", v=rupees_short(total))]
        for l in lines[:5]:
            unit = next((r["unit"] for r in radar["items"] if r["id"] == l["product_id"]), "pcs")
            parts.append(f"• {l['product']}: {l['qty']} {unit} · {rupees_short(l['total'])}")
        if len(lines) > 5:
            parts.append(_t(lang, "more", n=len(lines) - 5))
    skipped = len([r for r in radar["reorder"] if r["suggested_qty"] > 0]) - len(lines)
    if skipped > 0:
        parts.append(_t(lang, "on_order", n=_plural(skipped, word["product"])))

    parts.append("")
    parts.append(_t(lang, "yesterday", n=_plural(len(y_rows), word["sale"]), v=rupees_short(sum(y_rows))) if y_rows
                 else _t(lang, "no_sales"))
    parts += ["", _t(lang, "cta_order" if lines else "cta")]

    buttons = []
    ref = brief_id or 0
    if lines:
        buttons.append({"id": f"approve:{ref}", "title": word["b_approve"]})
    if radar["dead"] or radar["slow"]:
        buttons.append({"id": f"stuck:{ref}", "title": word["b_stuck"]})
    if lines:
        buttons.append({"id": f"skip:{ref}", "title": word["b_skip"]})

    text = "\n".join(parts)
    if len(text) > BODY_LIMIT:
        text = text[:BODY_LIMIT - 1] + "…"
    # Template variables can't hold line breaks; these fill the approved template's {{1}}..{{4}}.
    risk = (f"{_plural(len(radar['reorder']), 'product')}, {rupees_short(t['at_risk_value'])} of sales at risk"
            if radar["reorder"] else "nothing")
    stuck = f"{rupees_short(t['stuck_value'])} in {_plural(len(radar['dead']), 'product')}" if radar["dead"] else "nothing"
    return {
        "text": text, "buttons": buttons,
        "snapshot": sorted([l["product_id"], l["qty"]] for l in lines),
        "template_params": [_date_label(today), rupees_short(t["inventory_value"]), risk, stuck],
    }


# ------------------------------------------------------------------ sending

def _meta_error(data: dict, status: int) -> str:
    err = (data or {}).get("error") or {}
    code = err.get("code")
    known = {
        190: "The WhatsApp access token is invalid or has expired. Create a new one in Meta and update WHATSAPP_TOKEN.",
        131030: "This number isn't on the test recipient list of your Meta app. Add it in WhatsApp > API Setup.",
        131047: "More than 24 hours since this person last messaged, so WhatsApp needs the brief template.",
        132001: "The brief template wasn't found. Check WHATSAPP_BRIEF_TEMPLATE and its language.",
        131026: "WhatsApp couldn't deliver to this number. Check that it has WhatsApp.",
        10: "The access token doesn't have permission to send from this number.",
    }
    if code in known:
        return known[code]
    detail = err.get("error_data", {}).get("details") or err.get("message") or f"HTTP {status}"
    return f"WhatsApp said: {detail}" + (f" (code {code})" if code else "")


async def _post(msg: WhatsAppMessage, payload: dict) -> None:
    url = f"https://graph.facebook.com/{settings.WHATSAPP_GRAPH_VERSION}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    try:
        async with httpx.AsyncClient(timeout=15, transport=_transport) as client:
            r = await client.post(url, json=payload, headers={"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"})
        try:
            data = r.json()
        except ValueError:
            data = {}
        if r.status_code >= 400:
            msg.status, msg.error = "failed", _meta_error(data, r.status_code)
        else:
            msg.status = "sent"
            msg.wa_id = ((data.get("messages") or [{}])[0]).get("id")
    except httpx.HTTPError as e:
        msg.status, msg.error = "failed", f"Couldn't reach WhatsApp ({e.__class__.__name__}). It will not be retried."


def _payload(phone: str, body: str, buttons: list | None) -> dict:
    base = {"messaging_product": "whatsapp", "recipient_type": "individual", "to": phone}
    if buttons:
        return {**base, "type": "interactive", "interactive": {
            "type": "button", "body": {"text": body[:BODY_LIMIT]},
            "action": {"buttons": [{"type": "reply", "reply": {"id": b["id"][:256], "title": b["title"][:20]}} for b in buttons[:3]]},
        }}
    return {**base, "type": "text", "text": {"preview_url": False, "body": body[:TEXT_LIMIT]}}


async def send_message(db: AsyncSession, user: User | None, body: str, *, buttons: list | None = None, kind: str = "reply",
                       action_id: int | None = None, brief_id: int | None = None, simulated: bool = False,
                       phone: str | None = None) -> WhatsAppMessage:
    phone = phone or (user.phone if user else None)
    if buttons and len(body) > BODY_LIMIT:
        body = body[:BODY_LIMIT - 1] + "…"
    msg = WhatsAppMessage(user_id=user.id if user else None, phone=phone, direction="out", kind=kind, body=body[:TEXT_LIMIT],
                          buttons=json.dumps(buttons[:3]) if buttons else None, status="preview", simulated=simulated,
                          action_id=action_id, brief_id=brief_id)
    db.add(msg)
    if mode() == "live" and not simulated:
        if phone:
            await _post(msg, _payload(phone, body, buttons))
        else:
            msg.status, msg.error = "failed", "No WhatsApp number saved for this person."
    await db.flush()
    return msg


async def in_window(db: AsyncSession, phone: str | None) -> bool:
    if not phone:
        return False
    last = (await db.execute(select(func.max(WhatsAppMessage.created_at)).where(
        WhatsAppMessage.phone == phone, WhatsAppMessage.direction == "in", WhatsAppMessage.simulated.is_not(True)))).scalar()
    if not last:
        return False
    last = last if last.tzinfo else last.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - last < WINDOW


async def send_brief(db: AsyncSession, user: User, *, brief_date=None, simulated: bool = False) -> WhatsAppMessage:
    """Record the brief (unique per person per day when scheduled), then send it the way WhatsApp allows."""
    brief = WhatsAppBrief(user_id=user.id, brief_date=brief_date)
    db.add(brief)
    await db.flush()   # raises IntegrityError if another worker already sent today's
    cfg = await get_settings(db)
    c = await compose_brief(db, user, cfg["language"], brief.id)
    brief.snapshot = json.dumps(c["snapshot"])

    if mode() == "live" and not simulated and not await in_window(db, user.phone):
        if settings.WHATSAPP_BRIEF_TEMPLATE:
            return await _send_template(db, user, brief, c)
        msg = WhatsAppMessage(user_id=user.id, phone=user.phone, direction="out", kind="brief", body=c["text"],
                              buttons=json.dumps(c["buttons"]), status="failed", brief_id=brief.id,
                              error="WhatsApp only allows a free-form message within 24 hours of the person's last message. "
                                    "Ask them to send \"hi\" to the shop number once, or set up the brief template (README).")
        db.add(msg)
        await db.flush()
        return msg
    return await send_message(db, user, c["text"], buttons=c["buttons"] or None, kind="brief", brief_id=brief.id, simulated=simulated)


async def _send_template(db: AsyncSession, user: User, brief: WhatsAppBrief, c: dict) -> WhatsAppMessage:
    p = c["template_params"]
    buttons = [{"id": f"brief:{brief.id}", "title": "Show brief"}, {"id": f"approve:{brief.id}", "title": "Approve order"}]
    body = (f"Good morning. Your StockWaves brief for {p[0]}:\nStock at cost: {p[1]}\nRunning out: {p[2]}\n"
            f"Stuck 60+ days: {p[3]}\nTap below to see the full brief or approve the reorder.")
    msg = WhatsAppMessage(user_id=user.id, phone=user.phone, direction="out", kind="template", body=body,
                          buttons=json.dumps(buttons), status="preview", brief_id=brief.id)
    db.add(msg)
    payload = {
        "messaging_product": "whatsapp", "to": user.phone, "type": "template",
        "template": {
            "name": settings.WHATSAPP_BRIEF_TEMPLATE, "language": {"code": settings.WHATSAPP_TEMPLATE_LANG},
            "components": [
                {"type": "body", "parameters": [{"type": "text", "text": v} for v in p]},
                *({"type": "button", "sub_type": "quick_reply", "index": str(i), "parameters": [{"type": "payload", "payload": b["id"]}]}
                  for i, b in enumerate(buttons)),
            ],
        },
    }
    await _post(msg, payload)
    await db.flush()
    return msg


# ------------------------------------------------------------------ replies

def format_action(a: dict, lang: str) -> str:
    """A command preview or answer as WhatsApp text (*bold*, bullets)."""
    p = a["preview"]
    out = [f"*{p.get('title') or 'Answer'}*"]
    if p.get("summary"):
        out.append(p["summary"])
    if p.get("answer"):
        out.append(p["answer"])
    if p.get("kind") == "draft_purchase_order" and p.get("lines"):
        out += [f"• {l['product']} ({l['supplier']}): {l['qty']} × {inr(l['unit_cost'])} = {inr(l['total'])}" for l in p["lines"][:8]]
    for r in (p.get("rows") or [])[:8]:
        out.append(f"• {r['label']}: {r['value']}" + (f" ({r['detail']})" if r.get("detail") else ""))
    for w in p.get("warnings") or []:
        out.append(f"Note: {w}")
    if p.get("blocking"):
        out.append(p["blocking"])
    if p.get("navigate"):
        out.append(_t(lang, "open", link=_app_link(p["navigate"]["page"])))
    if p.get("suggestions"):
        out.append("Try: " + " · ".join(f"\"{s}\"" for s in p["suggestions"][:4]))
    if a.get("can_execute"):
        out.append(_t(lang, "confirm_hint"))
    text = "\n".join(out)
    return text if len(text) <= BODY_LIMIT else text[:BODY_LIMIT - 1] + "…"


def _done_text(a: dict, lang: str) -> str:
    r = a.get("result") or {}
    if a["kind"] == "draft_purchase_order":
        total = sum(l["total"] for l in a["preview"].get("lines") or [])
        return _t(lang, "done_po", numbers=", ".join(r.get("numbers") or []), v=inr(total), link=_app_link("orders"))
    return _t(lang, "done", title=a["preview"]["title"])


class Replier:
    """Sends replies to one person, in preview when the conversation came from the in-app phone."""

    def __init__(self, db: AsyncSession, user: User | None, lang: str, simulated: bool, phone: str | None):
        self.db, self.user, self.lang, self.simulated, self.phone = db, user, lang, simulated, phone
        self.sent: list[WhatsAppMessage] = []

    async def say(self, body: str, buttons: list | None = None, **kw) -> None:
        self.sent.append(await send_message(self.db, self.user, body, buttons=buttons, simulated=self.simulated,
                                            phone=self.phone, **kw))

    async def action(self, a: dict, intro: str | None = None) -> None:
        body = format_action(a, self.lang)
        if intro:
            body = intro + "\n\n" + body
        buttons = None
        if a.get("can_execute"):
            buttons = [{"id": f"confirm:{a['id']}", "title": _t(self.lang, "b_confirm")},
                       {"id": f"cancel:{a['id']}", "title": _t(self.lang, "b_cancel")}]
        await self.say(body, buttons, action_id=a["id"])

    async def done(self, a: dict) -> None:
        buttons = [{"id": f"undo:{a['id']}", "title": _t(self.lang, "b_undo")}] if a.get("can_undo") else None
        await self.say(_done_text(a, self.lang), buttons, action_id=a["id"])


async def _latest_action(db: AsyncSession, user: User, status: str, since: timedelta) -> AssistantAction | None:
    cutoff = datetime.now(timezone.utc) - since
    return (await db.execute(select(AssistantAction).where(
        AssistantAction.user_id == user.id, AssistantAction.channel == "whatsapp", AssistantAction.status == status,
        AssistantAction.created_at >= cutoff).order_by(AssistantAction.id.desc()).limit(1))).scalar_one_or_none()


async def _confirm(rp: Replier, action_id: int) -> None:
    db, user = rp.db, rp.user
    try:
        await rp.done(await commands.execute(db, user, action_id))
    except commands.CommandError as e:
        if e.code == "expired":
            old = await db.get(AssistantAction, action_id)
            fresh = await commands.plan(db, user, old.command, channel="whatsapp")
            await rp.action(fresh, intro=_t(rp.lang, "expired"))
        else:
            await rp.say(_t(rp.lang, "failed", e=str(e)))


async def _approve(rp: Replier, brief_id: int) -> None:
    db, user = rp.db, rp.user
    brief = await db.get(WhatsAppBrief, brief_id)
    if not brief or brief.user_id != user.id:
        await rp.say(_t(rp.lang, "not_found"))
        return
    a = await commands.plan(db, user, REORDER_ALL, channel="whatsapp")
    if not a["can_execute"]:
        await rp.action(a)
        return
    now_lines = sorted([l["product_id"], l["qty"]] for l in a["preview"].get("lines") or [])
    created = brief.created_at if brief.created_at.tzinfo else brief.created_at.replace(tzinfo=timezone.utc)
    fresh = datetime.now(timezone.utc) - created < APPROVE_MAX_AGE
    if fresh and now_lines == json.loads(brief.snapshot or "[]"):
        await rp.done(await commands.execute(db, user, a["id"]))   # the tap on the brief is the confirmation
    else:
        await rp.action(a, intro=_t(rp.lang, "changed"))


async def _button(rp: Replier, button_id: str) -> None:
    verb, _, ref = (button_id or "").partition(":")
    ref_id = int(ref) if ref.isdigit() else None
    db, user, lang = rp.db, rp.user, rp.lang
    if ref_id is None and verb not in ("help",):
        await rp.say(_t(lang, "not_found"))
    elif verb == "approve":
        await _approve(rp, ref_id)
    elif verb == "brief":
        c = await compose_brief(db, user, lang, ref_id)
        await rp.say(c["text"], c["buttons"] or None, kind="brief", brief_id=ref_id)
    elif verb == "stuck":
        ans = await commands.answer_from_data(db, "what's stuck")
        a = {"preview": {"title": "Stuck stock" if lang == "en" else "Atka maal", **ans, "suggestions": []}, "can_execute": False}
        await rp.say(format_action(a, lang) + "\n\n" + _t(lang, "stuck_link", link=_app_link("radar")))
    elif verb == "skip":
        cfg = await get_settings(db)
        await rp.say(_t(lang, "skip", time=_time_label(cfg["brief_time"])))
    elif verb == "confirm":
        await _confirm(rp, ref_id)
    elif verb == "cancel":
        try:
            await commands.cancel(db, user, ref_id)
            await rp.say(_t(lang, "cancelled"))
        except commands.CommandError as e:
            await rp.say(_t(lang, "failed", e=str(e)))
    elif verb == "undo":
        try:
            a = await commands.undo(db, user, ref_id)
            await rp.say(_t(lang, "undone", title=a["preview"]["title"]))
        except commands.CommandError as e:
            await rp.say(_t(lang, "failed", e=str(e)))
    else:
        await rp.say(_t(lang, "help"))


async def _text(rp: Replier, text: str) -> None:
    db, user, lang = rp.db, rp.user, rp.lang
    t = re.sub(r"\s+", " ", text.strip().lower()).strip(" .!")
    if t in HELP_WORDS:
        await rp.say(_t(lang, "help"))
    elif t in BRIEF_WORDS:
        rp.sent.append(await send_brief(db, user, simulated=rp.simulated))
    elif t in STOP_WORDS:
        user.whatsapp_brief = False
        await rp.say(_t(lang, "stopped"))
    elif t in START_WORDS:
        user.whatsapp_brief = True
        cfg = await get_settings(db)
        await rp.say(_t(lang, "started", time=_time_label(cfg["brief_time"])))
    elif t in UNDO_WORDS:
        a = await _latest_action(db, user, "done", timedelta(days=1))
        if not a:
            await rp.say(_t(lang, "nothing_to_undo"))
        else:
            await _button(rp, f"undo:{a.id}")
    elif t in YES_WORDS:
        a = await _latest_action(db, user, "proposed", timedelta(hours=12))
        await (_confirm(rp, a.id) if a else rp.say(_t(lang, "nothing_pending")))
    elif t in NO_WORDS:
        a = await _latest_action(db, user, "proposed", timedelta(hours=12))
        await (_button(rp, f"cancel:{a.id}") if a else rp.say(_t(lang, "nothing_pending")))
    else:
        try:
            await rp.action(await commands.plan(db, user, text[:300], channel="whatsapp"))
        except commands.CommandError as e:
            await rp.say(_t(lang, "failed", e=str(e)))


async def handle_incoming(db: AsyncSession, user: User | None, *, phone: str | None, text: str | None = None,
                          button_id: str | None = None, button_title: str | None = None, media: str | None = None,
                          simulated: bool = False, wa_id: str | None = None) -> list[WhatsAppMessage]:
    """One message from a person: log it, work out what they want, reply."""
    phone = phone or (user.phone if user else None)
    db.add(WhatsAppMessage(user_id=user.id if user else None, phone=phone, direction="in",
                           kind="button" if button_id else ("media" if media else "text"),
                           body=(button_title or button_id) if button_id else (text or f"[{media}]"),
                           status="received", simulated=simulated, wa_id=wa_id))
    if wa_id:
        await db.commit()   # record it before replying, so a redelivery of the same message is skipped
    else:
        await db.flush()
    lang = (await get_settings(db))["language"]
    rp = Replier(db, user, lang, simulated, phone)
    if user is None:
        # Reply once a day at most, so a stranger can't keep the bot talking.
        recent = (await db.execute(select(WhatsAppMessage.id).where(
            WhatsAppMessage.phone == phone, WhatsAppMessage.direction == "out",
            WhatsAppMessage.created_at >= datetime.now(timezone.utc) - timedelta(hours=24)).limit(1))).first()
        if not recent:
            await rp.say(_t(lang, "unknown"))
    elif media == "audio":
        await rp.say(_t(lang, "voice"))
    elif media:
        await rp.say(_t(lang, "media", link=_app_link("stockin")))
    elif button_id:
        await _button(rp, button_id)
    else:
        await _text(rp, text or "")
    return rp.sent


# ------------------------------------------------------------------ webhooks

STATUS_ORDER = {"preview": 0, "sent": 1, "delivered": 2, "read": 3}


async def process_webhook(db: AsyncSession, payload: dict) -> None:
    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            number_id = (value.get("metadata") or {}).get("phone_number_id")
            if settings.WHATSAPP_PHONE_NUMBER_ID and number_id and number_id != settings.WHATSAPP_PHONE_NUMBER_ID:
                continue  # meant for another number on the same Meta app

            for st in value.get("statuses") or []:
                msg = (await db.execute(select(WhatsAppMessage).where(
                    WhatsAppMessage.wa_id == st.get("id"), WhatsAppMessage.direction == "out"))).scalar_one_or_none()
                if not msg:
                    continue
                new = st.get("status")
                if new == "failed":
                    err = (st.get("errors") or [{}])[0]
                    msg.status = "failed"
                    msg.error = _meta_error({"error": {"code": err.get("code"), "message": err.get("title"),
                                                       "error_data": err.get("error_data") or {}}}, 400)
                elif STATUS_ORDER.get(new, -1) > STATUS_ORDER.get(msg.status, 99):
                    msg.status = new

            for m in value.get("messages") or []:
                wa_id = m.get("id")
                if wa_id and (await db.execute(select(WhatsAppMessage.id).where(
                        WhatsAppMessage.wa_id == wa_id, WhatsAppMessage.direction == "in"))).first():
                    continue  # Meta retries deliveries; handle each message once
                phone = re.sub(r"\D", "", m.get("from") or "")
                user = (await db.execute(select(User).where(User.phone == phone, User.is_active.is_(True)))).scalars().first()
                kind = m.get("type")
                kw = {}
                if kind == "text":
                    kw["text"] = (m.get("text") or {}).get("body", "")
                elif kind == "interactive":
                    i = m.get("interactive") or {}
                    reply = i.get("button_reply") or i.get("list_reply") or {}
                    kw["button_id"], kw["button_title"] = reply.get("id"), reply.get("title")
                elif kind == "button":   # quick reply on a template
                    b = m.get("button") or {}
                    kw["button_id"], kw["button_title"] = b.get("payload"), b.get("text")
                else:
                    kw["media"] = kind or "unknown"
                await handle_incoming(db, user, phone=phone, wa_id=wa_id, **kw)


# ------------------------------------------------------------------ the morning schedule

def next_brief_at(cfg: dict, now: datetime | None = None) -> datetime | None:
    if not cfg.get("brief_enabled"):
        return None
    local = (now or datetime.now(timezone.utc)).astimezone(LOCAL_TZ)
    h, m = (int(x) for x in cfg["brief_time"].split(":"))
    at = local.replace(hour=h, minute=m, second=0, microsecond=0)
    if at <= local:
        at += timedelta(days=1)
    while cfg.get("brief_days") == "mon-sat" and at.weekday() == 6:
        at += timedelta(days=1)
    return at


async def run_due_briefs(session_factory, now: datetime | None = None) -> int:
    """Send today's brief to everyone who wants it, if it's time. Safe to call every minute from every worker."""
    now = now or datetime.now(timezone.utc)
    local = now.astimezone(LOCAL_TZ)
    async with session_factory() as db:
        cfg = await get_settings(db)
        if not cfg["brief_enabled"] or (cfg["brief_days"] == "mon-sat" and local.weekday() == 6):
            return 0
        h, m = (int(x) for x in cfg["brief_time"].split(":"))
        due = local.replace(hour=h, minute=m, second=0, microsecond=0)
        if not due <= local < due + timedelta(hours=3):   # after a long outage, skip rather than send at night
            return 0
        done = set((await db.execute(select(WhatsAppBrief.user_id).where(WhatsAppBrief.brief_date == local.date()))).scalars())
        ids = [u for u in (await db.execute(select(User.id).where(
            User.whatsapp_brief.is_(True), User.is_active.is_(True), User.phone.is_not(None)))).scalars() if u not in done]
    sent = 0
    for uid in ids:
        async with session_factory() as db:
            try:
                user = await db.get(User, uid)
                await send_brief(db, user, brief_date=local.date())
                await db.commit()
                sent += 1
            except IntegrityError:
                await db.rollback()   # another worker got there first
            except Exception:
                await db.rollback()
                logger.exception("Couldn't send the WhatsApp brief to user %s", uid)
    if sent:
        logger.info("Sent %d WhatsApp brief(s)", sent)
    return sent


async def scheduler_loop(session_factory) -> None:
    await asyncio.sleep(15)
    while True:
        try:
            await run_due_briefs(session_factory)
        except Exception:
            logger.exception("WhatsApp brief scheduler failed; trying again in a minute")
        await asyncio.sleep(60)
