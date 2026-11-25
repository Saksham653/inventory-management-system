"""Snap-a-Bill: photograph a supplier bill, review the matched lines, post them into stock."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import MANAGERS
from app.models.schema import (
    Product, ProductAlias, Supplier, SupplierBill, SupplierBillImage, SupplierBillLine, User,
)
from app.services import matching
from app.services.bill_reader import BillReaderError, active_provider, read_bill
from app.services.stock import record_movement

router = APIRouter()

MAX_IMAGE_BYTES = 8 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/gif"}


class LineIn(BaseModel):
    id: int
    action: str = Field(pattern="^(match|create|skip)$")
    product_id: int | None = None
    qty: float | None = Field(default=None, ge=0)
    unit_cost: float | None = Field(default=None, ge=0)
    new_name: str | None = None
    new_sku: str | None = None
    new_price: float | None = Field(default=None, ge=0)


class BillPatch(BaseModel):
    supplier_id: int | None = None
    bill_no: str | None = None
    bill_date: str | None = None
    lines: list[LineIn] | None = None


async def _context(db: AsyncSession, supplier_id: int | None):
    products = (await db.execute(select(Product).order_by(Product.name))).scalars().all()
    q = select(ProductAlias)
    rows = (await db.execute(q)).scalars().all()
    # Supplier-specific aliases win over global ones.
    aliases = {a.alias: a.product_id for a in rows if a.supplier_id is None}
    aliases.update({a.alias: a.product_id for a in rows if supplier_id and a.supplier_id == supplier_id})
    return products, aliases


def _status(line: SupplierBillLine) -> str:
    if line.action == "skip":
        return "skipped"
    if line.action == "create":
        return "new"
    if not line.product_id:
        return "unmatched"
    return "matched" if (line.match_score or 0) >= matching.MATCHED else "check"


async def bill_out(db: AsyncSession, bill: SupplierBill, with_candidates: bool = True) -> dict:
    supplier = await db.get(Supplier, bill.supplier_id) if bill.supplier_id else None
    products, aliases = await _context(db, bill.supplier_id) if with_candidates else ([], {})
    names = {p.id: p.name for p in products} if products else dict(
        (await db.execute(select(Product.id, Product.name))).all())
    lines, warnings = [], []
    total = 0.0
    for l in bill.lines:
        line_total = round((l.qty or 0) * (l.unit_cost or 0), 2)
        flags = []
        if l.amount_on_bill and l.qty and l.unit_cost and abs(line_total - l.amount_on_bill) > max(1.0, 0.01 * l.amount_on_bill):
            flags.append(f"Bill says {l.amount_on_bill:,.0f} for this line, but qty × rate is {line_total:,.0f}")
        if l.qty is not None and l.qty != int(l.qty):
            flags.append("Quantity isn't a whole number")
        if l.action != "skip":
            total += line_total
        lines.append({
            "id": l.id, "position": l.position, "raw_text": l.raw_text, "qty": l.qty, "unit_cost": l.unit_cost,
            "amount_on_bill": l.amount_on_bill, "line_total": line_total, "action": l.action,
            "product_id": l.product_id, "product_name": names.get(l.product_id), "match_score": l.match_score,
            "status": _status(l), "new_name": l.new_name, "new_sku": l.new_sku, "new_price": l.new_price,
            "flags": flags,
            "candidates": matching.rank(l.raw_text or "", products, aliases) if with_candidates else [],
        })
    expected = bill.subtotal_on_bill or ((bill.total_on_bill or 0) - (bill.tax_on_bill or 0)) or None
    if expected and abs(expected - total) > max(1.0, 0.01 * expected) and all(l["action"] != "skip" for l in lines):
        warnings.append(f"Lines add up to {total:,.0f} but the bill's subtotal is {expected:,.0f}. A line may be missing or misread.")
    return {
        "id": bill.id, "number": f"BILL-{bill.id:04d}", "status": bill.status,
        "supplier_id": bill.supplier_id, "supplier_name": supplier.name if supplier else None,
        "supplier_name_raw": bill.supplier_name_raw, "bill_no": bill.bill_no, "bill_date": bill.bill_date,
        "subtotal_on_bill": bill.subtotal_on_bill, "tax_on_bill": bill.tax_on_bill, "total_on_bill": bill.total_on_bill,
        "computed_total": round(total, 2), "reader": bill.reader, "reader_notes": bill.reader_notes,
        "created_by": bill.created_by, "created_at": bill.created_at, "posted_by": bill.posted_by, "posted_at": bill.posted_at,
        "lines": lines, "warnings": warnings,
        "counts": {k: sum(1 for x in lines if x["status"] == k) for k in ("matched", "check", "new", "unmatched", "skipped")},
    }


async def _get(db: AsyncSession, bill_id: int) -> SupplierBill:
    bill = await db.get(SupplierBill, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill


@router.get("/reader")
async def reader_status(_: User = MANAGERS):
    """Lets the UI say up front whether scanning is available."""
    return {"provider": active_provider(), "available": active_provider() is not None}


@router.get("/")
async def list_bills(_: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    bills = (await db.execute(select(SupplierBill).order_by(SupplierBill.created_at.desc(), SupplierBill.id.desc()).limit(50))).scalars().all()
    out = []
    for b in bills:
        supplier = await db.get(Supplier, b.supplier_id) if b.supplier_id else None
        out.append({
            "id": b.id, "number": f"BILL-{b.id:04d}", "status": b.status, "bill_no": b.bill_no, "bill_date": b.bill_date,
            "supplier_name": supplier.name if supplier else b.supplier_name_raw, "lines": len(b.lines),
            "total": round(sum((l.qty or 0) * (l.unit_cost or 0) for l in b.lines if l.action != "skip"), 2),
            "created_at": b.created_at, "created_by": b.created_by,
        })
    return out


@router.post("/scan", status_code=201)
async def scan_bill(image: UploadFile = File(...), user: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    mime = (image.content_type or "").lower()
    if mime not in ALLOWED:
        raise HTTPException(status_code=415, detail="Upload a photo (JPEG, PNG or WebP).")
    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="The photo is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="The photo is larger than 8 MB.")

    try:
        reading = await read_bill(data, mime)
    except BillReaderError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    if not reading["readable"]:
        reason = reading.get("notes") or "No item lines could be read."
        raise HTTPException(status_code=422, detail=f"This doesn't look like a readable bill. {reason}")

    suppliers = (await db.execute(select(Supplier))).scalars().all()
    supplier, _ = matching.best_supplier(reading["supplier_name"], suppliers)
    products, aliases = await _context(db, supplier.id if supplier else None)
    taken = {p.sku for p in products}

    bill = SupplierBill(
        supplier_id=supplier.id if supplier else None, supplier_name_raw=reading["supplier_name"],
        bill_no=reading["bill_number"], bill_date=reading["bill_date"], status="draft",
        subtotal_on_bill=reading["subtotal"], tax_on_bill=reading["tax"], total_on_bill=reading["total"],
        reader=reading["reader"], reader_notes=reading["notes"], created_by=user.name,
    )
    for i, item in enumerate(reading["lines"]):
        cands = matching.rank(item["description"], products, aliases, limit=1)
        top = cands[0] if cands else None
        line = SupplierBillLine(position=i, raw_text=item["description"], qty=item["quantity"],
                                unit_cost=item["unit_price"], amount_on_bill=item["amount"])
        if top and top["score"] >= matching.CHECK:
            line.action, line.product_id, line.match_score = "match", top["product_id"], top["score"]
        else:
            # Likely a product the shop doesn't stock yet: pre-fill a new product.
            name = item["description"]
            sku = matching.suggest_sku(name, taken)
            taken.add(sku)
            cost = item["unit_price"] or 0
            line.action, line.match_score = "create", top["score"] if top else 0
            line.new_name, line.new_sku, line.new_price = name, sku, round(cost * 1.2, 2) if cost else None
        bill.lines.append(line)
    db.add(bill)
    await db.flush()
    db.add(SupplierBillImage(bill_id=bill.id, mime=mime, data=data))
    await db.flush()
    return await bill_out(db, bill)


@router.get("/{bill_id}")
async def get_bill(bill_id: int, _: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    return await bill_out(db, await _get(db, bill_id))


@router.get("/{bill_id}/image")
async def bill_image(bill_id: int, _: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    img = (await db.execute(select(SupplierBillImage).where(SupplierBillImage.bill_id == bill_id))).scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="No photo for this bill")
    return Response(content=img.data, media_type=img.mime, headers={"Cache-Control": "private, max-age=3600"})


@router.patch("/{bill_id}")
async def update_bill(bill_id: int, body: BillPatch, _: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    bill = await _get(db, bill_id)
    if bill.status != "draft":
        raise HTTPException(status_code=400, detail=f"This bill is already {bill.status}")
    changes = body.model_dump(exclude_unset=True, exclude={"lines"})
    if "supplier_id" in changes and changes["supplier_id"] and not await db.get(Supplier, changes["supplier_id"]):
        raise HTTPException(status_code=400, detail="Unknown supplier")
    for k, v in changes.items():
        setattr(bill, k, v)
    if body.lines is not None:
        by_id = {l.id: l for l in bill.lines}
        for li in body.lines:
            line = by_id.get(li.id)
            if not line:
                raise HTTPException(status_code=400, detail=f"Line {li.id} isn't on this bill")
            if li.action == "match" and li.product_id and li.product_id != line.product_id:
                if not await db.get(Product, li.product_id):
                    raise HTTPException(status_code=400, detail=f"Unknown product {li.product_id}")
                line.match_score = 1.0  # chosen by a person
            for k, v in li.model_dump(exclude={"id"}, exclude_unset=True).items():
                setattr(line, k, v)
    await db.flush()
    return await bill_out(db, bill)


@router.post("/{bill_id}/post")
async def post_bill(bill_id: int, user: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    """Add every non-skipped line to stock through the ledger, create new products, remember aliases."""
    bill = await _get(db, bill_id)
    if bill.status != "draft":
        raise HTTPException(status_code=400, detail=f"This bill is already {bill.status}")
    active = [l for l in bill.lines if l.action != "skip"]
    if not active:
        raise HTTPException(status_code=400, detail="Every line is skipped. Nothing to add.")

    problems = []
    existing_skus = set((await db.execute(select(Product.sku))).scalars().all())
    new_skus = set()
    for l in active:
        label = f"Line {l.position + 1} ({l.raw_text})"
        if not l.qty or l.qty <= 0 or l.qty != int(l.qty):
            problems.append(f"{label}: quantity must be a whole number above 0")
        if l.unit_cost is None or l.unit_cost < 0:
            problems.append(f"{label}: enter the cost per unit")
        if l.action == "match" and not l.product_id:
            problems.append(f"{label}: pick a product or mark it as new")
        if l.action == "create":
            sku = (l.new_sku or "").strip()
            if not (l.new_name or "").strip() or not sku:
                problems.append(f"{label}: a new product needs a name and SKU")
            elif sku in existing_skus or sku in new_skus:
                problems.append(f"{label}: SKU {sku} is already used")
            if l.new_price is None:
                problems.append(f"{label}: enter a selling price for the new product")
            new_skus.add(sku)
    if problems:
        raise HTTPException(status_code=400, detail=" · ".join(problems[:6]))

    ref = f"{bill.bill_no or f'BILL-{bill.id:04d}'}"
    created, units, value = [], 0, 0.0
    for l in active:
        if l.action == "create":
            product = Product(name=l.new_name.strip(), sku=l.new_sku.strip(), qty=0, price=l.new_price,
                              cost_price=l.unit_cost, supplier_id=bill.supplier_id, min_stock=5, unit="pcs")
            db.add(product)
            await db.flush()
            l.product_id = product.id
            created.append(product.name)
        else:
            product = await db.get(Product, l.product_id)
            product.cost_price = l.unit_cost  # latest purchase cost becomes the product's cost
        qty = int(l.qty)
        await record_movement(db, product, qty, "purchase", user=user, unit_cost=l.unit_cost,
                              ref_type="bill", ref_id=bill.id, note=f"Bill {ref}")
        units += qty
        value += qty * l.unit_cost
        alias = matching.normalise(l.raw_text or "")
        if alias:
            exists = (await db.execute(select(ProductAlias).where(
                ProductAlias.alias == alias, ProductAlias.supplier_id == bill.supplier_id))).scalar_one_or_none()
            if exists:
                exists.product_id = product.id
            else:
                db.add(ProductAlias(alias=alias, supplier_id=bill.supplier_id, product_id=product.id))

    bill.status = "posted"
    bill.posted_by = user.name
    bill.posted_at = datetime.now(timezone.utc)
    await db.flush()
    return {"bill": await bill_out(db, bill, with_candidates=False),
            "summary": {"lines": len(active), "units": units, "value": round(value, 2), "created": created}}


@router.post("/{bill_id}/discard")
async def discard_bill(bill_id: int, _: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    bill = await _get(db, bill_id)
    if bill.status != "draft":
        raise HTTPException(status_code=400, detail=f"This bill is already {bill.status}")
    bill.status = "discarded"
    return await bill_out(db, bill, with_candidates=False)
