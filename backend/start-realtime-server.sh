#!/bin/bash

# Script de démarrage robuste pour le serveur de streaming temps réel
# Ce script maintient le serveur en vie même en cas d'erreur

echo "🚀 Démarrage du serveur TransFlow en mode temps réel..."

# Variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_SCRIPT="$SCRIPT_DIR/test-server.js"
PID_FILE="$SCRIPT_DIR/server.pid"
LOG_FILE="$SCRIPT_DIR/server.log"
PORT=${PORT:-5002}

# Fonction pour nettoyer les processus existants
cleanup_existing() {
    echo "🧹 Nettoyage des processus existants..."
    
    # Tuer les processus par PID file
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if ps -p "$OLD_PID" > /dev/null 2>&1; then
            echo "🔪 Arrêt du processus existant (PID: $OLD_PID)"
            kill "$OLD_PID" 2>/dev/null
            sleep 2
            if ps -p "$OLD_PID" > /dev/null 2>&1; then
                kill -9 "$OLD_PID" 2>/dev/null
            fi
        fi
        rm -f "$PID_FILE"
    fi
    
    # Tuer les processus qui écoutent sur le port
    EXISTING_PIDS=$(lsof -ti :$PORT 2>/dev/null)
    if [ ! -z "$EXISTING_PIDS" ]; then
        echo "🔪 Arrêt des processus sur le port $PORT: $EXISTING_PIDS"
        echo "$EXISTING_PIDS" | xargs kill -9 2>/dev/null
    fi
    
    # Attendre un peu pour que les ports se libèrent
    sleep 2
}

# Fonction pour démarrer le serveur
start_server() {
    echo "▶️ Démarrage du serveur Node.js..."
    
    # Démarrer le serveur en arrière-plan avec gestion des logs
    cd "$SCRIPT_DIR"
    nohup node "$SERVER_SCRIPT" > "$LOG_FILE" 2>&1 &
    SERVER_PID=$!
    
    # Sauvegarder le PID
    echo "$SERVER_PID" > "$PID_FILE"
    
    echo "✅ Serveur démarré avec le PID: $SERVER_PID"
    echo "📋 Logs disponibles dans: $LOG_FILE"
    echo "🌐 Health check: http://localhost:$PORT/health"
    
    return $SERVER_PID
}

# Fonction pour surveiller le serveur
monitor_server() {
    local server_pid=$1
    echo "👁️ Surveillance du serveur (PID: $server_pid)..."
    
    while true; do
        if ! ps -p "$server_pid" > /dev/null 2>&1; then
            echo "❌ Le serveur s'est arrêté (PID: $server_pid)"
            echo "🔄 Redémarrage automatique..."
            
            # Nettoyer et redémarrer
            cleanup_existing
            start_server
            server_pid=$?
            
            echo "✅ Serveur redémarré avec le PID: $server_pid"
        fi
        
        # Vérifier toutes les 5 secondes
        sleep 5
    done
}

# Fonction pour tester la connectivité
test_connectivity() {
    echo "🔍 Test de connectivité..."
    
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
            echo "✅ Serveur accessible sur le port $PORT"
            return 0
        fi
        
        echo "⏳ Tentative $attempt/$max_attempts - En attente du serveur..."
        sleep 2
        ((attempt++))
    done
    
    echo "❌ Impossible de se connecter au serveur après $max_attempts tentatives"
    return 1
}

# Gestion des signaux pour un arrêt propre
trap 'echo "🛑 Arrêt demandé..."; cleanup_existing; exit 0' SIGINT SIGTERM

# Exécution principale
echo "🏁 Initialisation..."

# Nettoyer les processus existants
cleanup_existing

# Démarrer le serveur
start_server
SERVER_PID=$?

# Tester la connectivité
if test_connectivity; then
    echo "🎉 Serveur TransFlow opérationnel !"
    echo ""
    echo "📊 Endpoints disponibles:"
    echo "  • Health check: http://localhost:$PORT/health"
    echo "  • Liste des appels: http://localhost:$PORT/api/calls"
    echo "  • Streaming temps réel: http://localhost:$PORT/api/calls/stream-all"
    echo "  • Streaming audio: http://localhost:$PORT/api/calls/{id}/stream-realtime/{type}"
    echo ""
    echo "🔄 Le serveur redémarre automatiquement en cas d'arrêt"
    echo "🛑 Utilisez Ctrl+C pour arrêter"
    echo ""
    
    # Surveiller le serveur
    monitor_server $SERVER_PID
else
    echo "❌ Échec du démarrage du serveur"
    cleanup_existing
    exit 1
fi

