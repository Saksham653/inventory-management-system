"""Lightweight schema upgrades for databases created by older versions.

`create_all` makes new tables but never adds columns to existing ones, so the
live Postgres database would be missing e.g. products.cost_price. This adds any
missing nullable columns, then backfills an opening ledger row for products
that have stock but no history.
"""
import logging

from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.database import Base
from app.models.schema import Product, StockMovement

logger = logging.getLogger(__name__)


def _add_missing_columns(sync_conn) -> list[str]:
    insp = inspect(sync_conn)
    existing_tables = set(insp.get_table_names())
    dialect = sync_conn.dialect
    added = []
    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue
        have = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name in have:
                continue
            col_type = col.type.compile(dialect=dialect)
            sync_conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {col_type}'))
            added.append(f"{table.name}.{col.name}")
    return added


async def upgrade_schema(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        added = await conn.run_sync(_add_missing_columns)
    if added:
        logger.info("Added missing columns: %s", ", ".join(added))


async def backfill_ledger(db: AsyncSession) -> None:
    has_history = select(StockMovement.product_id).distinct()
    result = await db.execute(
        select(Product).where(Product.id.not_in(has_history), Product.qty != 0)
    )
    products = result.scalars().all()
    for p in products:
        db.add(StockMovement(
            product_id=p.id, type="opening", qty_change=p.qty, qty_after=p.qty,
            unit_cost=p.cost_price, note="Opening balance (recorded when the ledger was introduced)",
        ))
    if products:
        logger.info("Backfilled opening ledger rows for %d products", len(products))
    await db.commit()
