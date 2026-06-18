import os
import json
import logging
from .celery_app import celery_app
from .database import SessionLocal
from .models import Project, Clip
from .config import settings
from .services.video import download_youtube_video, extract_audio, cut_video
from .services.transcribe import transcribe_audio
from .services.ai import analyze_transcript_for_clips
from .services.face_detection import track_and_crop_to_vertical
from .services.subtitles import generate_ass_file, burn_subtitles
from .services.thumbnail import generate_thumbnail

logger = logging.getLogger(__name__)

@celery_app.task(bind=True)
def process_video_pipeline_task(self, project_id: str):
    """
    Background worker task that downloads, transcribes, and analyzes a video project.
    Creates clip records which are subsequently reframed and burned with subtitles.
    """
    db = SessionLocal()
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        logger.error(f"Project not found: {project_id}")
        db.close()
        return
        
    try:
        # Step 1: Download video if URL is provided
        if project.videoUrl:
            project.status = "DOWNLOADING"
            project.progress = 10
            db.commit()
            
            logger.info(f"Downloading YouTube video for project {project_id}")
            download_info = download_youtube_video(
                project.videoUrl, 
                os.path.join(settings.MEDIA_DIR, "originals")
            )
            
            project.videoPath = download_info["path"]
            project.originalDuration = download_info["duration"]
            if project.name == "Untitled Project":
                project.name = download_info["title"]
            db.commit()
        else:
            # Uploaded video must exist
            project.status = "DOWNLOADING"
            project.progress = 15
            db.commit()
            if not project.videoPath or not os.path.exists(project.videoPath):
                raise FileNotFoundError(f"Original uploaded video not found at: {project.videoPath}")
                
        # Step 2: Extract audio track
        project.status = "TRANSCRIBING"
        project.progress = 30
        db.commit()
        
        audio_filename = f"{project.id}.wav"
        audio_path = os.path.join(settings.MEDIA_DIR, "audio", audio_filename)
        extract_audio(project.videoPath, audio_path)
        project.audioPath = audio_path
        db.commit()
        
        # Step 3: Transcribe with Whisper
        project.progress = 50
        db.commit()
        
        logger.info(f"Transcribing audio for project {project_id}")
        transcript_data = transcribe_audio(audio_path)
        project.transcript = json.dumps(transcript_data)
        db.commit()
        
        # Step 4: Analyze transcript for clips (AI suggested vs manual pre-created)
        if getattr(project, "clippingMode", "ai") == "ai":
            project.status = "ANALYZING"
            project.progress = 70
            db.commit()
            
            logger.info(f"Analyzing transcript using Gemini for project {project_id}")
            clips_data = analyze_transcript_for_clips(
                transcript_data, 
                project.originalDuration, 
                target_duration=getattr(project, "targetDuration", 30.0)
            )
            
            # Step 5: Save clip entries and spawn crop/burn tasks
            project.status = "PROCESSING"
            project.progress = 85
            db.commit()
            
            for idx, clip_info in enumerate(clips_data):
                clip = Clip(
                    projectId=project.id,
                    title=clip_info["title"],
                    start=clip_info["start"],
                    end=clip_info["end"],
                    duration=clip_info["end"] - clip_info["start"],
                    score=clip_info["score"],
                    reason=clip_info["reason"],
                    status="PENDING",
                    titleSuggestions=json.dumps(clip_info["title_suggestions"]),
                    description=clip_info["description_suggestion"],
                    hashtags=",".join(clip_info["hashtags"]),
                    metadata_json=json.dumps({
                        "emotional_intensity": clip_info["emotional_intensity"],
                        "surprise": clip_info["surprise"],
                        "curiosity": clip_info["curiosity"],
                        "energy": clip_info["energy"],
                        "humor": clip_info["humor"],
                        "retention_probability": clip_info["retention_probability"]
                    }),
                    hook_text=clip_info["hook_text"],
                    viral_caption=clip_info["viral_caption"]
                )
                db.add(clip)
                db.commit()
                
                # Spawn clip rendering task in Celery
                render_clip_task.delay(clip.id)
                logger.info(f"Spawned render task for clip {clip.id} ({clip.title})")
        else:
            # Manual Mode: skip Gemini, search for pre-created clip to render
            project.status = "PROCESSING"
            project.progress = 85
            db.commit()
            logger.info(f"Manual mode: Checking for pre-created clips to render for project {project_id}")
            
            clips = db.query(Clip).filter(Clip.projectId == project.id, Clip.status == "PENDING").all()
            for clip in clips:
                render_clip_task.delay(clip.id)
                logger.info(f"Spawned manual render task for clip {clip.id} ({clip.title})")
            
        project.status = "COMPLETED"
        project.progress = 100
        db.commit()
        logger.info(f"Project pipeline complete for {project_id}")
        
    except Exception as e:
        logger.exception(f"Pipeline failed for project {project_id}")
        project.status = "FAILED"
        project.error = str(e)
        db.commit()
    finally:
        db.close()

