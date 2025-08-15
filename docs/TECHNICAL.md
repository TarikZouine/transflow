# Documentation technique - TransFlow

## Architecture générale

TransFlow est une application de transcription d'appels en temps réel composée de trois services principaux :

### 1. Frontend (React TypeScript)
- **Framework** : React 18 avec TypeScript
- **UI Library** : Material-UI (MUI)
- **State Management** : Zustand pour l'état global, React Query pour les données serveur
- **Build Tool** : Vite
- **Communication** : WebSocket via Socket.io-client, HTTP via Axios

### 2. Backend (Node.js Express)
- **Runtime** : Node.js 18+
- **Framework** : Express.js avec TypeScript
- **WebSocket** : Socket.io pour la communication temps réel
- **Base de données** : MongoDB avec Mongoose
- **Authentication** : JWT (préparé, non implémenté)
- **Logging** : Winston
- **File Upload** : Multer

### 3. Service Whisper (Node.js)
- **Runtime** : Node.js 18+
- **Framework** : Express.js minimaliste
- **Fonction** : Simulation de l'API Whisper d'OpenAI
- **Format** : Compatible avec l'API officielle Whisper

## Structure des dossiers

```
transflow/
├── frontend/                 # Application React
│   ├── src/
│   │   ├── components/      # Composants réutilisables
│   │   ├── pages/          # Pages de l'application
│   │   ├── hooks/          # Hooks personnalisés
│   │   ├── services/       # Services API
│   │   ├── types/          # Types TypeScript
│   │   └── utils/          # Utilitaires
│   ├── public/             # Assets statiques
│   └── package.json
├── backend/                  # API REST + WebSocket
│   ├── src/
│   │   ├── controllers/    # Contrôleurs (à implémenter)
│   │   ├── models/         # Modèles MongoDB
│   │   ├── routes/         # Routes Express
│   │   ├── services/       # Services métier
│   │   ├── middleware/     # Middlewares Express
│   │   ├── utils/          # Utilitaires
│   │   └── config/         # Configuration
│   └── package.json
├── services/whisper/         # Service de transcription
│   ├── src/
│   │   └── index.ts        # Serveur Express simple
│   └── package.json
├── shared/                   # Code partagé
│   ├── types/              # Types TypeScript partagés
│   └── utils/              # Utilitaires partagés
└── docs/                     # Documentation
```

## Communication entre services

### WebSocket Events

#### Client → Serveur
- `create_session` : Créer une nouvelle session de transcription
- `audio_chunk` : Envoyer un chunk audio pour transcription
- `end_session` : Terminer une session
- `save_session` : Sauvegarder une session

#### Serveur → Client
- `session_created` : Confirmation de création de session
- `transcription_update` : Nouvelle transcription disponible
- `session_ended` : Session terminée
- `error` : Erreur survenue

### API REST Endpoints

#### Sessions
- `GET /api/sessions` - Liste des sessions
- `POST /api/sessions` - Créer une session
- `GET /api/sessions/:id` - Détails d'une session
- `PUT /api/sessions/:id` - Mettre à jour une session
- `DELETE /api/sessions/:id` - Supprimer une session
- `GET /api/sessions/:id/transcriptions` - Transcriptions d'une session
- `GET /api/sessions/:id/download` - Télécharger une transcription

#### Transcriptions
- `GET /api/transcriptions` - Liste des transcriptions
- `POST /api/transcriptions` - Créer une transcription
- `GET /api/transcriptions/:id` - Détails d'une transcription
- `PUT /api/transcriptions/:id` - Mettre à jour une transcription
- `DELETE /api/transcriptions/:id` - Supprimer une transcription
- `POST /api/transcriptions/search` - Rechercher dans les transcriptions

#### Upload
- `POST /api/upload/audio` - Upload et transcription d'un fichier
- `POST /api/upload/batch` - Upload multiple de fichiers
- `GET /api/upload/formats` - Formats supportés

#### Paramètres
- `GET /api/settings` - Récupérer les paramètres
- `PUT /api/settings` - Mettre à jour les paramètres
- `POST /api/settings/reset` - Réinitialiser les paramètres
- `GET /api/settings/models` - Modèles Whisper disponibles
- `GET /api/settings/languages` - Langues supportées

### Service Whisper API

#### Endpoints
- `GET /health` - État du service
- `GET /v1/models` - Liste des modèles disponibles
- `POST /v1/audio/transcriptions` - Transcription audio
- `POST /v1/audio/translations` - Traduction audio

## Modèles de données

