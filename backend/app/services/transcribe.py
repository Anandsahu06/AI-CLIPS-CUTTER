import os
import logging
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

# Cache model instance to avoid reloading for every request
_model_instance = None

def get_whisper_model(model_size: str = "tiny"):
    global _model_instance
    if _model_instance is None:
        logger.info(f"Loading Whisper model '{model_size}' (device=cpu, compute_type=int8)...")
        # CPU optimized, int8 is fast and uses less RAM
        _model_instance = WhisperModel(model_size, device="cpu", compute_type="int8")
    return _model_instance

def transcribe_audio(audio_path: str, model_size: str = "tiny") -> dict:
    """
    Transcribes a 16kHz WAV mono audio file and returns a transcript dictionary containing:
    - language: detected language code (e.g. 'en')
    - text: full text transcript
    - words: list of dictionaries with word, start, end, and probability
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
    model = get_whisper_model(model_size)
    
    logger.info(f"Starting Whisper transcription for: {audio_path}")
    segments, info = model.transcribe(audio_path, word_timestamps=True, beam_size=5)
    
    detected_language = info.language
    logger.info(f"Detected language: {detected_language} (probability: {info.language_probability:.2f})")
    
    words_list = []
    full_text = []
    
    for segment in segments:
        full_text.append(segment.text.strip())
        if segment.words:
            for word in segment.words:
                words_list.append({
                    "word": word.word.strip(),
                    "start": round(word.start, 3),
                    "end": round(word.end, 3),
                    "probability": round(word.probability, 3)
                })
                
    transcript_result = {
        "language": detected_language,
        "text": " ".join(full_text),
        "words": words_list
    }
    
    logger.info(f"Transcription complete. Total words transcribed: {len(words_list)}")
    return transcript_result
