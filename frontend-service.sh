#!/bin/bash

# Service systemd-like pour maintenir le frontend React toujours actif
# Usage: ./frontend-service.sh [start|stop|restart|status]

FRONTEND_DIR="/opt/transflow/frontend"
PID_FILE="/opt/transflow/frontend.pid"
LOG_FILE="/opt/transflow/frontend-service.log"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

get_frontend_pid() {
    # Trouver le PID du processus Vite frontend
    pgrep -f "vite.*--port.*5173" | head -1
}

is_frontend_running() {
    local pid=$(get_frontend_pid)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

start_frontend() {
    if is_frontend_running; then
        log_message "✅ Frontend déjà actif"
        return 0
    fi
    
    log_message "🚀 Démarrage frontend React..."
    
    cd "$FRONTEND_DIR"
    
    # Vérifier que les dépendances sont installées
    if [ ! -d "node_modules" ]; then
        log_message "📦 Installation des dépendances..."
        npm install >> "$LOG_FILE" 2>&1
    fi
    
    # Démarrer en arrière-plan
    nohup npm run dev >> "$LOG_FILE" 2>&1 &
    local pid=$!
    
    # Attendre que Vite démarre
    sleep 5
    
    # Vérifier que le frontend est accessible
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl --max-time 3 -s http://localhost:5173 > /dev/null 2>&1; then
            echo "$pid" > "$PID_FILE"
            log_message "✅ Frontend démarré avec succès (PID: $pid, Port: 5173)"
            return 0
        fi
        
        log_message "⏳ Tentative $attempt/$max_attempts - Attente démarrage Vite..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_message "❌ Échec démarrage frontend après $max_attempts tentatives"
    return 1
}

stop_frontend() {
    log_message "🛑 Arrêt frontend..."
    
    # Trouver et tuer tous les processus liés au frontend
    local pids=$(pgrep -f "vite.*5173")
    if [ -n "$pids" ]; then
        echo $pids | xargs kill 2>/dev/null
        sleep 2
        
        # Force kill si nécessaire
        local remaining=$(pgrep -f "vite.*5173")
        if [ -n "$remaining" ]; then
            echo $remaining | xargs kill -9 2>/dev/null
        fi
    fi
    
    # Nettoyer le PID file
    rm -f "$PID_FILE"
    log_message "✅ Frontend arrêté"
}

restart_frontend() {
    log_message "🔄 Redémarrage frontend..."
    stop_frontend
    sleep 2
    start_frontend
}

status_frontend() {
    if is_frontend_running; then
        local pid=$(get_frontend_pid)
        echo "✅ Frontend ACTIF (PID: $pid)"
        echo "🌐 URL: http://localhost:5173"
        
        # Test de connectivité
        if curl --max-time 3 -s http://localhost:5173 > /dev/null 2>&1; then
            echo "🔗 Frontend accessible via HTTP"
        else
            echo "⚠️ Frontend process actif mais HTTP inaccessible"
        fi
    else
        echo "❌ Frontend ARRÊTÉ"
    fi
}

watch_frontend() {
    log_message "👁️ Démarrage surveillance continue du frontend..."
    
    while true; do
        if ! is_frontend_running; then
            log_message "🚨 Frontend arrêté détecté - Redémarrage automatique..."
            start_frontend
        fi
        sleep 10  # Vérification toutes les 10 secondes
    done
}

case "$1" in
    start)
        start_frontend
        ;;
    stop)
        stop_frontend
        ;;
    restart)
        restart_frontend
        ;;
    status)
        status_frontend
        ;;
    watch)
        watch_frontend
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|watch}"
        echo ""
        echo "  start   - Démarre le frontend React"
        echo "  stop    - Arrête le frontend"
        echo "  restart - Redémarre le frontend"
        echo "  status  - Affiche l'état du frontend"
        echo "  watch   - Surveillance continue avec redémarrage auto"
        exit 1
        ;;
esac
