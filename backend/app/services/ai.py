import os
import json
import logging
from typing import List
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from ..config import settings

logger = logging.getLogger(__name__)

# Define Pydantic structures for strict schema validation
class ClipMoment(BaseModel):
    start: float = Field(..., description="Start time of the moment in seconds")
    end: float = Field(..., description="End time of the moment in seconds (duration should be between 15 and 60 seconds)")
    score: int = Field(..., description="Engagement/virality score from 0 to 100")
    title: str = Field(..., description="A catchy, click-worthy title for the clip")
    reason: str = Field(..., description="Explanation of why this clip is engaging (emotional peak, educational, funny, surprise, etc.)")
    emotional_intensity: int = Field(..., description="Emotional intensity score from 0 to 100")
    surprise: int = Field(..., description="Surprise/novelty score from 0 to 100")
    curiosity: int = Field(..., description="Curiosity score from 0 to 100")
    energy: int = Field(..., description="Energy/pace score from 0 to 100")
    humor: int = Field(..., description="Humor/entertainment score from 0 to 100")
    retention_probability: int = Field(..., description="Audience retention probability from 0 to 100")
    hook_text: str = Field(..., description="A powerful visual hook (first 3 seconds) to overlay as text")
    viral_caption: str = Field(..., description="Viral caption for social posts")
    hashtags: List[str] = Field(..., description="List of 3-5 trending relevant hashtags")
    title_suggestions: List[str] = Field(..., description="List of exactly 20 alternative engaging titles for the clip")
    description_suggestion: str = Field(..., description="Optimized YouTube Shorts / TikTok description containing summary and hashtags")

class ViralMomentsResponse(BaseModel):
    clips: List[ClipMoment]

def get_gemini_client():
    api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured in settings or environment variables.")
    return genai.Client(api_key=api_key)

def analyze_transcript_for_clips(transcript_data: dict, original_duration: float, target_duration: float = 30.0) -> list:
    """
    Sends the word-level transcript to Gemini API and asks it to identify the top engaging clips
    with structural schema outputs.
    """
    client = get_gemini_client()
    
    # Format a compact transcript for Gemini to read
    # We will pass a sample of word timings or segment summaries
    words = transcript_data.get("words", [])
    if not words:
        logger.warning("No words found in transcript. Returning empty clips list.")
        return []
        
    # Group words into blocks of ~20 words with timestamps to reduce token size and make it easy to map
    blocks = []
    current_block = []
    block_start = None
    
    for i, w in enumerate(words):
        if len(current_block) == 0:
            block_start = w["start"]
        current_block.append(w["word"])
        
        # Every 20 words or at the end
        if len(current_block) >= 20 or i == len(words) - 1:
            block_end = w["end"]
            blocks.append({
                "start": block_start,
                "end": block_end,
                "text": " ".join(current_block)
            })
            current_block = []
            
    transcript_json_str = json.dumps(blocks, indent=2)
    
    prompt = f"""
    You are an expert social media editor and viral growth strategist for TikTok, YouTube Shorts, and Instagram Reels.
    
    Below is a transcript of a video with start and end timestamps (in seconds).
    
    Original Video Duration: {original_duration} seconds.
    
    Your task is to identify the 10 most engaging, cohesive, and viral moments.
    
    Guidelines:
    1. Each clip MUST have a duration of approximately {target_duration} seconds (unless the whole video is shorter).
    2. Focus on self-contained moments: starts with a strong hook, delivers value/emotion, and ends cleanly.
    3. Calculate the engagement score (0-100) based on emotional intensity, surprise, curiosity, energy, humor, and audience retention probability.
    4. Provide hook text, viral captions, exactly 20 title suggestions, descriptions, and hashtags.
    5. Ensure the start and end timestamps match the transcript timestamps as closely as possible. Do not output overlap clips that represent the exact same text, try to extract unique moments.
    
    Transcript:
    {transcript_json_str}
    """
    
    logger.info("Calling Gemini API for viral moment analysis...")
    
    # Fallback list of models supported by the API key
    models_to_try = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"]
    response = None
    last_error = None

    for model_name in models_to_try:
        try:
            logger.info(f"Calling Gemini API with model: {model_name}...")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ViralMomentsResponse,
                    temperature=0.2,
                ),
            )
            break # Success, break out of loop
        except Exception as e:
            logger.warning(f"Failed to generate content with {model_name}: {e}")
            last_error = e
            continue

    if response is None:
        logger.error(f"All Gemini models failed. Last error: {last_error}")
        raise RuntimeError(f"Gemini API limit reached or service unavailable: {last_error}")
    
    try:
        # The SDK parses structural JSON directly into the Pydantic schema structure
        # but let's access the text or JSON structure
        result_data = json.loads(response.text)
        clips = result_data.get("clips", [])
        logger.info(f"Gemini successfully identified {len(clips)} viral clips.")
        return clips
    except Exception as e:
        logger.error(f"Failed to parse Gemini response: {e}. Raw response: {response.text}")
        raise RuntimeError(f"Failed to analyze transcript: {e}")
