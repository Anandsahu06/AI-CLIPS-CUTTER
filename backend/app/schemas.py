from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ProjectBase(BaseModel):
    name: str
    videoUrl: Optional[str] = None

class ProjectCreate(ProjectBase):
    userId: str

class ProjectResponse(BaseModel):
    id: str
    name: str
    videoUrl: Optional[str] = None
    videoPath: Optional[str] = None
    audioPath: Optional[str] = None
    transcript: Optional[str] = None
    originalDuration: Optional[float] = None
    status: str
    error: Optional[str] = None
    progress: int
    userId: str
    clippingMode: str = "ai"
    targetDuration: Optional[float] = 30.0
    burnSubtitles: bool = True
    createdAt: datetime

    class Config:
        from_attributes = True

class ClipResponse(BaseModel):
    id: str
    projectId: str
    title: str
    start: float
    end: float
    duration: float
    score: int
    reason: Optional[str] = None
    videoPath: Optional[str] = None
    thumbnailPath: Optional[str] = None
    status: str
    titleSuggestions: Optional[str] = None
    description: Optional[str] = None
    hashtags: Optional[str] = None
    metadata_json: Optional[str] = None
    hook_text: Optional[str] = None
    viral_caption: Optional[str] = None
    subtitles_path: Optional[str] = None
    createdAt: datetime

    class Config:
        from_attributes = True

class ClipUpdate(BaseModel):
    title: Optional[str] = None
    start: Optional[float] = None
    end: Optional[float] = None
    description: Optional[str] = None
    hashtags: Optional[str] = None
    theme: Optional[str] = None  # tiktok, cyberpunk, minimalist, retro
    watermark: Optional[bool] = None

class ClipCreate(BaseModel):
    projectId: str
    title: str = "Custom Clip"
    start: float
    end: float

class AnalyticsCreate(BaseModel):
    clipId: str
    platform: str  # tiktok, shorts, reels

class AnalyticsResponse(BaseModel):
    id: str
    clipId: str
    views: int
    shares: int
    platforms: Optional[str] = None
    downloadedAt: datetime

    class Config:
        from_attributes = True
