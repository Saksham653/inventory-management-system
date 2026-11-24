"""Paisa Radar: inventory counted in rupees.

Answers three questions with plain arithmetic on the sales history and the stock
ledger (no AI involved, so every number can be explained):
  1. Where is my money stuck?   cash at cost, bucketed by days since last sale
  2. What will run out?          days of cover vs supplier lead time
  3. What should I do today?     ranked actions, by rupees freed or saved
"""
import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schema import Category, Product, Sale, StockMovement, Supplier

LOCAL_TZ = timezone(timedelta(hours=5, minutes=30))

VELOCITY_DAYS = 30        # sales window for the daily selling rate
SAFETY_DAYS = 3           # buffer on top of supplier lead time
TARGET_COVER_DAYS = 21    # an order should cover lead time + 3 weeks of sales
DEAD_DAYS = 60            # no sale for this long = dead stock
SLOW_WEEKS = 26           # more than ~6 months of stock at current pace = slow
RETURN_KEEP_WEEKS = 12    # when suggesting a return, keep 12 weeks of stock
BUCKETS = [(0, 30, "0–30 days"), (31, 60, "31–60 days"), (61, 90, "61–90 days"), (91, None, "90+ days")]


def _aware(dt):
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _bucket(days: int) -> int:
    for i, (lo, hi, _) in enumerate(BUCKETS):
        if days >= lo and (hi is None or days <= hi):
            return i
    return len(BUCKETS) - 1


