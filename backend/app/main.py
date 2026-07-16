"""AI Data Pipeline Doctor — FastAPI application entrypoint."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, SessionLocal, engine
from .routers import dashboard, incidents, ingest
from .services.knowledge import seed_kb

logging.basicConfig(level=logging.INFO)
settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        added = seed_kb(db)
        if added:
            logging.getLogger(__name__).info("Seeded knowledge base with %d entries", added)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Detect, diagnose, and resolve data pipeline failures in minutes.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(incidents.router)
app.include_router(dashboard.router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "ai_enabled": bool(settings.anthropic_api_key),
    }
