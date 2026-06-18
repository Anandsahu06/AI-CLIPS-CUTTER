@echo off
title ClipForge AI Backend Runner
echo =======================================================
echo           ClipForge AI - Backend Service Runner
echo =======================================================
echo.

echo [1/3] Checking dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo WARNING: Pip installation encountered errors. Ensure Python is on PATH and rerun.
)

echo.
echo [2/3] Starting Celery Worker in a separate window...
# SQLite database or Redis is used for celery. Celery worker is spawned concurrently.
start "ClipForge Celery Worker" cmd /k "celery -A app.celery_app.celery_app worker --loglevel=info -P solo"

echo.
echo [3/3] Starting FastAPI Web Server...
echo API docs will be available at: http://localhost:8000/docs
echo serving local media files at: http://localhost:8000/media/
echo.
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause
