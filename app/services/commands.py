"""Command bar engine: understand a typed command, preview it, run it on confirm, undo it.

Understanding happens in two layers:
  1. Rules for the everyday commands ("reorder iPhones", "add 20 USB-C Hub at 2200",
     "sold 2 Galaxy S24", "set price of iPad Air 5 to 61900", a few Hinglish forms).
     These need no AI key and are instant.
  2. An AI model for anything else, including questions, when a key is configured.

Nothing changes until the person confirms the preview. Every command is logged in
assistant_actions with the preview they saw and what ran, and executed actions can be undone.
"""
import json
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schema import (
    AssistantAction, Product, PurchaseOrder, PurchaseOrderLine, Sale, Supplier, User,
)
from app.services import llm, matching
from app.services.radar import compute_radar
from app.services.sales import create_sale, unit_price_for, void_sale
from app.services.stock import record_movement

MANAGE_KINDS = {"draft_purchase_order", "adjust_stock", "update_price"}
EXECUTABLE = MANAGE_KINDS | {"record_sale"}
PROPOSAL_TTL = timedelta(minutes=15)
PAGES = {
    "today": "Today", "products": "Products", "sales": "Sales", "stockin": "Stock in", "ledger": "Stock ledger",
    "radar": "Paisa Radar", "orders": "Purchase orders", "dashboard": "Analytics", "categories": "Categories",
    "suppliers": "Suppliers", "team": "Team", "import": "Import data", "assistant": "Assistant",
}
EXAMPLES = [
    "reorder everything running low", "reorder iPhone 15 Pro", "order 10 Galaxy S24 from Samsung",
    "add 20 USB-C Hub at 2200", "sold 2 Galaxy S24", "return 1 iPad Air 5", "damaged 1 HP Pavilion 15",
    "set price of iPad Air 5 to 61900", "set stock of Vivo V12 to 18", "what's running low?",
]


class CommandError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


# ------------------------------------------------------------------ formatting

def inr(n) -> str:
    n = float(n or 0)
    sign = "-" if n < 0 else ""
    digits = str(int(round(abs(n))))
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        digits = ",".join(groups) + "," + tail
    return f"{sign}₹{digits}"


def _num(s) -> float | None:
    if s is None:
        return None
    m = re.search(r"\d+(?:\.\d+)?", str(s).replace(",", ""))
    return float(m.group()) if m else None


# ------------------------------------------------------------------ rules

Q = r"(?P<qty>\d+)"
UNITS = r"(?:\s*(?:x|pcs|pieces|units?|nos)\b\.?)?\s*(?:of\s+)?"
MONEY = r"(?:rs\.?|₹|inr)?\s*(?P<val>[\d,]+(?:\.\d+)?)"
COST = r"(?:rs\.?|₹|inr)?\s*(?P<cost>[\d,]+(?:\.\d+)?)"
PRICE_FIELD = r"(?P<field>selling\s+price|sale\s+price|price|mrp|cost\s+price|purchase\s+price|cost)"


def _field(word: str) -> str:
    return "cost_price" if word.lower().startswith(("cost", "purchase")) else "price"


