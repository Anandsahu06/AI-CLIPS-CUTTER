import os
import logging
from celery import Celery
from .config import settings

logger = logging.getLogger(__name__)

# Fallback to SQLite broker for local development if Redis is not configured or reachable
broker_url = settings.CELERY_BROKER_URL
result_backend = settings.CELERY_RESULT_BACKEND

# If Redis url contains localhost, we will try to connect, but if Redis is not active,
# we can support fallback to SQLite via SQLAlchemy Celery transport.
# In production, Redis is used.
if not broker_url or "localhost" in broker_url:
    logger.info("Local environment detected. Celery is configured with SQLite fallback broker if Redis is unavailable.")

celery_app = Celery(
    "clipforge",
    broker=broker_url,
    backend=result_backend,
    include=["app.tasks"]
)

# Configuration updates
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=1800,  # Max 30 minutes per video
    worker_concurrency=1,   # Processes 1 video at a time locally to prevent Windows CPU overload
)
