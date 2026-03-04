from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import logging, time, os
from pathlib import Path

from app.core.config import settings
from app.core.database import engine
from app.models.schema import Base
from app.core.seed import seed_data
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import auth, employees, suppliers, products, categories, sales, chatbot, dashboard, uploader

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        # Seed data
        async with AsyncSession(engine) as db:
            await seed_data(db)
    except Exception as e:
        logger.error(f"Lifespan error: {e}")
        
    yield

app = FastAPI(
    title="SAM IMS API",
    description="Inventory Management System with AI Assistant",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gzip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Middleware for request logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} - {response.status_code} ({duration:.2f}s)")
    return response

# ── Serve built React frontend (production) ──────────────────────────────────
FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"

# Root endpoint
@app.get("/")
async def root():
    if FRONTEND_DIST.is_dir():
        return FileResponse(str(FRONTEND_DIST / "index.html"))
    return {"status": "online", "service": "SAM IMS API", "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")}

# API v1 routes
app.include_router(auth.router,       prefix="/api/v1/auth",       tags=["Auth"])
app.include_router(products.router,   prefix="/api/v1/products",   tags=["Products"])
app.include_router(categories.router, prefix="/api/v1/categories", tags=["Categories"])
app.include_router(suppliers.router,  prefix="/api/v1/suppliers",  tags=["Suppliers"])
app.include_router(employees.router,  prefix="/api/v1/employees",  tags=["Employees"])
app.include_router(sales.router,      prefix="/api/v1/sales",      tags=["Sales"])
app.include_router(dashboard.router,  prefix="/api/v1/dashboard",  tags=["Dashboard"])
app.include_router(chatbot.router,    prefix="/api/v1/chatbot",    tags=["AI Assistant"])
app.include_router(uploader.router,   prefix="/api/v1/uploader",   tags=["Data Uploader"])

if FRONTEND_DIST.is_dir():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="static-assets")

    # Catch-all: serve index.html for any non-API route (SPA routing)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))
