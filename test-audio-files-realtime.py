#!/usr/bin/env python3
"""
Test temps réel avec les deux fichiers audio (in=client, out=agent)
"""

import json
import time
import redis

# Configuration
REDIS_URL = "redis://127.0.0.1:6379/0"
CHANNEL = "transcripts.realtime.v2"

def test_audio_files_realtime():
    """Test temps réel avec les deux fichiers audio distincts"""
    
    # Connexion Redis
    r = redis.from_url(REDIS_URL)
    
    print("🎵 TEST TEMPS RÉEL - DEUX FICHIERS AUDIO DISTINCTS")
    print("=" * 55)
    print("📁 Fichier IN (client) = Bulle bleue 🟦")
    print("📁 Fichier OUT (agent) = Bulle rose 🟪")
    print("💡 Chaque fichier doit avoir sa propre bulle temps réel")
    print()
    
    call_id = f"audio-files-{int(time.time())}"
    
    # Simulation des deux fichiers audio en parallèle
    conversation = [
        # Fichier IN (Client) - Bulle bleue
        {"speaker": "client", "text": "Bonjour", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Bonjour, comment", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Bonjour, comment allez-vous", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Bonjour, comment allez-vous ?", "status": "completed", "realtime": False, "file": "in"},
        
        # Fichier OUT (Agent) - Bulle rose (en parallèle)
        {"speaker": "agent", "text": "Très", "status": "partial", "realtime": True, "file": "out"},
        {"speaker": "agent", "text": "Très bien", "status": "partial", "realtime": True, "file": "out"},
        {"speaker": "agent", "text": "Très bien, merci", "status": "partial", "realtime": True, "file": "out"},
        {"speaker": "agent", "text": "Très bien, merci beaucoup !", "status": "completed", "realtime": False, "file": "out"},
        
        # Fichier IN (Client) continue - Bulle bleue se met à jour
        {"speaker": "client", "text": "Parfait", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Parfait, je", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Parfait, je suis", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Parfait, je suis ravi", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Parfait, je suis ravi !", "status": "completed", "realtime": False, "file": "in"},
        
        # Fichier OUT (Agent) continue - Bulle rose se met à jour
        {"speaker": "agent", "text": "Moi", "status": "partial", "realtime": True, "file": "out"},
        {"speaker": "agent", "text": "Moi aussi", "status": "partial", "realtime": True, "file": "out"},
        {"speaker": "agent", "text": "Moi aussi !", "status": "completed", "realtime": False, "file": "out"},
        
        # Messages consolidés finaux
        {"speaker": "client", "text": "Bonjour, comment allez-vous ? Parfait, je suis ravi !", "status": "consolidated", "realtime": False, "consolidated": True, "file": "in"},
        {"speaker": "agent", "text": "Très bien, merci beaucoup ! Moi aussi !", "status": "consolidated", "realtime": False, "consolidated": True, "file": "out"},
    ]
    
    print(f"📞 Call ID: {call_id}")
    print(f"📁 Fichiers: IN (client) et OUT (agent)")
    print(f"🎨 Bulles: Bleue (client) et Rose (agent)")
    print(f"📝 Messages: {len(conversation)}")
    print()
    
    for i, msg in enumerate(conversation, 1):
        payload = {
            "callId": call_id,
            "tsMs": int(time.time() * 1000),
            "speaker": msg["speaker"],
            "lang": "fr",
            "confidence": 0.9,
            "offsetBytes": i * 1000,
            "status": msg["status"],
            "text": msg["text"],
            "processingTimeMs": 0,
            "engine": "vosk",
            "realtime": msg["realtime"]
        }
        
        if msg.get("consolidated"):
            payload["consolidated"] = True
        
        # Afficher le fichier et le statut
        file_emoji = "🟦" if msg["file"] == "in" else "🟪"
        file_name = "IN (Client)" if msg["file"] == "in" else "OUT (Agent)"
        
        print(f"{i:2d}. {file_emoji} {file_name}: {msg['text']}")
        print(f"    Status: {msg['status']} | Realtime: {msg['realtime']}")
        
        # Envoyer le message
        r.publish(CHANNEL, json.dumps(payload))
        
        # Attendre entre les messages pour simuler le temps réel
        time.sleep(0.8)
    
    print()
    print("🎉 TEST TERMINÉ !")
    print(f"📱 Vérifiez l'interface pour voir les deux bulles temps réel distinctes")
    print(f"🔗 URL: http://ai.intelios.us:3000/transcripts-live")
    print()
    print("✅ RÉSULTAT ATTENDU:")
    print("   • Bulle bleue (client) se met à jour progressivement")
    print("   • Bulle rose (agent) se met à jour progressivement")
    print("   • Chaque fichier audio a sa propre bulle temps réel")
    print("   • Ergonomie parfaite avec deux bulles distinctes")

if __name__ == "__main__":
    test_audio_files_realtime()




