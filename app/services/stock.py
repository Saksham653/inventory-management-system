"""The only place that changes Product.qty. Every change writes a ledger row."""
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schema import MOVEMENT_TYPES, Product, StockMovement, User


async def record_movement(
    db: AsyncSession,
    product: Product,
    qty_change: int,
    type: str,
    *,
    user: User | None = None,
    unit_cost: float | None = None,
    ref_type: str | None = None,
    ref_id: int | None = None,
    note: str | None = None,
    at: datetime | None = None,
    allow_negative: bool = False,
) -> StockMovement:
    if type not in MOVEMENT_TYPES:
        raise ValueError(f"Unknown movement type: {type}")
    new_qty = (product.qty or 0) + qty_change
    if new_qty < 0 and not allow_negative:
        raise HTTPException(status_code=400, detail=f"Not enough stock. Only {product.qty} available.")
    product.qty = new_qty
    mv = StockMovement(
        product_id=product.id,
        type=type,
        qty_change=qty_change,
        qty_after=new_qty,
        unit_cost=unit_cost if unit_cost is not None else product.cost_price,
        ref_type=ref_type,
        ref_id=ref_id,
        note=note,
        user_id=user.id if user else None,
        user_name=user.name if user else None,
    )
    if at is not None:
        mv.created_at = at
    db.add(mv)
    return mv
