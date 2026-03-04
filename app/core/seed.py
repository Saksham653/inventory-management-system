from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.models.schema import Category, Supplier, Product, Employee, Sale
from datetime import datetime, timedelta

async def seed_data(db: AsyncSession):
    # Check if we already have data
    result = await db.execute(select(func.count(Category.id)))
    if result.scalar() > 0:
        return

    # 1. Categories
    cats = [
        Category(name="Smartphones"),
        Category(name="Laptops"),
        Category(name="Accessories"),
        Category(name="Tablets"),
    ]
    db.add_all(cats)
    await db.flush()

    # 2. Suppliers
    sups = [
        Supplier(name="Apple Pvt Ltd", contact="9876543210", email="supply@apple.com"),
        Supplier(name="Samsung Electronics", contact="8765432109", email="b2b@samsung.com"),
        Supplier(name="Vivo Pvt Ltd", contact="7654321098", email="supply@vivo.com"),
        Supplier(name="HP India", contact="6543210987", email="supply@hp.com"),
    ]
    db.add_all(sups)
    await db.flush()

    # 3. Products
    # Fetch category ID for Smartphones (index 0)
    cat_id = cats[0].id
    prods = [
        Product(name="Vivo V12", sku="VIV-V12", cat_id=cat_id, qty=20, price=20000.0, brand="VIVO", min_stock=5, lead_time_days=3),
        Product(name="iPhone 15 Pro", sku="APL-IP15P", cat_id=cat_id, qty=3, price=134900.0, brand="APPLE", min_stock=5, lead_time_days=5),
        Product(name="Samsung Galaxy S24", sku="SAM-GS24", cat_id=cat_id, qty=15, price=79999.0, brand="SAMSUNG", min_stock=5, lead_time_days=3),
    ]
    db.add_all(prods)
    await db.flush()

    # 4. Employees
    emps = [
        Employee(name="Raj Patel", email="raj@sam.com", role="Admin"),
        Employee(name="Priya Singh", email="priya@sam.com", role="Manager"),
    ]
    db.add_all(emps)
    await db.flush()

    # 5. Sales (Seed some sales for PSR)
    today = datetime.utcnow()
    sales = [
        Sale(product_id=prods[0].id, qty=3, unit_price=20000.0, total_price=60000.0, sold_by="Raj Patel", date=today - timedelta(days=1)),
        Sale(product_id=prods[0].id, qty=2, unit_price=20000.0, total_price=40000.0, sold_by="Priya Singh", date=today - timedelta(days=2)),
        Sale(product_id=prods[1].id, qty=2, unit_price=134900.0, total_price=269800.0, sold_by="Raj Patel", date=today - timedelta(days=1)),
    ]
    db.add_all(sales)
    
    await db.commit()
