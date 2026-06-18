import os
import logging
import subprocess
from datetime import timedelta
from .video import FFMPEG_PATH

logger = logging.getLogger(__name__)

# Standard styles for subtitles
THEMES = {
    "tiktok": {
        "font_name": "Impact",
        "font_size": 48,
        "primary_color": "&H00FFFFFF",  # White (BGR hex: &H00BBGGRR)
        "outline_color": "&H00000000",  # Black
        "shadow_color": "&H00000000",   # Black
        "karaoke_color": "&H0000FFFF",  # Yellow
        "outline_width": 4.0,
        "alignment": 5,                 # Middle Center
        "uppercase": True
    },
    "cyberpunk": {
        "font_name": "Arial",
        "font_size": 48,
        "primary_color": "&H00FFFF00",  # Cyan
        "outline_color": "&H00FF00FF",  # Pink
        "shadow_color": "&H00000000",
        "karaoke_color": "&H00FF00FF",  # Pink highlight
        "outline_width": 3.0,
        "alignment": 5,
        "uppercase": True
    },
    "minimalist": {
        "font_name": "Arial",
        "font_size": 36,
        "primary_color": "&H00FFFFFF",  # White
        "outline_color": "&H80000000",  # Semi-transparent Black
        "shadow_color": "&H00000000",
        "karaoke_color": "&H0000FF00",  # Soft Green
        "outline_width": 1.5,
        "alignment": 2,                 # Bottom Center (alignment 2)
        "uppercase": False
    },
    "retro": {
        "font_name": "Courier New",
        "font_size": 40,
        "primary_color": "&H0000FFFF",  # Yellow
        "outline_color": "&H00000000",
        "shadow_color": "&H00000000",
        "karaoke_color": "&H00FFFFFF",  # White
        "outline_width": 2.0,
        "alignment": 5,
        "uppercase": True
    }
}

def format_ass_time(seconds: float) -> str:
    """Formats float seconds into ASS time format: H:MM:SS.cc"""
    if seconds < 0:
        seconds = 0
    td = timedelta(seconds=seconds)
    hours = td.seconds // 3600
    minutes = (td.seconds % 3600) // 60
    secs = td.seconds % 60
    centiseconds = int(round(td.microseconds / 10000))
    if centiseconds >= 100:
        centiseconds = 99
    return f"{hours}:{minutes:02d}:{secs:02d}.{centiseconds:02d}"

def escape_ffmpeg_path(path: str) -> str:
    """Escapes file paths for the FFmpeg filter syntax, especially on Windows."""
    # Replace backslashes with forward slashes
    path = path.replace("\\", "/")
    # Colons are special in FFmpeg filter string, escape them e.g. C: -> C\:
    path = path.replace(":", "\\:")
    # Quotes are also special
    path = path.replace("'", "'\\\\''")
    return path

def generate_ass_file(words: list, start_time: float, end_time: float, output_path: str, theme_name: str = "tiktok") -> str:
    """
    Creates a styled ASS subtitle file for a specific clip timeframe.
    """
    theme = THEMES.get(theme_name.lower(), THEMES["tiktok"])
    
    # 1. Filter words within clip boundaries and adjust their start/end relative to clip start
    clip_words = []
    for w in words:
        w_start = w["start"]
        w_end = w["end"]
        
        # Word must be within clip
        if w_start >= start_time and w_end <= end_time:
            clip_words.append({
                "word": w["word"].upper() if theme["uppercase"] else w["word"],
                "start": w_start - start_time,
                "end": w_end - start_time
            })
            
    # 2. Group words into short lines (e.g. 3 words max per card)
    word_groups = []
    current_group = []
    group_size = 3
    
    for i, cw in enumerate(clip_words):
        current_group.append(cw)
        if len(current_group) == group_size or i == len(clip_words) - 1:
            word_groups.append(current_group)
            current_group = []
            
    # 3. Create dialog lines. For karaoke effect, we write an event for each word's highlight period.
    # If the group is [w1, w2, w3], we write:
    # Event 1: from w1_start to w1_end -> highlight w1
    # Event 2: from w2_start to w2_end -> highlight w2
    # Event 3: from w3_start to w3_end -> highlight w3
    # During each highlight, the rest of the words in the group are shown in normal style.
    events = []
    
    for idx, group in enumerate(word_groups):
        g_start = group[0]["start"]
        g_end = group[-1]["end"]
        
        # Write sub-dialogues for each word's highlighting window
        for w_idx, highlight_word in enumerate(group):
            # Highlight period matches the word's timing
            # But the line appears for the whole duration of the group
            # To simulate karaoke: we split the group duration into segments:
            # Segment 1 (highlight w1): from w1.start to w2.start (or w1.end if there is a gap)
            # Segment 2 (highlight w2): from w2.start to w3.start
            # etc.
            seg_start = highlight_word["start"]
            if w_idx == len(group) - 1:
                seg_end = g_end
            else:
                seg_end = group[w_idx + 1]["start"]
                
            # Construct text: highlight current word, rest in primary color
            text_parts = []
            for w in group:
                if w == highlight_word:
                    # Highlight color tag
                    text_parts.append(f"{{\\c{theme['karaoke_color']}}}{w['word']}{{\\c}}")
                else:
                    text_parts.append(w["word"])
                    
            text = " ".join(text_parts)
            events.append(
                f"Dialogue: 0,{format_ass_time(seg_start)},{format_ass_time(seg_end)},Default,,0,0,0,,{text}"
            )
            
    # 4. Compile ASS script headers
    ass_template = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{theme['font_name']},{theme['font_size']},{theme['primary_color']},{theme['primary_color']},{theme['outline_color']},{theme['shadow_color']},1,0,0,0,100,100,0,0,1,{theme['outline_width']},0.0,{theme['alignment']},20,20,100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    # Append events
    ass_content = ass_template + "\n".join(events)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(ass_content)
        
    return output_path

def burn_subtitles(video_path: str, ass_path: str, output_path: str) -> str:
    """
    Burns the ASS subtitle file into the video using FFmpeg.
    """
    escaped_ass = escape_ffmpeg_path(ass_path)
    
    # Run FFmpeg command to burn subtitles
    cmd = [
        FFMPEG_PATH,
        "-y",
        "-i", video_path,
        "-vf", f"subtitles='{escaped_ass}'",
        "-c:v", "libx264",
        "-c:a", "copy",
        "-preset", "veryfast",
        output_path
    ]
    
    logger.info(f"Burning subtitles: {ass_path} -> {video_path}")
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    
    if result.returncode != 0:
        logger.error(f"FFmpeg subtitle burn failed: {result.stderr}")
        raise RuntimeError(f"Failed to burn subtitles: {result.stderr}")
        
    return output_path
