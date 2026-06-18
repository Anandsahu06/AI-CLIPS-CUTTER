#!/bin/bash
set -e

echo "=== Starting ClipForge AI Initialization ==="

# 1. Run database migrations for SQLite
echo "Initializing database..."
cd /app/frontend
npx prisma db push

# 2. Start FastAPI Backend (localhost only, proxied by Nginx)
echo "Starting FastAPI backend server..."
cd /app/backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# 3. Start Celery worker using SQLite broker
echo "Starting Celery task worker..."
celery -A app.celery_app.celery_app worker --loglevel=info -P solo &
CELERY_PID=$!

# 4. Start Next.js Frontend (localhost only, proxied by Nginx)
echo "Starting Next.js frontend server..."
cd /app/frontend
npm run start &
FRONTEND_PID=$!

# 5. Start Nginx reverse proxy (exposes port 10000 to Render)
echo "Starting Nginx reverse proxy..."
nginx -g "daemon off;" &
NGINX_PID=$!

echo "=== All processes launched! Monitoring status... ==="

# Monitor processes to ensure if any process fails, the container exits (so Render restarts it)
while true; do
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[ERROR] FastAPI Backend died. Exiting..."
    exit 1
  fi
  if ! kill -0 $CELERY_PID 2>/dev/null; then
    echo "[ERROR] Celery Worker died. Exiting..."
    exit 1
  fi
  if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "[ERROR] Next.js Frontend died. Exiting..."
    exit 1
  fi
  if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "[ERROR] Nginx reverse proxy died. Exiting..."
    exit 1
  fi
  sleep 5
done
