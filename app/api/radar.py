from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import ANY_USER
from app.models.schema import User
from app.services.radar import compute_radar

router = APIRouter()


@router.get("/")
async def radar(_: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    """Paisa Radar: stuck cash, items running out, and ranked actions."""
    return await compute_radar(db)
