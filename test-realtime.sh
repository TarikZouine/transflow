#!/bin/bash

echo "🧪 TEST DU TEMPS RÉEL MOT PAR MOT AVEC VOSK"
echo "============================================="

# Test 1: Vérifier que le backend répond
echo "1️⃣ Test du backend..."
if curl -s http://localhost:5002/health > /dev/null; then
    echo "✅ Backend OK"
else
    echo "❌ Backend KO"
    exit 1
fi

# Test 2: Vérifier l'engine actuel
echo "2️⃣ Vérification de l'engine actuel..."
CURRENT_ENGINE=$(curl -s http://localhost:5002/api/transcription/engine | grep -o '"engine":"[^"]*"' | cut -d'"' -f4)
echo "   Engine actuel: $CURRENT_ENGINE"

# Test 3: Switch vers Vosk si nécessaire
if [ "$CURRENT_ENGINE" != "vosk" ]; then
    echo "3️⃣ Switch vers Vosk..."
    VOSK_RESPONSE=$(curl -s -X POST http://localhost:5002/api/transcription/engine \
      -H "Content-Type: application/json" \
      -d '{"engine":"vosk"}')
    echo "   Réponse: $VOSK_RESPONSE"
    
    # Vérifier que le switch a fonctionné
    sleep 2
    NEW_ENGINE=$(curl -s http://localhost:5002/api/transcription/engine | grep -o '"engine":"[^"]*"' | cut -d'"' -f4)
    if [ "$NEW_ENGINE" = "vosk" ]; then
        echo "✅ Switch vers Vosk réussi"
    else
        echo "❌ Switch vers Vosk échoué"
        exit 1
    fi
else
    echo "✅ Vosk déjà actif"
fi

# Test 4: Vérifier que le service Python temps réel est prêt
echo "4️⃣ Vérification du service Python temps réel..."
if [ -f "transcription-service/src/main_vosk_realtime.py" ]; then
    echo "✅ Service Python temps réel prêt"
else
    echo "❌ Service Python temps réel manquant"
    exit 1
fi

# Test 5: Vérifier que Vosk est accessible
echo "5️⃣ Vérification de Vosk..."
if docker ps | grep -q "vosk"; then
    echo "✅ Container Vosk actif"
else
    echo "❌ Container Vosk inactif"
    exit 1
fi

# Test 6: Test d'envoi d'un message temps réel simulé
echo "6️⃣ Test d'envoi d'un message temps réel..."
TEST_PAYLOAD='{
  "callId": "test-realtime-001",
  "tsMs": '$(date +%s%3N)',
  "speaker": "client",
  "lang": "fr",
  "confidence": 0.8,
  "offsetBytes": 1000,
  "status": "partial",
  "text": "Bonjour, comment allez-vous ?",
  "processingTimeMs": 0,
  "engine": "vosk",
  "realtime": true
}'

echo "   Envoi du payload: $TEST_PAYLOAD"

# Publier sur Redis pour simuler un message temps réel
if command -v redis-cli >/dev/null 2>&1; then
    redis-cli publish "transcripts.realtime.v2" "$TEST_PAYLOAD"
    echo "✅ Message publié sur Redis"
else
    echo "⚠️ Redis CLI non disponible, test simulé"
fi

echo ""
echo "🎉 TEST TERMINÉ !"
echo ""
echo "📋 PROCHAINES ÉTAPES :"
echo "1. Démarrer le service Python temps réel :"
echo "   cd transcription-service && python3 src/main_vosk_realtime.py"
echo ""
echo "2. Tester avec de vrais fichiers audio dans /home/nfs_proxip_monitor"
echo ""
echo "3. Vérifier l'interface frontend pour voir les messages temps réel"
echo "   http://ai.intelios.us:3000/transcripts-live"




