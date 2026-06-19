import os
import subprocess
import logging
import shutil
import yt_dlp
import imageio_ffmpeg
import cv2

logger = logging.getLogger(__name__)

# Set up a local bin folder inside backend directory containing ffmpeg (or ffmpeg.exe)
# to satisfy yt-dlp and other tools that search for the executable
BIN_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "bin"))
os.makedirs(BIN_DIR, exist_ok=True)

is_windows = os.name == 'nt'
FFMPEG_NAME = "ffmpeg.exe" if is_windows else "ffmpeg"
FFMPEG_PATH = os.path.join(BIN_DIR, FFMPEG_NAME)

if not os.path.exists(FFMPEG_PATH):
    try:
        shutil.copy(imageio_ffmpeg.get_ffmpeg_exe(), FFMPEG_PATH)
        # On Linux/macOS, we must set execution permissions
        if not is_windows:
            os.chmod(FFMPEG_PATH, 0o755)
        logger.info(f"Copied FFmpeg to local path: {FFMPEG_PATH}")
    except Exception as e:
        logger.error(f"Failed to copy FFmpeg to bin folder: {e}")
        # Fallback to imageio-ffmpeg default
        FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()

# Inject the local bin directory into PATH so all child processes can find it
if BIN_DIR not in os.environ.get("PATH", ""):
    os.environ["PATH"] = BIN_DIR + os.pathsep + os.environ.get("PATH", "")

def get_ydl_opts(base_opts: dict) -> dict:
    import tempfile
    opts = base_opts.copy()
    cookies_content = os.getenv("YOUTUBE_COOKIES")
    if cookies_content:
        temp_dir = tempfile.gettempdir()
        temp_cookies_path = os.path.join(temp_dir, "youtube_cookies.txt")
        try:
            with open(temp_cookies_path, "w", encoding="utf-8") as f:
                f.write(cookies_content.strip() + "\n")
            opts["cookiefile"] = temp_cookies_path
            logger.info(f"Using YouTube cookies from YOUTUBE_COOKIES env. Saved to: {temp_cookies_path}")
        except Exception as e:
            logger.error(f"Failed to write YOUTUBE_COOKIES to file: {e}")
    return opts

