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
import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import soundfile as sf
import redis
import vosk
import subprocess
import shutil
import mysql.connector

# Configuration
MONITOR_DIR = os.getenv("MONITOR_DIR", "/home/nfs_proxip_monitor")
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
CHANNEL = os.getenv("TRANSCRIPT_CHANNEL", "transcripts.realtime.v2")
VOSK_MODEL_PATH = os.getenv("VOSK_MODEL_PATH", "/opt/vosk/vosk-model")
LANGUAGE = os.getenv("LANGUAGE", "fr")

SAMPLE_RATE = 8000  # SLN 16-bit mono 8kHz
BYTES_PER_SAMPLE = 2
CHUNK_SECONDS = 10  # Chunks plus longs pour de meilleures phrases
CHUNK_BYTES = SAMPLE_RATE * BYTES_PER_SAMPLE * CHUNK_SECONDS
SCAN_INTERVAL = 0.5  # Scan moins fréquent mais plus efficace

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
        # Pas de recognizer global - on en crée un par thread
        self.active_calls: Dict[str, Dict] = {}
        self.audio_buffers: Dict[str, List[bytes]] = {}
        self.transcript_buffers: Dict[str, List[str]] = {}
        self.last_partial: Dict[str, str] = {}
        self.speaker_detection: Dict[str, str] = {}
        
        # Tracker les chunks traités pour éviter les doublons
        self.processed_chunks: Dict[str, set] = {}  # call_id -> set of (file_path, offset)
        
        # NOUVEAU: Tracker les appels activés pour transcription
        self.enabled_calls: set = set()  # Appels activés par l'utilisateur
        
        # Initialiser le modèle Vosk
        self._init_vosk_model()
        
        # Initialiser la connexion MySQL
        self._init_mysql_connection()
        
        # Démarrer le monitoring de la table de contrôle
        self._start_control_monitor()
        
    def _init_vosk_model(self):
        """Initialise le modèle Vosk"""
        try:
            if not os.path.exists(VOSK_MODEL_PATH):
                print(f"❌ Modèle Vosk non trouvé: {VOSK_MODEL_PATH}")
                print("💡 Téléchargez le modèle avec: wget https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip")
                return False
                
            print(f"🔧 Chargement du modèle Vosk: {VOSK_MODEL_PATH}")
            # Désactiver les logs verbeux de Vosk
            vosk.SetLogLevel(-1)
            self.model = vosk.Model(VOSK_MODEL_PATH)
            print("✅ Modèle Vosk chargé avec succès", flush=True)
            return True
            
        except Exception as e:
            print(f"❌ Erreur chargement modèle Vosk: {e}")
            return False
    
    def _init_mysql_connection(self):
        """Initialise la connexion MySQL"""
        try:
            self.mysql_conn = mysql.connector.connect(
                unix_socket='/var/run/mysqld/mysqld.sock',
                user='root',
                password='',
                database='transflow'
            )
            print("✅ Connexion MySQL initialisée", flush=True)
        except Exception as e:
            print(f"❌ Erreur connexion MySQL: {e}", flush=True)
            self.mysql_conn = None
    
    def _start_control_monitor(self):
        """Démarre le monitoring de la table de contrôle MySQL"""
        def control_monitor():
            print("🎧 Monitoring de la table transcription_control démarré", flush=True)
            
            while True:
                try:
                    if self.mysql_conn is None:
                        self._init_mysql_connection()
                        time.sleep(5)
                        continue
                    
                    # Récupérer les appels activés depuis la table
                    cursor = self.mysql_conn.cursor()
                    cursor.execute("SELECT call_id FROM transcription_control WHERE is_enabled = TRUE")
                    enabled_calls_db = {row[0] for row in cursor.fetchall()}
                    cursor.close()
                    
                    # DEBUG: Afficher l'état actuel
                    print(f"🔍 Monitoring MySQL: {len(enabled_calls_db)} appels activés en DB, {len(self.enabled_calls)} en mémoire", flush=True)
                    if enabled_calls_db:
                        print(f"🔍 Appels en DB: {list(enabled_calls_db)[:3]}...", flush=True)
                    if self.enabled_calls:
                        print(f"🔍 Appels en mémoire: {list(self.enabled_calls)[:3]}...", flush=True)
                    
                    # Détecter les nouveaux appels activés
                    new_enabled = enabled_calls_db - self.enabled_calls
                    if new_enabled:
                        print(f"🔍 Nouveaux appels détectés: {list(new_enabled)}", flush=True)
                    for call_id in new_enabled:
                        self.enabled_calls.add(call_id)
                        print(f"✅ Transcription activée pour: {call_id}", flush=True)
                    
                    # Détecter les appels désactivés
                    newly_disabled = self.enabled_calls - enabled_calls_db
                    if newly_disabled:
                        print(f"🚫 Appels désactivés détectés: {list(newly_disabled)}", flush=True)
                    for call_id in newly_disabled:
                        self.enabled_calls.discard(call_id)
                        # Arrêter IMMÉDIATEMENT le monitoring pour cet appel
                        if call_id in self.active_calls:
                            self.stop_call_monitoring(call_id)
                        print(f"❌ Transcription ARRÊTÉE pour: {call_id}", flush=True)
                    
                    # Attendre 2 secondes pour une réactivité maximale
                    time.sleep(2)
                    
                except Exception as e:
                    print(f"⚠️ Erreur monitoring MySQL: {e}", flush=True)
                    time.sleep(5)
        
        # Démarrer le monitor dans un thread séparé
        monitor_thread = threading.Thread(target=control_monitor, daemon=True)
        monitor_thread.start()
    
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
            self.processed_chunks[call_id] = set()  # Initialiser le tracker de chunks
            current_time = datetime.datetime.now().strftime("%H:%M:%S")
            print(f"🎯 {current_time} | Démarrage monitoring appel: {call_id} (speaker: {speaker})", flush=True)
    
    def stop_call_monitoring(self, call_id: str):
        """Arrête IMMÉDIATEMENT et complètement le monitoring d'un appel"""
        if call_id in self.active_calls:
            print(f"🛑 ARRÊT IMMÉDIAT monitoring appel: {call_id}", flush=True)
            
            # Marquer comme inactif pour stopper tous les threads
            self.active_calls[call_id]['status'] = 'stopped'
            
            # Consolidation finale de la phrase (si il y a du contenu)
            try:
                self._consolidate_final_transcript(call_id)
            except Exception as e:
                print(f"⚠️ Erreur consolidation finale {call_id}: {e}", flush=True)
            
            # Nettoyage complet et robuste
            try:
                del self.active_calls[call_id]
                if call_id in self.audio_buffers:
                    del self.audio_buffers[call_id]
                if call_id in self.transcript_buffers:
                    del self.transcript_buffers[call_id]
                if call_id in self.processed_chunks:
                    del self.processed_chunks[call_id]
                
                # Nettoyer tous les last_partial qui commencent par call_id
                keys_to_remove = []
                for key in self.last_partial.keys():
                    if key.startswith(call_id):
                        keys_to_remove.append(key)
                for key in keys_to_remove:
                    del self.last_partial[key]
                    
                print(f"🧹 Nettoyage complet terminé pour: {call_id}", flush=True)
                
            except Exception as e:
                print(f"⚠️ Erreur nettoyage {call_id}: {e}", flush=True)
    
    # Fonction supprimée - remplacée par process_audio_chunk_with_speaker
    
    def process_audio_chunk_with_speaker(self, call_id: str, audio_data: bytes, offset_bytes: int, speaker: str):
        """Traite un chunk audio en temps réel avec un speaker spécifique"""
        # PROTECTION ROBUSTE: Ne traiter QUE les appels activés
        if call_id not in self.active_calls or call_id not in self.enabled_calls:
            return
            
        try:
            # Ajouter à la buffer audio
            self.audio_buffers[call_id].append(audio_data)
            self.active_calls[call_id]['last_audio'] = time.time()
            
            # Créer un recognizer dédié pour ce thread/appel pour éviter les conflits
            local_rec = vosk.KaldiRecognizer(self.model, SAMPLE_RATE)
            local_rec.SetWords(False)  # Désactiver les timestamps pour éviter les erreurs iVector
            
            # Traitement immédiat de chaque chunk pour ne rien perdre
            if audio_data:
                try:
                    # Convertir SLN en PCM pour Vosk
                    pcm_data = self._sln_to_pcm(audio_data)
                    
                    if local_rec.AcceptWaveform(pcm_data.tobytes()):
                        # Résultat final (phrase complète)
                        result = json.loads(local_rec.Result())
                        text = result.get('text', '').strip()
                        if text and len(text) > 1:  # Accepter même les mots courts
                            self._process_final_result_with_speaker(call_id, result, offset_bytes, speaker)
                    else:
                        # Résultat partiel (mot par mot)
                        partial = local_rec.PartialResult()
                        partial_data = json.loads(partial)
                        text = partial_data.get('partial', '').strip()
                        if text and len(text) > 2:  # Accepter les partiels courts aussi
                            self._process_partial_result_with_speaker(call_id, partial_data, offset_bytes, speaker)
                except Exception as vosk_error:
                    print(f"⚠️ Erreur Vosk pour {call_id} ({speaker}): {vosk_error}", flush=True)
                        
        except Exception as e:
            print(f"❌ Erreur traitement audio chunk ({speaker}): {e}")
    
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
                "confidence": 0.8,
                "offsetBytes": offset_bytes,
                "status": "partial",
                "text": partial_text,
                "processingTimeMs": 0,
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
                "realtime": False
            }
            
            # Publier sur Redis
            self.redis_client.publish(CHANNEL, json.dumps(payload))
            print(f"📝 [FINAL] {call_id} - {final_text}")
    
    def _process_final_result_with_speaker(self, call_id: str, result: dict, offset_bytes: int, speaker: str):
        """Traite un résultat final avec speaker spécifique"""
        final_text = result.get('text', '').strip()
        
        if final_text:
            # Publier le résultat final
            import datetime
            payload = {
                "callId": call_id,
                "tsMs": int(time.time() * 1000),
                "speaker": speaker,  # Utiliser le speaker spécifique du fichier
                "lang": LANGUAGE,
                "confidence": 0.9,
                "offsetBytes": offset_bytes,
                "status": "completed",
                "text": final_text,
                "processingTimeMs": 0,
                "realtime": False,
                "timestamp": datetime.datetime.now().strftime("%H:%M:%S")  # Ajouter l'heure
            }
            
            self.redis_client.publish(CHANNEL, json.dumps(payload))
            self.transcript_buffers[call_id].append(final_text)
            
            # Ajouter l'heure de transcription
            current_time = datetime.datetime.now().strftime("%H:%M:%S")
            print(f"📝 [FINAL] {current_time} | {call_id} ({speaker}) - {final_text}", flush=True)
    
    def _process_partial_result_with_speaker(self, call_id: str, partial_data: dict, offset_bytes: int, speaker: str):
        """Traite un résultat partiel avec speaker spécifique"""
        partial_text = partial_data.get('partial', '').strip()
        
        # Créer une clé unique par speaker pour éviter les conflits
        speaker_key = f"{call_id}_{speaker}"
        
        if partial_text and partial_text != self.last_partial.get(speaker_key, ""):
            self.last_partial[speaker_key] = partial_text
            
            # Envoyer le mot en temps réel
            import datetime
            payload = {
                "callId": call_id,
                "tsMs": int(time.time() * 1000),
                "speaker": speaker,  # Utiliser le speaker spécifique du fichier
                "lang": LANGUAGE,
                "confidence": 0.8,
                "offsetBytes": offset_bytes,
                "status": "partial",
                "text": partial_text,
                "processingTimeMs": 0,
                "realtime": True,
                "timestamp": datetime.datetime.now().strftime("%H:%M:%S")  # Ajouter l'heure
            }
            
            self.redis_client.publish(CHANNEL, json.dumps(payload))
            
            # Ajouter l'heure de transcription temps réel
            current_time = datetime.datetime.now().strftime("%H:%M:%S")
            print(f"🔤 [REALTIME] {current_time} | {call_id} ({speaker}) - {partial_text}", flush=True)
    
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
                "realtime": False,
                "consolidated": True
            }
            
            # Publier la version consolidée
            self.redis_client.publish(CHANNEL, json.dumps(payload))
            print(f"🔗 [CONSOLIDATED] {call_id} - {final_text}")
    
    def monitor_directory(self):
        """Monitore le répertoire pour les nouveaux fichiers audio"""
        print(f"🔍 Démarrage monitoring répertoire: {MONITOR_DIR}")
        
        # Dictionnaire pour tracker les threads actifs par appel
        active_threads: Dict[str, threading.Thread] = {}
        
        while True:
            try:
                # Scanner les appels actifs
                active_calls = self._scan_active_calls()
                
                # ROBUSTE: Traiter SEULEMENT les appels explicitement activés dans la DB
                for call_id, files in active_calls.items():
                    # CONDITION STRICTE: Traiter SEULEMENT les appels enabled
                    if call_id in self.enabled_calls:
                        print(f"🎯 Appel activé détecté: {call_id} (enabled_calls: {len(self.enabled_calls)})", flush=True)
                        
                        # Démarrer le monitoring si pas encore fait
                        if call_id not in self.active_calls:
                            self.start_call_monitoring(call_id)
                            
                            # Créer un thread pour CHAQUE FICHIER (in et out séparément)
                            for file_path, speaker in files:
                                thread_id = f"{call_id}_{speaker}"  # ID unique par fichier
                                
                                # Vérifier que le fichier est vraiment actif avant de créer un thread
                                try:
                                    if not file_path.exists():
                                        continue
                                    
                                    file_mtime = file_path.stat().st_mtime
                                    current_time = time.time()
                                    
                                    # Ne créer un thread que si le fichier a été modifié dans les 30 dernières secondes
                                    if current_time - file_mtime > 30:
                                        continue  # Fichier trop ancien, ignorer
                                        
                                except Exception:
                                    continue
                                
                                if thread_id not in active_threads or not active_threads[thread_id].is_alive():
                                    # S'assurer qu'il n'y a pas de thread zombie
                                    if thread_id in active_threads:
                                        del active_threads[thread_id]
                                    
                                    thread = threading.Thread(
                                        target=self._process_file_continuously,
                                        args=(call_id, file_path, speaker),
                                        daemon=True,
                                        name=f"VoskTranscriber-{call_id}-{speaker}"
                                    )
                                    thread.start()
                                    active_threads[thread_id] = thread
                                    current_time_str = datetime.datetime.now().strftime("%H:%M:%S")
                                    print(f"🧵 {current_time_str} | Thread démarré pour {call_id} ({speaker}) [ACTIVÉ]", flush=True)
                    else:
                        # Appel détecté mais PAS activé - ne rien faire
                        if call_id in self.active_calls:
                            print(f"🛑 Appel {call_id} détecté mais NON activé - Arrêt monitoring", flush=True)
                            self.stop_call_monitoring(call_id)
                
                # NOUVEAU: Nettoyage proactif des appels qui ne sont plus enabled
                calls_to_stop = []
                for call_id in self.active_calls.copy():
                    if call_id not in self.enabled_calls:
                        calls_to_stop.append(call_id)
                
                for call_id in calls_to_stop:
                    print(f"🧹 Nettoyage appel non-enabled: {call_id}", flush=True)
                    self.stop_call_monitoring(call_id)
                    # Arrêter tous les threads associés
                    threads_to_remove = []
                    for thread_id in active_threads:
                        if thread_id.startswith(f"{call_id}_"):
                            threads_to_remove.append(thread_id)
                    
                    for thread_id in threads_to_remove:
                        if thread_id in active_threads:
                            del active_threads[thread_id]
                            print(f"🧹 Thread supprimé: {thread_id}", flush=True)
                
                # Plus de nettoyage automatique - seulement sur désactivation manuelle
                
                # Nettoyer les threads morts (silencieusement)
                dead_threads = [call_id for call_id, thread in active_threads.items() 
                              if not thread.is_alive()]
                for call_id in dead_threads:
                    del active_threads[call_id]
                
                time.sleep(SCAN_INTERVAL)
                
            except KeyboardInterrupt:
                print("🛑 Arrêt du monitoring")
                # Attendre que tous les threads se terminent
                for thread in active_threads.values():
                    if thread.is_alive():
                        thread.join(timeout=1)
                break
            except Exception as e:
                print(f"❌ Erreur monitoring: {e}")
                time.sleep(1)
    
    def _process_call_continuously(self, call_id: str, initial_files: List[Tuple[Path, str]]):
        """Traite un appel de manière continue dans son propre thread"""
        try:
            print(f"🎯 Traitement continu démarré pour l'appel: {call_id}", flush=True)
            
            # Traiter les fichiers en continu jusqu'à ce que l'appel se termine
            processed_offsets = {}  # Tracker les offsets par fichier
            
            while call_id in self.active_calls and self.active_calls[call_id]['status'] == 'active':
                # Rescanner les fichiers de cet appel spécifiquement
                call_files = self._get_call_files(call_id)
                
                if not call_files:
                    time.sleep(0.5)
                    continue
                
                # Traiter chaque fichier de l'appel
                for file_path, speaker in call_files:
                    try:
                        file_key = str(file_path)
                        
                        # Vérifier si le fichier a été modifié récemment
                        try:
                            current_size = file_path.stat().st_size
                            last_offset = processed_offsets.get(file_key, 0)
                            
                            # Si le fichier a grandi, traiter la nouvelle partie
                            if current_size > last_offset:
                                self._process_audio_file_incremental(call_id, file_path, speaker, last_offset)
                                processed_offsets[file_key] = current_size
                                
                        except Exception as e:
                            print(f"⚠️ Erreur lecture fichier {file_path}: {e}")
                            continue
                            
                    except Exception as e:
                        print(f"⚠️ Erreur traitement fichier pour {call_id}: {e}")
                        continue
                
                # Pause courte avant le prochain scan
                time.sleep(0.2)
                
        except Exception as e:
            print(f"❌ Erreur traitement continu appel {call_id}: {e}")
        finally:
            print(f"🏁 Traitement continu terminé pour l'appel: {call_id}")
    
    def _process_file_continuously(self, call_id: str, file_path: Path, speaker: str):
        """Traite un fichier spécifique (in ou out) de manière continue - SEULEMENT si activé"""
        try:
            print(f"🎯 Traitement fichier démarré: {call_id} ({speaker}) - {file_path.name}", flush=True)
            
            processed_offset = 0  # Tracker l'offset pour ce fichier
            
            last_activity_time = time.time()
            
            while (call_id in self.active_calls and 
                   self.active_calls[call_id]['status'] == 'active' and
                   call_id in self.enabled_calls):  # ROBUSTE: Vérifier que l'appel est TOUJOURS activé
                try:
                    # Vérifier si le fichier existe et a grandi
                    if not file_path.exists():
                        time.sleep(0.5)
                        continue
                    
                    current_size = file_path.stat().st_size
                    current_time = time.time()
                    
                    # Vérifier IMMÉDIATEMENT si l'appel est encore enabled
                    if call_id not in self.enabled_calls:
                        print(f"🚫 Appel {call_id} plus enabled - Arrêt thread {speaker}", flush=True)
                        break
                    
                    # Vérifier si le fichier a été modifié récemment (30 secondes)
                    file_mtime = file_path.stat().st_mtime
                    if current_time - file_mtime > 30:
                        print(f"🛑 Fichier inactif depuis 30s: {file_path.name} - Arrêt transcription", flush=True)
                        # Ne pas retirer de enabled_calls ici - laisser le monitoring MySQL décider
                        break
                    
                    # Si le fichier a grandi, traiter la nouvelle partie
                    if current_size > processed_offset:
                        new_data_size = current_size - processed_offset
                        
                        # Lire seulement la nouvelle partie
                        with open(file_path, 'rb') as f:
                            f.seek(processed_offset)
                            new_audio_data = f.read(new_data_size)
                        
                        if new_audio_data:
                            # Traiter par chunks
                            chunk_offset = 0
                            while chunk_offset < len(new_audio_data):
                                chunk = new_audio_data[chunk_offset:chunk_offset + CHUNK_BYTES]
                                if chunk:
                                    self.process_audio_chunk_with_speaker(call_id, chunk, processed_offset + chunk_offset, speaker)
                                chunk_offset += CHUNK_BYTES
                            
                            processed_offset = current_size
                    
                    # Vérification ultra-rapide de l'état enabled
                    if call_id not in self.enabled_calls:
                        print(f"🚫 ARRÊT IMMÉDIAT - Plus enabled: {call_id} ({speaker})", flush=True)
                        break
                    
                    # Pause courte avant le prochain scan
                    time.sleep(0.2)
                    
                except Exception as e:
                    print(f"⚠️ Erreur traitement fichier {file_path}: {e}", flush=True)
                    time.sleep(1)
                    
        except Exception as e:
            print(f"❌ Erreur traitement continu fichier {file_path}: {e}", flush=True)
        finally:
            print(f"🏁 Traitement fichier terminé: {call_id} ({speaker})", flush=True)
    
    def _get_call_files(self, call_id: str) -> List[Tuple[Path, str]]:
        """Récupère les fichiers pour un appel spécifique"""
        files = []
        current_time = time.time()
        
        try:
            monitor_path = Path(MONITOR_DIR)
            if not monitor_path.exists():
                return files
            
            for f in monitor_path.iterdir():
                if not f.is_file() or f.suffix not in (".sln", ".wav"):
                    continue
                
                # Vérifier si le fichier a été modifié récemment
                try:
                    mtime = f.stat().st_mtime
                    if current_time - mtime > 120:  # 2 minutes pour capturer plus d'appels
                        continue
                except:
                    continue
                
                # Parser le nom de fichier pour voir s'il appartient à cet appel
                name = f.name
                parts = name.split("-")
                if len(parts) < 3:
                    continue
                    
                # Extraire timestamp + phone pour correspondre au call_id
                timestamp_phone = parts[0] + "-" + parts[1]
                file_call_id = timestamp_phone
                
                # Si ce fichier appartient à l'appel qu'on traite
                if file_call_id == call_id:
                    # Détecter le speaker
                    speaker = "mixed"
                    if "in" in name.lower():
                        speaker = "client"
                    elif "out" in name.lower():
                        speaker = "agent"
                    
                    files.append((f, speaker))
                    
        except Exception as e:
            print(f"❌ Erreur scan fichiers pour {call_id}: {e}")
        
        return files
    
    def _process_audio_file_incremental(self, call_id: str, file_path: Path, speaker: str, offset: int):
        """Traite seulement la nouvelle partie d'un fichier audio"""
        try:
            # Mettre à jour la dernière activité (mais pas le speaker global)
            if call_id in self.active_calls:
                self.active_calls[call_id]['last_audio'] = time.time()
            
            # Lire seulement la nouvelle partie du fichier
            if file_path.suffix == ".sln":
                with open(file_path, 'rb') as f:
                    f.seek(offset)
                    new_audio_data = f.read()
            elif file_path.suffix == ".wav":
                # Pour les fichiers WAV, c'est plus complexe car il faut skip le header
                with wave.open(str(file_path), 'rb') as wav:
                    frame_size = wav.getsampwidth() * wav.getnchannels()
                    frame_offset = offset // frame_size
                    wav.setpos(frame_offset)
                    remaining_frames = wav.getnframes() - frame_offset
                    if remaining_frames > 0:
                        new_audio_data = wav.readframes(remaining_frames)
                    else:
                        new_audio_data = b''
            
            if not new_audio_data:
                return
            
            # Traiter par chunks pour le temps réel
            chunk_offset = 0
            while chunk_offset < len(new_audio_data):
                chunk = new_audio_data[chunk_offset:chunk_offset + CHUNK_BYTES]
                if chunk:
                    current_offset = offset + chunk_offset
                    chunk_key = (str(file_path), current_offset)
                    
                    # Vérifier si ce chunk a déjà été traité
                    if call_id in self.processed_chunks and chunk_key in self.processed_chunks[call_id]:
                        # Chunk déjà traité - pas de log pour éviter la pollution
                        chunk_offset += CHUNK_BYTES
                        continue
                    
                    # Marquer ce chunk comme traité AVANT de le traiter
                    if call_id not in self.processed_chunks:
                        self.processed_chunks[call_id] = set()
                    self.processed_chunks[call_id].add(chunk_key)
                    
                    # Traiter le chunk avec le speaker spécifique du fichier
                    self.process_audio_chunk_with_speaker(call_id, chunk, current_offset, speaker)
                    
                chunk_offset += CHUNK_BYTES
                
        except Exception as e:
            print(f"❌ Erreur traitement incrémental {file_path}: {e}")
    
    def _sln_to_pcm(self, sln_data: bytes) -> np.ndarray:
        """Convertit les données SLN en PCM float32"""
        # SLN = 16-bit signed little-endian
        pcm_int16 = np.frombuffer(sln_data, dtype=np.int16)
        # Convertir en float32 normalisé entre -1 et 1
        pcm_float32 = pcm_int16.astype(np.float32) / 32768.0
        return pcm_float32
    
    def _scan_active_calls(self) -> Dict[str, List[Tuple[Path, str]]]:
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
                    if current_time - mtime > 30:  # 30 secondes pour capturer les appels actifs
                        continue
                except:
                    continue
                
                # Parser le nom de fichier - format variable
                name = f.name
                parts = name.split("-")
                if len(parts) < 3:
                    continue
                    
                # Extraire le numéro de téléphone (toujours en position 1)
                phone_number = parts[1]
                
                # Utiliser timestamp + phone pour un ID unique mais groupé
                timestamp_phone = parts[0] + "-" + phone_number
                call_id = timestamp_phone
                
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
    print("🚀 Démarrage du service Vosk en temps réel", flush=True)
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
