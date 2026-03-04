from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.core.database import get_db
from app.models.schema import Product, Sale, PriceTier
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
async def get_products(db: AsyncSession = Depends(get_db)):
    """
    Get all products.
    """
    try:
        query = select(Product).order_by(Product.name)
        result = await db.execute(query)
        products = result.scalars().all()
        return [
            {
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "qty": p.qty,
                "thresh": p.min_stock,
                "lead_time_days": p.lead_time_days,
                "price": p.price,
                "brand": p.brand,
                "catId": p.cat_id
            }
            for p in products
        ]
    except Exception as e:
        logger.error(f"Error fetching products: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{product_id}/price")
async def get_dynamic_price(product_id: int, qty: int, db: AsyncSession = Depends(get_db)):
    """
    Get dynamic price based on quantity tiers for a specific product.
    Returns the lowest applicable price for the given quantity.
    """
    try:
        # Get base price and tiers
        query = select(Product).where(Product.id == product_id)
        result = await db.execute(query)
        product = result.scalar_one_or_none()
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Start with base price
        final_price = product.price
        
        # Check for applicable tiers
        tier_query = select(PriceTier).where(
            PriceTier.product_id == product_id,
            PriceTier.min_qty <= qty
        ).order_by(PriceTier.min_qty.desc()).limit(1)
        
        tier_result = await db.execute(tier_query)
        best_tier = tier_result.scalar_one_or_none()
        
        if best_tier:
            final_price = best_tier.price
            
        return {
            "product_id": product_id,
            "qty": qty,
            "unit_price": final_price,
            "is_tiered": final_price != product.price
        }
        
    except Exception as e:
        logger.error(f"Error calculating dynamic price: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/replenishment-risk")
async def get_replenishment_risk(db: AsyncSession = Depends(get_db)):
    """
    Calculate replenishment risk for all products based on sales velocity.
    Days of Cover = Stock / Average Sales Velocity (30 days)
    Risk exists if Days of Cover < Lead Time + 3 (buffer)
    """
    try:
        # Get sales velocity over last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        # Calculate velocity: total units sold / 30
        velocity_query = select(
            Sale.product_id,
            (func.sum(Sale.qty) / 30.0).label("avg_velocity")
        ).where(Sale.date >= thirty_days_ago).group_by(Sale.product_id)
        
        velocity_results = await db.execute(velocity_query)
        velocities = {row.product_id: row.avg_velocity for row in velocity_results}
        
        # Get all products
        products_query = select(Product)
        products_result = await db.execute(products_query)
        products = products_result.scalars().all()
        
        risk_report = []
        for p in products:
            velocity = velocities.get(p.id, 0.0)
            
            # Avoid division by zero
            if velocity > 0:
                days_of_cover = p.qty / velocity
            else:
                days_of_cover = float('inf') # Plenty of stock if no sales
            
            # Risk condition: Days of Cover < Lead Time + 3
            is_at_risk = days_of_cover < (p.lead_time_days + 3)
            
            risk_report.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "qty": p.qty,
                "avg_velocity": round(velocity, 2),
                "days_of_cover": round(days_of_cover, 1) if days_of_cover != float('inf') else 999,
                "lead_time": p.lead_time_days,
                "at_risk": is_at_risk
            })
            
        return sorted(risk_report, key=lambda x: x["days_of_cover"])
        
    except Exception as e:
        logger.error(f"Error calculating PSR: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
