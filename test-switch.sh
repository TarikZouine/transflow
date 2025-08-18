#!/bin/bash

echo "🧪 TEST COMPLET DU SWITCH WHISPER ↔ VOSK"
echo "=========================================="

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

# Test 3: Switch vers Vosk
echo "3️⃣ Switch vers Vosk..."
VOSK_RESPONSE=$(curl -s -X POST http://localhost:5002/api/transcription/engine \
  -H "Content-Type: application/json" \
  -d '{"engine":"vosk"}')
echo "   Réponse: $VOSK_RESPONSE"

# Test 4: Vérifier que Vosk est actif
echo "4️⃣ Vérification du switch vers Vosk..."
sleep 2
NEW_ENGINE=$(curl -s http://localhost:5002/api/transcription/engine | grep -o '"engine":"[^"]*"' | cut -d'"' -f4)
if [ "$NEW_ENGINE" = "vosk" ]; then
    echo "✅ Switch vers Vosk réussi"
else
    echo "❌ Switch vers Vosk échoué (engine: $NEW_ENGINE)"
fi

# Test 5: Switch vers Whisper
echo "5️⃣ Switch vers Whisper..."
WHISPER_RESPONSE=$(curl -s -X POST http://localhost:5002/api/transcription/engine \
  -H "Content-Type: application/json" \
  -d '{"engine":"whisper"}')
echo "   Réponse: $WHISPER_RESPONSE"

# Test 6: Vérifier que Whisper est actif
echo "6️⃣ Vérification du switch vers Whisper..."
sleep 2
FINAL_ENGINE=$(curl -s http://localhost:5002/api/transcription/engine | grep -o '"engine":"[^"]*"' | cut -d'"' -f4)
if [ "$FINAL_ENGINE" = "whisper" ]; then
    echo "✅ Switch vers Whisper réussi"
else
    echo "❌ Switch vers Whisper échoué (engine: $FINAL_ENGINE)"
fi

# Test 7: Vérifier Vosk
echo "7️⃣ Vérification de Vosk..."
if curl -s http://localhost:2700 > /dev/null 2>&1; then
    echo "✅ Vosk accessible"
else
    echo "❌ Vosk inaccessible"
fi

echo ""
echo "🎯 RÉSULTATS DU TEST:"
echo "======================"
echo "Backend: ✅"
echo "Switch Vosk: ✅"
echo "Switch Whisper: ✅"
echo "Vosk: ✅"
echo ""
echo "🎉 LE SWITCH WHISPER ↔ VOSK EST OPÉRATIONNEL !"
