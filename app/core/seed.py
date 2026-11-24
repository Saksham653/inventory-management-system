"""Startup data: demo users and a sample electronics shop with ~5 months of history."""
import logging
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.models.schema import Category, Employee, Product, Sale, StockMovement, Supplier, User

logger = logging.getLogger(__name__)

# Public demo logins (also listed in the README). Only seeded when SEED_DEMO is on.
DEMO_ACCOUNTS = [
    {"name": "Admin User", "email": "admin@sam.com", "password": "admin123", "role": "admin"},
    {"name": "Sarah Chen", "email": "manager@sam.com", "password": "pass123", "role": "manager"},
    {"name": "John Staff", "email": "staff@sam.com", "password": "pass123", "role": "staff"},
]

HISTORY_DAYS = 150

# name, sku, category, supplier, price, cost, qty now, min, lead,
# (first_day_ago, last_day_ago, daily sale chance, max units per sale)
CATALOG = [
    ("Vivo V12", "VIV-V12", "Smartphones", "Vivo Pvt Ltd", 20000, 17600, 20, 5, 3, (150, 63, 0.30, 2)),
    ("iPhone 15 Pro", "APL-IP15P", "Smartphones", "Apple Pvt Ltd", 134900, 118500, 3, 5, 6, (150, 1, 0.38, 1)),
    ("Samsung Galaxy S24", "SAM-GS24", "Smartphones", "Samsung Electronics", 79999, 70400, 15, 5, 4, (150, 1, 0.45, 2)),
    ("MacBook Air M3", "APL-MBA", "Laptops", "Apple Pvt Ltd", 114900, 101100, 8, 3, 6, (150, 96, 0.12, 1)),
    ("HP Pavilion 15", "HP-PAV15", "Laptops", "HP India", 52000, 45800, 2, 3, 5, (150, 2, 0.20, 1)),
    ("USB-C Hub 7-in-1", "ACC-HUB7", "Accessories", "Samsung Electronics", 2499, 2200, 45, 10, 4, (150, 3, 0.14, 2)),
    ("iPad Air 5", "APL-IPAD5", "Tablets", "Apple Pvt Ltd", 59900, 51200, 6, 3, 6, (150, 35, 0.15, 1)),
]

CATEGORIES = [
    ("Smartphones", "Mobile phones"),
    ("Laptops", "Notebooks and ultrabooks"),
    ("Accessories", "Chargers, hubs and add-ons"),
    ("Tablets", "iPad and Android tablets"),
]

SUPPLIERS = [
    ("Apple Pvt Ltd", "9876543210", "supply@apple.example", "Bengaluru", "iPhone, iPad and Mac", 6),
    ("Samsung Electronics", "8765432109", "b2b@samsung.example", "Gurugram", "Galaxy phones and accessories", 4),
    ("Vivo Pvt Ltd", "7654321098", "supply@vivo.example", "Mumbai", "Budget smartphones", 3),
    ("HP India", "6543210987", "supply@hp.example", "Bengaluru", "Laptops and peripherals", 5),
]

EMPLOYEES = [
    ("Raj Patel", "raj@sam.com", "Admin", "Male", "9876543210", date(1990, 3, 15), date(2022, 1, 10), "Mumbai", 75000),
    ("Priya Singh", "priya@sam.com", "Manager", "Female", "8765432109", date(1993, 7, 22), date(2022, 3, 15), "Delhi", 55000),
    ("Amit Kumar", "amit@sam.com", "Staff", "Male", "7654321098", date(1995, 11, 8), date(2023, 6, 1), "Bengaluru", 35000),
    ("Sneha Joshi", "sneha@sam.com", "Staff", "Female", "6543210987", date(1997, 2, 14), date(2023, 9, 20), "Pune", 32000),
]


async def seed_users(db: AsyncSession) -> None:
    count = (await db.execute(select(func.count(User.id)))).scalar()
    if count:
        return
    if settings.SEED_DEMO:
        for a in DEMO_ACCOUNTS:
            db.add(User(name=a["name"], email=a["email"], role=a["role"], password_hash=hash_password(a["password"])))
        logger.info("Seeded demo users")
    demo_emails = {a["email"] for a in DEMO_ACCOUNTS} if settings.SEED_DEMO else set()
    admin_email = settings.ADMIN_EMAIL.strip().lower()
    if admin_email and settings.ADMIN_PASSWORD and admin_email not in demo_emails:
        db.add(User(name=settings.ADMIN_NAME, email=admin_email, role="admin",
                    password_hash=hash_password(settings.ADMIN_PASSWORD)))
        logger.info("Created first admin %s", admin_email)
    await db.commit()


async def seed_catalog(db: AsyncSession) -> None:
    if not settings.SEED_DEMO:
        return
    if (await db.execute(select(func.count(Category.id)))).scalar():
        return

    cats = {name: Category(name=name, description=desc) for name, desc in CATEGORIES}
    sups = {
        name: Supplier(name=name, contact=contact, email=email, address=addr, description=desc, lead_time_days=lead)
        for name, contact, email, addr, desc, lead in SUPPLIERS
    }
    db.add_all([*cats.values(), *sups.values()])
    for name, email, role, gender, contact, dob, doj, addr, salary in EMPLOYEES:
        db.add(Employee(name=name, email=email, role=role, gender=gender, contact=contact,
                        dob=dob, doj=doj, address=addr, salary=salary))
    await db.flush()

    rng = random.Random(42)  # same history on every fresh install
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    sellers = ["Raj Patel", "Priya Singh", "Amit Kumar", "Sneha Joshi"]

    for name, sku, cat, sup, price, cost, qty_now, min_stock, lead, (first, last, chance, max_units) in CATALOG:
        # Simulate sales first so the opening stock works out to today's quantity.
        sales_plan = []
        for days_ago in range(first, last - 1, -1):
            if rng.random() < chance or days_ago == last:
                sales_plan.append((days_ago, rng.randint(1, max_units)))
        opening = qty_now + sum(q for _, q in sales_plan)

        p = Product(name=name, sku=sku, cat_id=cats[cat].id, supplier_id=sups[sup].id, price=price,
                    cost_price=cost, qty=0, min_stock=min_stock, lead_time_days=lead,
                    brand=sup.split()[0].upper(), unit="pcs")
        db.add(p)
        await db.flush()

        running = opening
        db.add(StockMovement(product_id=p.id, type="opening", qty_change=opening, qty_after=opening,
                             unit_cost=cost, note="Opening stock", user_name="Admin User",
                             created_at=now - timedelta(days=HISTORY_DAYS + 1)))
        for days_ago, units in sales_plan:
            at = now - timedelta(days=days_ago, hours=rng.randint(0, 9))
            seller = rng.choice(sellers)
            sale = Sale(product_id=p.id, qty=units, unit_price=price, unit_cost=cost, total_price=units * price,
                        customer=f"98{rng.randint(10000000, 99999999)}", sold_by=seller, date=at)
            db.add(sale)
            await db.flush()
            running -= units
            db.add(StockMovement(product_id=p.id, type="sale", qty_change=-units, qty_after=running,
                                 unit_cost=cost, ref_type="sale", ref_id=sale.id, user_name=seller, created_at=at))
        p.qty = running
    await db.commit()
    logger.info("Seeded demo catalogue")


async def seed_data(db: AsyncSession) -> None:
    await seed_users(db)
    await seed_catalog(db)