async def compute_radar(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=VELOCITY_DAYS)

    products = (await db.execute(select(Product).order_by(Product.name))).scalars().all()
    cats = {c.id: c.name for c in (await db.execute(select(Category))).scalars()}
    sups = {s.id: s for s in (await db.execute(select(Supplier))).scalars()}

    sold_30 = dict((await db.execute(
        select(Sale.product_id, func.sum(Sale.qty)).where(Sale.date >= since).group_by(Sale.product_id))).all())
    last_sale = dict((await db.execute(
        select(Sale.product_id, func.max(Sale.date)).group_by(Sale.product_id))).all())
    first_stocked = dict((await db.execute(
        select(StockMovement.product_id, func.min(StockMovement.created_at)).group_by(StockMovement.product_id))).all())

    # Weekly sales (shop-local days) and cost of goods over 90 days for stock turns.
    rows = (await db.execute(
        select(Sale.date, Sale.total_price, Sale.qty, Sale.unit_cost).where(Sale.date >= now - timedelta(days=90)))).all()
    today = now.astimezone(LOCAL_TZ).date()
    week = prev_week = cogs_90 = 0.0
    for d, total, qty, unit_cost in rows:
        age = (today - _aware(d).astimezone(LOCAL_TZ).date()).days
        if age < 7:
            week += total or 0
        elif age < 14:
            prev_week += total or 0
        cogs_90 += (qty or 0) * (unit_cost or 0)

    items = []
    for p in products:
        qty = p.qty or 0
        cost = p.cost_price or 0
        rate = (sold_30.get(p.id) or 0) / VELOCITY_DAYS
        lead = p.lead_time_days if p.lead_time_days is not None else (sups[p.supplier_id].lead_time_days if p.supplier_id in sups else 3)
        last = _aware(last_sale.get(p.id))
        stocked = _aware(first_stocked.get(p.id)) or _aware(p.created_at) or now
        idle_since = last or stocked
        days_idle = max(0, (now - idle_since).days)
        cover = qty / rate if rate > 0 else None
        reorder_point = rate * (lead + SAFETY_DAYS)
        needs_reorder = rate > 0 and qty <= reorder_point  # includes items already out of stock
        suggested = max(0, math.ceil(rate * (lead + TARGET_COVER_DAYS) - qty)) if needs_reorder else 0
        days_without_stock = max(0.0, lead - (cover or 0)) if needs_reorder else 0.0
        # Units you'd be short of before a delivery placed today arrives (lead time + safety buffer).
        shortfall_units = max(0.0, rate * (lead + SAFETY_DAYS) - qty) if needs_reorder else 0.0
        sales_at_risk = shortfall_units * (p.price or 0)
        weeks_of_stock = qty / (rate * 7) if rate > 0 else None
        is_dead = qty > 0 and days_idle >= DEAD_DAYS
        is_slow = qty > 0 and not is_dead and weeks_of_stock is not None and weeks_of_stock > SLOW_WEEKS

        items.append({
            "id": p.id, "name": p.name, "sku": p.sku, "unit": p.unit or "pcs",
            "category": cats.get(p.cat_id), "category_id": p.cat_id,
            "supplier": sups[p.supplier_id].name if p.supplier_id in sups else None, "supplier_id": p.supplier_id,
            "qty": qty, "cost_price": cost, "price": p.price or 0,
            "stock_value": round(qty * cost, 2),
            "margin_pct": round(((p.price or 0) - cost) / p.price * 100, 1) if p.price else None,
            "sold_30d": sold_30.get(p.id) or 0,
            "daily_rate": round(rate, 2),
            "last_sold_at": last, "days_idle": days_idle, "never_sold": last is None,
            "bucket": _bucket(days_idle),
            "lead_time": lead,
            "days_of_cover": round(cover, 1) if cover is not None else None,
            "weeks_of_stock": round(weeks_of_stock, 1) if weeks_of_stock is not None else None,
            "reorder_point": round(reorder_point, 1),
            "needs_reorder": needs_reorder,
            "suggested_qty": suggested,
            "suggested_cost": round(suggested * cost, 2),
            "days_without_stock": round(days_without_stock, 1),
            "shortfall_units": round(shortfall_units, 1),
            "sales_at_risk": round(sales_at_risk, 2),
            "status": "dead" if is_dead else "slow" if is_slow else "reorder" if needs_reorder else "healthy",
            "suggestions": [],
        })

    # Suggestions for stuck stock, each with an estimate of rupees freed.
    fast_by_cat = defaultdict(list)
    for it in items:
        if it["daily_rate"] > 0 and it["status"] in ("healthy", "reorder"):
            fast_by_cat[it["category_id"]].append(it)
    for it in items:
        if it["status"] not in ("dead", "slow"):
            continue
        s = it["suggestions"]
        if it["status"] == "slow" and it["daily_rate"] > 0:
            keep = math.ceil(it["daily_rate"] * 7 * RETURN_KEEP_WEEKS)
            extra = it["qty"] - keep
            if extra > 0 and it["supplier"]:
                s.append({"kind": "return", "label": f"Return {extra} to {it['supplier']}",
                          "detail": f"Keeps {RETURN_KEEP_WEEKS} weeks of stock at the current pace",
                          "value": round(extra * it["cost_price"], 2)})
        partners = sorted(fast_by_cat.get(it["category_id"], []), key=lambda x: -x["daily_rate"])
        any_fast = partners or sorted([x for v in fast_by_cat.values() for x in v], key=lambda x: -x["daily_rate"])
        if any_fast:
            partner = any_fast[0]
            s.append({"kind": "bundle", "label": f"Bundle with {partner['name']}",
                      "detail": f"{partner['name']} sells {partner['daily_rate']}/day",
                      "value": round(min(it["qty"], max(1, round(partner["daily_rate"] * 14))) * it["cost_price"], 2)})
        if it["margin_pct"] and it["margin_pct"] > 2:
            pct = max(2, min(10, int(it["margin_pct"] // 2)))
            s.append({"kind": "discount", "label": f"{pct}% off for 2 weeks",
                      "detail": f"Stays above cost: margin is {it['margin_pct']}%",
                      "value": it["stock_value"]})
        if it["status"] == "dead":
            s.append({"kind": "stop", "label": "Stop reordering",
                      "detail": f"No sale in {it['days_idle']} days", "value": 0})

    buckets = []
    for i, (lo, hi, label) in enumerate(BUCKETS):
        members = [it for it in items if it["bucket"] == i and it["qty"] > 0]
        buckets.append({"label": label, "from_days": lo, "to_days": hi,
                        "value": round(sum(m["stock_value"] for m in members), 2),
                        "products": [m["id"] for m in members]})

    total_value = round(sum(it["stock_value"] for it in items), 2)
    dead = sorted([it for it in items if it["status"] == "dead"], key=lambda x: -x["stock_value"])
    slow = sorted([it for it in items if it["status"] == "slow"], key=lambda x: -x["stock_value"])
    reorder = sorted([it for it in items if it["needs_reorder"]],
                     key=lambda x: (x["days_of_cover"] if x["days_of_cover"] is not None else -1))
    stuck_value = round(sum(it["stock_value"] for it in dead), 2)
    at_risk_value = round(sum(it["sales_at_risk"] for it in reorder), 2)

    actions = []
    if reorder:
        actions.append({"kind": "reorder", "label": f"Order {len(reorder)} product{'s' if len(reorder) > 1 else ''} before they run out",
                        "value": at_risk_value, "value_label": "sales protected"})
    for it in dead + slow:
        best = max(it["suggestions"], key=lambda s: s["value"], default=None)
        if best and best["value"] > 0:
            actions.append({"kind": best["kind"], "label": f"{it['name']}: {best['label'].lower()}",
                            "value": best["value"], "value_label": "cash freed", "product_id": it["id"]})
    actions.sort(key=lambda a: -a["value"])

    if dead:
        top = dead[:2]
        names = " and ".join(t["name"] for t in top)
        pct = round(stuck_value / total_value * 100) if total_value else 0
        where = "mostly in" if len(dead) > 2 else "in"
        headline = {
            "amount": stuck_value,
            "text": f"is stuck in stock that hasn't sold in {DEAD_DAYS}+ days",
            "detail": f"That's {pct}% of your inventory value, {where} {names}.",
            "tone": "crit",
        }
    elif reorder:
        headline = {"amount": at_risk_value, "text": "of sales is at risk from items running out",
                    "detail": f"{len(reorder)} products won't last until a new delivery arrives.", "tone": "warn"}
    else:
        headline = {"amount": total_value, "text": "in stock, and none of it is stuck",
                    "detail": "Everything has sold in the last 60 days and covers supplier lead times.", "tone": "ok"}

    turns = (cogs_90 / total_value) if total_value else 0
    return {
        "generated_at": now,
        "headline": headline,
        "totals": {
            "inventory_value": total_value,
            "inventory_retail": round(sum(it["qty"] * it["price"] for it in items), 2),
            "stuck_value": stuck_value,
            "slow_value": round(sum(it["stock_value"] for it in slow), 2),
            "at_risk_value": at_risk_value,
            "reorder_cost": round(sum(it["suggested_cost"] for it in reorder), 2),
            "sales_this_week": round(week, 2),
            "sales_last_week": round(prev_week, 2),
            "cogs_90d": round(cogs_90, 2),
            "stock_turns_90d": round(turns, 2),
        },
        "buckets": buckets,
        "reorder": reorder,
        "dead": dead,
        "slow": slow,
        "actions": actions[:6],
        "items": items,
        "rules": {
            "velocity_days": VELOCITY_DAYS, "safety_days": SAFETY_DAYS, "target_cover_days": TARGET_COVER_DAYS,
            "dead_days": DEAD_DAYS, "slow_weeks": SLOW_WEEKS, "return_keep_weeks": RETURN_KEEP_WEEKS,
        },
    }
