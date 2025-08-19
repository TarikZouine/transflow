#!/bin/bash

echo "🚀 DÉMARRAGE DU SERVICE VOSK TEMPS RÉEL"
echo "========================================"

# Vérifier que l'environnement Python est prêt
if [ ! -d "transcription-service/.venv" ]; then
    echo "❌ Environnement Python virtuel non trouvé"
    echo "💡 Créez-le avec : cd transcription-service && python3 -m venv .venv"
    exit 1
fi

# Vérifier que Vosk est installé
if ! python3 -c "import vosk" 2>/dev/null; then
    echo "❌ Module Vosk non installé"
    echo "💡 Installez-le avec : pip install vosk"
    exit 1
fi

# Vérifier que le modèle Vosk est disponible
VOSK_MODEL_PATH="/opt/vosk-model-small-fr"
if [ ! -d "$VOSK_MODEL_PATH" ]; then
    echo "⚠️ Modèle Vosk non trouvé dans $VOSK_MODEL_PATH"
    echo "💡 Téléchargez-le avec :"
    echo "   wget https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip"
    echo "   unzip vosk-model-small-fr-0.22.zip"
    echo "   sudo mv vosk-model-small-fr /opt/"
    echo ""
    echo "🔧 Utilisation du modèle par défaut..."
    export VOSK_MODEL_PATH="/usr/local/share/vosk-models/vosk-model-small-fr"
fi

# Vérifier que le répertoire de monitoring existe
MONITOR_DIR="/home/nfs_proxip_monitor"
if [ ! -d "$MONITOR_DIR" ]; then
    echo "⚠️ Répertoire de monitoring non trouvé : $MONITOR_DIR"
    echo "💡 Créez-le avec : sudo mkdir -p $MONITOR_DIR && sudo chmod 755 $MONITOR_DIR"
    exit 1
fi

# Configuration des variables d'environnement
export MONITOR_DIR="$MONITOR_DIR"
export REDIS_URL="redis://127.0.0.1:6379/0"
export TRANSCRIPT_CHANNEL="transcripts.realtime.v2"
export LANGUAGE="fr"

echo "✅ Configuration :"
echo "   📁 Répertoire monitoré: $MONITOR_DIR"
echo "   🔗 Redis: $REDIS_URL"
echo "   📡 Canal: $TRANSCRIPT_CHANNEL"
echo "   🎯 Modèle Vosk: $VOSK_MODEL_PATH"
echo "   🌍 Langue: $LANGUAGE"

# Activer l'environnement virtuel et démarrer le service
echo ""
echo "🔧 Démarrage du service..."
cd transcription-service

# Activer l'environnement virtuel
source .venv/bin/activate

# Démarrer le service temps réel
echo "🚀 Lancement du service Vosk temps réel..."
python3 src/main_vosk_realtime.py




