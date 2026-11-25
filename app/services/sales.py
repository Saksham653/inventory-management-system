"""Recording and voiding sales, shared by the Sales API and the command bar."""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schema import PriceTier, Product, Sale, User
from app.services.stock import record_movement


async def unit_price_for(db: AsyncSession, product: Product, qty: int) -> float:
    """Selling price per unit for this quantity, using bulk price tiers when set."""
    tier = (await db.execute(
        select(PriceTier).where(PriceTier.product_id == product.id, PriceTier.min_qty <= qty)
        .order_by(PriceTier.min_qty.desc()).limit(1)
    )).scalar_one_or_none()
    return tier.price if tier else (product.price or 0)


async def create_sale(db: AsyncSession, product: Product, qty: int, user: User, customer: str | None = None) -> Sale:
    unit_price = await unit_price_for(db, product, qty)
    sale = Sale(product_id=product.id, qty=qty, unit_price=unit_price, unit_cost=product.cost_price or 0,
                total_price=round(unit_price * qty, 2), customer=customer, sold_by=user.name, user_id=user.id)
    db.add(sale)
    await db.flush()
    await record_movement(db, product, -qty, "sale", user=user, ref_type="sale", ref_id=sale.id)
    await db.flush()
    await db.refresh(sale)
    return sale


async def void_sale(db: AsyncSession, sale: Sale, user: User, note: str | None = None) -> None:
    """Remove a sale and put its stock back, keeping a ledger entry."""
    product = await db.get(Product, sale.product_id)
    if product:
        await record_movement(db, product, sale.qty, "void", user=user, ref_type="sale", ref_id=sale.id,
                              note=note or f"Sale #{sale.id} voided")
    await db.delete(sale)


async def get_sale(db: AsyncSession, sale_id: int) -> Sale:
    sale = await db.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale
