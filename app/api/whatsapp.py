"""WhatsApp brief: settings, recipients, the in-app phone preview, and Meta's webhook."""
import json
import logging
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.deps import ADMINS, ANY_USER, MANAGERS
from app.models.schema import User, WhatsAppMessage
from app.services import whatsapp

logger = logging.getLogger(__name__)
router = APIRouter()


class SettingsIn(BaseModel):
    brief_enabled: bool | None = None
    brief_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    brief_days: Literal["daily", "mon-sat"] | None = None
    language: Literal["en", "hi"] | None = None


class RecipientIn(BaseModel):
    phone: str | None = Field(default=None, max_length=24)
    whatsapp_brief: bool | None = None


class SimulateIn(BaseModel):
    text: str | None = Field(default=None, max_length=300)
    button_id: str | None = Field(default=None, max_length=64)
    button_title: str | None = Field(default=None, max_length=40)


class BriefIn(BaseModel):
    user_id: int | None = None
    preview_only: bool = True


def message_out(m: WhatsAppMessage) -> dict:
    return {"id": m.id, "user_id": m.user_id, "phone": m.phone, "direction": m.direction, "kind": m.kind, "body": m.body,
            "buttons": json.loads(m.buttons) if m.buttons else [], "status": m.status, "simulated": bool(m.simulated),
            "error": m.error, "action_id": m.action_id, "brief_id": m.brief_id, "created_at": m.created_at}


async def _recipients(db: AsyncSession, me: User) -> list[dict]:
    q = select(User).where(User.is_active.is_(True)).order_by(User.name)
    if me.role != "admin":
        q = q.where(User.id == me.id)
    users = (await db.execute(q)).scalars().all()
    last = {}
    if users:
        sub = (select(WhatsAppMessage.user_id, func.max(WhatsAppMessage.id).label("mid"))
               .where(WhatsAppMessage.kind.in_(("brief", "template")), WhatsAppMessage.simulated.is_not(True),
                      WhatsAppMessage.user_id.in_([u.id for u in users]))
               .group_by(WhatsAppMessage.user_id).subquery())
        for m in (await db.execute(select(WhatsAppMessage).join(sub, WhatsAppMessage.id == sub.c.mid))).scalars():
            last[m.user_id] = {"status": m.status, "at": m.created_at, "error": m.error}
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role, "phone": u.phone,
             "whatsapp_brief": bool(u.whatsapp_brief), "last_brief": last.get(u.id)} for u in users]


