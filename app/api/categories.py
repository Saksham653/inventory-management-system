from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import ADMINS, ANY_USER, MANAGERS
from app.models.schema import Category, Product, User

router = APIRouter()


class CategoryIn(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None


class CategoryPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    description: str | None = None


def category_out(c: Category, product_count: int = 0) -> dict:
    return {"id": c.id, "name": c.name, "description": c.description,
            "product_count": product_count, "created_at": c.created_at}


async def _name_taken(db: AsyncSession, name: str, exclude_id: int | None = None) -> bool:
    q = select(Category.id).where(func.lower(Category.name) == name.lower())
    if exclude_id:
        q = q.where(Category.id != exclude_id)
    return (await db.execute(q)).first() is not None


@router.get("/")
async def list_categories(_: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    counts = dict((await db.execute(select(Product.cat_id, func.count(Product.id)).group_by(Product.cat_id))).all())
    cats = (await db.execute(select(Category).order_by(Category.name))).scalars().all()
    return [category_out(c, counts.get(c.id, 0)) for c in cats]


@router.post("/", status_code=201)
async def create_category(body: CategoryIn, _: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    name = body.name.strip()
    if await _name_taken(db, name):
        raise HTTPException(status_code=409, detail=f"A category called {name} already exists")
    c = Category(name=name, description=body.description)
    db.add(c)
    await db.flush()
    await db.refresh(c)
    return category_out(c)


@router.patch("/{category_id}")
async def update_category(category_id: int, body: CategoryPatch, _: User = MANAGERS,
                          db: AsyncSession = Depends(get_db)):
    c = await db.get(Category, category_id)
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    changes = body.model_dump(exclude_unset=True)
    if "name" in changes:
        changes["name"] = changes["name"].strip()
        if await _name_taken(db, changes["name"], exclude_id=c.id):
            raise HTTPException(status_code=409, detail=f"A category called {changes['name']} already exists")
    for k, v in changes.items():
        setattr(c, k, v)
    return category_out(c)


@router.delete("/{category_id}", status_code=204)
async def delete_category(category_id: int, _: User = ADMINS, db: AsyncSession = Depends(get_db)):
    c = await db.get(Category, category_id)
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    # Products keep existing, just uncategorised.
    await db.execute(update(Product).where(Product.cat_id == c.id).values(cat_id=None))
    await db.delete(c)
