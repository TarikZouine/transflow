import os
import time
import json
import threading
from pathlib import Path

import numpy as np
import soundfile as sf
import redis
from faster_whisper import WhisperModel
import tempfile
import subprocess

MONITOR_DIR = os.getenv("MONITOR_DIR", "/home/nfs_proxip_monitor")
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
CHANNEL = os.getenv("TRANSCRIPT_CHANNEL", "transcripts.realtime.v2")
MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
LANGUAGE = os.getenv("LANGUAGE", "fr")

SAMPLE_RATE = 8000  # SLN 16-bit mono 8kHz
BYTES_PER_SAMPLE = 2
CHUNK_SECONDS = 10
CHUNK_BYTES = SAMPLE_RATE * BYTES_PER_SAMPLE * CHUNK_SECONDS
START_SECONDS_BEFORE_END = 15

# Configuration pour traitement temps réel
SCAN_INTERVAL = 0.5  # Scan toutes les 500ms au lieu de 2s
MAX_ACTIVE_THREADS = 100  # Limite de threads actifs
THREAD_CLEANUP_INTERVAL = 30  # Nettoyage des threads morts toutes les 30s


def list_calls(dir_path: Path):
    """Liste tous les appels avec fichiers récents (modifiés dans les 30 dernières secondes, comme le backend)"""
    current_time = time.time()
    calls = {}
    total_files = 0
    recent_files = 0
    
    for f in dir_path.iterdir():
        if not f.is_file() or f.suffix not in (".sln", ".wav"):
            continue
            
        total_files += 1
        
        # Vérifier si le fichier a été modifié récemment (30 secondes, comme le backend)
        try:
            mtime = f.stat().st_mtime
            if current_time - mtime > 30:  # 30 secondes = 30s (comme le backend)
                continue
        except:
            continue
            
        recent_files += 1
        
        # Parser le nom de fichier
        name = f.name
        parts = name.split("-")
        if len(parts) < 2:
            continue
            
        ts_phone = parts[0] + "-" + parts[1]
        call_id = ts_phone
        
        # Ajouter le fichier à l'appel (même logique que le backend)
        if call_id not in calls:
            calls[call_id] = []
        calls[call_id].append(f)
    
    print(f"[transcriber] DEBUG: {total_files} fichiers totaux, {recent_files} fichiers récents, {len(calls)} appels actifs")
    return calls


def sln_bytes_to_float32(sln_bytes: bytes) -> np.ndarray:
    data = np.frombuffer(sln_bytes, dtype=np.int16)
    return (data.astype(np.float32) / 32768.0)


def make_wav_from_sln_bytes(sln_bytes: bytes, out_path: Path):
    pcm = sln_bytes_to_float32(sln_bytes)
    # Ecrire WAV 8k
    sf.write(out_path.as_posix(), pcm, SAMPLE_RATE, subtype='PCM_16')


def resample_8k_to_16k(pcm_8k: np.ndarray) -> np.ndarray:
    """Upsample simple x2 (linéaire) 8kHz -> 16kHz pour Whisper."""
    if pcm_8k.ndim != 1:
        pcm_8k = pcm_8k.reshape(-1)
    n = pcm_8k.shape[0]
    if n == 0:
        return pcm_8k
    # Interpolation linéaire entre chaque échantillon
    x = np.arange(n)
    x_new = np.linspace(0, n - 1, n * 2)
    pcm_16k = np.interp(x_new, x, pcm_8k).astype(np.float32)
    return pcm_16k


