#!/bin/bash

# Service de surveillance automatique pour maintenir
# le frontend React + backend TypeScript toujours actifs

SCRIPT_DIR="/opt/transflow"
LOG_FILE="/opt/transflow/auto-keepalive.log"
PID_FILE="/opt/transflow/keepalive.pid"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_services() {
    backend_ok=false
    frontend_ok=false
    
    # Test backend
    if curl --max-time 3 -s http://localhost:5000/health > /dev/null 2>&1; then
        backend_ok=true
    fi
    
    # Test frontend
    if curl --max-time 3 -s http://localhost:3000 > /dev/null 2>&1; then
        frontend_ok=true
    fi
    
    echo "$backend_ok $frontend_ok"
}

restart_services_if_needed() {
    read backend_ok frontend_ok <<< $(check_services)
    
    local restart_needed=false
    
    if [ "$backend_ok" != "true" ]; then
        log_message "🚨 Backend arrêté - Redémarrage..."
        "$SCRIPT_DIR/start-fullstack.sh" start > /dev/null 2>&1
        restart_needed=true
    fi
    
    if [ "$frontend_ok" != "true" ]; then
        log_message "🚨 Frontend arrêté - Redémarrage..."
        "$SCRIPT_DIR/start-fullstack.sh" start > /dev/null 2>&1  
        restart_needed=true
    fi
    
    if [ "$restart_needed" = "true" ]; then
        sleep 10  # Attendre que les services redémarrent
    fi
}

main_monitoring_loop() {
    log_message "🔍 Démarrage surveillance automatique TransFlow"
    log_message "👁️ Frontend: http://localhost:3000"
    log_message "🔌 Backend: http://localhost:5000"
    
    # Démarrage initial si nécessaire
    restart_services_if_needed
    
    # Boucle de surveillance
    while true; do
        read backend_ok frontend_ok <<< $(check_services)
        
        if [ "$backend_ok" = "true" ] && [ "$frontend_ok" = "true" ]; then
            # Tout va bien - surveillance silencieuse
            sleep 20
        else
            # Problème détecté
            if [ "$backend_ok" != "true" ]; then
                log_message "❌ Backend inaccessible"
            fi
            if [ "$frontend_ok" != "true" ]; then
                log_message "❌ Frontend inaccessible"
            fi
            
            restart_services_if_needed
            sleep 5
        fi
    done
}

start_daemon() {
    # Vérifier si déjà en cours
    if [ -f "$PID_FILE" ]; then
        old_pid=$(cat "$PID_FILE")
        if kill -0 "$old_pid" 2>/dev/null; then
            echo "⚠️ Surveillance déjà active (PID: $old_pid)"
            exit 1
        fi
    fi
    
    echo "🚀 Démarrage surveillance automatique..."
    
    # Démarrer en arrière-plan
    nohup "$0" _monitor > /dev/null 2>&1 &
    pid=$!
    echo $pid > "$PID_FILE"
    
    echo "✅ Surveillance active (PID: $pid)"
    echo "📊 État: /opt/transflow/start-fullstack.sh status"
    echo "🛑 Arrêt: /opt/transflow/auto-keepalive.sh stop"
}

stop_daemon() {
    if [ -f "$PID_FILE" ]; then
        pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            log_message "🛑 Surveillance arrêtée (PID: $pid)"
        fi
        rm -f "$PID_FILE"
    fi
    echo "🛑 Surveillance arrêtée"
}

case "$1" in
    start)
        start_daemon
        ;;
    stop)
        stop_daemon
        ;;
    status)
        if [ -f "$PID_FILE" ]; then
            pid=$(cat "$PID_FILE")
            if kill -0 "$pid" 2>/dev/null; then
                echo "✅ Surveillance ACTIVE (PID: $pid)"
            else
                echo "❌ Surveillance ARRÊTÉE (PID mort)"
                rm -f "$PID_FILE"
            fi
        else
            echo "❌ Surveillance ARRÊTÉE"
        fi
        
        # État des services
        "$SCRIPT_DIR/start-fullstack.sh" status
        ;;
    _monitor)
        # Fonction interne pour le monitoring
        main_monitoring_loop
        ;;
    *)
        echo "🎯 SURVEILLANCE AUTOMATIQUE TRANSFLOW"
        echo "====================================="
        echo ""
        echo "Usage: $0 {start|stop|status}"
        echo ""
        echo "  start  - Démarre la surveillance automatique"
        echo "  stop   - Arrête la surveillance"
        echo "  status - Affiche l'état de la surveillance et des services"
        echo ""
        echo "La surveillance maintient automatiquement :"
        echo "  🎨 Frontend React (port 3000)"
        echo "  🔌 Backend TypeScript (port 5000)"
        exit 1
        ;;
esac
