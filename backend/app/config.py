import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///../frontend/prisma/dev.db"
    GEMINI_API_KEY: str = ""
    BACKEND_URL: str = "http://localhost:8000"
    
    # Celery settings
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    
    # Storage settings
    STORAGE_TYPE: str = "local"  # local or s3
    S3_ENDPOINT: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_BUCKET_NAME: str = "clipforge-media"
    
    # Media paths (absolute paths to ensure alignment regardless of current working directory)
    # The default location is backend/media
    MEDIA_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "media"))

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

# Ensure directories exist for processing
os.makedirs(settings.MEDIA_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.MEDIA_DIR, "originals"), exist_ok=True)
os.makedirs(os.path.join(settings.MEDIA_DIR, "audio"), exist_ok=True)
os.makedirs(os.path.join(settings.MEDIA_DIR, "clips"), exist_ok=True)
os.makedirs(os.path.join(settings.MEDIA_DIR, "thumbnails"), exist_ok=True)
os.makedirs(os.path.join(settings.MEDIA_DIR, "subtitles"), exist_ok=True)
