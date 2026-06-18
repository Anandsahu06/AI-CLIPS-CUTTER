import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, Text, TypeDecorator, DateTime as SqlAlchemyDateTime
from sqlalchemy.orm import relationship
from .database import Base

class SafeDateTime(TypeDecorator):
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            if value.isdigit():
                return datetime.fromtimestamp(int(value) / 1000.0, timezone.utc).replace(tzinfo=None)
            try:
                val_str = value.replace('Z', '+00:00')
                return datetime.fromisoformat(val_str)
            except ValueError:
                try:
                    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S.%f")
                except ValueError:
                    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value / 1000.0, timezone.utc).replace(tzinfo=None)
        return value

DateTime = SafeDateTime

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=True)
    email = Column(String(255), unique=True, index=True)
    emailVerified = Column(DateTime, nullable=True)
    image = Column(String(255), nullable=True)
    password = Column(String(255), nullable=True)
    role = Column(String(50), default="USER")
    createdAt = Column(DateTime, default=datetime.utcnow)
    
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    videoUrl = Column(String(500), nullable=True)
    videoPath = Column(String(500), nullable=True)
    audioPath = Column(String(500), nullable=True)
    transcript = Column(Text, nullable=True)  # JSON string
    originalDuration = Column(Float, nullable=True)
    status = Column(String(50), default="PENDING")  # PENDING, DOWNLOADING, TRANSCRIBING, ANALYZING, COMPLETED, FAILED
    error = Column(String(1000), nullable=True)
    progress = Column(Integer, default=0)
    userId = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    clippingMode = Column(String(50), default="ai")  # "ai" or "manual"
    targetDuration = Column(Float, default=30.0)
    burnSubtitles = Column(Boolean, default=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="projects")
    clips = relationship("Clip", back_populates="project", cascade="all, delete-orphan")

class Clip(Base):
    __tablename__ = "clips"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    projectId = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    start = Column(Float, nullable=False)
    end = Column(Float, nullable=False)
    duration = Column(Float, nullable=False)
    score = Column(Integer, default=0)
    reason = Column(Text, nullable=True)
    videoPath = Column(String(500), nullable=True)
    thumbnailPath = Column(String(500), nullable=True)
    status = Column(String(50), default="PENDING")  # PENDING, PROCESSING, COMPLETED, FAILED
    titleSuggestions = Column(Text, nullable=True)  # JSON string (20 titles)
    description = Column(Text, nullable=True)
    hashtags = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)  # JSON string containing scores for emotions
    hook_text = Column(String(500), nullable=True)
    viral_caption = Column(String(1000), nullable=True)
    subtitles_path = Column(String(500), nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="clips")
    analytics = relationship("Analytics", back_populates="clip", cascade="all, delete-orphan")

class SubtitleTheme(Base):
    __tablename__ = "subtitle_themes"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), unique=True, nullable=False)
    fontName = Column(String(255), default="Arial")
    fontSize = Column(Integer, default=24)
    primaryColor = Column(String(50), default="&H00FFFFFF")  # ASS format BGR Hex
    outlineColor = Column(String(50), default="&H00000000")
    karaokeColor = Column(String(50), default="&H0000FFFF")  # Highlight color (default yellow)
    shadowColor = Column(String(50), default="&H00000000")
    outlineWidth = Column(Float, default=2.0)
    uppercase = Column(Boolean, default=True)
    isDefault = Column(Boolean, default=False)
    createdAt = Column(DateTime, default=datetime.utcnow)

class Analytics(Base):
    __tablename__ = "analytics"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    clipId = Column(String(36), ForeignKey("clips.id", ondelete="CASCADE"), nullable=False)
    views = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    platforms = Column(Text, nullable=True)  # JSON list
    downloadedAt = Column(DateTime, default=datetime.utcnow)
    
    clip = relationship("Clip", back_populates="analytics")
