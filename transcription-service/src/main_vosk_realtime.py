#!/usr/bin/env python3
"""
Service de transcription Vosk en temps réel mot par mot
- Streaming audio en continu
- Reconnaissance mot par mot en temps réel
- Consolidation de phrase à la fin
- Support des speakers (client/agent)
"""

import os
import time
import json
import threading
import queue
import wave
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import soundfile as sf
import redis
import vosk
import subprocess
import shutil

# Configuration
MONITOR_DIR = os.getenv("MONITOR_DIR", "/home/nfs_proxip_monitor")
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
CHANNEL = os.getenv("TRANSCRIPT_CHANNEL", "transcripts.realtime.v2")
VOSK_MODEL_PATH = os.getenv("VOSK_MODEL_PATH", "/opt/vosk/vosk-model")
LANGUAGE = os.getenv("LANGUAGE", "fr")

SAMPLE_RATE = 8000  # SLN 16-bit mono 8kHz
BYTES_PER_SAMPLE = 2
CHUNK_SECONDS = 2  # Chunks plus petits pour le temps réel
CHUNK_BYTES = SAMPLE_RATE * BYTES_PER_SAMPLE * CHUNK_SECONDS
SCAN_INTERVAL = 0.2  # Scan très fréquent pour le temps réel

# Configuration Vosk
VOSK_CONFIG = {
    'sample_rate': SAMPLE_RATE,
    'max_alternatives': 1,
    'partial_results': True,  # Résultats partiels pour le temps réel
    'word_timings': True,     # Timestamps des mots
    'max_alternatives': 1
}

