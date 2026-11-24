from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import ADMINS, ANY_USER
from app.core.security import (
    create_access_token, create_refresh_token, decode_token, hash_password, verify_password,
)
from app.core.seed import DEMO_ACCOUNTS
from app.models.schema import ROLES, User

router = APIRouter()


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class UserCreate(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)
    role: str = "staff"


def user_out(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role}


def token_pair(u: User) -> dict:
    return {
        "access_token": create_access_token(u.id),
        "refresh_token": create_refresh_token(u.id),
        "token_type": "bearer",
        "user": user_out(u),
    }


@router.post("/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == body.email.lower()))).scalar_one_or_none()
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return token_pair(user)


@router.post("/refresh")
async def refresh(body: RefreshIn, db: AsyncSession = Depends(get_db)):
    user_id = decode_token(body.refresh_token, "refresh")
    user = await db.get(User, user_id) if user_id else None
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    return token_pair(user)


@router.get("/me")
async def me(user: User = ANY_USER):
    return user_out(user)


@router.get("/demo-accounts")
async def demo_accounts():
    """Lets the login screen offer one-click demo logins, only when demo mode is on."""
    if not settings.SEED_DEMO:
        return []
    return [{"email": a["email"], "password": a["password"], "role": a["role"]} for a in DEMO_ACCOUNTS]


@router.get("/users")
async def list_users(_: User = ADMINS, db: AsyncSession = Depends(get_db)):
    users = (await db.execute(select(User).order_by(User.name))).scalars().all()
    return [user_out(u) for u in users]


@router.post("/users", status_code=201)
async def create_user(body: UserCreate, _: User = ADMINS, db: AsyncSession = Depends(get_db)):
    if body.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of: {', '.join(ROLES)}")
    email = body.email.lower()
    if (await db.execute(select(User).where(User.email == email))).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    user = User(name=body.name, email=email, role=body.role, password_hash=hash_password(body.password))
    db.add(user)
    await db.flush()
    return user_out(user)