RULES = [
    (r"^(?:re-?order|restock|order)\s+(?:all|everything)(?:\s+(?:that'?s\s+|that\s+is\s+)?(?:low|running\s+low|running\s+out))?$",
     lambda m: {"kind": "draft_purchase_order", "all_low": True}),
    (r"^(?:re-?order|restock)\s+(?:all\s+)?(?:low(?:\s+stock)?|what'?s\s+(?:low|running\s+(?:low|out))|whatever'?s\s+low)$",
     lambda m: {"kind": "draft_purchase_order", "all_low": True}),
    (r"^" + Q + r"\s+(?P<what>.+?)\s+(?:mangao|mangwao|mangwa\s+do|order\s+karo|order\s+kar\s+do)$",
     lambda m: {"kind": "draft_purchase_order", "items": [{"query": m["what"], "qty": int(m["qty"])}]}),
    (r"^(?P<what>.+?)\s+(?:mangao|mangwao|mangwa\s+do|re-?order\s+karo|order\s+karo)$",
     lambda m: {"kind": "draft_purchase_order", "items": [{"query": m["what"], "qty": None}], "supplier_query": m["what"]}),
    (r"^(?:re-?order|restock|order\s+more(?:\s+of)?)\s+from\s+(?P<sup>.+)$",
     lambda m: {"kind": "draft_purchase_order", "supplier_query": m["sup"]}),
    (r"^(?:re-?order|restock|order\s+more(?:\s+of)?)\s+(?P<what>.+)$",
     lambda m: {"kind": "draft_purchase_order", "items": [{"query": m["what"], "qty": None}], "supplier_query": m["what"]}),
    (r"^(?:order|buy|purchase|po\s+for|po)\s+" + Q + UNITS + r"(?P<what>.+?)(?:\s+from\s+(?P<sup>.+))?$",
     lambda m: {"kind": "draft_purchase_order", "items": [{"query": m["what"], "qty": int(m["qty"])}], "supplier_hint": m["sup"]}),
    (r"^(?:set|change|update|make)?\s*(?:the\s+)?" + PRICE_FIELD + r"\s+(?:of\s+|for\s+)?(?P<what>.+?)\s+(?:to|=|as|at)\s*" + MONEY + r"$",
     lambda m: {"kind": "update_price", "items": [{"query": m["what"]}], "price_field": _field(m["field"]), "new_value": _num(m["val"])}),
    (r"^(?:set|change|update|make)\s+(?P<what>.+?)(?:'s)?\s+" + PRICE_FIELD + r"\s+(?:to|=|as|at)\s*" + MONEY + r"$",
     lambda m: {"kind": "update_price", "items": [{"query": m["what"]}], "price_field": _field(m["field"]), "new_value": _num(m["val"])}),
    (r"^(?:add|received?|stock\s+in|got|arrived)\s+" + Q + UNITS + r"(?P<what>.+?)(?:\s+(?:at|@|for)\s*" + COST + r"(?:\s*(?:each|per\s+unit|/unit|/pc|a\s+piece))?)?$",
     lambda m: {"kind": "adjust_stock", "adjust_type": "purchase", "items": [{"query": m["what"], "qty": int(m["qty"])}], "unit_cost": _num(m["cost"])}),
    (r"^" + Q + r"\s+(?P<what>.+?)\s+(?:aaya|aaye|aa\s+gaye|aagaye|aya|aaye\s+hain)$",
     lambda m: {"kind": "adjust_stock", "adjust_type": "purchase", "items": [{"query": m["what"], "qty": int(m["qty"])}]}),
    (r"^(?:customer\s+)?return(?:ed|s)?\s+" + Q + UNITS + r"(?P<what>.+)$",
     lambda m: {"kind": "adjust_stock", "adjust_type": "return", "items": [{"query": m["what"], "qty": int(m["qty"])}]}),
    (r"^(?P<verb>remove|damaged|broken|lost|expired|write\s*off|minus)\s+" + Q + UNITS + r"(?P<what>.+)$",
     lambda m: {"kind": "adjust_stock", "adjust_type": "adjust", "items": [{"query": m["what"], "qty": -int(m["qty"])}],
                "note": m["verb"].capitalize()}),
    (r"^(?:set|count(?:ed)?|correct|update)\s+(?:(?:the\s+)?stock\s+(?:of\s+|for\s+)?)?(?P<what>.+?)\s+(?:stock\s+|qty\s+|quantity\s+|count\s+)?(?:to|=|is)\s+" + Q + r"(?:\s*(?:pcs|units?))?$",
     lambda m: {"kind": "adjust_stock", "adjust_type": "adjust", "set_absolute": True, "items": [{"query": m["what"], "qty": int(m["qty"])}],
                "note": "Stock count"}),
    (r"^(?:sell|sold|sale(?:\s+of)?)\s+" + Q + UNITS + r"(?P<what>.+?)(?:\s+to\s+(?P<cust>.+))?$",
     lambda m: {"kind": "record_sale", "items": [{"query": m["what"], "qty": int(m["qty"])}], "customer": m["cust"]}),
    (r"^" + Q + r"\s+(?P<what>.+?)\s+(?:becha|beche|bika|bik\s+gaye|bike|bech\s+diye)$",
     lambda m: {"kind": "record_sale", "items": [{"query": m["what"], "qty": int(m["qty"])}]}),
    (r"^(?:open|show|see)?\s*(?:the\s+)?(?:stock\s+)?(?:ledger|history)\s+(?:of|for)\s+(?P<what>.+)$",
     lambda m: {"kind": "navigate", "items": [{"query": m["what"]}]}),
    (r"^(?:open|show|see)\s+(?P<what>.+?)\s+(?:ledger|history)$",
     lambda m: {"kind": "navigate", "items": [{"query": m["what"]}]}),
]
_COMPILED = [(re.compile(p, re.IGNORECASE), b) for p, b in RULES]
QUESTION = re.compile(r"(\?\s*$|^(what|which|how|why|when|who|where|is|are|do|does|did|show|list|tell|kitna|kitne|kitni|kaun|kya|konsa|kaunsa)\b)", re.I)


def parse_rules(text: str) -> dict | None:
    t = re.sub(r"\s+", " ", text.strip().rstrip("."))
    page = re.match(r"^(?:open|go\s+to|goto|show)\s+(?P<what>.+)$", t, re.I)
    if page:
        want = matching.normalise(page["what"])
        for pid, label in PAGES.items():
            if want in (matching.normalise(label), pid, matching.normalise(label) + " page"):
                return {"kind": "navigate", "page": pid}
    for rx, build in _COMPILED:
        m = rx.match(t)
        if m:
            return build(m)
    if QUESTION.search(t):
        return {"kind": "answer", "question": t}
    return None


