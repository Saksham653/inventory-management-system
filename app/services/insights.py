"""Stock analytics shared by the products and dashboard routes."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schema import Product, Sale

SAFETY_DAYS = 3
VELOCITY_WINDOW_DAYS = 30


async def replenishment_report(db: AsyncSession) -> list[dict]:
    """Days of cover per product from the last 30 days of sales.

    A product is at risk when its stock runs out before a new order could arrive
    (supplier lead time + a few safety days).
    """
    since = datetime.now(timezone.utc) - timedelta(days=VELOCITY_WINDOW_DAYS)
    rows = await db.execute(
        select(Sale.product_id, func.sum(Sale.qty)).where(Sale.date >= since).group_by(Sale.product_id)
    )
    sold = {pid: units or 0 for pid, units in rows}
    products = (await db.execute(select(Product))).scalars().all()

    report = []
    for p in products:
        velocity = sold.get(p.id, 0) / VELOCITY_WINDOW_DAYS
        cover = (p.qty / velocity) if velocity > 0 else None
        lead = p.lead_time_days or 0
        at_risk = (cover is not None and cover < lead + SAFETY_DAYS) or (p.qty or 0) <= 0
        report.append({
            "id": p.id,
            "name": p.name,
            "sku": p.sku,
            "qty": p.qty,
            "avg_daily_sales": round(velocity, 2),
            "days_of_cover": round(cover, 1) if cover is not None else None,
            "lead_time": lead,
            "at_risk": at_risk,
        })
    # Products with no recent sales sort last.
    return sorted(report, key=lambda r: (r["days_of_cover"] is None, r["days_of_cover"] or 0))
