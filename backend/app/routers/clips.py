import os
import json
import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Clip, Project
from ..schemas import ClipResponse, ClipUpdate, ClipCreate
from ..tasks import render_clip_task
from ..services.subtitles import THEMES

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/clips", tags=["clips"])

@router.post("/", response_model=ClipResponse)
def create_custom_clip(
    payload: ClipCreate,
    db: Session = Depends(get_db)
):
    """
    Manually creates a new clip segment with user-specified timestamps
    and starts the video rendering and subtitle burning pipeline.
    """
    project = db.query(Project).filter(Project.id == payload.projectId).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    clip = Clip(
        id=str(uuid.uuid4()),
        projectId=payload.projectId,
        title=payload.title,
        start=payload.start,
        end=payload.end,
        duration=payload.end - payload.start,
        score=100,  # Manual clips are default 100% score
        status="PENDING"
    )
    db.add(clip)
    db.commit()
    db.refresh(clip)
    
    # Trigger rendering task
    render_clip_task.delay(clip.id)
    logger.info(f"Custom clip {clip.id} created and rendering scheduled.")
    
    return clip

@router.get("/{clip_id}", response_model=ClipResponse)
def get_clip_details(clip_id: str, db: Session = Depends(get_db)):
    """Retrieves all data, virality subscores, descriptions, and hashtags for a single clip."""
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    return clip

@router.patch("/{clip_id}", response_model=ClipResponse)
def update_clip(
    clip_id: str,
    payload: ClipUpdate = Body(...),
    db: Session = Depends(get_db)
):
    """
    Updates clip parameters. If start/end timestamps or subtitle theme are changed,
    the backend automatically schedules a re-render task in Celery.
    """
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
        
    re_render_needed = False
    
    # 1. Update text metadata
    if payload.title is not None:
        clip.title = payload.title
    if payload.description is not None:
        clip.description = payload.description
    if payload.hashtags is not None:
        clip.hashtags = payload.hashtags
        
    # 2. Track timing changes for trim
    if payload.start is not None and payload.start != clip.start:
        clip.start = payload.start
        re_render_needed = True
    if payload.end is not None and payload.end != clip.end:
        clip.end = payload.end
        re_render_needed = True
        
    # 3. Update duration if timings changed
    if re_render_needed:
        clip.duration = clip.end - clip.start
        
    # 4. Handle subtitle theme changes
    # Themes will be parsed by render_clip_task from settings or custom database models.
    # For simplicity, we can pass theme choice (tiktok, cyberpunk, minimalist, retro) to task.
    
    db.commit()
    
    # If timings or styles changed, trigger re-render
    if re_render_needed or payload.theme is not None:
        clip.status = "PENDING"
        db.commit()
        
        # Trigger Celery task
        # We can update the task to accept theme overrides, but for now we run:
        render_clip_task.delay(clip.id)
        logger.info(f"Re-rendering scheduled for clip {clip_id} due to modifications.")
        
    db.refresh(clip)
    return clip

@router.get("/{clip_id}/download")
def download_clip_file(clip_id: str, db: Session = Depends(get_db)):
    """Downloads the final vertical MP4 clip file with subtitles."""
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
        
    if clip.status != "COMPLETED" or not clip.videoPath or not os.path.exists(clip.videoPath):
        raise HTTPException(status_code=400, detail="Clip video is not ready or does not exist.")
        
    # Set nice filename for download
    sanitized_title = "".join(c for c in clip.title if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
    filename = f"{sanitized_title}_1080p.mp4"
    
    return FileResponse(
        path=clip.videoPath,
        media_type="video/mp4",
        filename=filename
    )

@router.get("/{clip_id}/thumbnail")
def download_clip_thumbnail(clip_id: str, db: Session = Depends(get_db)):
    """Downloads the generated PNG thumbnail for the clip."""
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
        
    if not clip.thumbnailPath or not os.path.exists(clip.thumbnailPath):
        raise HTTPException(status_code=400, detail="Clip thumbnail is not ready or does not exist.")
        
    return FileResponse(
        path=clip.thumbnailPath,
        media_type="image/png"
    )