# ------------------------------------------------------------------ resolving names

def resolve(query: str, products: list) -> tuple[Product | None, list[dict]]:
    """A single confident product, or None plus the best candidates."""
    cands = matching.rank(query, products, limit=4)
    by_id = {p.id: p for p in products}
    # Every typed word appears in exactly one product's name ("iPhones" -> iPhone 15 Pro): take it.
    full = [p for p in products if matching.query_coverage(query, p.name, p.sku) == 1.0]
    if len(full) == 1:
        return full[0], cands
    if len(full) > 1:
        scored = sorted(({"product_id": p.id, "name": p.name, "score": matching.score(query, p.name, p.sku), "via": "name"}
                         for p in full), key=lambda c: -c["score"])
        if scored[0]["score"] >= 0.72 and scored[0]["score"] - scored[1]["score"] >= 0.12:
            return by_id[scored[0]["product_id"]], scored
        return None, scored[:4]
    if not cands:
        return None, []
    top = cands[0]
    second = cands[1]["score"] if len(cands) > 1 else 0
    if top["score"] >= 0.72 and top["score"] - second >= 0.12:
        return by_id[top["product_id"]], cands
    return None, [c for c in cands if c["score"] >= 0.3]


def _clarify(text: str, query: str, cands: list[dict], verb: str) -> dict:
    suggestions = []
    for c in cands[:4]:
        replaced = re.sub(re.escape(query), c["name"], text, count=1, flags=re.I)
        suggestions.append(replaced if replaced != text else f"{verb} {c['name']}")
    msg = (f"Which product did you mean by “{query}”?" if cands
           else f"I couldn't find a product called “{query}”. Check the name on the Products page.")
    return {"kind": "clarify", "title": "Which product?", "summary": msg, "suggestions": suggestions}


# ------------------------------------------------------------------ planning

async def _open_po_products(db: AsyncSession) -> set[int]:
    rows = await db.execute(select(PurchaseOrderLine.product_id).join(PurchaseOrder)
                            .where(PurchaseOrder.status.in_(("draft", "sent"))))
    return set(rows.scalars().all())


async def plan_purchase(db: AsyncSession, text: str, intent: dict) -> dict:
    products = (await db.execute(select(Product))).scalars().all()
    suppliers = {s.id: s for s in (await db.execute(select(Supplier))).scalars()}
    radar = await compute_radar(db)
    rad = {r["id"]: r for r in radar["items"]}
    warnings, picks, suggestions = [], [], []  # picks: (product, qty, reason)

    if intent.get("all_low"):
        for r in radar["reorder"]:
            if r["suggested_qty"] > 0:
                picks.append((next(p for p in products if p.id == r["id"]), r["suggested_qty"], "Paisa Radar suggestion"))
        if not picks:
            return {"kind": "draft_purchase_order", "title": "Nothing to reorder", "blocking":
                    "Paisa Radar says every product lasts until its next delivery."}
    else:
        for item in intent.get("items") or []:
            product = await db.get(Product, item["product_id"]) if item.get("product_id") else None
            if not product and item.get("query"):
                product, cands = resolve(item["query"], products)
                if not product:
                    # "reorder apple" may mean a supplier rather than a product.
                    sup, _ = matching.best_supplier(intent.get("supplier_query"), list(suppliers.values()))
                    if sup:
                        intent = {**intent, "supplier_id": sup.id}
                        continue
                    return _clarify(text, item["query"], cands, "reorder")
            if not product:
                continue
            r = rad.get(product.id, {})
            qty = item.get("qty")
            if qty:
                picks.append((product, int(qty), "as asked"))
            elif r.get("suggested_qty"):
                picks.append((product, r["suggested_qty"], "Paisa Radar suggestion"))
            else:
                left = f"{r['days_of_cover']} days of stock" if r.get("days_of_cover") is not None else f"{product.qty} in stock"
                warnings.append(f"{product.name} doesn't need reordering yet ({left}).")
                suggestions.append(f"order 10 {product.name}")
        sup_id = intent.get("supplier_id")
        if not sup_id and intent.get("supplier_query") and not picks and not warnings:
            sup, _ = matching.best_supplier(intent["supplier_query"], list(suppliers.values()))
            sup_id = sup.id if sup else None
        if sup_id:
            for r in radar["reorder"]:
                if r["supplier_id"] == sup_id and r["suggested_qty"] > 0:
                    picks.append((next(p for p in products if p.id == r["id"]), r["suggested_qty"], "Paisa Radar suggestion"))
            if not picks:
                warnings.append(f"Nothing from {suppliers[sup_id].name} needs reordering right now.")

    pending = await _open_po_products(db)
    lines, skipped = [], []
    for product, qty, reason in picks:
        if product.id in pending:
            skipped.append(product.name)
            continue
        lines.append({"product_id": product.id, "product": product.name, "supplier_id": product.supplier_id,
                      "supplier": suppliers[product.supplier_id].name if product.supplier_id in suppliers else "No supplier",
                      "qty": qty, "unit_cost": product.cost_price or 0, "total": round(qty * (product.cost_price or 0), 2),
                      "reason": reason})
    if skipped:
        warnings.append(f"Already on an open purchase order: {', '.join(skipped)}.")
    if not lines:
        return {"kind": "draft_purchase_order", "title": "Nothing to order", "warnings": warnings[1:],
                "blocking": warnings[0] if warnings else "Nothing matched that command.", "suggestions": suggestions}
    groups = {}
    for l in lines:
        groups.setdefault(l["supplier_id"], []).append(l)
    total = sum(l["total"] for l in lines)
    n = len(groups)
    return {
        "kind": "draft_purchase_order",
        "title": f"Draft {n} purchase order{'s' if n > 1 else ''}",
        "summary": f"{sum(l['qty'] for l in lines)} units across {len(lines)} product{'s' if len(lines) > 1 else ''} · {inr(total)} at cost. Drafts only: nothing is sent to suppliers.",
        "lines": lines, "warnings": warnings,
        "params": {"orders": [{"supplier_id": sid, "lines": [{"product_id": l["product_id"], "qty": l["qty"], "unit_cost": l["unit_cost"]} for l in ls]}
                              for sid, ls in groups.items()]},
    }


