from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import ADMINS, MANAGERS
from app.models.schema import Employee, User

router = APIRouter()


class EmployeeIn(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    role: str = "Staff"
    gender: str | None = None
    contact: str | None = None
    dob: date | None = None
    doj: date | None = None
    address: str | None = None
    salary: float | None = Field(default=None, ge=0)


class EmployeePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    email: EmailStr | None = None
    role: str | None = None
    gender: str | None = None
    contact: str | None = None
    dob: date | None = None
    doj: date | None = None
    address: str | None = None
    salary: float | None = Field(default=None, ge=0)


def employee_out(e: Employee) -> dict:
    return {"id": e.id, "name": e.name, "email": e.email, "role": e.role, "gender": e.gender,
            "contact": e.contact, "dob": e.dob, "doj": e.doj, "address": e.address, "salary": e.salary}


async def _email_taken(db: AsyncSession, email: str, exclude_id: int | None = None) -> bool:
    q = select(Employee.id).where(Employee.email == email)
    if exclude_id:
        q = q.where(Employee.id != exclude_id)
    return (await db.execute(q)).first() is not None


# Salaries and personal details: managers can view, only admins can change.
@router.get("/")
async def list_employees(_: User = MANAGERS, db: AsyncSession = Depends(get_db)):
    emps = (await db.execute(select(Employee).order_by(Employee.name))).scalars().all()
    return [employee_out(e) for e in emps]


@router.post("/", status_code=201)
async def create_employee(body: EmployeeIn, _: User = ADMINS, db: AsyncSession = Depends(get_db)):
    email = body.email.lower()
    if await _email_taken(db, email):
        raise HTTPException(status_code=409, detail="An employee with this email already exists")
    e = Employee(**body.model_dump(exclude={"email"}), email=email)
    db.add(e)
    await db.flush()
    return employee_out(e)


@router.patch("/{employee_id}")
async def update_employee(employee_id: int, body: EmployeePatch, _: User = ADMINS,
                          db: AsyncSession = Depends(get_db)):
    e = await db.get(Employee, employee_id)
    if not e:
        raise HTTPException(status_code=404, detail="Employee not found")
    changes = body.model_dump(exclude_unset=True)
    if "email" in changes and changes["email"]:
        changes["email"] = changes["email"].lower()
        if await _email_taken(db, changes["email"], exclude_id=e.id):
            raise HTTPException(status_code=409, detail="An employee with this email already exists")
    for k, v in changes.items():
        setattr(e, k, v)
    return employee_out(e)


@router.delete("/{employee_id}", status_code=204)
async def delete_employee(employee_id: int, _: User = ADMINS, db: AsyncSession = Depends(get_db)):
    e = await db.get(Employee, employee_id)
    if not e:
        raise HTTPException(status_code=404, detail="Employee not found")
    await db.delete(e)
