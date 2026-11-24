from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import ANY_USER, MANAGERS
from app.models.schema import Product, PurchaseOrder, PurchaseOrderLine, Supplier, User
from app.services.radar import compute_radar
from app.services.stock import record_movement

router = APIRouter()


class DraftIn(BaseModel):
    product_ids: list[int] | None = None  # None = every product Paisa Radar says to reorder


class LineIn(BaseModel):
    product_id: int
    qty: int = Field(gt=0)
    unit_cost: float | None = Field(default=None, ge=0)


class POUpdate(BaseModel):
    note: str | None = None
    lines: list[LineIn] | None = None


async def po_out(db: AsyncSession, po: PurchaseOrder) -> dict:
    supplier = await db.get(Supplier, po.supplier_id) if po.supplier_id else None
    ids = [l.product_id for l in po.lines]
    names = dict((await db.execute(select(Product.id, Product.name).where(Product.id.in_(ids)))).all()) if ids else {}
    lines = [{"id": l.id, "product_id": l.product_id, "product_name": names.get(l.product_id, "Deleted product"),
              "qty": l.qty, "unit_cost": l.unit_cost or 0, "total": round(l.qty * (l.unit_cost or 0), 2)} for l in po.lines]
    return {
        "id": po.id, "number": f"PO-{po.id:04d}", "status": po.status, "note": po.note, "source": po.source,
        "supplier_id": po.supplier_id, "supplier_name": supplier.name if supplier else "No supplier",
        "supplier_contact": supplier.contact if supplier else None, "supplier_email": supplier.email if supplier else None,
        "created_by": po.created_by, "created_at": po.created_at, "sent_at": po.sent_at, "received_at": po.received_at,
        "lines": lines, "units": sum(l["qty"] for l in lines), "total": round(sum(l["total"] for l in lines), 2),
    }


async def _get(db: AsyncSession, po_id: int) -> PurchaseOrder:
    po = await db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po


@router.get("/")
async def list_pos(_: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    pos = (await db.execute(select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc(), PurchaseOrder.id.desc()))).scalars().all()
    return [await po_out(db, po) for po in pos]


@router.post("/draft-from-radar", status_code=201)
async def draft_from_radar(body: DraftIn, user: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    """Turn Paisa Radar's reorder list into one draft purchase order per supplier."""
    radar = await compute_radar(db)
    wanted = set(body.product_ids) if body.product_ids else None
    picks = [r for r in radar["reorder"] if r["suggested_qty"] > 0 and (wanted is None or r["id"] in wanted)]
    if not picks:
        raise HTTPException(status_code=400, detail="Nothing needs reordering right now")

    # Skip products already waiting on an open order.
    open_lines = (await db.execute(
        select(PurchaseOrderLine.product_id).join(PurchaseOrder)
        .where(PurchaseOrder.status.in_(("draft", "sent"))))).scalars().all()
    pending = set(open_lines)
    skipped = [r["name"] for r in picks if r["id"] in pending]
    picks = [r for r in picks if r["id"] not in pending]
    if not picks:
        raise HTTPException(status_code=409, detail=f"Already on an open order: {', '.join(skipped)}")

    by_supplier = defaultdict(list)
    for r in picks:
        by_supplier[r["supplier_id"]].append(r)
    created = []
    for supplier_id, rows in by_supplier.items():
        po = PurchaseOrder(supplier_id=supplier_id, status="draft", source="radar", created_by=user.name,
                           note="Drafted by Paisa Radar from the last 30 days of sales")
        po.lines = [PurchaseOrderLine(product_id=r["id"], qty=r["suggested_qty"], unit_cost=r["cost_price"]) for r in rows]
        db.add(po)
        await db.flush()
        created.append(po)
    return {"orders": [await po_out(db, po) for po in created], "skipped": skipped}


@router.patch("/{po_id}")
async def update_po(po_id: int, body: POUpdate, _: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    po = await _get(db, po_id)
    if po.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft orders can be edited")
    if body.note is not None:
        po.note = body.note
    if body.lines is not None:
        if not body.lines:
            raise HTTPException(status_code=400, detail="An order needs at least one line")
        ids = {l.product_id for l in body.lines}
        found = set((await db.execute(select(Product.id).where(Product.id.in_(ids)))).scalars())
        if ids - found:
            raise HTTPException(status_code=400, detail=f"Unknown product id(s): {', '.join(map(str, sorted(ids - found)))}")
        po.lines = [PurchaseOrderLine(product_id=l.product_id, qty=l.qty, unit_cost=l.unit_cost or 0) for l in body.lines]
    await db.flush()
    return await po_out(db, po)


@router.post("/{po_id}/send")
async def send_po(po_id: int, _: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    """Mark as sent to the supplier (sending by WhatsApp/email arrives in a later phase)."""
    po = await _get(db, po_id)
    if po.status != "draft":
        raise HTTPException(status_code=400, detail=f"Order is already {po.status}")
    po.status = "sent"
    po.sent_at = datetime.now(timezone.utc)
    return await po_out(db, po)


@router.post("/{po_id}/receive")
async def receive_po(po_id: int, user: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    """Stock arrived: add every line to stock through the ledger and update cost prices."""
    po = await _get(db, po_id)
    if po.status not in ("draft", "sent"):
        raise HTTPException(status_code=400, detail=f"Order is already {po.status}")
    number = f"PO-{po.id:04d}"
    for line in po.lines:
        product = await db.get(Product, line.product_id)
        if not product:
            continue
        if line.unit_cost:
            product.cost_price = line.unit_cost
        await record_movement(db, product, line.qty, "purchase", user=user, unit_cost=line.unit_cost,
                              ref_type="purchase_order", ref_id=po.id, note=f"Received {number}")
    po.status = "received"
    po.received_at = datetime.now(timezone.utc)
    return await po_out(db, po)


@router.post("/{po_id}/cancel")
async def cancel_po(po_id: int, _: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    po = await _get(db, po_id)
    if po.status not in ("draft", "sent"):
        raise HTTPException(status_code=400, detail=f"Order is already {po.status}")
    po.status = "cancelled"
    return await po_out(db, po)