async def plan_adjust(db: AsyncSession, text: str, intent: dict) -> dict:
    products = (await db.execute(select(Product))).scalars().all()
    item = (intent.get("items") or [{}])[0]
    product = await db.get(Product, item["product_id"]) if item.get("product_id") else None
    if not product:
        product, cands = resolve(item.get("query") or "", products)
        if not product:
            return _clarify(text, item.get("query") or "", cands, "add 1")
    kind = intent.get("adjust_type") or "adjust"
    qty = int(item.get("qty") or 0)
    change = qty - product.qty if intent.get("set_absolute") else qty
    if change == 0:
        return {"kind": "adjust_stock", "title": "No change", "blocking": f"{product.name} already has {product.qty} in stock."}
    after = product.qty + change
    unit_cost = intent.get("unit_cost") if kind == "purchase" else None
    labels = {"purchase": "Stock in", "return": "Customer return", "adjust": "Stock correction"}
    title = {"purchase": f"Add {change} × {product.name}", "return": f"Return {change} × {product.name} to stock"}.get(
        kind, f"{'Add' if change > 0 else 'Remove'} {abs(change)} × {product.name}")
    warnings = []
    if kind == "purchase" and unit_cost is not None and product.cost_price and abs(unit_cost - product.cost_price) / product.cost_price > 0.25:
        warnings.append(f"New cost {inr(unit_cost)} is far from the current {inr(product.cost_price)}. Check the number.")
    preview = {
        "kind": "adjust_stock", "title": title,
        "summary": f"{labels[kind]} · stock {product.qty} → {after} {product.unit or 'pcs'}" + (f" · cost {inr(unit_cost)} each" if unit_cost else ""),
        "lines": [{"product_id": product.id, "product": product.name, "before": product.qty, "change": change, "after": after,
                   "unit_cost": unit_cost if unit_cost is not None else product.cost_price}],
        "warnings": warnings,
        "params": {"product_id": product.id, "qty_change": change, "type": kind, "unit_cost": unit_cost,
                   "note": intent.get("note") or labels[kind]},
    }
    if after < 0:
        preview["blocking"] = f"Only {product.qty} {product.name} in stock, so you can't remove {abs(change)}."
    return preview


async def plan_sale(db: AsyncSession, text: str, intent: dict) -> dict:
    products = (await db.execute(select(Product))).scalars().all()
    item = (intent.get("items") or [{}])[0]
    product = await db.get(Product, item["product_id"]) if item.get("product_id") else None
    if not product:
        product, cands = resolve(item.get("query") or "", products)
        if not product:
            return _clarify(text, item.get("query") or "", cands, "sold 1")
    qty = int(item.get("qty") or 0)
    if qty <= 0:
        return {"kind": "record_sale", "title": "How many?", "blocking": "Say how many were sold, e.g. “sold 2 Galaxy S24”."}
    price = await unit_price_for(db, product, qty)
    customer = (intent.get("customer") or "").strip() or None
    preview = {
        "kind": "record_sale", "title": f"Record sale: {qty} × {product.name}",
        "summary": f"{inr(price)} each · {inr(price * qty)} total · stock {product.qty} → {product.qty - qty}" + (f" · customer {customer}" if customer else ""),
        "lines": [{"product_id": product.id, "product": product.name, "qty": qty, "unit_price": price, "total": round(price * qty, 2),
                   "before": product.qty, "after": product.qty - qty}],
        "warnings": [],
        "params": {"product_id": product.id, "qty": qty, "customer": customer},
    }
    if qty > product.qty:
        preview["blocking"] = f"Only {product.qty} {product.name} in stock."
    return preview


