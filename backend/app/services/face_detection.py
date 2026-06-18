import os
import cv2
import logging
import subprocess
import imageio_ffmpeg
from .video import FFMPEG_PATH, get_video_dimensions

logger = logging.getLogger(__name__)

def track_and_crop_to_vertical(video_path: str, output_path: str, start_time: float, end_time: float) -> str:
    """
    Cuts a segment from video_path, tracks the main face, crops to 9:16 vertical ratio,
    and merges original audio, outputting to output_path.
    """
    # 1. Create a temp file for cropped video without audio
    temp_cropped_path = output_path + ".temp.mp4"
    
    # 2. Open input video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video_path}")
        
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Target dimension (9:16)
    target_height = height
    target_width = int(height * (9 / 16))
    if target_width % 2 != 0:
        target_width += 1  # FFmpeg requires even dimensions
        
    # Make sure target width is not larger than original width
    if target_width > width:
        target_width = width
        target_height = int(width * (16 / 9))
        if target_height % 2 != 0:
            target_height += 1
            
    # Compute start and end frame indices
    start_frame = int(start_time * fps)
    end_frame = int(end_time * fps)
    
    # Set video reader to start frame
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    
    # Load face cascade
    cascade_path = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
    face_cascade = cv2.CascadeClassifier(cascade_path)
    if face_cascade.empty():
        logger.warning("Haar cascade face detector could not be loaded. Defaulting to center crop.")
        
    # Setup VideoWriter
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(temp_cropped_path, fourcc, fps, (target_width, target_height))
    
    # Tracking parameters
    last_x_center = width / 2
    alpha = 0.08  # Smoothing factor: lower = smoother/lagging, higher = faster tracking
    
    current_frame = start_frame
    logger.info(f"Reframing frames {start_frame} to {end_frame} (Total: {end_frame - start_frame} frames)")
    
    while current_frame < end_frame:
        ret, frame = cap.read()
        if not ret:
            break
            
        x_center = width / 2
        
        # Detect faces every 12 frames to speed up processing
        if face_cascade and current_frame % 12 == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            # Resize 4x smaller for faster face detection
            small_gray = cv2.resize(gray, (0, 0), fx=0.25, fy=0.25)
            faces = face_cascade.detectMultiScale(small_gray, scaleFactor=1.3, minNeighbors=5)
            
            if len(faces) > 0:
                # Get the largest face
                largest_face = max(faces, key=lambda f: f[2] * f[3])
                (fx, fy, fw, fh) = largest_face
                # Scale coordinates back up (4x since downscaled by 0.25)
                x_center = (fx + fw / 2) * 4
            else:
                x_center = last_x_center
        else:
            x_center = last_x_center
            
        # Smooth horizontal transition
        smoothed_x = alpha * x_center + (1 - alpha) * last_x_center
        last_x_center = smoothed_x
        
        # Calculate cropping boundaries
        x_start = int(smoothed_x - target_width / 2)
        x_start = max(0, min(x_start, width - target_width))
        y_start = int((height - target_height) / 2)
        
        # Perform crop
        cropped_frame = frame[y_start:y_start + target_height, x_start:x_start + target_width]
        out.write(cropped_frame)
        
        current_frame += 1
        
    cap.release()
    out.release()
    
    # 3. Merge audio back using FFmpeg and re-encode to H264 for high web compatibility
    cmd = [
        FFMPEG_PATH,
        "-y",
        "-ss", str(start_time),
        "-t", str(end_time - start_time),
        "-i", video_path,
        "-i", temp_cropped_path,
        "-map 1:v", # Video from cropped temp
        "-map 0:a", # Audio from original
        "-c:v", "libx264",
        "-c:a", "aac",
        "-preset", "veryfast",
        output_path
    ]
    
    # Run FFmpeg command
    # FFmpeg args are split as list. The -map options need to be separate arguments:
    ffmpeg_cmd = [
        FFMPEG_PATH,
        "-y",
        "-ss", str(start_time),
        "-i", video_path,
        "-i", temp_cropped_path,
        "-map", "1:v",
        "-map", "0:a",
        "-t", str(end_time - start_time),
        "-c:v", "libx264",
        "-c:a", "aac",
        "-preset", "veryfast",
        output_path
    ]
    
    logger.info(f"Merging audio for reframed video: {output_path}")
    result = subprocess.run(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    
    # Clean up temp file
    if os.path.exists(temp_cropped_path):
        try:
            os.remove(temp_cropped_path)
        except Exception as e:
            logger.warning(f"Could not remove temp file {temp_cropped_path}: {e}")
            
    if result.returncode != 0:
        logger.error(f"FFmpeg audio merge failed: {result.stderr}")
        raise RuntimeError(f"Failed to merge audio back: {result.stderr}")
        
    return output_path
