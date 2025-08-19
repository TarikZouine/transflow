#!/bin/bash

# Script pour maintenir le frontend React toujours actif
# Surveille et redémarre automatiquement si nécessaire

FRONTEND_DIR="/opt/transflow/frontend"
LOG_FILE="/opt/transflow/frontend-keepalive.log"
PID_FILE="/opt/transflow/frontend.pid"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_frontend_running() {
    # Vérifier si un processus npm run dev existe pour le frontend
    if pgrep -f "vite.*frontend" > /dev/null; then
        return 0  # Frontend en cours
    else
        return 1  # Frontend arrêté
    fi
}

start_frontend() {
    log_message "🚀 Démarrage du frontend React..."
    cd "$FRONTEND_DIR"
    
    # Tuer d'abord tout processus existant
    pkill -f "vite.*frontend" 2>/dev/null || true
    
    # Démarrer le frontend en arrière-plan
    nohup npm run dev > "$LOG_FILE" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$PID_FILE"
    
    log_message "✅ Frontend démarré avec PID: $FRONTEND_PID"
    
    # Attendre un peu pour vérifier que le démarrage s'est bien passé
    sleep 3
    
    if check_frontend_running; then
        log_message "✅ Frontend confirmé actif"
        return 0
    else
        log_message "❌ Échec démarrage frontend"
        return 1
    fi
}

main_loop() {
    log_message "🔍 Démarrage du monitoring frontend..."
    
    while true; do
        if check_frontend_running; then
            # Frontend actif - affichage silencieux
            sleep 10
        else
            log_message "⚠️ Frontend arrêté détecté - Redémarrage..."
            start_frontend
            sleep 5
        fi
    done
}

# Fonction d'arrêt propre
cleanup() {
    log_message "🛑 Arrêt du monitoring frontend"
    if [ -f "$PID_FILE" ]; then
        FRONTEND_PID=$(cat "$PID_FILE")
        if kill -0 "$FRONTEND_PID" 2>/dev/null; then
            kill "$FRONTEND_PID"
            log_message "🛑 Frontend arrêté (PID: $FRONTEND_PID)"
        fi
        rm -f "$PID_FILE"
    fi
    exit 0
}

# Capturer les signaux d'arrêt
trap cleanup SIGTERM SIGINT

# Vérifier les dépendances
if [ ! -d "$FRONTEND_DIR" ]; then
    log_message "❌ Répertoire frontend non trouvé: $FRONTEND_DIR"
    exit 1
fi

if [ ! -f "$FRONTEND_DIR/package.json" ]; then
    log_message "❌ package.json non trouvé dans: $FRONTEND_DIR"
    exit 1
fi

# Démarrer immédiatement si pas actif
if ! check_frontend_running; then
    log_message "🎯 Frontend non actif - Démarrage initial..."
    start_frontend
fi

# Boucle de monitoring
main_loop