@router.get("/status")
async def status(request: Request, me: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    cfg = await whatsapp.get_settings(db)
    nxt = whatsapp.next_brief_at(cfg)
    return {
        "mode": whatsapp.mode(),
        "configured": {
            "token": bool(settings.WHATSAPP_TOKEN), "phone_number_id": bool(settings.WHATSAPP_PHONE_NUMBER_ID),
            "app_secret": bool(settings.WHATSAPP_APP_SECRET), "verify_token": bool(settings.WHATSAPP_VERIFY_TOKEN),
            "template": settings.WHATSAPP_BRIEF_TEMPLATE or None,
        },
        "webhook_url": whatsapp.webhook_url(str(request.base_url)),
        "graph_version": settings.WHATSAPP_GRAPH_VERSION,
        "settings": cfg,
        "next_brief_at": nxt,
        "can_edit": me.role == "admin",
        "me": me.id,
        "recipients": await _recipients(db, me),
    }


@router.put("/settings")
async def update_settings(body: SettingsIn, _: User = ADMINS, db: AsyncSession = Depends(get_db)):
    cfg = await whatsapp.save_settings(db, body.model_dump(exclude_none=True))
    return {"settings": cfg, "next_brief_at": whatsapp.next_brief_at(cfg)}


@router.put("/recipients/{user_id}")
async def update_recipient(user_id: int, body: RecipientIn, me: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    if me.id != user_id and me.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can change someone else's WhatsApp settings")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    fields = body.model_fields_set
    if "phone" in fields:
        try:
            phone = whatsapp.normalise_phone(body.phone)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        if phone:
            taken = (await db.execute(select(User.name).where(User.phone == phone, User.id != user_id))).scalar()
            if taken:
                raise HTTPException(status_code=409, detail=f"This number is already saved for {taken}")
        user.phone = phone
        if not phone:
            user.whatsapp_brief = False
    if "whatsapp_brief" in fields and body.whatsapp_brief is not None:
        if body.whatsapp_brief and not user.phone:
            raise HTTPException(status_code=400, detail="Add a WhatsApp number first")
        user.whatsapp_brief = body.whatsapp_brief
    await db.flush()
    return {"id": user.id, "phone": user.phone, "whatsapp_brief": bool(user.whatsapp_brief)}


@router.get("/thread")
async def thread(user_id: int | None = None, me: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    uid = user_id or me.id
    if uid != me.id and me.role != "admin":
        raise HTTPException(status_code=403, detail="You can only see your own conversation")
    rows = (await db.execute(select(WhatsAppMessage).where(WhatsAppMessage.user_id == uid)
                             .order_by(WhatsAppMessage.id.desc()).limit(60))).scalars().all()
    return [message_out(m) for m in reversed(rows)]


@router.get("/messages")
async def messages(_: User = ADMINS, db: AsyncSession = Depends(get_db)):
    """Recent real messages (not the in-app preview), for checking delivery."""
    rows = (await db.execute(select(WhatsAppMessage, User.name).outerjoin(User, User.id == WhatsAppMessage.user_id)
                             .where(WhatsAppMessage.simulated.is_not(True))
                             .order_by(WhatsAppMessage.id.desc()).limit(100))).all()
    return [{**message_out(m), "user_name": name} for m, name in rows]


@router.post("/simulate")
async def simulate(body: SimulateIn, me: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    """A message or button tap from the in-app phone. Same handling as WhatsApp; replies stay in the app."""
    if not (body.text or "").strip() and not body.button_id:
        raise HTTPException(status_code=400, detail="Type a message")
    sent = await whatsapp.handle_incoming(db, me, phone=me.phone, text=body.text, button_id=body.button_id,
                                          button_title=body.button_title, simulated=True)
    return [message_out(m) for m in sent]


@router.post("/brief/send")
async def send_brief(body: BriefIn, me: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    uid = body.user_id or me.id
    if uid != me.id and me.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can send the brief to someone else")
    user = await db.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    real = not body.preview_only and whatsapp.mode() == "live"
    if real and not user.phone:
        raise HTTPException(status_code=400, detail=f"Add a WhatsApp number for {user.name} first")
    msg = await whatsapp.send_brief(db, user, simulated=not real)
    return message_out(msg)


# ------------------------------------------------------------------ Meta webhook (public, signed)

@router.get("/webhook", include_in_schema=False)
async def verify(mode: str = Query("", alias="hub.mode"), token: str = Query("", alias="hub.verify_token"),
                 challenge: str = Query("", alias="hub.challenge")):
    """Meta calls this once when you save the webhook URL, to check you own it."""
    if mode == "subscribe" and settings.WHATSAPP_VERIFY_TOKEN and token == settings.WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(challenge)
    raise HTTPException(status_code=403, detail="Verify token doesn't match WHATSAPP_VERIFY_TOKEN")


async def _process(payload: dict) -> None:
    async with AsyncSessionLocal() as db:
        try:
            await whatsapp.process_webhook(db, payload)
            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("Couldn't handle a WhatsApp webhook")


@router.post("/webhook", include_in_schema=False)
async def receive(request: Request, background: BackgroundTasks):
    raw = await request.body()
    if not whatsapp.verify_signature(raw, request.headers.get("x-hub-signature-256")):
        raise HTTPException(status_code=403, detail="Bad or missing signature (check WHATSAPP_APP_SECRET)")
    try:
        payload = json.loads(raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="Body is not JSON")
    # Answer Meta straight away and reply after: a slow answer (an AI-read command) would make Meta
    # deliver the same message again. Each message is also handled only once (see process_webhook).
    background.add_task(_process, payload)
    return {"ok": True}
