#!/bin/bash

echo "🚀 Démarrage du backend TransFlow..."
echo "📍 Répertoire: $(pwd)"

# Nettoyer les processus existants
echo "🧹 Nettoyage des processus existants..."
pkill -f "test-server.js" 2>/dev/null || true

# Attendre que les processus se terminent
sleep 2

# Vérifier qu'aucun processus ne tourne
if pgrep -f "test-server.js" > /dev/null; then
    echo "❌ Impossible de nettoyer tous les processus"
    exit 1
fi

echo "✅ Nettoyage terminé"

# Démarrer le backend
echo "🔧 Démarrage du backend avec engine: ${TRANSCRIPTION_ENGINE:-whisper}"
cd backend
TRANSCRIPTION_ENGINE=${TRANSCRIPTION_ENGINE:-whisper} node test-server.js