async def plan_price(db: AsyncSession, text: str, intent: dict) -> dict:
    products = (await db.execute(select(Product))).scalars().all()
    item = (intent.get("items") or [{}])[0]
    product = await db.get(Product, item["product_id"]) if item.get("product_id") else None
    if not product:
        product, cands = resolve(item.get("query") or "", products)
        if not product:
            return _clarify(text, item.get("query") or "", cands, "set price of")
    field = intent.get("price_field") or "price"
    new = intent.get("new_value")
    if new is None or new < 0:
        return {"kind": "update_price", "title": "What price?", "blocking": "Say the new price, e.g. “set price of iPad Air 5 to 61900”."}
    old = getattr(product, field) or 0
    label = "selling price" if field == "price" else "cost price"
    if old == new:
        return {"kind": "update_price", "title": "No change", "blocking": f"The {label} of {product.name} is already {inr(new)}."}
    price = new if field == "price" else product.price or 0
    cost = new if field == "cost_price" else product.cost_price or 0
    margin = round((price - cost) / price * 100, 1) if price else None
    warnings = []
    if price and cost and price < cost:
        warnings.append(f"The selling price would be below cost ({inr(price)} vs {inr(cost)}).")
    if old and abs(new - old) / old > 0.5:
        warnings.append(f"That's a {round((new - old) / old * 100)}% change. Check the number.")
    return {
        "kind": "update_price", "title": f"Change {label} of {product.name}",
        "summary": f"{inr(old)} → {inr(new)}" + (f" · margin becomes {margin}%" if margin is not None else ""),
        "lines": [{"product_id": product.id, "product": product.name, "field": field, "before": old, "after": new, "margin": margin}],
        "warnings": warnings,
        "params": {"product_id": product.id, "field": field, "old": old, "new": new},
    }


async def plan_navigate(db: AsyncSession, text: str, intent: dict) -> dict:
    if intent.get("page") in PAGES:
        return {"kind": "navigate", "title": f"Open {PAGES[intent['page']]}", "navigate": {"page": intent["page"]}}
    products = (await db.execute(select(Product))).scalars().all()
    item = (intent.get("items") or [{}])[0]
    product = await db.get(Product, item["product_id"]) if item.get("product_id") else None
    if not product:
        product, cands = resolve(item.get("query") or "", products)
        if not product:
            return _clarify(text, item.get("query") or "", cands, "open ledger of")
    return {"kind": "navigate", "title": f"Open stock history of {product.name}", "navigate": {"page": "ledger", "product_id": product.id}}


# ------------------------------------------------------------------ answers

async def answer_from_data(db: AsyncSession, question: str) -> dict | None:
    """Common questions answered straight from Paisa Radar, without an AI key."""
    q = question.lower()
    radar = None
    if re.search(r"\b(low|running out|run out|reorder|khatam|order karna)\b", q):
        radar = await compute_radar(db)
        rows = [{"label": r["name"], "value": f"{r['qty']} left · {r['days_of_cover']} days" if r["days_of_cover"] is not None else f"{r['qty']} left",
                 "detail": f"order {r['suggested_qty']} · {inr(r['suggested_cost'])}"} for r in radar["reorder"]]
        text = (f"{len(rows)} product{'s' if len(rows) != 1 else ''} won't last until the next delivery." if rows
                else "Nothing is running low: every product lasts until its next delivery.")
        return {"answer": text, "rows": rows, "suggestions": ["reorder everything running low"] if rows else []}
    if re.search(r"\b(stuck|dead|not sell|not selling|slow|nahi bik|unsold|haven'?t sold|hasn'?t sold|didn'?t sell)\b", q):
        radar = await compute_radar(db)
        items = radar["dead"] + radar["slow"]
        rows = [{"label": r["name"], "value": inr(r["stock_value"]),
                 "detail": f"last sold {r['days_idle']} days ago" if r["status"] == "dead" else f"{r['weeks_of_stock']} weeks of stock"} for r in items]
        text = (f"{inr(sum(r['stock_value'] for r in items))} is tied up in {len(items)} slow or unsold product{'s' if len(items) != 1 else ''}."
                if items else "Nothing is stuck: everything sold in the last 60 days.")
        return {"answer": text, "rows": rows, "suggestions": ["open paisa radar"] if items else []}
    if re.search(r"\b(worth|value|money in stock|inventory value|kitne ka|stock worth|total stock|stock bacha)\b", q):
        radar = await compute_radar(db)
        t = radar["totals"]
        return {"answer": f"Your stock is worth {inr(t['inventory_value'])} at cost ({inr(t['inventory_retail'])} at selling price). "
                          f"{inr(t['stuck_value'])} of it hasn't sold in 60+ days.", "rows": [], "suggestions": []}
    if re.search(r"\b(best|top|most)\b.*\b(sell|sold|selling|bik|bikta)\b|\bbestsell", q):
        since = datetime.now(timezone.utc) - timedelta(days=30)
        rows_ = (await db.execute(select(Product.name, func.sum(Sale.qty), func.sum(Sale.total_price))
                                  .join(Product, Product.id == Sale.product_id).where(Sale.date >= since)
                                  .group_by(Product.name).order_by(func.sum(Sale.total_price).desc()).limit(5))).all()
        rows = [{"label": n, "value": inr(v), "detail": f"{int(u)} sold"} for n, u, v in rows_]
        return {"answer": "Best sellers in the last 30 days, by sales:" if rows else "No sales in the last 30 days.", "rows": rows, "suggestions": []}
    return None


