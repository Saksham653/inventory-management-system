from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import ADMINS, ANY_USER
from app.models.schema import Product, Sale, User
from app.services.sales import create_sale as record_sale, get_sale, void_sale as do_void_sale

router = APIRouter()


class SaleIn(BaseModel):
    product_id: int
    qty: int = Field(gt=0)
    customer: str | None = None


def sale_out(s: Sale, product_name: str | None = None) -> dict:
    return {
        "id": s.id, "product_id": s.product_id, "product_name": product_name,
        "qty": s.qty, "unit_price": s.unit_price, "total_price": s.total_price,
        "unit_cost": s.unit_cost or 0, "customer": s.customer, "sold_by": s.sold_by, "date": s.date,
    }


@router.get("/")
async def list_sales(_: User = ANY_USER, db: AsyncSession = Depends(get_db), limit: int = 500):
    rows = await db.execute(
        select(Sale, Product.name).join(Product, Product.id == Sale.product_id, isouter=True)
        .order_by(Sale.date.desc()).limit(min(limit, 5000))
    )
    return [sale_out(s, name) for s, name in rows]


@router.post("/", status_code=201)
async def create_sale(body: SaleIn, user: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    """Record a sale. The server sets the price (including bulk tiers) and deducts stock via the ledger."""
    product = await db.get(Product, body.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    sale = await record_sale(db, product, body.qty, user, body.customer)
    return sale_out(sale, product.name)


@router.delete("/{sale_id}", status_code=204)
async def void_sale(sale_id: int, user: User = ADMINS, db: AsyncSession = Depends(get_db)):
    """Remove a sale recorded by mistake and put its stock back, keeping a ledger entry."""
    await do_void_sale(db, await get_sale(db, sale_id), user)
