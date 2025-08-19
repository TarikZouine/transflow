#!/usr/bin/env python3
"""
Script de test temps réel pour un appel existant
"""

import json
import time
import redis

# Configuration
REDIS_URL = "redis://127.0.0.1:6379/0"
CHANNEL = "transcripts.realtime.v2"

def test_existing_call_realtime():
    """Test temps réel pour un appel existant"""
    
    # Connexion Redis
    r = redis.from_url(REDIS_URL)
    
    print("📞 TEST TEMPS RÉEL POUR UN APPEL EXISTANT")
    print("=" * 45)
    
    # Utiliser un call_id existant
    call_id = "1755537168.1244929-33618849223"
    
    # Conversation temps réel simulée
    conversation = [
        # Client parle en temps réel
        {"speaker": "client", "text": "Je", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Je veux", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Je veux parler", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Je veux parler avec", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Je veux parler avec quelqu'un", "status": "completed", "realtime": False},
        
        # Agent répond en temps réel
        {"speaker": "agent", "text": "Bien", "status": "partial", "realtime": True},
        {"speaker": "agent", "text": "Bien sûr", "status": "partial", "realtime": True},
        {"speaker": "agent", "text": "Bien sûr, je", "status": "partial", "realtime": True},
        {"speaker": "agent", "text": "Bien sûr, je suis", "status": "partial", "realtime": True},
        {"speaker": "agent", "text": "Bien sûr, je suis là", "status": "completed", "realtime": False},
        
        # Message consolidé final
        {"speaker": "client", "text": "Je veux parler avec quelqu'un. Bien sûr, je suis là.", "status": "consolidated", "realtime": False, "consolidated": True},
    ]
    
    print(f"📞 Call ID: {call_id}")
    print(f"👥 Participants: Client et Agent")
    print(f"📝 Messages temps réel: {len(conversation)}")
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
        
        print(f"{i:2d}. {msg['speaker'].upper()}: {msg['text']}")
        print(f"    Status: {msg['status']} | Realtime: {msg['realtime']}")
        
        # Envoyer le message
        r.publish(CHANNEL, json.dumps(payload))
        
        # Attendre entre les messages pour simuler le temps réel
        time.sleep(0.5)
    
    print()
    print("🎉 TEST TERMINÉ !")
    print(f"📱 Vérifiez l'interface frontend pour voir les messages temps réel")
    print(f"🔗 URL: http://ai.intelios.us:3000/transcripts-live")
    print(f"💡 Les messages temps réel doivent apparaître avec [REALTIME] et [VOSK]")

if __name__ == "__main__":
    test_existing_call_realtime()




