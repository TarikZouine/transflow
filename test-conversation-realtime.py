#!/usr/bin/env python3
"""
Script de test d'une conversation temps réel complète
"""

import json
import time
import redis

# Configuration
REDIS_URL = "redis://127.0.0.1:6379/0"
CHANNEL = "transcripts.realtime.v2"

def test_conversation_realtime():
    """Test d'une conversation temps réel complète"""
    
    # Connexion Redis
    r = redis.from_url(REDIS_URL)
    
    print("🗣️ TEST D'UNE CONVERSATION TEMPS RÉEL COMPLÈTE")
    print("=" * 50)
    
    call_id = f"test-conversation-{int(time.time())}"
    
    # Conversation simulée
    conversation = [
        # Client parle
        {"speaker": "client", "text": "Bonjour", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Bonjour, comment", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Bonjour, comment allez-vous ?", "status": "completed", "realtime": False},
        
        # Agent répond
        {"speaker": "agent", "text": "Très bien", "status": "partial", "realtime": True},
        {"speaker": "agent", "text": "Très bien, merci", "status": "partial", "realtime": True},
        {"speaker": "agent", "text": "Très bien, merci beaucoup", "status": "completed", "realtime": False},
        
        # Client continue
        {"speaker": "client", "text": "Parfait", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Parfait, je suis", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Parfait, je suis content", "status": "completed", "realtime": False},
        
        # Message consolidé final
        {"speaker": "client", "text": "Bonjour, comment allez-vous ? Parfait, je suis content.", "status": "consolidated", "realtime": False, "consolidated": True},
    ]
    
    print(f"📞 Call ID: {call_id}")
    print(f"👥 Participants: Client et Agent")
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
        
        print(f"{i:2d}. {msg['speaker'].upper()}: {msg['text']}")
        print(f"    Status: {msg['status']} | Realtime: {msg['realtime']}")
        
        # Envoyer le message
        r.publish(CHANNEL, json.dumps(payload))
        
        # Attendre entre les messages
        time.sleep(1)
    
    print()
    print("🎉 CONVERSATION TERMINÉE !")
    print(f"📱 Vérifiez l'interface frontend pour voir la conversation temps réel")
    print(f"🔗 URL: http://ai.intelios.us:3000/transcripts-live")

if __name__ == "__main__":
    test_conversation_realtime()




