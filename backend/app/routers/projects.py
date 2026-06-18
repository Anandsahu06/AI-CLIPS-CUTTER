import os
import shutil
import uuid
import logging
import requests
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Project, Clip, User
from ..schemas import ProjectResponse
from ..tasks import process_video_pipeline_task
from ..config import settings
from ..services.video import get_youtube_video_info, download_specific_format

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/", response_model=ProjectResponse)
def create_project(
    name: str = Form("Untitled Project"),
    videoUrl: str = Form(...),
    userId: str = Form(...),
    clippingMode: str = Form("ai"),
    manualStart: Optional[float] = Form(None),
    manualEnd: Optional[float] = Form(None),
    targetDuration: Optional[float] = Form(None),
    burnSubtitles: bool = Form(True),
    db: Session = Depends(get_db)
):
    """
    Submits a YouTube URL. Scaffolds a project in the database, and schedules
    the download/transcribe/AI analysis pipeline in Celery.
    """
    # Verify user exists
    user = db.query(User).filter(User.id == userId).first()
    if not user:
        # If user does not exist, auto create it for demo and NextAuth credentials simplicity
        user = User(id=userId, email=f"{userId}@clipforge.ai", name="Default User")
        db.add(user)
        db.commit()

    project = Project(
        id=str(uuid.uuid4()),
        name=name,
        videoUrl=videoUrl,
        status="PENDING",
        progress=0,
        userId=userId,
        clippingMode=clippingMode,
        targetDuration=targetDuration or 30.0,
        burnSubtitles=burnSubtitles
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # If manual clipping mode is selected and timestamps are provided, create the Clip record up front
    if clippingMode == "manual" and manualStart is not None and manualEnd is not None:
        clip = Clip(
            id=str(uuid.uuid4()),
            projectId=project.id,
            title="Manual Clip",
            start=manualStart,
            end=manualEnd,
            duration=manualEnd - manualStart,
            score=100,
            status="PENDING"
        )
        db.add(clip)
        db.commit()
    
    # Trigger Celery background task
    process_video_pipeline_task.delay(project.id)
    
    return project

@router.post("/upload", response_model=ProjectResponse)
def upload_project_file(
    name: str = Form("Uploaded Video"),
    userId: str = Form(...),
    clippingMode: str = Form("ai"),
    manualStart: Optional[float] = Form(None),
    manualEnd: Optional[float] = Form(None),
    targetDuration: Optional[float] = Form(None),
    burnSubtitles: bool = Form(True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Submits a raw MP4 upload. Saves the file to originals/, scaffolds the database project,
    and schedules the audio extraction/transcription/AI analysis pipeline in Celery.
    """
    # Verify user exists
    user = db.query(User).filter(User.id == userId).first()
    if not user:
        user = User(id=userId, email=f"{userId}@clipforge.ai", name="Default User")
        db.add(user)
        db.commit()
        
    project_id = str(uuid.uuid4())
    original_filename = f"{project_id}_{file.filename}"
    original_path = os.path.join(settings.MEDIA_DIR, "originals", original_filename)
    
    # Save uploaded file
    try:
        with open(original_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to write uploaded file: {e}")
        raise HTTPException(status_code=500, detail="Could not write file to storage.")
        
    project = Project(
        id=project_id,
        name=name,
        videoPath=original_path,
        status="PENDING",
        progress=5,
        userId=userId,
        clippingMode=clippingMode,
        targetDuration=targetDuration or 30.0,
        burnSubtitles=burnSubtitles
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # If manual clipping mode is selected and timestamps are provided, create the Clip record up front
    if clippingMode == "manual" and manualStart is not None and manualEnd is not None:
        clip = Clip(
            id=str(uuid.uuid4()),
            projectId=project.id,
            title="Manual Clip",
            start=manualStart,
            end=manualEnd,
            duration=manualEnd - manualStart,
            score=100,
            status="PENDING"
        )
        db.add(clip)
        db.commit()
        
    # Trigger Celery background task
    process_video_pipeline_task.delay(project.id)
    
    return project

@router.get("/user/{user_id}", response_model=List[ProjectResponse])
def get_user_projects(user_id: str, db: Session = Depends(get_db)):
    """Lists all projects for a specific user ID."""
    return db.query(Project).filter(Project.userId == user_id).order_by(Project.createdAt.desc()).all()

@router.get("/youtube-info")
def get_youtube_info(url: str):
    """
    Fetches basic metadata (title, duration, thumbnail, available formats)
    for a YouTube URL without downloading it.
    """
    try:
        info = get_youtube_video_info(url)
        return info
    except Exception as e:
        logger.exception("Failed to get YouTube info")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/youtube-download")
def download_youtube_file(url: str, format_id: str, type: str):
    """
    Downloads a specific format of the video/audio and streams it back to the client.
    """
    try:
        downloads_dir = os.path.join(settings.MEDIA_DIR, "downloads")
        file_path = download_specific_format(url, format_id, type, downloads_dir)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=500, detail="Downloaded file not found on disk.")
            
        filename = os.path.basename(file_path)
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/octet-stream"
        )
    except Exception as e:
        logger.exception("Failed to download YouTube file")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/youtube-thumbnail")
def download_youtube_thumbnail(videoId: str):
    """
    Downloads the highest quality thumbnail image of a YouTube video and proxies it.
    """
    try:
        url = f"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg"
        res = requests.get(url)
        if res.status_code != 200:
            url = f"https://img.youtube.com/vi/{videoId}/hqdefault.jpg"
            res = requests.get(url)
            
        if res.status_code == 200:
            return Response(
                content=res.content, 
                media_type="image/jpeg", 
                headers={
                    "Content-Disposition": f"attachment; filename={videoId}_thumbnail.jpg"
                }
            )
        else:
            raise HTTPException(status_code=404, detail="Thumbnail not found")
    except Exception as e:
        logger.exception("Failed to proxy YouTube thumbnail")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_id}")
def get_project_details(project_id: str, db: Session = Depends(get_db)):
    """Returns project metadata, processing status, and associated short clips."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    clips = db.query(Clip).filter(Clip.projectId == project_id).order_by(Clip.score.desc()).all()
    
    return {
        "id": project.id,
        "name": project.name,
        "videoUrl": project.videoUrl,
        "videoPath": project.videoPath,
        "audioPath": project.audioPath,
        "transcript": project.transcript,
        "originalDuration": project.originalDuration,
        "status": project.status,
        "progress": project.progress,
        "error": project.error,
        "userId": project.userId,
        "createdAt": project.createdAt,
        "clips": clips
    }

@router.delete("/user/{user_id}/clear")
def clear_user_projects(user_id: str, db: Session = Depends(get_db)):
    """Deletes all projects, database records, and media files for a specific user ID."""
    projects = db.query(Project).filter(Project.userId == user_id).all()
    for project in projects:
        # Delete original video file
        if project.videoPath and os.path.exists(project.videoPath):
            try:
                os.remove(project.videoPath)
            except Exception as e:
                logger.warning(f"Could not remove original video: {e}")
                
        # Delete extracted audio
        if project.audioPath and os.path.exists(project.audioPath):
            try:
                os.remove(project.audioPath)
            except Exception as e:
                logger.warning(f"Could not remove audio file: {e}")
                
        # Find and delete clip files
        clips = db.query(Clip).filter(Clip.projectId == project.id).all()
        for clip in clips:
            if clip.videoPath and os.path.exists(clip.videoPath):
                try:
                    os.remove(clip.videoPath)
                except Exception as e:
                    logger.warning(f"Could not remove clip video: {e}")
            if clip.thumbnailPath and os.path.exists(clip.thumbnailPath):
                try:
                    os.remove(clip.thumbnailPath)
                except Exception as e:
                    logger.warning(f"Could not remove thumbnail: {e}")
            if clip.subtitles_path and os.path.exists(clip.subtitles_path):
                try:
                    os.remove(clip.subtitles_path)
                except Exception as e:
                    logger.warning(f"Could not remove subtitle file: {e}")
                    
        db.delete(project)
    db.commit()
    return {"message": f"Successfully cleared all projects and files for user {user_id}"}

@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    """Deletes a project, its database records, and all associated video files from disk."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Delete original video file
    if project.videoPath and os.path.exists(project.videoPath):
        try:
            os.remove(project.videoPath)
        except Exception as e:
            logger.warning(f"Could not remove original video: {e}")
            
    # Delete extracted audio
    if project.audioPath and os.path.exists(project.audioPath):
        try:
            os.remove(project.audioPath)
        except Exception as e:
            logger.warning(f"Could not remove audio file: {e}")
            
    # Find and delete clip files
    clips = db.query(Clip).filter(Clip.projectId == project_id).all()
    for clip in clips:
        if clip.videoPath and os.path.exists(clip.videoPath):
            try:
                os.remove(clip.videoPath)
            except Exception as e:
                logger.warning(f"Could not remove clip video: {e}")
        if clip.thumbnailPath and os.path.exists(clip.thumbnailPath):
            try:
                os.remove(clip.thumbnailPath)
            except Exception as e:
                logger.warning(f"Could not remove thumbnail: {e}")
        if clip.subtitles_path and os.path.exists(clip.subtitles_path):
            try:
                os.remove(clip.subtitles_path)
            except Exception as e:
                logger.warning(f"Could not remove subtitle file: {e}")
                
    db.delete(project)
    db.commit()
    return {"message": "Project and associated media successfully deleted"}
