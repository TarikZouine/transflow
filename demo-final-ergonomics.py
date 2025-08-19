#!/usr/bin/env python3
"""
Démonstration finale de l'ergonomie temps réel parfaite
avec les deux fichiers audio distincts
"""

import json
import time
import redis

# Configuration
REDIS_URL = "redis://127.0.0.1:6379/0"
CHANNEL = "transcripts.realtime.v2"

def demo_final_ergonomics():
    """Démonstration finale de l'ergonomie temps réel parfaite"""
    
    # Connexion Redis
    r = redis.from_url(REDIS_URL)
    
    print("🎭 DÉMONSTRATION FINALE - ERGONOMIE TEMPS RÉEL PARFAITE")
    print("=" * 65)
    print("🎯 Objectif: Montrer l'ergonomie parfaite avec deux fichiers audio")
    print("📁 Fichier IN (client) = Bulle bleue 🟦")
    print("📁 Fichier OUT (agent) = Bulle rose 🟪")
    print("💡 Chaque fichier a sa propre bulle qui se met à jour progressivement")
    print()
    
    call_id = f"demo-final-{int(time.time())}"
    
    # Démonstration progressive et réaliste
    demo = [
        # Phase 1: Client commence à parler (Fichier IN)
        {"speaker": "client", "text": "Salut", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Salut, ça", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Salut, ça va", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Salut, ça va ?", "status": "completed", "realtime": False, "file": "in"},
        
        # Phase 2: Agent répond (Fichier OUT) - EN PARALLÈLE
        {"speaker": "agent", "text": "Oui", "status": "partial", "realtime": True, "file": "out"},
        {"speaker": "agent", "text": "Oui, ça", "status": "partial", "realtime": True, "file": "out"},
        {"speaker": "agent", "text": "Oui, ça va", "status": "partial", "realtime": True, "file": "out"},
        {"speaker": "agent", "text": "Oui, ça va bien", "status": "partial", "realtime": True, "file": "out"},
        {"speaker": "agent", "text": "Oui, ça va bien !", "status": "completed", "realtime": False, "file": "out"},
        
        # Phase 3: Client continue (Fichier IN) - Bulle bleue se met à jour
        {"speaker": "client", "text": "Parfait", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Parfait, je", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Parfait, je suis", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Parfait, je suis content", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Parfait, je suis content de", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Parfait, je suis content de vous", "status": "partial", "realtime": True, "file": "in"},
        {"speaker": "client", "text": "Parfait, je suis content de vous entendre", "status": "completed", "realtime": False, "file": "in"},
        
        # Phase 4: Agent continue (Fichier OUT) - Bulle rose se met à jour
        {"speaker": "agent", "text": "Moi", "status": "partial", "realtime": True, "file": "out"},
        {"speaker": "agent", "text": "Moi aussi", "status": "partial", "realtime": True, "file": "out"},
        {"speaker": "agent", "text": "Moi aussi, c'est", "status": "partial", "realtime": True, "file": "out"},
        {"speaker": "agent", "text": "Moi aussi, c'est un", "status": "partial", "realtime": True, "file": "out"},
        {"speaker": "agent", "text": "Moi aussi, c'est un plaisir", "status": "partial", "realtime": True, "file": "out"},
        {"speaker": "agent", "text": "Moi aussi, c'est un plaisir !", "status": "completed", "realtime": False, "file": "out"},
        
        # Phase 5: Messages consolidés finaux
        {"speaker": "client", "text": "Salut, ça va ? Parfait, je suis content de vous entendre.", "status": "consolidated", "realtime": False, "consolidated": True, "file": "in"},
        {"speaker": "agent", "text": "Oui, ça va bien ! Moi aussi, c'est un plaisir !", "status": "consolidated", "realtime": False, "consolidated": True, "file": "out"},
    ]
    
    print(f"📞 Call ID: {call_id}")
    print(f"📁 Fichiers: IN (client) et OUT (agent)")
    print(f"🎨 Bulles: Bleue (client) et Rose (agent)")
    print(f"📝 Phases: 5 (progressive → parallèle → final → consolidé)")
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
            phase = "Phase 1: Client commence (Fichier IN)"
        elif i <= 8:
            phase = "Phase 2: Agent répond (Fichier OUT)"
        elif i <= 14:
            phase = "Phase 3: Client continue (Fichier IN)"
        elif i <= 20:
            phase = "Phase 4: Agent continue (Fichier OUT)"
        else:
            phase = "Phase 5: Messages consolidés finaux"
        
        file_emoji = "🟦" if msg["file"] == "in" else "🟪"
        file_name = "IN (Client)" if msg["file"] == "in" else "OUT (Agent)"
        
        print(f"{i:2d}. {phase}")
        print(f"    {file_emoji} {file_name}: {msg['text']}")
        print(f"    Status: {msg['status']} | Realtime: {msg['realtime']}")
        print()
        
        # Envoyer le message
        r.publish(CHANNEL, json.dumps(payload))
        
        # Attendre entre les messages pour simuler le temps réel
        time.sleep(1.0)
    
    print("🎉 DÉMONSTRATION TERMINÉE !")
    print(f"📱 Vérifiez l'interface pour voir l'ergonomie parfaite")
    print(f"🔗 URL: http://ai.intelios.us:3000/transcripts-live")
    print()
    print("✅ RÉSULTAT ATTENDU:")
    print("   • Bulle bleue (client) se met à jour progressivement")
    print("   • Bulle rose (agent) se met à jour progressivement")
    print("   • Chaque fichier audio a sa propre bulle temps réel")
    print("   • Transitions fluides : Temps réel → Final → Consolidé")
    print("   • Ergonomie parfaite et intuitive avec deux bulles distinctes")

if __name__ == "__main__":
    demo_final_ergonomics()




