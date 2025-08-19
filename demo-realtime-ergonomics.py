#!/usr/bin/env python3
"""
Démonstration de l'ergonomie temps réel parfaite
"""

import json
import time
import redis

# Configuration
REDIS_URL = "redis://127.0.0.1:6379/0"
CHANNEL = "transcripts.realtime.v2"

def demo_realtime_ergonomics():
    """Démonstration de l'ergonomie temps réel parfaite"""
    
    # Connexion Redis
    r = redis.from_url(REDIS_URL)
    
    print("🎭 DÉMONSTRATION ERGONOMIE TEMPS RÉEL PARFAITE")
    print("=" * 55)
    print("💡 Objectif: Montrer que les messages temps réel se mettent à jour")
    print("💡 dans la même bulle jusqu'à être remplacés par le final/consolidé")
    print()
    
    call_id = f"demo-ergo-{int(time.time())}"
    
    # Démonstration progressive
    demo = [
        # Phase 1: Client parle progressivement
        {"speaker": "client", "text": "Salut", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Salut, ça", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Salut, ça va", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Salut, ça va ?", "status": "completed", "realtime": False},
        
        # Phase 2: Agent répond progressivement
        {"speaker": "agent", "text": "Oui", "status": "partial", "realtime": True},
        {"speaker": "agent", "text": "Oui, ça", "status": "partial", "realtime": True},
        {"speaker": "agent", "text": "Oui, ça va", "status": "partial", "realtime": True},
        {"speaker": "agent", "text": "Oui, ça va bien", "status": "partial", "realtime": True},
        {"speaker": "agent", "text": "Oui, ça va bien !", "status": "completed", "realtime": False},
        
        # Phase 3: Client continue progressivement
        {"speaker": "client", "text": "Super", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Super, je", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Super, je suis", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Super, je suis ravi", "status": "partial", "realtime": True},
        {"speaker": "client", "text": "Super, je suis ravi !", "status": "completed", "realtime": False},
        
        # Phase 4: Message consolidé final
        {"speaker": "client", "text": "Salut, ça va ? Super, je suis ravi !", "status": "consolidated", "realtime": False, "consolidated": True},
    ]
    
    print(f"📞 Call ID: {call_id}")
    print(f"👥 Participants: Client et Agent")
    print(f"📝 Phases: 4 (progressive → final → consolidé)")
    print()
    
    for i, msg in enumerate(demo, 1):
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
        
        # Afficher le statut de la phase
        if i <= 4:
            phase = "Phase 1: Client parle progressivement"
        elif i <= 8:
            phase = "Phase 2: Agent répond progressivement"
        elif i <= 12:
            phase = "Phase 3: Client continue progressivement"
        else:
            phase = "Phase 4: Message consolidé final"
        
        print(f"{i:2d}. {phase}")
        print(f"    {msg['speaker'].upper()}: {msg['text']}")
        print(f"    Status: {msg['status']} | Realtime: {msg['realtime']}")
        print()
        
        # Envoyer le message
        r.publish(CHANNEL, json.dumps(payload))
        
        # Attendre entre les messages pour simuler le temps réel
        time.sleep(1.2)
    
    print("🎉 DÉMONSTRATION TERMINÉE !")
    print(f"📱 Vérifiez l'interface frontend pour voir l'ergonomie parfaite")
    print(f"🔗 URL: http://ai.intelios.us:3000/transcripts-live")
    print()
    print("✅ RÉSULTAT ATTENDU:")
    print("   • Les messages temps réel se mettent à jour dans la même bulle")
    print("   • Le message final remplace la bulle temps réel")
    print("   • Le message consolidé remplace le final")
    print("   • Ergonomie parfaite et intuitive")

if __name__ == "__main__":
    demo_realtime_ergonomics()




