from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import ANY_USER
from app.models.schema import Category, Product, Sale, Supplier, User
from app.services.insights import replenishment_report

router = APIRouter()

# Daily buckets follow shop time (India-first product).
LOCAL_TZ = timezone(timedelta(hours=5, minutes=30))
DAILY_DAYS = 30


def _aware(dt: datetime) -> datetime:
    # SQLite returns naive datetimes; treat them as UTC.
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _month_starts(now: datetime, n: int) -> list[datetime]:
    starts, y, m = [], now.year, now.month
    for _ in range(n):
        starts.append(datetime(y, m, 1, tzinfo=timezone.utc))
        y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    return list(reversed(starts))


@router.get("/stats")
async def stats(_: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    products = (await db.execute(select(Product))).scalars().all()
    categories = {c.id: c.name for c in (await db.execute(select(Category))).scalars().all()}
    supplier_count = (await db.execute(select(func.count(Supplier.id)))).scalar() or 0

    inventory_cost = sum((p.qty or 0) * (p.cost_price or 0) for p in products)
    inventory_retail = sum((p.qty or 0) * (p.price or 0) for p in products)
    low_stock = [p for p in products if (p.qty or 0) <= (p.min_stock or 0)]

    # Revenue: last 6 calendar months, plus last 30 days vs the 30 before.
    months = _month_starts(now, 6)
    sales_rows = (await db.execute(
        select(Sale.date, Sale.total_price, Sale.qty, Sale.unit_cost).where(Sale.date >= months[0])
    )).all()
    by_month = defaultdict(float)
    cost_by_month = defaultdict(float)
    by_day = defaultdict(lambda: [0.0, 0.0])
    today_local = now.astimezone(LOCAL_TZ).date()
    rev_30 = rev_prev_30 = profit_30 = 0.0
    count_30 = 0
    for d, total, qty, unit_cost in sales_rows:
        d = _aware(d)
        cost = (qty or 0) * (unit_cost or 0)
        by_month[(d.year, d.month)] += total or 0
        cost_by_month[(d.year, d.month)] += cost
        day = d.astimezone(LOCAL_TZ).date()
        if (today_local - day).days < DAILY_DAYS:
            by_day[day][0] += total or 0
            by_day[day][1] += cost
        age = (today_local - day).days  # same local-day window as the daily chart
        if age < 30:
            rev_30 += total or 0
            profit_30 += (total or 0) - (qty or 0) * (unit_cost or 0)
            count_30 += 1
        elif age < 60:
            rev_prev_30 += total or 0

    total_rev, total_count = (await db.execute(
        select(func.coalesce(func.sum(Sale.total_price), 0), func.count(Sale.id)))).one()

    # Drop leading months that started before the first recorded sale: a half-recorded
    # month would show a fake dip. Keep at least the current month.
    first_sale = (await db.execute(select(func.min(Sale.date)))).scalar()
    if first_sale is not None:
        first_sale = _aware(first_sale)
        months = [m for m in months[:-1] if m >= first_sale.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                  and not (m.year == first_sale.year and m.month == first_sale.month and first_sale.day > 1)] + months[-1:]

    # Stock value at cost by category.
    by_cat = defaultdict(float)
    for p in products:
        by_cat[categories.get(p.cat_id, "Uncategorised")] += (p.qty or 0) * (p.cost_price or 0)

    recent = (await db.execute(
        select(Sale, Product.name).join(Product, Product.id == Sale.product_id, isouter=True)
        .order_by(Sale.date.desc()).limit(6)
    )).all()

    risk = [r for r in await replenishment_report(db) if r["at_risk"]]

    return {
        "product_count": len(products),
        "supplier_count": supplier_count,
        "low_stock_count": len(low_stock),
        "inventory_value_cost": round(inventory_cost, 2),
        "inventory_value_retail": round(inventory_retail, 2),
        "revenue_total": round(total_rev or 0, 2),
        "sales_count_total": total_count,
        "revenue_30d": round(rev_30, 2),
        "revenue_prev_30d": round(rev_prev_30, 2),
        "gross_profit_30d": round(profit_30, 2),
        "sales_count_30d": count_30,
        "monthly_revenue": [
            {"month": m.strftime("%b"), "year": m.year, "revenue": round(by_month[(m.year, m.month)], 2),
             "cost": round(cost_by_month[(m.year, m.month)], 2), "partial": i == len(months) - 1}
            for i, m in enumerate(months)
        ],
        "daily": [
            {"date": day.isoformat(), "revenue": round(by_day[day][0], 2), "cost": round(by_day[day][1], 2)}
            for day in (today_local - timedelta(days=n) for n in range(DAILY_DAYS - 1, -1, -1))
        ],
        "stock_value_by_category": sorted(
            [{"category": k, "value": round(v, 2)} for k, v in by_cat.items() if v > 0],
            key=lambda x: -x["value"],
        ),
        "recent_sales": [
            {"id": s.id, "product_name": name, "qty": s.qty, "total_price": s.total_price,
             "sold_by": s.sold_by, "date": s.date}
            for s, name in recent
        ],
        "at_risk": risk,
    }
