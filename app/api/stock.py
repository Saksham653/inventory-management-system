from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import ANY_USER, MANAGERS
from app.models.schema import Product, StockMovement, User
from app.services.stock import record_movement

router = APIRouter()


class AdjustIn(BaseModel):
    product_id: int
    qty_change: int
    type: str = Field(default="adjust", pattern="^(adjust|purchase|return)$")
    unit_cost: float | None = Field(default=None, ge=0)
    note: str | None = None


def movement_out(m: StockMovement, product_name: str | None) -> dict:
    return {
        "id": m.id, "product_id": m.product_id, "product_name": product_name, "type": m.type,
        "qty_change": m.qty_change, "qty_after": m.qty_after, "unit_cost": m.unit_cost,
        "ref_type": m.ref_type, "ref_id": m.ref_id, "note": m.note, "user_name": m.user_name,
        "created_at": m.created_at,
    }


@router.get("/movements")
async def list_movements(product_id: int | None = None, limit: int = 200,
                         _: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    q = (select(StockMovement, Product.name)
         .join(Product, Product.id == StockMovement.product_id, isouter=True)
         .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
         .limit(min(limit, 2000)))
    if product_id:
        q = q.where(StockMovement.product_id == product_id)
    return [movement_out(m, name) for m, name in await db.execute(q)]


@router.post("/adjust", status_code=201)
async def adjust_stock(body: AdjustIn, user: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    """Stock in from a supplier, a customer return, or a correction after a count."""
    if body.qty_change == 0:
        raise HTTPException(status_code=400, detail="Quantity change can't be zero")
    product = await db.get(Product, body.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if body.type == "purchase" and body.unit_cost is not None:
        product.cost_price = body.unit_cost  # latest purchase cost becomes the product's cost
    mv = await record_movement(db, product, body.qty_change, body.type, user=user,
                               unit_cost=body.unit_cost, note=body.note)
    await db.flush()
    await db.refresh(mv)
    return movement_out(mv, product.name)
