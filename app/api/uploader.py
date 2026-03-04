from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.schema import Product, Category, Supplier
import pandas as pd
import json
import io
import logging
from typing import List, Dict
import defusedxml.ElementTree as ET

logger = logging.getLogger(__name__)
router = APIRouter()

def validate_row(row: Dict, required_fields: List[str]):
    for field in required_fields:
        if field not in row or pd.isna(row[field]):
            return False, f"Missing required field: {field}"
    return True, None

from sqlalchemy import text

async def reset_sequences(db: AsyncSession):
    """
    Ensure PostgreSQL sequences are in sync with the actual data.
    """
    try:
        await db.execute(text("SELECT setval('products_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM products), false)"))
        await db.execute(text("SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM categories), false)"))
        await db.execute(text("SELECT setval('suppliers_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM suppliers), false)"))
        await db.execute(text("SELECT setval('sales_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM sales), false)"))
        await db.commit()
    except Exception as e:
        logger.warning(f"Could not reset sequences (non-Postgres?): {e}")

@router.post("/upload")
async def upload_data(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Process uploaded files (CSV, JSON, XML, Excel) and sync with IMS inventory.
    """
    filename = file.filename
    
    try:
        # 0. SYNC SEQUENCES BEFORE STARTING
        await reset_sequences(db)
        
        contents = await file.read()
        df = None
        
        # 1. PARSE DIFFERENT FORMATS
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(contents))
        elif filename.endswith('.json'):
            data = json.loads(contents)
            df = pd.DataFrame(data)
        elif filename.endswith('.xml'):
            root = ET.fromstring(contents)
            rows = []
            for item in root:
                row = {child.tag: child.text for child in item}
                rows.append(row)
            df = pd.DataFrame(rows)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Use CSV, Excel, JSON, or XML.")

        if df is None or df.empty:
            raise HTTPException(status_code=400, detail="File is empty.")

        # 2. STANDARDIZE COLUMNS
        df.columns = [c.lower().strip() for c in df.columns]
        required = ['name', 'sku', 'qty', 'price']
        
        # 3. PROCESS ROWS
        results = {"added": 0, "updated": 0, "errors": []}
        
        # Pre-fetch existing products by SKU to avoid N+1 queries
        skus = [str(row['sku']).strip() for index, row in df.iterrows() if 'sku' in row and not pd.isna(row['sku'])]
        from sqlalchemy.future import select
        stmt = select(Product).where(Product.sku.in_(skus))
        p_res = await db.execute(stmt)
        existing_products = {p.sku: p for p in p_res.scalars().all()}
        
        new_products = []
        
        async with db.begin_nested():
            for index, row in df.iterrows():
                row_dict = row.to_dict()
                is_valid, error = validate_row(row_dict, required)
                if not is_valid:
                    results["errors"].append(f"Row {index + 1}: {error}")
                    continue
                    
                sku = str(row['sku']).strip()
                product = existing_products.get(sku)
                
                if product:
                    product.name = str(row['name'])
                    product.qty = int(row['qty'])
                    product.price = float(row['price'])
                    product.brand = str(row.get('brand', 'Unknown'))
                    results["updated"] += 1
                else:
                    new_p = Product(
                        name=str(row['name']),
                        sku=sku,
                        qty=int(row['qty']),
                        price=float(row['price']),
                        brand=str(row.get('brand', 'Unknown')),
                        min_stock=5
                    )
                    db.add(new_p)
                    new_products.append(new_p)
                    results["added"] += 1
            
            # Flush bulk inserts to let sequence values flow in properly
            if new_products:
                await db.flush()
        
        # 4. FINAL COMMIT
        await db.commit()
        
        return {
            "message": f"Successfully processed {filename}",
            "summary": results,
            "total_rows": len(df)
        }

    except Exception as e:
        logger.error(f"Uploader error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
