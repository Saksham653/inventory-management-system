import io
import json
import logging

import defusedxml.ElementTree as ET
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import MANAGERS
from app.models.schema import Product, User
from app.services.stock import record_movement

logger = logging.getLogger(__name__)
router = APIRouter()

REQUIRED = ["name", "sku", "qty", "price"]
MAX_BYTES = 5 * 1024 * 1024


async def reset_sequences(db: AsyncSession):
    """Keep Postgres id sequences in sync after rows were inserted with explicit ids."""
    if settings.is_sqlite:
        return
    for table in ("products", "categories", "suppliers", "sales"):
        await db.execute(text(
            f"SELECT setval('{table}_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM {table}), false)"))


def _read(filename: str, contents: bytes) -> pd.DataFrame:
    name = filename.lower()
    if name.endswith(".csv"):
        return pd.read_csv(io.BytesIO(contents))
    if name.endswith((".xls", ".xlsx")):
        return pd.read_excel(io.BytesIO(contents))
    if name.endswith(".json"):
        return pd.DataFrame(json.loads(contents))
    if name.endswith(".xml"):
        root = ET.fromstring(contents)
        return pd.DataFrame([{child.tag: child.text for child in item} for item in root])
    raise HTTPException(status_code=400, detail="Unsupported file type. Use CSV, Excel, JSON or XML.")


def _num(v, cast, default=None):
    if v is None or (isinstance(v, float) and pd.isna(v)) or v == "":
        return default
    return cast(float(v))


@router.post("/upload")
async def upload_data(file: UploadFile = File(...), user: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    """Create or update products from a file. Stock changes are written to the ledger."""
    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 5 MB")
    try:
        df = _read(file.filename or "", contents)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Couldn't read the file: {e}")
    if df.empty:
        raise HTTPException(status_code=400, detail="The file has no rows")

    df.columns = [str(c).lower().strip() for c in df.columns]
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing)}")

    await reset_sequences(db)
    skus = [str(s).strip() for s in df["sku"].dropna()]
    existing = {p.sku: p for p in (await db.execute(select(Product).where(Product.sku.in_(skus)))).scalars()}

    results = {"added": 0, "updated": 0, "errors": []}
    for index, row in df.iterrows():
        line = index + 2  # header is line 1
        try:
            if any(pd.isna(row[c]) for c in REQUIRED):
                raise ValueError("name, sku, qty and price are required")
            sku = str(row["sku"]).strip()
            qty = _num(row["qty"], int)
            price = _num(row["price"], float)
            cost = _num(row.get("cost_price"), float)
            if qty < 0 or price < 0:
                raise ValueError("qty and price can't be negative")
        except (ValueError, TypeError) as e:
            results["errors"].append(f"Line {line}: {e}")
            continue

        brand = None if pd.isna(row.get("brand")) else str(row.get("brand"))
        product = existing.get(sku)
        if product:
            product.name = str(row["name"])
            product.price = price
            if brand:
                product.brand = brand
            if cost is not None:
                product.cost_price = cost
            if qty != product.qty:
                await record_movement(db, product, qty - product.qty, "adjust", user=user,
                                      ref_type="import", note=f"Import from {file.filename}")
            results["updated"] += 1
        else:
            product = Product(name=str(row["name"]), sku=sku, qty=0, price=price, cost_price=cost or 0,
                              brand=brand or "Unknown", min_stock=5)
            db.add(product)
            await db.flush()
            existing[sku] = product
            if qty:
                await record_movement(db, product, qty, "opening", user=user,
                                      ref_type="import", note=f"Import from {file.filename}")
            results["added"] += 1

    return {"message": f"Processed {file.filename}", "summary": results, "total_rows": len(df)}
