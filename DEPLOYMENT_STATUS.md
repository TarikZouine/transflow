# État du Déploiement TransFlow

## ✅ Services Fonctionnels

### 🎤 Service Whisper
- **Port**: 8000
- **URL**: http://localhost:8000
- **Status**: ✅ Opérationnel
- **Health Check**: http://localhost:8000/health

### 🔧 Backend API  
- **Port**: 5002
- **URL**: http://localhost:5002
- **Status**: ✅ Opérationnel  
- **Health Check**: http://localhost:5002/health
- **Note**: Utilise un serveur de test simplifié (MongoDB désactivé)

### ⚛️ Frontend React
- **Port**: 3000
- **URL**: http://localhost:3000
- **Status**: ✅ Opérationnel
- **Framework**: Vite + React + TypeScript

## 🌐 Accès Externe (ai.intelios.us)

Pour accéder aux services depuis l'extérieur, vous devez :

### Option 1: Accès Direct par Ports
Si les ports sont ouverts sur le serveur :
- **Frontend**: http://ai.intelios.us:3000
- **Backend**: http://ai.intelios.us:5002  
- **Whisper**: http://ai.intelios.us:8000

### Option 2: Proxy Nginx (Recommandé)
Configuration d'un reverse proxy sur le port 80/443 :
- **Frontend**: http://ai.intelios.us/
- **Backend**: http://ai.intelios.us/api/
- **Whisper**: http://ai.intelios.us/whisper/

## 🔧 Configuration Actuelle

### Ports Utilisés
- `3000`: Frontend React (Vite dev server)
- `5002`: Backend API (Express.js)  
- `8000`: Service Whisper (Express.js)

### Variables d'Environnement
```bash
# Frontend (.env)
VITE_API_URL=http://localhost:5002/api
VITE_WS_URL=ws://localhost:5002

# Backend (.env)  
PORT=5002
NODE_ENV=development

# Whisper (.env)
PORT=8000
NODE_ENV=development
```

## ⚠️ Limitations Actuelles

1. **Base de Données**: MongoDB désactivé (pas installé sur le serveur)
2. **Authentication**: Non implémentée
3. **HTTPS**: Non configuré
4. **Production Build**: Services en mode développement

## 🚀 Prochaines Étapes

1. **Test d'Accès Externe**: Vérifier si les ports sont accessibles
2. **Configuration Nginx**: Setup reverse proxy si nécessaire
3. **MongoDB**: Installation et configuration
4. **Production**: Build et configuration production
5. **HTTPS**: Configuration SSL/TLS

## 📋 Commandes Utiles

### Démarrage Manuel
```bash
# Service Whisper
cd /opt/transflow/services/whisper
npx ts-node src/index.ts

# Backend  
cd /opt/transflow/backend
node test-server.js

# Frontend
cd /opt/transflow/frontend  
npm run dev
```

### Vérification Status
```bash
curl http://localhost:8000/health  # Whisper
curl http://localhost:5002/health  # Backend
curl http://localhost:3000         # Frontend
```

---
**Dernière Mise à Jour**: $(date)
**Serveur**: ai.intelios.us (/opt/transflow)
