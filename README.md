# TransFlow - Transcription d'appels en temps réel

TransFlow est une application complète de transcription d'appels téléphoniques en temps réel, alimentée par l'intelligence artificielle Whisper d'OpenAI.

## 🚀 Fonctionnalités

- **Transcription en temps réel** : Transcription instantanée des conversations téléphoniques
- **Interface utilisateur moderne** : Interface React avec Material-UI
- **WebSockets** : Communication en temps réel entre le frontend et le backend
- **Service Whisper** : Service de transcription dédié basé sur Whisper
- **Historique des sessions** : Sauvegarde et consultation des sessions passées
- **Paramètres configurables** : Choix du modèle, langue, qualité audio, etc.
- **Upload de fichiers** : Transcription de fichiers audio existants
- **Export des transcriptions** : Téléchargement en différents formats

## 🏗️ Architecture

```
transflow/
├── frontend/          # Application React TypeScript
├── backend/           # Serveur Node.js Express + Socket.io
├── services/whisper/  # Service de transcription Whisper
├── shared/            # Types et utilitaires partagés
└── docs/              # Documentation
```

## 🛠️ Technologies utilisées

### Frontend
- **React 18** avec TypeScript
- **Material-UI** pour l'interface utilisateur
- **Socket.io Client** pour les WebSockets
- **React Query** pour la gestion des données
- **Vite** comme bundler
- **Zustand** pour la gestion d'état

### Backend
- **Node.js** avec Express
- **Socket.io** pour les WebSockets en temps réel
- **TypeScript** pour la sécurité des types
- **MongoDB** avec Mongoose pour la base de données
- **Winston** pour les logs
- **Multer** pour l'upload de fichiers

### Service Whisper
- **Node.js** avec Express
- **API compatible Whisper** pour la transcription
- **Support multi-formats** audio

## 📦 Installation

### Prérequis
- Node.js 18+ 
- MongoDB
- npm ou yarn

### Installation des dépendances

1. **Frontend**
```bash
cd frontend
npm install
```

2. **Backend**
```bash
cd backend
npm install
```

3. **Service Whisper**
```bash
cd services/whisper
npm install
```

## 🚀 Démarrage

### 1. Service Whisper
```bash
cd services/whisper
npm run dev
# Serveur disponible sur http://localhost:8000
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Configurer les variables d'environnement
npm run dev
# Serveur disponible sur http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm run dev
# Application disponible sur http://localhost:3000
```

## 🔧 Configuration

### Variables d'environnement Backend (.env)
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
```

### Variables d'environnement Service Whisper (.env)
```bash
# Serveur
PORT=8000
NODE_ENV=development

# Whisper
WHISPER_MODEL=base
WHISPER_LANGUAGE=fr

# Stockage
TEMP_DIR=./temp
```

## 📖 Utilisation

1. **Démarrer une session** : Cliquez sur "Commencer" sur la page d'accueil
2. **Autoriser le microphone** : Acceptez l'autorisation d'accès au microphone
3. **Enregistrer** : Cliquez sur "Démarrer" pour commencer l'enregistrement
4. **Transcription en direct** : Regardez la transcription apparaître en temps réel
5. **Sauvegarder** : Utilisez les boutons pour sauvegarder ou télécharger la transcription

## 🔄 WebSocket Events

### Client vers Serveur
- `create_session` : Créer une nouvelle session
- `audio_chunk` : Envoyer un chunk audio
- `end_session` : Terminer une session
- `save_session` : Sauvegarder une session

### Serveur vers Client
- `session_created` : Session créée avec succès
- `transcription_update` : Nouvelle transcription disponible
- `session_ended` : Session terminée
- `error` : Erreur survenue

## 📡 API Endpoints

### Sessions
- `GET /api/sessions` : Liste des sessions
- `POST /api/sessions` : Créer une session
- `GET /api/sessions/:id` : Détails d'une session
- `PUT /api/sessions/:id` : Mettre à jour une session
- `DELETE /api/sessions/:id` : Supprimer une session

### Transcriptions
- `GET /api/transcriptions` : Liste des transcriptions
- `POST /api/transcriptions` : Créer une transcription
- `POST /api/transcriptions/search` : Rechercher dans les transcriptions

### Upload
- `POST /api/upload/audio` : Uploader et transcrire un fichier
- `POST /api/upload/batch` : Uploader plusieurs fichiers

### Paramètres
- `GET /api/settings` : Récupérer les paramètres
- `PUT /api/settings` : Mettre à jour les paramètres

## 🧪 Tests

```bash
# Frontend
cd frontend
npm test

# Backend
cd backend
npm test

# Service Whisper
cd services/whisper
npm test
```

## 📝 Scripts disponibles

### Frontend
- `npm run dev` : Serveur de développement
- `npm run build` : Build de production
- `npm run lint` : Linting
- `npm run format` : Formatage du code

### Backend
- `npm run dev` : Serveur de développement avec nodemon
- `npm run build` : Compilation TypeScript
- `npm run start` : Serveur de production
- `npm run lint` : Linting
- `npm run format` : Formatage du code

### Service Whisper
- `npm run dev` : Serveur de développement
- `npm run build` : Compilation TypeScript
- `npm run start` : Serveur de production

## 🚀 Déploiement

### Docker (Recommandé)
```bash
# Construction des images
docker-compose build

# Démarrage des services
docker-compose up -d
```

### Déploiement manuel
1. Build des applications
2. Configuration des variables d'environnement
3. Démarrage des services dans l'ordre : Whisper → Backend → Frontend

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit les changements (`git commit -am 'Ajout nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Créer une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 👨‍💻 Auteur

**TarikZouine**

## 🆘 Support

Pour toute question ou problème, veuillez ouvrir une issue sur GitHub.

---

Made with ❤️ by TarikZouine