def tail_transcribe_call(model: WhisperModel, r: redis.Redis, call_id: str, in_path: Path, out_path: Path):
    """Lit les 2 flux (in/out) et transcrit indépendamment chaque canal (speaker=client/agent)."""
    # Initialiser les offsets à 15s avant la fin pour éviter boucle sur fin temporaire
    offsets = {"in": 0, "out": 0}
    for side, fpath in (("in", in_path), ("out", out_path)):
        if fpath and fpath.exists():
            size = fpath.stat().st_size
            back_bytes = START_SECONDS_BEFORE_END * SAMPLE_RATE * BYTES_PER_SAMPLE
            offsets[side] = max(0, size - back_bytes)
    print(f"[transcriber] start call={call_id} offsets={offsets} in={bool(in_path)} out={bool(out_path)}")
    files = {"in": in_path, "out": out_path}
    last_publish_ts = 0
    
    # Tracker l'état de transcription pour chaque side
    transcription_state = {"in": False, "out": False}

    while True:
        chunks = {}
        for side in ("in", "out"):
            fpath = files.get(side)
            if not fpath or not fpath.exists():
                continue
            size = fpath.stat().st_size
            off = offsets[side]
            if size - off >= CHUNK_BYTES:
                with open(fpath, 'rb') as f:
                    f.seek(off)
                    data = f.read(CHUNK_BYTES)
                offsets[side] += len(data)
                chunks[side] = data

        if not chunks:
            time.sleep(0.25)
            continue

        # Transcrire chaque canal séparément
        for side, sln_bytes in chunks.items():
            pcm_8k = sln_bytes_to_float32(sln_bytes)
            pcm_16k = resample_8k_to_16k(pcm_8k)
            print(f"[transcriber] transcribing call={call_id} side={side} samples={pcm_16k.shape[0]} off={offsets[side]}")
            
            # Marquer le début de transcription seulement si pas déjà en cours
            if not transcription_state[side]:
                transcription_state[side] = True
                start_payload = {
                    "callId": call_id,
                    "tsMs": int(time.time() * 1000),
                    "speaker": 'client' if side == 'in' else 'agent',
                    "lang": LANGUAGE,
                    "offsetBytes": offsets.get(side, 0),
                    "status": "transcribing",
                    "text": "Transcription en cours..."
                }
                r.publish(CHANNEL, json.dumps(start_payload))
            
            # Mesurer le temps de transcription AVANT la transcription
            transcription_start = time.time()
            
            # Transcription Whisper
            seg_iter, info = model.transcribe(
                pcm_16k,
                language="fr",
                task="transcribe",
                vad_filter=False,
                beam_size=5,
                no_speech_threshold=0.2,
                condition_on_previous_text=False
            )
            segments = list(seg_iter)
            text = " ".join((seg.text or "").strip() for seg in segments)
            if not text:
                rms = float(np.sqrt(np.mean(np.square(pcm_16k)))) if pcm_16k.size else 0.0
                text = "[pause]" if rms <= 0.002 else "[inaudible]"
            
            # Calculer le temps de traitement IMMÉDIATEMENT après la transcription
            processing_time_ms = int((time.time() - transcription_start) * 1000)
            
            # Vérifier que le temps est raisonnable (max 30 secondes)
            if processing_time_ms > 30000:
                print(f"⚠️ Temps de traitement anormalement élevé: {processing_time_ms}ms, limité à 30000ms")
                processing_time_ms = 30000
            
            speaker = 'client' if side == 'in' else 'agent'
            
            # Marquer la fin de transcription
            transcription_state[side] = False
            
            # Nettoyer le texte en retirant les sabliers et espaces
            clean_text = text.strip().replace('⏳', '').strip()
            
            payload = {
                "callId": call_id,
                "tsMs": int(time.time() * 1000),
                "speaker": speaker,
                "lang": LANGUAGE,
                "confidence": getattr(info, 'average_logprob', None),
                "offsetBytes": offsets.get(side, 0),
                "status": "completed",
                "text": clean_text,
                "processingTimeMs": processing_time_ms
            }
            r.publish(CHANNEL, json.dumps(payload))
            print(f"[transcriber] published call={call_id} side={speaker} len={len(clean_text)} time={processing_time_ms}ms")


def cleanup_dead_threads(threads):
    """Nettoie les threads morts de la liste"""
    return [t for t in threads if t.is_alive()]


def main():
    dir_path = Path(MONITOR_DIR)
    if not dir_path.exists():
        print(f"MONITOR_DIR not found: {dir_path}")
        return

    print("Loading Whisper model...", MODEL_NAME)
    model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
    r = redis.from_url(REDIS_URL)

    started = set()
    threads = []
    last_cleanup = time.time()

    print(f"[transcriber] Starting with scan interval: {SCAN_INTERVAL}s, max threads: {MAX_ACTIVE_THREADS}")

    while True:
        try:
            current_time = time.time()
            
            # Nettoyage périodique des threads morts
            if current_time - last_cleanup > THREAD_CLEANUP_INTERVAL:
                old_count = len(threads)
                threads = cleanup_dead_threads(threads)
                new_count = len(threads)
                if old_count != new_count:
                    print(f"[transcriber] Cleaned up {old_count - new_count} dead threads. Active: {new_count}")
                last_cleanup = current_time
            
            # Limiter le nombre de threads actifs
            if len(threads) >= MAX_ACTIVE_THREADS:
                print(f"[transcriber] Max threads reached ({len(threads)}), skipping scan")
                time.sleep(SCAN_INTERVAL)
                continue
            
            calls = list_calls(dir_path)
            active_calls = len(calls)
            
            if active_calls > 0:
                print(f"[transcriber] Found {active_calls} active calls, {len(threads)} threads running")
            
            for call_id, files in calls.items():
                if call_id in started:
                    continue
                    
                in_path = next((f for f in files if f.name.endswith('-in.sln')), None)
                out_path = next((f for f in files if f.name.endswith('-out.sln')), None)
                
                if not in_path and not out_path:
                    continue
                    
                print(f"[transcriber] starting call thread {call_id}")
                t = threading.Thread(target=tail_transcribe_call, args=(model, r, call_id, in_path, out_path), daemon=True)
                t.start()
                threads.append(t)
                started.add(call_id)
                
                # Limite de sécurité
                if len(threads) >= MAX_ACTIVE_THREADS:
                    print(f"[transcriber] Max threads reached, stopping new thread creation")
                    break
                    
        except Exception as e:
            print(f"[transcriber] scan error: {e}")
            
        time.sleep(SCAN_INTERVAL)


if __name__ == "__main__":
    main()


