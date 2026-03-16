"""
SwellStack FastAPI Backend
Runs on the Intel NUC on localhost:8000.
FUTURE INTEGRATION: Cloudflare Tunnel will expose this to the internet in production.
"""
import logging
from contextlib import asynccontextmanager

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import buoys, forecast, gear, nlq, optimal, safety, sessions, spots, stoke
from scheduler.jobs import register_jobs
from config import settings

# ─── Logging ──────────────────────────────────────────────────────────────
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer() if settings.debug else structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()

# ─── Scheduler ────────────────────────────────────────────────────────────
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("SwellStack API starting up", environment=settings.environment)
    register_jobs(scheduler)
    scheduler.start()
    logger.info("Scheduler started", jobs=len(scheduler.get_jobs()))
    yield
    scheduler.shutdown()
    logger.info("SwellStack API shut down")


# ─── App ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SwellStack API",
    description="AI-native surf forecasting. More accurate. More personal.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────
app.include_router(spots.router,    prefix="/api/v1", tags=["spots"])
app.include_router(forecast.router, prefix="/api/v1", tags=["forecast"])
app.include_router(buoys.router,    prefix="/api/v1", tags=["buoys"])
app.include_router(sessions.router, prefix="/api/v1", tags=["sessions"])
app.include_router(nlq.router,      prefix="/api/v1", tags=["nlq"])
app.include_router(stoke.router,    prefix="/api/v1", tags=["stoke"])
app.include_router(optimal.router,  prefix="/api/v1", tags=["optimal"])
app.include_router(safety.router,   prefix="/api/v1", tags=["safety"])
app.include_router(gear.router,     prefix="/api/v1", tags=["gear"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/")
async def root():
    return {
        "name": "SwellStack API",
        "docs": "/docs",
        "status": "riding"
    }
