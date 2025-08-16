FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY src ./src

ENV REDIS_URL=redis://127.0.0.1:6379/0 \
    TRANSCRIPT_CHANNEL=transcripts.realtime.v2 \
    MONITOR_DIR=/home/nfs_proxip_monitor \
    WHISPER_MODEL=small \
    LANGUAGE=fr

CMD ["python", "-m", "src.main"]


