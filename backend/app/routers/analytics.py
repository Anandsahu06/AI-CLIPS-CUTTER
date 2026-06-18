import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import Analytics, Clip, Project, User
from ..schemas import AnalyticsResponse, AnalyticsCreate

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.post("/", response_model=AnalyticsResponse)
def log_analytics_event(
    payload: AnalyticsCreate,
    db: Session = Depends(get_db)
):
    """Logs a clip download or view event for social analytics tracking."""
    clip = db.query(Clip).filter(Clip.id == payload.clipId).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
        
    # Find existing analytics or create new
    analytics = db.query(Analytics).filter(Analytics.clipId == payload.clipId).first()
    if not analytics:
        analytics = Analytics(
            clipId=payload.clipId,
            views=0,
            shares=0,
            platforms=json.dumps([])
        )
        db.add(analytics)
        db.commit()
        db.refresh(analytics)
        
    # Increment download count (modeled as views for dashboard simplicity)
    analytics.views += 1
    
    # Track platforms
    platforms_list = json.loads(analytics.platforms or "[]")
    if payload.platform not in platforms_list:
        platforms_list.append(payload.platform)
        analytics.platforms = json.dumps(platforms_list)
        
    db.commit()
    db.refresh(analytics)
    return analytics

@router.get("/dashboard")
def get_admin_dashboard_metrics(db: Session = Depends(get_db)):
    """
    Returns aggregated system statistics for the Admin Panel.
    Includes count statistics, processing statuses, and popular downloads.
    """
    # 1. Broad counts
    total_users = db.query(User).count()
    total_projects = db.query(Project).count()
    total_clips = db.query(Clip).count()
    total_downloads = db.query(func.sum(Analytics.views)).scalar() or 0
    
    # 2. Project Status Breakdown
    status_counts = db.query(
        Project.status, func.count(Project.id)
    ).group_by(Project.status).all()
    
    status_breakdown = {status: count for status, count in status_counts}
    
    # 3. Top-performing clips
    top_clips = db.query(
        Clip.id, Clip.title, Clip.score, Analytics.views
    ).join(Analytics, Clip.id == Analytics.clipId).order_by(
        Analytics.views.desc()
    ).limit(5).all()
    
    top_clips_list = [
        {"id": c[0], "title": c[1], "score": c[2], "downloads": c[3]}
        for c in top_clips
    ]
    
    # 4. System health status
    active_jobs = db.query(Project).filter(
        Project.status.in_(["DOWNLOADING", "TRANSCRIBING", "ANALYZING", "PROCESSING"])
    ).count()
    
    return {
        "metrics": {
            "totalUsers": total_users,
            "totalProjects": total_projects,
            "totalClipsGenerated": total_clips,
            "totalDownloads": total_downloads,
            "activeJobs": active_jobs
        },
        "projectStatusBreakdown": status_breakdown,
        "popularClips": top_clips_list
    }
