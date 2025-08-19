#!/bin/bash

echo "🔍 Test de connectivité TransFlow"
echo "================================"

# Test du frontend
echo "📱 Test du Frontend (port 3000)..."
if curl --max-time 5 -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend accessible sur http://localhost:3000"
    FRONTEND_TITLE=$(curl --max-time 5 -s http://localhost:3000 | grep -o "<title>.*</title>" | sed 's/<title>\(.*\)<\/title>/\1/')
    echo "   Titre: $FRONTEND_TITLE"
else
    echo "❌ Frontend inaccessible sur le port 3000"
fi

echo ""

# Test du backend
echo "🔧 Test du Backend (port 5002)..."
if curl --max-time 5 -s http://localhost:5002/health > /dev/null; then
    echo "✅ Backend accessible sur http://localhost:5002"
    BACKEND_STATUS=$(curl --max-time 5 -s http://localhost:5002/health | jq -r '.status + " - " + .service' 2>/dev/null || curl --max-time 5 -s http://localhost:5002/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo "   Statut: $BACKEND_STATUS"
else
    echo "❌ Backend inaccessible sur le port 5002"
fi

echo ""

# Test de la base de données
echo "🗄️  Test de la base de données..."
if command -v mongo >/dev/null 2>&1; then
    if mongo --eval "db.runCommand('ping')" transflow >/dev/null 2>&1; then
        echo "✅ Base de données MongoDB accessible"
        DB_COLLECTIONS=$(mongo --quiet --eval "db.getCollectionNames().join(', ')" transflow 2>/dev/null | tr -d '\n')
        echo "   Collections: $DB_COLLECTIONS"
    else
        echo "❌ Base de données MongoDB inaccessible"
    fi
else
    echo "⚠️  MongoDB CLI non installé"
fi

echo ""

# Test des processus
echo "🔄 Test des processus..."
FRONTEND_PID=$(pgrep -f "vite" | head -1)
BACKEND_PID=$(pgrep -f "test-server.js" | head -1)

if [ ! -z "$FRONTEND_PID" ]; then
    echo "✅ Frontend (Vite) en cours d'exécution - PID: $FRONTEND_PID"
else
    echo "❌ Frontend (Vite) non trouvé"
fi

if [ ! -z "$BACKEND_PID" ]; then
    echo "✅ Backend (Node.js) en cours d'exécution - PID: $BACKEND_PID"
else
    echo "❌ Backend (Node.js) non trouvé"
fi

echo ""

# Test des ports
echo "🌐 Test des ports..."
if netstat -tlnp 2>/dev/null | grep ":3000" > /dev/null; then
    echo "✅ Port 3000 ouvert (Frontend)"
else
    echo "❌ Port 3000 fermé"
fi

if netstat -tlnp 2>/dev/null | grep ":5002" > /dev/null; then
    echo "✅ Port 5002 ouvert (Backend)"
else
    echo "❌ Port 5002 fermé"
fi

echo ""

# Résumé
echo "📊 Résumé de la connectivité:"
echo "=============================="

if [ ! -z "$FRONTEND_PID" ] && [ ! -z "$BACKEND_PID" ]; then
    echo "🎉 Tous les services sont opérationnels !"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend:  http://localhost:5002"
    echo "   API Health: http://localhost:5002/health"
else
    echo "⚠️  Certains services ne sont pas opérationnels"
    echo "   Vérifiez les logs et redémarrez si nécessaire"
fi

echo ""
echo "🔧 Commandes utiles:"
echo "   Logs backend: tail -f backend/server.log"
echo "   Redémarrer backend: ./start-backend.sh"
echo "   Redémarrer frontend: cd frontend && npm run dev"
