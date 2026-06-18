import pytest
from unittest.mock import patch, MagicMock
from app.services.video import extract_audio, cut_video
from app.services.transcribe import transcribe_audio
from app.services.ai import analyze_transcript_for_clips
from app.services.subtitles import escape_ffmpeg_path, format_ass_time

def test_ass_time_formatting():
    """Validates that time formatting for ASS captions complies with standard H:MM:SS.cc"""
    assert format_ass_time(0) == "0:00:00.00"
    assert format_ass_time(61.5) == "0:01:01.50"
    assert format_ass_time(3600.0) == "1:00:00.00"

def test_ffmpeg_path_escaping():
    """Verifies path escaping utility for FFmpeg filter compliance, particularly on Windows."""
    raw_path = "C:\\projects\\AI CLIPS CUTTER\\subs.ass"
    escaped = escape_ffmpeg_path(raw_path)
    assert "\\:" in escaped
    assert "/" in escaped
    assert "\\" not in escaped.replace("\\:", "")

@patch("app.services.video.subprocess.run")
def test_audio_extraction_command(mock_run):
    """Checks if audio extractor invokes FFmpeg subprocess with downsampling constraints."""
    mock_run.return_value = MagicMock(returncode=0)
    
    extract_audio("input.mp4", "output.wav")
    
    mock_run.assert_called_once()
    args = mock_run.call_args[0][0]
    assert "input.mp4" in args
    assert "output.wav" in args
    assert "-ac" in args
    assert "16000" in args

@patch("app.services.video.subprocess.run")
def test_video_cutting_command(mock_run):
    """Ensures video cutting script passes start offsets, segments, and codec parameters."""
    mock_run.return_value = MagicMock(returncode=0)
    
    cut_video("input.mp4", 10.0, 25.0, "output.mp4")
    
    mock_run.assert_called_once()
    args = mock_run.call_args[0][0]
    assert "-ss" in args
    assert "10.0" in args
    assert "-t" in args
    assert "15.0" in args

@patch("app.services.transcribe.os.path.exists", return_value=True)
@patch("app.services.transcribe.WhisperModel")
def test_audio_transcription(mock_whisper_class, mock_exists):
    """Ensures Whisper service outputs word-level arrays from mock audio feeds."""
    # Setup mocks
    mock_model = MagicMock()
    mock_whisper_class.return_value = mock_model
    
    mock_word = MagicMock(word=" Hello", start=0.5, end=1.2, probability=0.95)
    mock_segment = MagicMock(text="Hello", words=[mock_word])
    mock_info = MagicMock(language="en", language_probability=0.99)
    
    mock_model.transcribe.return_value = ([mock_segment], mock_info)
    
    result = transcribe_audio("dummy.wav")
    
    assert result["language"] == "en"
    assert len(result["words"]) == 1
    assert result["words"][0]["word"] == "Hello"
    assert result["words"][0]["start"] == 0.5

@patch("app.services.ai.get_gemini_client")
def test_gemini_clip_detection(mock_get_client):
    """Validates Gemini client response text loading and Pydantic parsing filters."""
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    
    mock_response = MagicMock()
    mock_response.text = '{"clips": [{"start": 1.2, "end": 20.5, "score": 95, "title": "Viral Hook", "reason": "Engaging content", "emotional_intensity": 90, "surprise": 85, "curiosity": 90, "energy": 80, "humor": 40, "retention_probability": 92, "hook_text": "Look at this", "viral_caption": "Wait for it", "hashtags": ["viral"], "title_suggestions": ["Short"], "description_suggestion": "SEO text"}]}'
    
    mock_client.models.generate_content.return_value = mock_response
    
    transcript_dummy = {"words": [{"word": "test", "start": 0.0, "end": 1.0}]}
    clips = analyze_transcript_for_clips(transcript_dummy, 60.0)
    
    assert len(clips) == 1
    assert clips[0]["title"] == "Viral Hook"
    assert clips[0]["score"] == 95
    assert clips[0]["start"] == 1.2

