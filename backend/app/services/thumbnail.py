import os
import cv2
import logging
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

def generate_thumbnail(video_path: str, timestamp_s: float, title: str, output_path: str) -> str:
    """
    Extracts a frame from video_path at timestamp_s, overlays title text using Pillow,
    and saves the result to output_path as a PNG.
    """
    logger.info(f"Extracting frame for thumbnail at {timestamp_s}s from {video_path}")
    
    # 1. Extract frame using OpenCV
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video_path}")
        
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_idx = int(timestamp_s * fps)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        logger.warning(f"Could not extract frame at {timestamp_s}s. Trying first frame.")
        cap = cv2.VideoCapture(video_path)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            raise RuntimeError("Could not extract any frame from video")
            
    # 2. Convert BGR frame to RGB and load into PIL
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(frame_rgb)
    width, height = img.size
    
    # Create Draw object
    draw = ImageDraw.Draw(img)
    
    # 3. Load font (fallback to default if not found)
    font_path = "arial.ttf"
    try:
        # Check standard paths or just load Arial
        font = ImageFont.truetype(font_path, size=int(height * 0.06))
    except IOError:
        logger.warning(f"Could not load custom font '{font_path}', using default font.")
        font = ImageFont.load_default()
        
    # 4. Text wrapping for title
    max_chars_per_line = 15
    words = title.upper().split(" ")
    lines = []
    current_line = []
    
    for word in words:
        if len(" ".join(current_line + [word])) <= max_chars_per_line:
            current_line.append(word)
        else:
            if current_line:
                lines.append(" ".join(current_line))
            current_line = [word]
    if current_line:
        lines.append(" ".join(current_line))
        
    text_content = "\n".join(lines)
    
    # 5. Draw text with outline/shadow for high visibility
    # Get bounding box of the whole multi-line text to center it
    try:
        # Pillow >= 8.0 has getbbox or textbbox
        bbox = draw.textbbox((0, 0), text_content, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
    except AttributeError:
        # Fallback for older Pillow
        text_w, text_h = draw.textsize(text_content, font=font)
        
    # Position text in the top 1/3 of the vertical video
    x = (width - text_w) / 2
    y = height * 0.25
    
    # Draw drop shadow (offset black text)
    shadow_offset = int(height * 0.005)
    for ox in range(-shadow_offset, shadow_offset + 1, 2):
        for oy in range(-shadow_offset, shadow_offset + 1, 2):
            draw.text((x + ox, y + oy), text_content, fill="black", font=font, align="center")
            
    # Draw primary text in vibrant Yellow
    draw.text((x, y), text_content, fill="yellow", font=font, align="center")
    
    # 6. Save as PNG
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, "PNG")
    logger.info(f"Generated thumbnail saved to: {output_path}")
    
    return output_path