@celery_app.task(bind=True)
def render_clip_task(self, clip_id: str):
    """
    Cuts, reframes, generates subtitles, and burns style formatting onto a short clip.
    """
    db = SessionLocal()
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        logger.error(f"Clip not found: {clip_id}")
        db.close()
        return
        
    project = db.query(Project).filter(Project.id == clip.projectId).first()
    if not project:
        logger.error(f"Project not found for clip {clip_id}")
        clip.status = "FAILED"
        db.commit()
        db.close()
        return
        
    try:
        clip.status = "PROCESSING"
        db.commit()
        
        # 1. Paths setup
        os.makedirs(os.path.join(settings.MEDIA_DIR, "clips"), exist_ok=True)
        os.makedirs(os.path.join(settings.MEDIA_DIR, "subtitles"), exist_ok=True)
        os.makedirs(os.path.join(settings.MEDIA_DIR, "thumbnails"), exist_ok=True)
        
        output_filename = f"{clip.id}.mp4"
        output_path = os.path.join(settings.MEDIA_DIR, "clips", output_filename)
        
        temp_cropped_filename = f"crop_{clip.id}.mp4"
        temp_cropped_path = os.path.join(settings.MEDIA_DIR, "clips", temp_cropped_filename)
        
        ass_filename = f"{clip.id}.ass"
        ass_path = os.path.join(settings.MEDIA_DIR, "subtitles", ass_filename)
        
        thumbnail_filename = f"{clip.id}.png"
        thumbnail_path = os.path.join(settings.MEDIA_DIR, "thumbnails", thumbnail_filename)
        
        # 2. Smart Reframing & Crop to 9:16 (vertical format)
        logger.info(f"Running smart reframe for clip {clip_id}")
        
        # Check if subtitles should be burned
        should_burn = getattr(project, "burnSubtitles", True)
        
        if should_burn:
            # Reframe to temporary cropped path first
            track_and_crop_to_vertical(
                project.videoPath, 
                temp_cropped_path, 
                clip.start, 
                clip.end
            )
            
            # 3. Generate subtitle ASS file
            logger.info(f"Generating subtitle ASS file for clip {clip_id}")
            words = []
            if project.transcript:
                try:
                    transcript_data = json.loads(project.transcript)
                    if isinstance(transcript_data, dict) and "words" in transcript_data:
                        words = transcript_data["words"]
                except Exception as e:
                    logger.warning(f"Failed to parse project transcript: {e}")
                    
            theme_name = getattr(clip, "subtitleTheme", "tiktok") or "tiktok"
            generate_ass_file(words, clip.start, clip.end, ass_path, theme_name=theme_name)
            clip.subtitles_path = ass_path
            db.commit()
            
            # 4. Burn subtitles into reframed video
            logger.info(f"Burning subtitles for clip {clip_id}")
            burn_subtitles(temp_cropped_path, ass_path, output_path)
            clip.videoPath = output_path
            db.commit()
        else:
            # Reframe directly to final output path (skip subtitles)
            track_and_crop_to_vertical(
                project.videoPath, 
                output_path, 
                clip.start, 
                clip.end
            )
            clip.subtitles_path = None
            clip.videoPath = output_path
            db.commit()
        
        # Clean up intermediate crop file (saving disk space)
        if os.path.exists(temp_cropped_path):
            try:
                os.remove(temp_cropped_path)
            except Exception as e:
                logger.warning(f"Could not remove temp cropped video: {e}")
                
        # 5. Generate high-quality thumbnail image
        logger.info(f"Rendering thumbnail for clip {clip_id}")
        midpoint_in_clip = (clip.end - clip.start) / 2
        generate_thumbnail(output_path, midpoint_in_clip, clip.title, thumbnail_path)
        clip.thumbnailPath = thumbnail_path
        
        clip.status = "COMPLETED"
        db.commit()
        logger.info(f"Clip render finished successfully: {clip_id}")
        
    except Exception as e:
        logger.exception(f"Clip rendering failed for: {clip_id}")
        clip.status = "FAILED"
        db.commit()
    finally:
        db.close()