# ------------------------------------------------------------------ AI interpretation

def _nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


AI_SCHEMA = {
    "type": "object",
    "properties": {
        "kind": {"type": "string", "enum": ["draft_purchase_order", "adjust_stock", "record_sale", "update_price", "navigate", "answer", "unsupported"]},
        "items": {"type": "array", "items": {"type": "object", "properties": {
            "product_id": _nullable({"type": "integer"}), "qty": _nullable({"type": "number"})},
            "required": ["product_id", "qty"], "additionalProperties": False}},
        "all_low": {"type": "boolean"},
        "supplier_id": _nullable({"type": "integer"}),
        "adjust_type": _nullable({"type": "string", "enum": ["purchase", "return", "adjust"]}),
        "set_absolute": {"type": "boolean"},
        "unit_cost": _nullable({"type": "number"}),
        "customer": _nullable({"type": "string"}),
        "price_field": _nullable({"type": "string", "enum": ["price", "cost_price"]}),
        "new_value": _nullable({"type": "number"}),
        "page": _nullable({"type": "string", "enum": list(PAGES)}),
        "answer": _nullable({"type": "string"}),
    },
    "required": ["kind", "items", "all_low", "supplier_id", "adjust_type", "set_absolute", "unit_cost", "customer",
                 "price_field", "new_value", "page", "answer"],
    "additionalProperties": False,
}


async def _ai_context(db: AsyncSession) -> str:
    radar = await compute_radar(db)
    suppliers = (await db.execute(select(Supplier))).scalars().all()
    prod_lines = [f"{r['id']} | {r['name']} | sku {r['sku']} | stock {r['qty']} | cost {r['cost_price']:.0f} | price {r['price']:.0f} | "
                  f"supplier {r['supplier_id']} | sold30d {r['sold_30d']} | days_left {r['days_of_cover']} | status {r['status']}"
                  for r in radar["items"][:300]]
    t = radar["totals"]
    return (
        "PRODUCTS (id | name | sku | stock | cost | price | supplier_id | sold in 30 days | days of stock left | status)\n"
        + "\n".join(prod_lines)
        + "\n\nSUPPLIERS (id | name)\n" + "\n".join(f"{s.id} | {s.name}" for s in suppliers)
        + f"\n\nTOTALS: stock at cost {t['inventory_value']:.0f}, stuck 60+ days {t['stuck_value']:.0f}, "
          f"sales this week {t['sales_this_week']:.0f}, last week {t['sales_last_week']:.0f}"
        + f"\nPAGES: {', '.join(PAGES)}"
    )


AI_SYSTEM = """You turn one command typed into an inventory app for an Indian shop into a structured action. Amounts are in rupees. Commands may be English, Hindi or Hinglish.

Pick one kind:
- draft_purchase_order: order or reorder products. items = products with qty (qty null = use the app's suggestion). all_low = true for "reorder everything that's low". supplier_id when they name a supplier.
- adjust_stock: stock arrived (adjust_type "purchase", qty positive, unit_cost if given), customer return ("return"), damage/loss/correction ("adjust", qty negative to remove). set_absolute = true when they give the counted total ("set stock of X to 18").
- record_sale: something was sold. items with qty, customer if given.
- update_price: change selling price ("price") or cost ("cost_price") of one product to new_value.
- navigate: open a page (page) or one product's stock history (items with product_id, page "ledger").
- answer: a question about the shop. Write a short, specific answer in "answer" using only the data below; plain sentences with rupee amounts like ₹1,18,500.
- unsupported: anything else; explain briefly in "answer" what you can do instead.

Use only product_id and supplier_id values from the lists. If you are unsure which product they mean, use unsupported and name the likely options in "answer". Never invent numbers."""