def download_youtube_video(url: str, output_dir: str) -> dict:
    """
    Downloads the highest quality video (up to 1080p) from YouTube using yt-dlp.
    Saves it as an MP4 file.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    ffmpeg_dir = os.path.dirname(FFMPEG_PATH)
    # We want merged video/audio, preferably mp4 container, capped at 1080p
    ydl_opts = get_ydl_opts({
        "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": os.path.join(output_dir, "%(id)s.%(ext)s"),
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "ffmpeg_location": ffmpeg_dir
    })
    
    logger.info(f"Downloading YouTube video: {url}")
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)
        
        # Ensure the filename has the correct merged extension
        if not os.path.exists(filename):
            base, _ = os.path.splitext(filename)
            if os.path.exists(base + ".mp4"):
                filename = base + ".mp4"
                
        return {
            "title": info.get("title", "YouTube Video"),
            "path": filename,
            "duration": info.get("duration", 0),
            "id": info.get("id", "")
        }

def extract_audio(video_path: str, output_path: str) -> str:
    """
    Extracts the audio track from a video file and saves it as a 16kHz mono WAV file
    (which is the optimal format for OpenAI Whisper).
    """
    dir_name = os.path.dirname(output_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    
    # ffmpeg command to extract audio and downsample to 16kHz mono WAV
    cmd = [
        FFMPEG_PATH,
        "-y",
        "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        output_path
    ]
    
    logger.info(f"Extracting audio from {video_path} to {output_path}")
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    
    if result.returncode != 0:
        logger.error(f"FFmpeg audio extraction failed: {result.stderr}")
        raise RuntimeError(f"Failed to extract audio: {result.stderr}")
        
    return output_path

def cut_video(video_path: str, start: float, end: float, output_path: str) -> str:
    """
    Cuts a segment of a video from 'start' seconds to 'end' seconds without re-encoding
    (which is fast) or with re-encoding if needed (required for burning subtitles later).
    Here we cut and re-encode to ensure perfect keyframes for sharing.
    """
    dir_name = os.path.dirname(output_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    duration = end - start
    
    cmd = [
        FFMPEG_PATH,
        "-y",
        "-ss", str(start),
        "-i", video_path,
        "-t", str(duration),
        "-c:v", "libx264",
        "-c:a", "aac",
        "-preset", "fast",
        output_path
    ]
    
    logger.info(f"Cutting video from {start}s to {end}s")
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    
    if result.returncode != 0:
        logger.error(f"FFmpeg video cut failed: {result.stderr}")
        raise RuntimeError(f"Failed to cut video: {result.stderr}")
        
    return output_path

def get_video_dimensions(video_path: str) -> tuple:
    """
    Returns (width, height) of the video using OpenCV.
    """
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError("Could not open video file with OpenCV")
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()
        if width > 0 and height > 0:
            return width, height
    except Exception as e:
        logger.error(f"OpenCV failed to read dimensions: {e}. Falling back to default.")
    
    # Try ffprobe as a backup if it exists
    ffprobe_path = FFMPEG_PATH.replace("ffmpeg.exe", "ffprobe.exe").replace("ffmpeg", "ffprobe")
    if not os.path.exists(ffprobe_path):
        ffprobe_path = "ffprobe"
    
    try:
        cmd = [
            ffprobe_path,
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "csv=s=x:p=0",
            video_path
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode == 0:
            parts = result.stdout.strip().split("x")
            if len(parts) >= 2:
                return int(parts[0]), int(parts[1])
    except Exception:
        pass
            
    return 1920, 1080

def get_youtube_video_info(url: str) -> dict:
    """
    Extracts video info using yt-dlp without downloading.
    """
    ydl_opts = get_ydl_opts({
        "quiet": True,
        "no_warnings": True,
        "ffmpeg_location": os.path.dirname(FFMPEG_PATH)
    })
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        video_id = info.get("id", "")
        title = info.get("title", "YouTube Video")
        duration = info.get("duration", 0)
        thumbnail = info.get("thumbnail", f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg")
        
        # Extract formats
        formats = []
        seen_heights = set()
        
        # Add audio option first
        formats.append({
            "format_id": "bestaudio",
            "ext": "mp3",
            "height": 0,
            "note": "Audio Only (.mp3)",
            "type": "audio"
        })
        
        for f in info.get("formats", []):
            height = f.get("height")
            # Filter standard heights
            if height in [360, 480, 720, 1080] and height not in seen_heights:
                seen_heights.add(height)
                formats.append({
                    "format_id": f.get("format_id") or str(height),
                    "ext": "mp4",
                    "height": height,
                    "note": f"Video {height}p (.mp4)",
                    "type": "video"
                })
                
        # Sort video formats by height descending
        video_formats = sorted([f for f in formats if f["type"] == "video"], key=lambda x: x["height"], reverse=True)
        audio_formats = [f for f in formats if f["type"] == "audio"]
        
        return {
            "id": video_id,
            "title": title,
            "duration": duration,
            "thumbnail": thumbnail,
            "formats": audio_formats + video_formats
        }

import threading

_download_locks = {}
_download_locks_lock = threading.Lock()

def get_download_lock(key: str) -> threading.Lock:
    with _download_locks_lock:
        if key not in _download_locks:
            _download_locks[key] = threading.Lock()
        return _download_locks[key]

def download_specific_format(url: str, format_id: str, type: str, output_dir: str) -> str:
    """
    Downloads a specific format (mp3 or mp4 quality) to output_dir.
    Returns the path to the downloaded file.
    """
    os.makedirs(output_dir, exist_ok=True)
    ffmpeg_dir = os.path.dirname(FFMPEG_PATH)
    
    # 1. Fetch info first to get video ID and perform cache check
    video_id = None
    try:
        ydl_opts_info = get_ydl_opts({
            "quiet": True,
            "no_warnings": True,
            "ffmpeg_location": ffmpeg_dir
        })
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            info = ydl.extract_info(url, download=False)
            video_id = info.get("id")
    except Exception as e:
        logger.warning(f"Could not fetch info for cache check: {e}")
        
    lock_key = f"{video_id}_{format_id}" if video_id else url
    lock = get_download_lock(lock_key)
    
    with lock:
        if video_id:
            if type == "audio":
                expected_path = os.path.join(output_dir, f"{video_id}_audio.mp3")
            else:
                expected_path = os.path.join(output_dir, f"{video_id}_{format_id}.mp4")
                
            if os.path.exists(expected_path) and os.path.getsize(expected_path) > 0:
                logger.info(f"Returning cached downloaded file: {expected_path}")
                return expected_path
                
        # 2. Setup options for actual download
        if type == "audio":
            ydl_opts = get_ydl_opts({
                "format": "bestaudio/best",
                "outtmpl": os.path.join(output_dir, "%(id)s_audio.%(ext)s"),
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }],
                "ffmpeg_location": ffmpeg_dir,
                "quiet": True,
                "no_warnings": True,
                "overwrites": True
            })
        else:
            # If format_id is specified, download that format and merge with bestaudio
            ydl_opts = get_ydl_opts({
                "format": f"{format_id}+bestaudio/best",
                "outtmpl": os.path.join(output_dir, f"%(id)s_{format_id}.%(ext)s"),
                "merge_output_format": "mp4",
                "ffmpeg_location": ffmpeg_dir,
                "quiet": True,
                "no_warnings": True,
                "overwrites": True
            })
            
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                
                # Handle cases where postprocessor changes extension or merge format changes name
                if type == "audio":
                    base, _ = os.path.splitext(filename)
                    filename = base + ".mp3"
                else:
                    if not os.path.exists(filename):
                        base, _ = os.path.splitext(filename)
                        if os.path.exists(base + ".mp4"):
                            filename = base + ".mp4"
                            
                return filename
        except Exception as e:
            # Fallback check: if the file was actually written despite rename/cleanup error
            if video_id:
                if type == "audio":
                    fallback_path = os.path.join(output_dir, f"{video_id}_audio.mp3")
                else:
                    fallback_path = os.path.join(output_dir, f"{video_id}_{format_id}.mp4")
                    
                if os.path.exists(fallback_path) and os.path.getsize(fallback_path) > 0:
                    logger.info(f"Target file found after error fallback: {fallback_path}")
                    return fallback_path
            raise e
