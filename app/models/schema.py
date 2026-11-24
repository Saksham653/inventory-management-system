from datetime import timezone

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import TypeDecorator

from app.core.database import Base

class UTCDateTime(TypeDecorator):
    """Timestamps always come back timezone-aware (UTC). SQLite otherwise returns naive values,
    which browsers would misread as local time."""
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
            if dialect.name == "sqlite":
                value = value.replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


ROLES = ("admin", "manager", "staff")

# Every change to Product.qty is recorded as a StockMovement of one of these types.
MOVEMENT_TYPES = ("opening", "purchase", "sale", "adjust", "return", "void")


class User(Base):
    """A person who can log in. Separate from Employee (HR record)."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="staff")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(UTCDateTime, server_default=func.now())


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String)
    created_at = Column(UTCDateTime, server_default=func.now())


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    contact = Column(String)
    email = Column(String)
    address = Column(String)
    description = Column(String)
    lead_time_days = Column(Integer, default=3)
    created_at = Column(UTCDateTime, server_default=func.now())


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    sku = Column(String, unique=True, index=True)
    qty = Column(Integer, default=0)
    min_stock = Column(Integer, default=10)
    lead_time_days = Column(Integer, default=3)
    price = Column(Float)               # selling price
    cost_price = Column(Float, default=0)  # what we pay the supplier; drives money insights
    unit = Column(String, default="pcs")
    brand = Column(String)
    cat_id = Column(Integer, ForeignKey("categories.id"))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    created_at = Column(UTCDateTime, server_default=func.now())

    price_tiers = relationship("PriceTier", back_populates="product", cascade="all, delete-orphan")


class PriceTier(Base):
    __tablename__ = "price_tiers"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    min_qty = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)

    product = relationship("Product", back_populates="price_tiers")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    qty = Column(Integer)
    unit_price = Column(Float)
    unit_cost = Column(Float, default=0)  # cost snapshot at time of sale, for margin
    total_price = Column(Float)
    customer = Column(String)
    sold_by = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(UTCDateTime, server_default=func.now())


class StockMovement(Base):
    """Append-only stock ledger. Product.qty always equals the sum of qty_change."""
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True, nullable=False)
    type = Column(String, nullable=False)
    qty_change = Column(Integer, nullable=False)
    qty_after = Column(Integer, nullable=False)
    unit_cost = Column(Float)
    ref_type = Column(String)   # e.g. "sale", "import"
    ref_id = Column(Integer)
    note = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    user_name = Column(String)
    created_at = Column(UTCDateTime, server_default=func.now(), index=True)


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    role = Column(String)
    gender = Column(String)
    contact = Column(String)
    dob = Column(Date)
    doj = Column(Date)
    address = Column(String)
    salary = Column(Float)
    created_at = Column(UTCDateTime, server_default=func.now())


PO_STATUSES = ("draft", "sent", "received", "cancelled")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    status = Column(String, nullable=False, default="draft")
    note = Column(String)
    source = Column(String)  # e.g. "radar" when drafted from Paisa Radar
    created_by = Column(String)
    created_at = Column(UTCDateTime, server_default=func.now())
    sent_at = Column(UTCDateTime)
    received_at = Column(UTCDateTime)

    lines = relationship("PurchaseOrderLine", back_populates="order", cascade="all, delete-orphan",
                         lazy="selectin")


class PurchaseOrderLine(Base):
    __tablename__ = "purchase_order_lines"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("purchase_orders.id"), index=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    qty = Column(Integer, nullable=False)
    unit_cost = Column(Float, default=0)

    order = relationship("PurchaseOrder", back_populates="lines")
