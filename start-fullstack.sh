#!/bin/bash

# Script pour maintenir frontend + backend toujours actifs
# Gestion automatique des redémarrages et monitoring

BACKEND_DIR="/opt/transflow/backend"
FRONTEND_DIR="/opt/transflow/frontend"
LOG_FILE="/opt/transflow/fullstack.log"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_backend() {
    curl --max-time 3 -s http://localhost:5000/health > /dev/null 2>&1
    return $?
}

check_frontend() {
    curl --max-time 3 -s http://localhost:3000 > /dev/null 2>&1
    return $?
}

start_backend() {
    log_message "🚀 Démarrage backend..."
    cd "$BACKEND_DIR"
    
    # Tuer les anciens processus
    pkill -f "nodemon.*src/index.ts" 2>/dev/null || true
    pkill -f "ts-node.*src/index.ts" 2>/dev/null || true
    
    # Démarrer le backend
    nohup npm run dev >> "$LOG_FILE" 2>&1 &
    
    # Attendre le démarrage
    local max_attempts=15
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if check_backend; then
            log_message "✅ Backend prêt (port 5000)"
            return 0
        fi
        log_message "⏳ Attente backend ($attempt/$max_attempts)..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_message "❌ Échec démarrage backend"
    return 1
}

start_frontend() {
    log_message "🎨 Démarrage frontend..."
    cd "$FRONTEND_DIR"
    
    # Tuer les anciens processus
    pkill -f "vite.*3000" 2>/dev/null || true
    
    # Démarrer le frontend
    nohup npm run dev >> "$LOG_FILE" 2>&1 &
    
    # Attendre le démarrage
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if check_frontend; then
            log_message "✅ Frontend prêt (port 3000)"
            return 0
        fi
        log_message "⏳ Attente frontend ($attempt/$max_attempts)..."
        sleep 3
        attempt=$((attempt + 1))
    done
    
    log_message "❌ Échec démarrage frontend"
    return 1
}

monitor_services() {
    log_message "👁️ Surveillance continue frontend + backend..."
    
    while true; do
        backend_ok=true
        frontend_ok=true
        
        # Vérifier backend
        if ! check_backend; then
            log_message "🚨 Backend arrêté - Redémarrage..."
            start_backend
            backend_ok=$?
        fi
        
        # Vérifier frontend  
        if ! check_frontend; then
            log_message "🚨 Frontend arrêté - Redémarrage..."
            start_frontend
            frontend_ok=$?
        fi
        
        # Status silencieux si tout va bien
        if $backend_ok && $frontend_ok; then
            # Tout va bien - pas de log
            sleep 15
        else
            log_message "⚠️ Problèmes détectés - Monitoring renforcé"
            sleep 5
        fi
    done
}

show_status() {
    echo "🎯 ÉTAT DES SERVICES"
    echo "==================="
    
    if check_backend; then
        echo "✅ Backend : ACTIF (http://localhost:5000)"
    else
        echo "❌ Backend : ARRÊTÉ"
    fi
    
    if check_frontend; then
        echo "✅ Frontend: ACTIF (http://localhost:3000)" 
    else
        echo "❌ Frontend: ARRÊTÉ"
    fi
    
    echo ""
    echo "🔧 Processus actifs:"
    ps aux | grep -E "(nodemon|vite)" | grep -v grep | awk '{print "  " $2 " " $11 " " $12 " " $13}'
}

cleanup() {
    log_message "🛑 Arrêt des services..."
    pkill -f "nodemon.*src/index.ts" 2>/dev/null || true
    pkill -f "vite.*3000" 2>/dev/null || true
    log_message "🧹 Services arrêtés"
    exit 0
}

# Capturer les signaux d'arrêt
trap cleanup SIGTERM SIGINT

case "$1" in
    start)
        log_message "🚀 Démarrage fullstack TransFlow..."
        start_backend
        sleep 3
        start_frontend
        log_message "🎉 Fullstack démarré !"
        show_status
        ;;
    stop)
        cleanup
        ;;
    restart)
        cleanup
        sleep 2
        "$0" start
        ;;
    status)
        show_status
        ;;
    monitor)
        # Démarrer si nécessaire puis surveiller
        if ! check_backend; then
            start_backend
        fi
        if ! check_frontend; then
            start_frontend
        fi
        monitor_services
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|monitor}"
        echo ""
        echo "  start   - Démarre frontend + backend"
        echo "  stop    - Arrête tous les services"
        echo "  restart - Redémarre tous les services"
        echo "  status  - Affiche l'état des services"
        echo "  monitor - Surveillance continue avec redémarrage auto"
        exit 1
        ;;
esac
