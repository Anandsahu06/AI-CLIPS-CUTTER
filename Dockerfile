# Stage 1: Build the Next.js frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npx prisma generate
ENV NEXT_PUBLIC_API_URL=/api
RUN npm run build
# Remove devDependencies to keep image size small
RUN npm prune --production

# Stage 2: Final image with Python, Node, and Nginx
FROM python:3.11-slim

# Install system dependencies (including ffmpeg and nginx)
RUN apt-get update && apt-get install -y \
    curl \
    git \
    libgl1 \
    libglib2.0-0 \
    build-essential \
    ffmpeg \
    nginx \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend dependencies and install them
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code
COPY backend/ ./backend/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend ./frontend

# Copy configuration files
COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose Nginx port
EXPOSE 10000

# Set environment variables
ENV DATABASE_URL="sqlite:////app/frontend/prisma/dev.db"
ENV CELERY_BROKER_URL="sqla+sqlite:////app/frontend/prisma/celery.db"
ENV CELERY_RESULT_BACKEND="db+sqlite:////app/frontend/prisma/celery_results.db"
ENV PORT=10000

WORKDIR /app
CMD ["/app/start.sh"]
