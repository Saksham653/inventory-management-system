"""FastAPI dependencies for authentication and role checks."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.schema import User

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not signed in or session expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    user_id = decode_token(creds.credentials, "access")
    if user_id is None:
        raise unauthorized
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user


def require_roles(*roles: str):
    """Dependency factory: allow only users whose role is in `roles`."""
    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="You don't have permission to do this")
        return user
    return checker


ANY_USER = Depends(get_current_user)
MANAGERS = Depends(require_roles("admin", "manager"))
ADMINS = Depends(require_roles("admin"))