async def interpret_with_ai(db: AsyncSession, text: str) -> tuple[dict, str]:
    data, reader = await llm.complete_json(AI_SYSTEM + "\n\n" + await _ai_context(db), f"Command: {text}", AI_SCHEMA)
    known = set((await db.execute(select(Product.id))).scalars().all())
    items = [{"product_id": i.get("product_id"), "qty": i.get("qty")} for i in (data.get("items") or [])
             if i.get("product_id") in known]
    intent = {k: data.get(k) for k in ("kind", "all_low", "supplier_id", "adjust_type", "set_absolute", "unit_cost",
                                       "customer", "price_field", "new_value", "page", "answer")}
    intent["items"] = items
    if intent["kind"] == "adjust_stock" and items and intent.get("adjust_type") in ("purchase", "return"):
        items[0]["qty"] = abs(items[0]["qty"] or 0)
    return intent, reader


# ------------------------------------------------------------------ entry points

def _role_ok(user: User, kind: str) -> bool:
    return kind not in MANAGE_KINDS or user.role in ("admin", "manager")


async def plan(db: AsyncSession, user: User, text: str) -> dict:
    text = (text or "").strip()
    if not text:
        raise CommandError("Type a command, like “reorder iPhone 15 Pro”.")
    if len(text) > 300:
        raise CommandError("That command is too long. Keep it to one action.")

    intent, reader = parse_rules(text), "rules"
    ai_error = None
    if intent and intent["kind"] == "answer":
        direct = await answer_from_data(db, intent["question"])
        if direct:
            preview = {"kind": "answer", "title": "Answer", **direct}
            return await _save(db, user, text, preview, reader, status="answered")
    if not intent or intent["kind"] == "answer":
        if llm.provider():
            try:
                intent, reader = await interpret_with_ai(db, text)
            except llm.LLMError as e:
                ai_error = str(e)
                intent = None
        if not intent:
            msg = ai_error or ("I can do everyday stock actions without AI. For free-form questions, add an AI key on the server."
                               if not llm.provider() else "I didn't understand that.")
            preview = {"kind": "unsupported", "title": "Try one of these", "summary": msg, "suggestions": EXAMPLES[:6]}
            return await _save(db, user, text, preview, reader, status="answered")

    kind = intent["kind"]
    if kind in ("answer", "unsupported"):
        preview = {"kind": kind, "title": "Answer" if kind == "answer" else "Not something I can do",
                   "answer": intent.get("answer") or "I don't have an answer for that.", "rows": [],
                   "suggestions": [] if kind == "answer" else EXAMPLES[:4]}
        return await _save(db, user, text, preview, reader, status="answered")

    builder = {"draft_purchase_order": plan_purchase, "adjust_stock": plan_adjust, "record_sale": plan_sale,
               "update_price": plan_price, "navigate": plan_navigate}[kind]
    preview = await builder(db, text, intent)
    if preview["kind"] in EXECUTABLE and not _role_ok(user, preview["kind"]):
        preview["blocking"] = "Only managers and admins can do this."
    status = "proposed" if preview["kind"] in EXECUTABLE and "params" in preview and not preview.get("blocking") else "answered"
    return await _save(db, user, text, preview, reader, status=status)


async def _save(db: AsyncSession, user: User, text: str, preview: dict, reader: str, status: str) -> dict:
    params = preview.pop("params", None)
    action = AssistantAction(user_id=user.id, user_name=user.name, command=text, kind=preview["kind"], interpreted_by=reader,
                             plan=json.dumps(params) if params is not None else None, preview=json.dumps(preview, default=str),
                             status=status)
    db.add(action)
    await db.flush()
    return action_out(action)


def action_out(a: AssistantAction) -> dict:
    preview = json.loads(a.preview) if a.preview else {}
    result = json.loads(a.result) if a.result else None
    return {
        "id": a.id, "command": a.command, "kind": a.kind, "status": a.status, "interpreted_by": a.interpreted_by,
        "user_name": a.user_name, "created_at": a.created_at, "executed_at": a.executed_at, "undone_at": a.undone_at,
        "error": a.error, "preview": preview, "result": result,
        "can_execute": a.status == "proposed", "can_undo": a.status == "done" and a.kind in EXECUTABLE,
    }


async def _get(db: AsyncSession, action_id: int, user: User) -> AssistantAction:
    a = await db.get(AssistantAction, action_id)
    if not a:
        raise CommandError("That command wasn't found.", 404)
    if a.user_id != user.id and user.role != "admin":
        raise CommandError("You can only run your own commands.", 403)
    return a


