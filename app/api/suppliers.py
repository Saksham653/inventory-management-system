from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import ADMINS, ANY_USER, MANAGERS
from app.models.schema import Product, PurchaseOrder, Supplier, User

router = APIRouter()


class SupplierIn(BaseModel):
    name: str = Field(min_length=1)
    contact: str | None = None
    email: str | None = None
    address: str | None = None
    description: str | None = None
    lead_time_days: int = Field(default=3, ge=0)


class SupplierPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    contact: str | None = None
    email: str | None = None
    address: str | None = None
    description: str | None = None
    lead_time_days: int | None = Field(default=None, ge=0)


def supplier_out(s: Supplier, product_count: int = 0) -> dict:
    return {"id": s.id, "name": s.name, "contact": s.contact, "email": s.email, "address": s.address,
            "description": s.description, "lead_time_days": s.lead_time_days,
            "product_count": product_count, "created_at": s.created_at}


@router.get("/")
async def list_suppliers(_: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    counts = dict((await db.execute(
        select(Product.supplier_id, func.count(Product.id)).group_by(Product.supplier_id))).all())
    sups = (await db.execute(select(Supplier).order_by(Supplier.name))).scalars().all()
    return [supplier_out(s, counts.get(s.id, 0)) for s in sups]


@router.post("/", status_code=201)
async def create_supplier(body: SupplierIn, _: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    s = Supplier(**body.model_dump())
    db.add(s)
    await db.flush()
    await db.refresh(s)
    return supplier_out(s)


@router.patch("/{supplier_id}")
async def update_supplier(supplier_id: int, body: SupplierPatch, _: User = MANAGERS,
                          db: AsyncSession = Depends(get_db)):
    s = await db.get(Supplier, supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    return supplier_out(s)


@router.delete("/{supplier_id}", status_code=204)
async def delete_supplier(supplier_id: int, _: User = ADMINS, db: AsyncSession = Depends(get_db)):
    s = await db.get(Supplier, supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    orders = (await db.execute(select(func.count(PurchaseOrder.id)).where(PurchaseOrder.supplier_id == s.id))).scalar()
    if orders:
        raise HTTPException(status_code=409,
                            detail=f"{s.name} has {orders} purchase order(s) on record, so it can't be deleted.")
    await db.execute(update(Product).where(Product.supplier_id == s.id).values(supplier_id=None))
    await db.delete(s)
