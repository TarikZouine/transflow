#!/usr/bin/env python3
"""
Script de test temps réel parfait avec mise à jour progressive
"""

import json
import time
import redis

# Configuration
REDIS_URL = "redis://127.0.0.1:6379/0"
CHANNEL = "transcripts.realtime.v2"

def test_perfect_realtime():
    """Test temps réel parfait avec mise à jour progressive"""
    
    # Connexion Redis
    r = redis.from_url(REDIS_URL)
    
    print("🎯 TEST TEMPS RÉEL PARFAIT - MISE À JOUR PROGRESSIVE")
    print("=" * 55)
    
    call_id = f"test-perfect-{int(time.time())}"
    
    # Conversation temps réel progressive
    conversation = [
        # Client parle progressivement
        {"speaker": "client", "text": "Bonjour", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Bonjour, comment", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Bonjour, comment allez-vous", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Bonjour, comment allez-vous aujourd'hui ?", "status": "completed", "realtime": False},
        
        # Agent répond progressivement
        {"speaker": "agent", "text": "Très", "status": "partial", "realtime": True},
        {"speaker": "agent", "text": "Très bien", "status": "partial", "realtime": True},
        {"speaker": "agent", "text": "Très bien, merci", "status": "partial", "realtime": True},
        {"speaker": "agent", "text": "Très bien, merci beaucoup", "status": "partial", "realtime": True},
        {"speaker": "agent", "text": "Très bien, merci beaucoup !", "status": "completed", "realtime": False},
        
        # Client continue progressivement
        {"speaker": "client", "text": "Parfait", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Parfait, je", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Parfait, je suis", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Parfait, je suis content", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Parfait, je suis content de", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Parfait, je suis content de vous", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Parfait, je suis content de vous entendre", "status": "completed", "realtime": False},
        
        # Message consolidé final
        {"speaker": "client", "text": "Bonjour, comment allez-vous aujourd'hui ? Parfait, je suis content de vous entendre.", "status": "consolidated", "realtime": False, "consolidated": True},
    ]
    
    print(f"📞 Call ID: {call_id}")
    print(f"👥 Participants: Client et Agent")
    print(f"📝 Messages temps réel: {len(conversation)}")
    print(f"💡 Les messages temps réel doivent se mettre à jour dans la même bulle")
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
        time.sleep(0.8)
    
    print()
    print("🎉 TEST TERMINÉ !")
    print(f"📱 Vérifiez l'interface frontend pour voir la conversation temps réel parfaite")
    print(f"🔗 URL: http://ai.intelios.us:3000/transcripts-live")
    print(f"💡 Les messages temps réel doivent se mettre à jour dans la même bulle")
    print(f"💡 Le message consolidé doit remplacer la bulle temps réel")

if __name__ == "__main__":
    test_perfect_realtime()




