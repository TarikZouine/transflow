#!/usr/bin/env python3
"""
Script de test simple pour le temps réel
"""

import json
import time
import redis

# Configuration
REDIS_URL = "redis://127.0.0.1:6379/0"
CHANNEL = "transcripts.realtime.v2"

def test_realtime():
    """Test du temps réel avec des messages simulés"""
    
    # Connexion Redis
    r = redis.from_url(REDIS_URL)
    
    print("🧪 TEST DU TEMPS RÉEL SIMPLE")
    print("=" * 40)
    
    # Test 1: Message temps réel
    print("1️⃣ Envoi message temps réel...")
    payload1 = {
        "callId": "test-realtime-001",
        "tsMs": int(time.time() * 1000),
        "speaker": "client",
        "lang": "fr",
        "confidence": 0.8,
        "offsetBytes": 1000,
        "status": "partial",
        "text": "Bonjour, comment allez-vous ?",
        "processingTimeMs": 0,
        "engine": "vosk",
        "realtime": True
    }
    
    r.publish(CHANNEL, json.dumps(payload1))
    print("   ✅ Message temps réel envoyé")
    
    # Test 2: Message final
    time.sleep(2)
    print("2️⃣ Envoi message final...")
    payload2 = {
        "callId": "test-realtime-001",
        "tsMs": int(time.time() * 1000),
        "speaker": "client",
        "lang": "fr",
        "confidence": 0.9,
        "offsetBytes": 2000,
        "status": "completed",
        "text": "Bonjour, comment allez-vous ?",
        "processingTimeMs": 150,
        "engine": "vosk",
        "realtime": False
    }
    
    r.publish(CHANNEL, json.dumps(payload2))
    print("   ✅ Message final envoyé")
    
    # Test 3: Message consolidé
    time.sleep(2)
    print("3️⃣ Envoi message consolidé...")
    payload3 = {
        "callId": "test-realtime-001",
        "tsMs": int(time.time() * 1000),
        "speaker": "client",
        "lang": "fr",
        "confidence": 0.95,
        "offsetBytes": 3000,
        "status": "consolidated",
        "text": "Bonjour, comment allez-vous ?",
        "processingTimeMs": 150,
        "engine": "vosk",
        "realtime": False,
        "consolidated": True
    }
    
    r.publish(CHANNEL, json.dumps(payload3))
    print("   ✅ Message consolidé envoyé")
    
    print("\n🎉 TEST TERMINÉ !")
    print("Vérifiez l'interface frontend pour voir les messages")

if __name__ == "__main__":
    test_realtime()