### User
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}
```

### CallSession
```typescript
interface CallSession {
  id: string;
  userId?: string;
  title: string;
  status: 'active' | 'completed' | 'paused' | 'error';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  participants: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### TranscriptionSegment
```typescript
interface TranscriptionSegment {
  id: string;
  sessionId: string;
  speaker?: string;
  text: string;
  confidence: number;
  startTime: number;
  endTime: number;
  language?: string;
  createdAt: Date;
}
```

## Configuration

### Variables d'environnement Backend
```bash
# Serveur
PORT=5000
NODE_ENV=development

# Base de données
MONGODB_URI=mongodb://localhost:27017/transflow

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# Whisper
WHISPER_API_URL=http://localhost:8000

# Stockage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=50MB

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Variables d'environnement Frontend
```bash
# API
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=ws://localhost:5000

# Application
VITE_APP_NAME=TransFlow
VITE_APP_VERSION=1.0.0

# Fonctionnalités
VITE_ENABLE_SPEAKER_DETECTION=true
VITE_ENABLE_REAL_TIME=true
VITE_MAX_RECORDING_DURATION=3600000

# Audio
VITE_AUDIO_SAMPLE_RATE=44100
VITE_AUDIO_CHANNELS=1
VITE_AUDIO_CHUNK_SIZE=1024
```

### Variables d'environnement Service Whisper
```bash
# Serveur
PORT=8000
NODE_ENV=development

# Whisper
WHISPER_MODEL=base
WHISPER_LANGUAGE=fr
WHISPER_TASK=transcribe

# Stockage
TEMP_DIR=./temp
MODELS_DIR=./models

# CORS
CORS_ORIGIN=http://localhost:5000
```

## Sécurité

### Mesures implémentées
- **Helmet** : Protection des headers HTTP
- **CORS** : Configuration stricte des origines autorisées
- **Rate Limiting** : Limitation du nombre de requêtes par IP
- **File Upload** : Validation des types de fichiers et taille maximale
- **Input Validation** : Validation avec Joi (préparé)
- **Error Handling** : Gestion centralisée des erreurs

### À implémenter
- **Authentication** : JWT avec refresh tokens
- **Authorization** : Contrôle d'accès basé sur les rôles
- **Input Sanitization** : Nettoyage des entrées utilisateur
- **SQL Injection** : Protection MongoDB (NoSQL)
- **XSS Protection** : Validation côté client et serveur

## Performance

### Optimisations implémentées
- **Compression** : Gzip pour les réponses HTTP
- **Caching** : Headers de cache pour les assets statiques
- **Database Indexing** : Index MongoDB pour les requêtes fréquentes
- **Connection Pooling** : Pool de connexions MongoDB
- **Chunked Processing** : Traitement par chunks des données audio

### Métriques à surveiller
- **Response Time** : Temps de réponse des API
- **Memory Usage** : Utilisation mémoire des services
- **Database Performance** : Temps d'exécution des requêtes
- **WebSocket Connections** : Nombre de connexions simultanées
- **Audio Processing Time** : Temps de transcription Whisper

## Déploiement

### Docker
```bash
# Build et démarrage avec Docker Compose
docker-compose up -d

# Build individuel
docker build -t transflow-backend ./backend
docker build -t transflow-frontend ./frontend
docker build -t transflow-whisper ./services/whisper
```

### Production
1. **Build** : `npm run build`
2. **Variables d'environnement** : Configuration production
3. **Base de données** : MongoDB Atlas ou instance dédiée
4. **Reverse Proxy** : Nginx pour le frontend
5. **SSL/TLS** : Certificats HTTPS
6. **Monitoring** : Logs centralisés et métriques

## Tests

### Types de tests à implémenter
- **Unit Tests** : Tests unitaires des fonctions
- **Integration Tests** : Tests d'intégration des APIs
- **E2E Tests** : Tests end-to-end avec Cypress
- **Performance Tests** : Tests de charge avec Artillery
- **Security Tests** : Tests de sécurité automatisés

### Commandes de test
```bash
# Tests unitaires
npm run test

# Tests d'intégration
npm run test:integration

# Tests E2E
npm run test:e2e

# Coverage
npm run test:coverage
```

## Monitoring et Logs

### Logging
- **Winston** : Logging structuré avec niveaux
- **Rotation** : Rotation automatique des logs
- **Centralisation** : Agrégation des logs des services

### Métriques
- **Health Checks** : Endpoints de santé pour chaque service
- **Performance Metrics** : Temps de réponse, utilisation CPU/RAM
- **Business Metrics** : Nombre de sessions, précision transcription

### Alerting
- **Error Rate** : Alerte sur taux d'erreur élevé
- **Response Time** : Alerte sur temps de réponse lent
- **Resource Usage** : Alerte sur utilisation excessive des ressources

## Développement

### Scripts disponibles
```bash
# Installation complète
npm run install:all

# Développement (tous services)
npm run dev

# Build production
npm run build

# Linting
npm run lint

# Formatage
npm run format

# Nettoyage
npm run clean
```

### Workflow Git
1. **Feature Branch** : `git checkout -b feature/nouvelle-fonctionnalite`
2. **Development** : Développement avec tests
3. **Commit** : Messages de commit descriptifs
4. **Pull Request** : Review de code
5. **Merge** : Merge après validation

## Troubleshooting

### Problèmes courants

#### WebSocket ne se connecte pas
- Vérifier que le backend est démarré
- Vérifier les CORS dans la configuration
- Vérifier les ports (3000, 5000, 8000)

#### Transcription ne fonctionne pas
- Vérifier que le service Whisper est démarré (port 8000)
- Vérifier les permissions microphone dans le navigateur
- Vérifier les logs du service Whisper

#### Erreurs de base de données
- Vérifier que MongoDB est démarré
- Vérifier la chaîne de connexion MONGODB_URI
- Vérifier les permissions d'accès à la base

#### Problèmes de build
- Supprimer node_modules et package-lock.json
- Réinstaller avec `npm install`
- Vérifier les versions Node.js et npm

### Logs utiles
```bash
# Logs backend
tail -f backend/logs/combined.log

# Logs service Whisper
docker logs transflow-whisper

# Logs MongoDB
docker logs transflow-mongodb
```
