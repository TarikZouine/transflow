#!/bin/bash

# Script pour maintenir le backend simple sur port 5002 toujours actif

BACKEND_SCRIPT="/opt/transflow/backend/start-backend-5002.js"
PID_FILE="/opt/transflow/backend-5002.pid"
LOG_FILE="/opt/transflow/backend-5002.log"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

is_backend_running() {
    if curl --max-time 3 -s http://localhost:5002/health > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

start_backend() {
    log_message "🚀 Démarrage backend simple sur port 5002..."
    
    # Tuer l'ancien processus si existe
    if [ -f "$PID_FILE" ]; then
        local old_pid=$(cat "$PID_FILE")
        if kill -0 "$old_pid" 2>/dev/null; then
            kill "$old_pid"
            sleep 2
        fi
    fi
    
    # Démarrer le nouveau backend
    cd /opt/transflow/backend
    nohup node start-backend-5002.js >> "$LOG_FILE" 2>&1 &
    local pid=$!
    echo $pid > "$PID_FILE"
    
    # Attendre le démarrage
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if is_backend_running; then
            log_message "✅ Backend 5002 démarré avec succès (PID: $pid)"
            return 0
        fi
        log_message "⏳ Tentative $attempt/$max_attempts - Attente démarrage..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_message "❌ Échec démarrage backend 5002"
    return 1
}

stop_backend() {
    log_message "🛑 Arrêt backend 5002..."
    
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            log_message "✅ Backend 5002 arrêté (PID: $pid)"
        fi
        rm -f "$PID_FILE"
    fi
    
    # Tuer tous les processus qui écoutent sur 5002
    local pids=$(lsof -ti:5002 2>/dev/null)
    if [ -n "$pids" ]; then
        echo $pids | xargs kill 2>/dev/null
    fi
}

status_backend() {
    if is_backend_running; then
        local pid=""
        if [ -f "$PID_FILE" ]; then
            pid=" (PID: $(cat "$PID_FILE"))"
        fi
        echo "✅ Backend 5002 ACTIF$pid"
        echo "🌐 URL: http://ai.intelios.us:5002"
        echo "🔗 API: http://ai.intelios.us:5002/api/calls/active"
    else
        echo "❌ Backend 5002 ARRÊTÉ"
    fi
}

monitor_backend() {
    log_message "👁️ Démarrage surveillance backend 5002..."
    
    while true; do
        if ! is_backend_running; then
            log_message "🚨 Backend 5002 arrêté - Redémarrage automatique..."
            start_backend
        fi
        sleep 15  # Vérification toutes les 15 secondes
    done
}

case "$1" in
    start)
        start_backend
        ;;
    stop)
        stop_backend
        ;;
    restart)
        stop_backend
        sleep 2
        start_backend
        ;;
    status)
        status_backend
        ;;
    monitor)
        monitor_backend
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|monitor}"
        echo ""
        echo "  start   - Démarre le backend sur port 5002"
        echo "  stop    - Arrête le backend"
        echo "  restart - Redémarre le backend"
        echo "  status  - Affiche l'état du backend"
        echo "  monitor - Surveillance continue avec redémarrage auto"
        exit 1
        ;;
esac