def _aware(dt):
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def execute(db: AsyncSession, user: User, action_id: int) -> dict:
    a = await _get(db, action_id, user)
    if a.status != "proposed":
        raise CommandError(f"This command is already {a.status}.")
    if datetime.now(timezone.utc) - _aware(a.created_at) > PROPOSAL_TTL:
        a.status = "expired"
        raise CommandError("This preview is more than 15 minutes old. Run the command again to get fresh numbers.")
    if not _role_ok(user, a.kind):
        raise CommandError("Only managers and admins can do this.", 403)
    p = json.loads(a.plan)
    result = {}
    if a.kind == "draft_purchase_order":
        ids = []
        for order in p["orders"]:
            po = PurchaseOrder(supplier_id=order["supplier_id"], status="draft", source="command", created_by=user.name,
                               note=f"From the command bar: “{a.command}”")
            po.lines = [PurchaseOrderLine(product_id=l["product_id"], qty=l["qty"], unit_cost=l["unit_cost"]) for l in order["lines"]]
            db.add(po)
            await db.flush()
            ids.append(po.id)
        result = {"po_ids": ids, "numbers": [f"PO-{i:04d}" for i in ids]}
    elif a.kind == "adjust_stock":
        product = await db.get(Product, p["product_id"])
        if not product:
            raise CommandError("That product no longer exists.", 404)
        old_cost = product.cost_price
        if p["type"] == "purchase" and p.get("unit_cost") is not None:
            product.cost_price = p["unit_cost"]
        mv = await record_movement(db, product, p["qty_change"], p["type"], user=user, unit_cost=p.get("unit_cost"),
                                   ref_type="command", ref_id=a.id, note=f"{p['note']} (command bar)")
        await db.flush()
        result = {"movement_id": mv.id, "product_id": product.id, "qty_change": p["qty_change"],
                  "old_cost": old_cost, "new_cost": product.cost_price}
    elif a.kind == "record_sale":
        product = await db.get(Product, p["product_id"])
        if not product:
            raise CommandError("That product no longer exists.", 404)
        sale = await create_sale(db, product, p["qty"], user, p.get("customer"))
        result = {"sale_id": sale.id, "product_id": product.id, "total": sale.total_price}
    elif a.kind == "update_price":
        product = await db.get(Product, p["product_id"])
        if not product:
            raise CommandError("That product no longer exists.", 404)
        if (getattr(product, p["field"]) or 0) != p["old"]:
            raise CommandError("The price changed since this preview. Run the command again.", 409)
        setattr(product, p["field"], p["new"])
        result = {"product_id": product.id, "field": p["field"], "old": p["old"], "new": p["new"]}
    a.status, a.executed_at, a.result = "done", datetime.now(timezone.utc), json.dumps(result)
    await db.flush()
    return action_out(a)


async def undo(db: AsyncSession, user: User, action_id: int) -> dict:
    a = await _get(db, action_id, user)
    if a.status != "done" or a.kind not in EXECUTABLE:
        raise CommandError("Only completed actions can be undone.")
    if not _role_ok(user, a.kind):
        raise CommandError("Only managers and admins can undo this.", 403)
    r = json.loads(a.result)
    if a.kind == "draft_purchase_order":
        pos = [await db.get(PurchaseOrder, i) for i in r["po_ids"]]
        received = [f"PO-{po.id:04d}" for po in pos if po and po.status == "received"]
        if received:
            raise CommandError(f"{', '.join(received)} was already received, so it can't be undone. Correct the stock instead.", 409)
        for po in pos:
            if po and po.status in ("draft", "sent"):
                po.status = "cancelled"
                po.note = (po.note or "") + " · Undone from the command bar"
    elif a.kind == "adjust_stock":
        product = await db.get(Product, r["product_id"])
        if not product:
            raise CommandError("That product no longer exists.", 404)
        await record_movement(db, product, -r["qty_change"], "adjust", user=user, ref_type="command", ref_id=a.id,
                              note=f"Undo of command #{a.id}")
        if r.get("old_cost") is not None and product.cost_price == r.get("new_cost"):
            product.cost_price = r["old_cost"]
    elif a.kind == "record_sale":
        sale = await db.get(Sale, r["sale_id"])
        if not sale:
            raise CommandError("That sale was already removed.", 409)
        await void_sale(db, sale, user, note=f"Sale #{sale.id} undone from the command bar")
    elif a.kind == "update_price":
        product = await db.get(Product, r["product_id"])
        if not product:
            raise CommandError("That product no longer exists.", 404)
        if (getattr(product, r["field"]) or 0) != r["new"]:
            raise CommandError("The price was changed again since, so this can't be undone safely.", 409)
        setattr(product, r["field"], r["old"])
    a.status, a.undone_at = "undone", datetime.now(timezone.utc)
    await db.flush()
    return action_out(a)


async def history(db: AsyncSession, user: User, limit: int = 50) -> list[dict]:
    q = select(AssistantAction).order_by(AssistantAction.created_at.desc(), AssistantAction.id.desc()).limit(limit)
    if user.role == "staff":
        q = q.where(AssistantAction.user_id == user.id)
    return [action_out(a) for a in (await db.execute(q)).scalars()]