class VoskRealtimeTranscriber:
    """Transcriber Vosk en temps réel avec streaming mot par mot"""
    
    def __init__(self):
        self.redis_client = redis.from_url(REDIS_URL)
        self.model = None
        self.rec = None
        self.active_calls: Dict[str, Dict] = {}
        self.audio_buffers: Dict[str, List[bytes]] = {}
        self.transcript_buffers: Dict[str, List[str]] = {}
        self.last_partial: Dict[str, str] = {}
        self.speaker_detection: Dict[str, str] = {}
        
        # Initialiser le modèle Vosk
        self._init_vosk_model()
        
    def _init_vosk_model(self):
        """Initialise le modèle Vosk"""
        try:
            if not os.path.exists(VOSK_MODEL_PATH):
                print(f"❌ Modèle Vosk non trouvé: {VOSK_MODEL_PATH}")
                print("💡 Téléchargez le modèle avec: wget https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip")
                return False
                
            print(f"🔧 Chargement du modèle Vosk: {VOSK_MODEL_PATH}")
            self.model = vosk.Model(VOSK_MODEL_PATH)
            self.rec = vosk.KaldiRecognizer(self.model, SAMPLE_RATE)
            self.rec.SetWords(True)  # Activer les timestamps des mots
            print("✅ Modèle Vosk chargé avec succès")
            return True
            
        except Exception as e:
            print(f"❌ Erreur chargement modèle Vosk: {e}")
            return False
    
    def start_call_monitoring(self, call_id: str, speaker: str = "mixed"):
        """Démarre le monitoring d'un appel"""
        if call_id not in self.active_calls:
            self.active_calls[call_id] = {
                'speaker': speaker,
                'start_time': time.time(),
                'last_audio': time.time(),
                'status': 'active'
            }
            self.audio_buffers[call_id] = []
            self.transcript_buffers[call_id] = []
            self.last_partial[call_id] = ""
            print(f"🎯 Démarrage monitoring appel: {call_id} (speaker: {speaker})")
    
    def stop_call_monitoring(self, call_id: str):
        """Arrête le monitoring d'un appel et consolide la transcription"""
        if call_id in self.active_calls:
            # Consolidation finale de la phrase
            self._consolidate_final_transcript(call_id)
            
            # Nettoyage
            del self.active_calls[call_id]
            del self.audio_buffers[call_id]
            del self.transcript_buffers[call_id]
            del self.last_partial[call_id]
            print(f"🛑 Arrêt monitoring appel: {call_id}")
    
    def process_audio_chunk(self, call_id: str, audio_data: bytes, offset_bytes: int):
        """Traite un chunk audio en temps réel"""
        if call_id not in self.active_calls:
            return
            
        try:
            # Ajouter à la buffer audio
            self.audio_buffers[call_id].append(audio_data)
            self.active_calls[call_id]['last_audio'] = time.time()
            
            # Traitement Vosk en temps réel
            if self.rec and audio_data:
                # Traitement du chunk audio
                if self.rec.AcceptWaveform(audio_data):
                    # Résultat final (phrase complète)
                    result = json.loads(self.rec.Result())
                    if result.get('text', '').strip():
                        self._process_final_result(call_id, result, offset_bytes)
                else:
                    # Résultat partiel (mot par mot)
                    partial = self.rec.PartialResult()
                    partial_data = json.loads(partial)
                    if partial_data.get('partial', '').strip():
                        self._process_partial_result(call_id, partial_data, offset_bytes)
                        
        except Exception as e:
            print(f"❌ Erreur traitement audio chunk: {e}")
    
    def _process_partial_result(self, call_id: str, partial_data: dict, offset_bytes: int):
        """Traite un résultat partiel (mot par mot)"""
        partial_text = partial_data.get('partial', '').strip()
        
        if partial_text and partial_text != self.last_partial.get(call_id, ""):
            self.last_partial[call_id] = partial_text
            
            # Envoyer le mot en temps réel
            payload = {
                "callId": call_id,
                "tsMs": int(time.time() * 1000),
                "speaker": self.active_calls[call_id]['speaker'],
                "lang": LANGUAGE,
                "confidence": 0.8,  # Vosk ne donne pas de confidence
                "offsetBytes": offset_bytes,
                "status": "partial",
                "text": partial_text,
                "processingTimeMs": 0,  # Temps réel = 0
                "engine": "vosk",
                "realtime": True
            }
            
            # Publier sur Redis
            self.redis_client.publish(CHANNEL, json.dumps(payload))
            print(f"🔤 [REALTIME] {call_id} - {partial_text}")
    
    def _process_final_result(self, call_id: str, result: dict, offset_bytes: int):
        """Traite un résultat final (phrase complète)"""
        final_text = result.get('text', '').strip()
        
        if final_text:
            # Ajouter au buffer de transcription
            self.transcript_buffers[call_id].append(final_text)
            
            # Envoyer la phrase finale consolidée
            payload = {
                "callId": call_id,
                "tsMs": int(time.time() * 1000),
                "speaker": self.active_calls[call_id]['speaker'],
                "lang": LANGUAGE,
                "confidence": 0.9,  # Plus élevé pour les phrases finales
                "offsetBytes": offset_bytes,
                "status": "completed",
                "text": final_text,
                "processingTimeMs": 0,  # Temps réel = 0
                "engine": "vosk",
                "realtime": False
            }
            
            # Publier sur Redis
            self.redis_client.publish(CHANNEL, json.dumps(payload))
            print(f"📝 [FINAL] {call_id} - {final_text}")
    
    def _consolidate_final_transcript(self, call_id: str):
        """Consolide la transcription finale d'un appel"""
        if call_id in self.transcript_buffers and self.transcript_buffers[call_id]:
            # Joindre tous les segments en une phrase finale
            final_text = " ".join(self.transcript_buffers[call_id])
            
            payload = {
                "callId": call_id,
                "tsMs": int(time.time() * 1000),
                "speaker": self.active_calls[call_id]['speaker'],
                "lang": LANGUAGE,
                "confidence": 0.95,  # Très élevé pour la consolidation
                "offsetBytes": 0,
                "status": "consolidated",
                "text": final_text,
                "processingTimeMs": 0,
                "engine": "vosk",
                "realtime": False,
                "consolidated": True
            }
            
            # Publier la version consolidée
            self.redis_client.publish(CHANNEL, json.dumps(payload))
            print(f"🔗 [CONSOLIDATED] {call_id} - {final_text}")
    
    def monitor_directory(self):
        """Monitore le répertoire pour les nouveaux fichiers audio"""
        print(f"🔍 Démarrage monitoring répertoire: {MONITOR_DIR}")
        
        while True:
            try:
                # Scanner les appels actifs
                active_calls = self._scan_active_calls()
                
                # Traiter chaque appel
                for call_id, files in active_calls.items():
                    if call_id not in self.active_calls:
                        # Nouvel appel
                        self.start_call_monitoring(call_id)
                    
                    # Traiter les fichiers audio
                    for audio_file in files:
                        self._process_audio_file(call_id, audio_file)
                
                # Nettoyer les appels inactifs
                self._cleanup_inactive_calls()
                
                time.sleep(SCAN_INTERVAL)
                
            except KeyboardInterrupt:
                print("🛑 Arrêt du monitoring")
                break
            except Exception as e:
                print(f"❌ Erreur monitoring: {e}")
                time.sleep(1)
    
    def _scan_active_calls(self) -> Dict[str, List[Path]]:
        """Scanne les appels actifs dans le répertoire"""
        calls = {}
        current_time = time.time()
        
        try:
            monitor_path = Path(MONITOR_DIR)
            if not monitor_path.exists():
                return calls
            
            for f in monitor_path.iterdir():
                if not f.is_file() or f.suffix not in (".sln", ".wav"):
                    continue
                
                # Vérifier si le fichier a été modifié récemment
                try:
                    mtime = f.stat().st_mtime
                    if current_time - mtime > 30:  # 30 secondes
                        continue
                except:
                    continue
                
                # Parser le nom de fichier
                name = f.name
                parts = name.split("-")
                if len(parts) < 2:
                    continue
                    
                ts_phone = parts[0] + "-" + parts[1]
                call_id = ts_phone
                
                # Détecter le speaker basé sur le nom de fichier
                speaker = "mixed"
                if "in" in name.lower():
                    speaker = "client"
                elif "out" in name.lower():
                    speaker = "agent"
                
                if call_id not in calls:
                    calls[call_id] = []
                calls[call_id].append((f, speaker))
                
        except Exception as e:
            print(f"❌ Erreur scan répertoire: {e}")
        
        return calls
    
    def _process_audio_file(self, call_id: str, file_info: Tuple[Path, str]):
        """Traite un fichier audio pour un appel"""
        audio_file, speaker = file_info
        
        try:
            # Mettre à jour le speaker si nécessaire
            if call_id in self.active_calls:
                self.active_calls[call_id]['speaker'] = speaker
            
            # Lire le fichier audio
            if audio_file.suffix == ".sln":
                with open(audio_file, 'rb') as f:
                    audio_data = f.read()
            elif audio_file.suffix == ".wav":
                with wave.open(str(audio_file), 'rb') as wav:
                    audio_data = wav.readframes(wav.getnframes())
            
            # Traiter par chunks pour le temps réel
            offset = 0
            while offset < len(audio_data):
                chunk = audio_data[offset:offset + CHUNK_BYTES]
                if chunk:
                    self.process_audio_chunk(call_id, chunk, offset)
                offset += CHUNK_BYTES
                
        except Exception as e:
            print(f"❌ Erreur traitement fichier {audio_file}: {e}")
    
    def _cleanup_inactive_calls(self):
        """Nettoie les appels inactifs"""
        current_time = time.time()
        inactive_calls = []
        
        for call_id, call_info in self.active_calls.items():
            if current_time - call_info['last_audio'] > 60:  # 1 minute d'inactivité
                inactive_calls.append(call_id)
        
        for call_id in inactive_calls:
            self.stop_call_monitoring(call_id)

def main():
    """Fonction principale"""
    print("🚀 Démarrage du service Vosk en temps réel")
    print(f"📁 Répertoire monitoré: {MONITOR_DIR}")
    print(f"🔗 Redis: {REDIS_URL}")
    print(f"📡 Canal: {CHANNEL}")
    print(f"🎯 Modèle Vosk: {VOSK_MODEL_PATH}")
    
    # Créer le transcriber
    transcriber = VoskRealtimeTranscriber()
    
    if not transcriber.model:
        print("❌ Impossible de démarrer sans modèle Vosk")
        return
    
    # Démarrer le monitoring
    try:
        transcriber.monitor_directory()
    except KeyboardInterrupt:
        print("🛑 Arrêt demandé par l'utilisateur")
    finally:
        print("🧹 Nettoyage...")

if __name__ == "__main__":
    main()
