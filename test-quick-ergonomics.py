#!/usr/bin/env python3
"""
Test rapide de l'ergonomie temps réel
"""

import json
import time
import redis

# Configuration
REDIS_URL = "redis://127.0.0.1:6379/0"
CHANNEL = "transcripts.realtime.v2"

def test_quick_ergonomics():
    """Test rapide de l'ergonomie temps réel"""
    
    # Connexion Redis
    r = redis.from_url(REDIS_URL)
    
    print("⚡ TEST RAPIDE ERGONOMIE TEMPS RÉEL")
    print("=" * 40)
    
    call_id = f"quick-test-{int(time.time())}"
    
    # Test simple et rapide
    test = [
        {"speaker": "client", "text": "Test", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Test temps", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Test temps réel", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Test temps réel !", "status": "completed", "realtime": False},
        {"speaker": "client", "text": "Test temps réel ! Ergonomie parfaite !", "status": "consolidated", "realtime": False, "consolidated": True},
    ]
    
    print(f"📞 Call ID: {call_id}")
    print(f"👤 Speaker: Client")
    print(f"📝 Messages: {len(test)}")
    print()
    
    for i, msg in enumerate(test, 1):
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
        
        print(f"{i}. {msg['text']}")
        print(f"   Status: {msg['status']} | Realtime: {msg['realtime']}")
        
        # Envoyer le message
        r.publish(CHANNEL, json.dumps(payload))
        
        # Attendre rapidement
        time.sleep(0.5)
    
    print()
    print("🎉 TEST TERMINÉ !")
    print(f"📱 Vérifiez l'interface: la bulle doit se mettre à jour progressivement")

if __name__ == "__main__":
    test_quick_ergonomics()




