from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import ADMINS, ANY_USER, MANAGERS
from app.models.schema import PriceTier, Product, Sale, StockMovement, User
from app.services.insights import replenishment_report
from app.services.stock import record_movement

router = APIRouter()


class ProductIn(BaseModel):
    name: str = Field(min_length=1)
    sku: str = Field(min_length=1)
    brand: str | None = None
    category_id: int | None = None
    supplier_id: int | None = None
    qty: int = Field(default=0, ge=0)
    price: float = Field(ge=0)
    cost_price: float = Field(default=0, ge=0)
    unit: str = "pcs"
    min_stock: int = Field(default=5, ge=0)
    lead_time_days: int = Field(default=3, ge=0)


class ProductPatch(BaseModel):
    name: str | None = None
    sku: str | None = None
    brand: str | None = None
    category_id: int | None = None
    supplier_id: int | None = None
    qty: int | None = Field(default=None, ge=0)
    price: float | None = Field(default=None, ge=0)
    cost_price: float | None = Field(default=None, ge=0)
    unit: str | None = None
    min_stock: int | None = Field(default=None, ge=0)
    lead_time_days: int | None = Field(default=None, ge=0)
    adjust_note: str | None = None


def product_out(p: Product) -> dict:
    return {
        "id": p.id, "name": p.name, "sku": p.sku, "brand": p.brand,
        "category_id": p.cat_id, "supplier_id": p.supplier_id,
        "qty": p.qty, "unit": p.unit or "pcs", "price": p.price, "cost_price": p.cost_price or 0,
        "min_stock": p.min_stock, "lead_time_days": p.lead_time_days,
        "created_at": p.created_at,
    }


async def _get(db: AsyncSession, product_id: int) -> Product:
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


async def _sku_taken(db: AsyncSession, sku: str, exclude_id: int | None = None) -> bool:
    q = select(Product.id).where(Product.sku == sku)
    if exclude_id:
        q = q.where(Product.id != exclude_id)
    return (await db.execute(q)).first() is not None


@router.get("/")
async def list_products(_: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    products = (await db.execute(select(Product).order_by(Product.name))).scalars().all()
    return [product_out(p) for p in products]


@router.get("/replenishment-risk")
async def get_replenishment_risk(_: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    return await replenishment_report(db)


@router.post("/", status_code=201)
async def create_product(body: ProductIn, user: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    sku = body.sku.strip()
    if await _sku_taken(db, sku):
        raise HTTPException(status_code=409, detail=f"SKU {sku} is already used by another product")
    data = body.model_dump(exclude={"qty", "category_id", "sku"})
    p = Product(**data, sku=sku, cat_id=body.category_id, qty=0)
    db.add(p)
    await db.flush()
    if body.qty:
        await record_movement(db, p, body.qty, "opening", user=user, note="Opening stock")
    return product_out(p)


@router.patch("/{product_id}")
async def update_product(product_id: int, body: ProductPatch, user: User = MANAGERS,
                         db: AsyncSession = Depends(get_db)):
    p = await _get(db, product_id)
    changes = body.model_dump(exclude_unset=True, exclude={"qty", "adjust_note"})
    if "sku" in changes:
        changes["sku"] = changes["sku"].strip()
        if await _sku_taken(db, changes["sku"], exclude_id=p.id):
            raise HTTPException(status_code=409, detail=f"SKU {changes['sku']} is already used")
    if "category_id" in changes:
        changes["cat_id"] = changes.pop("category_id")
    for k, v in changes.items():
        setattr(p, k, v)
    if body.qty is not None and body.qty != p.qty:
        await record_movement(db, p, body.qty - p.qty, "adjust", user=user,
                              note=body.adjust_note or "Manual stock correction")
    return product_out(p)


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: int, _: User = ADMINS, db: AsyncSession = Depends(get_db)):
    p = await _get(db, product_id)
    sales = (await db.execute(select(func.count(Sale.id)).where(Sale.product_id == p.id))).scalar()
    if sales:
        raise HTTPException(status_code=409,
                            detail=f"{p.name} has {sales} sales on record, so it can't be deleted. Set its stock to 0 instead.")
    await db.execute(delete(StockMovement).where(StockMovement.product_id == p.id))
    await db.delete(p)


@router.get("/{product_id}/price")
async def get_dynamic_price(product_id: int, qty: int, _: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    """Lowest applicable unit price for a quantity, using price tiers when set."""
    p = await _get(db, product_id)
    tier = (await db.execute(
        select(PriceTier).where(PriceTier.product_id == product_id, PriceTier.min_qty <= qty)
        .order_by(PriceTier.min_qty.desc()).limit(1)
    )).scalar_one_or_none()
    unit_price = tier.price if tier else p.price
    return {"product_id": product_id, "qty": qty, "unit_price": unit_price, "is_tiered": unit_price != p.price}
