from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.schema import Sale, Product
from pydantic import BaseModel
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class SaleCreate(BaseModel):
    product_id: int
    qty: int
    unit_price: float
    total_price: float
    customer: Optional[str] = None
    sold_by: str

@router.post("/")
async def create_sale(sale_data: SaleCreate, db: AsyncSession = Depends(get_db)):
    """
    Record a new sale and deduct stock from product.
    """
    try:
        # 1. Verify product and stock
        p_query = select(Product).where(Product.id == sale_data.product_id)
        p_result = await db.execute(p_query)
        product = p_result.scalar_one_or_none()
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        if product.qty < sale_data.qty:
            raise HTTPException(status_code=400, detail=f"Insufficient stock. Only {product.qty} units available.")
        
        # 2. Deduct stock
        product.qty -= sale_data.qty
        
        # 3. Create sale record
        new_sale = Sale(
            product_id=sale_data.product_id,
            qty=sale_data.qty,
            unit_price=sale_data.unit_price,
            total_price=sale_data.total_price,
            customer=sale_data.customer,
            sold_by=sale_data.sold_by
        )
        
        db.add(new_sale)
        await db.commit()
        await db.refresh(new_sale)
        
        return new_sale
        
    except HTTPException as he:
        raise he
    except Exception as e:
        await db.rollback()
        logger.error(f"Error recording sale: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/")
async def get_sales(db: AsyncSession = Depends(get_db)):
    """
    Get all sales records.
    """
    try:
        query = select(Sale).order_by(Sale.date.desc())
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error fetching sales: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")