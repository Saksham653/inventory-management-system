"""Command bar: type a command, see a preview, confirm, undo."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import ANY_USER
from app.models.schema import User
from app.services import commands, llm

router = APIRouter()


class CommandIn(BaseModel):
    text: str = Field(min_length=1, max_length=300)


def _wrap(e: commands.CommandError):
    return HTTPException(status_code=e.status, detail=str(e))


@router.get("/info")
async def info(_: User = ANY_USER):
    return {"ai": llm.provider() is not None, "examples": commands.EXAMPLES}


@router.post("/plan")
async def plan(body: CommandIn, user: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    try:
        return await commands.plan(db, user, body.text)
    except commands.CommandError as e:
        raise _wrap(e)


@router.post("/actions/{action_id}/execute")
async def execute(action_id: int, user: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    try:
        return await commands.execute(db, user, action_id)
    except commands.CommandError as e:
        if e.status == 400 and "15 minutes" in str(e):
            await db.commit()  # keep the "expired" status
        raise _wrap(e)


@router.post("/actions/{action_id}/undo")
async def undo(action_id: int, user: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    try:
        return await commands.undo(db, user, action_id)
    except commands.CommandError as e:
        raise _wrap(e)


@router.get("/actions")
async def actions(user: User = ANY_USER, db: AsyncSession = Depends(get_db)):
    return await commands.history(db, user)
