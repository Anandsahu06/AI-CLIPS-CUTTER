import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .database import engine, Base
from .config import settings
from .routers import projects, clips, analytics

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Create database tables if SQLite is used
# (For Postgres in production, migrations are usually run beforehand)
try:
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    
    # Safely alter database schema to add clippingMode and targetDuration columns if not present
    from sqlalchemy import text
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE projects ADD COLUMN clippingMode VARCHAR(50) DEFAULT 'ai'"))
            logger.info("Database schema updated: projects.clippingMode column added.")
        except Exception:
            # Column already exists
            pass
        try:
            conn.execute(text("ALTER TABLE projects ADD COLUMN targetDuration FLOAT DEFAULT 30.0"))
            logger.info("Database schema updated: projects.targetDuration column added.")
        except Exception:
            # Column already exists
            pass
        try:
            conn.execute(text("ALTER TABLE projects ADD COLUMN burnSubtitles BOOLEAN DEFAULT 1"))
            logger.info("Database schema updated: projects.burnSubtitles column added.")
        except Exception:
            # Column already exists
            pass
            
    logger.info("Database initialized successfully.")
except Exception as e:
    logger.error(f"Failed to initialize database: {e}")

app = FastAPI(
    title="ClipForge AI API",
    description="Backend processing engine for auto-cropping and subtitling vertical short clips",
    version="1.0.0"
)

# CORS configurations for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local media directory to serve files (videos, thumbnails, subtitles) directly to the web player
# Accessible via: http://localhost:8000/media/clips/{clip_id}.mp4
app.mount("/media", StaticFiles(directory=settings.MEDIA_DIR), name="media")

# Register routes
app.include_router(projects.router)
app.include_router(clips.router)
app.include_router(analytics.router)

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "ClipForge AI",
        "storage_mode": settings.STORAGE_TYPE
    }
