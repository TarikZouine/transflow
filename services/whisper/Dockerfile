# Dockerfile pour le service Whisper
FROM node:18-alpine

# Créer le répertoire de l'application
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY tsconfig.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source
COPY src/ ./src/

# Compiler TypeScript
RUN npm run build

# Créer les dossiers nécessaires
RUN mkdir -p temp models

# Exposer le port
EXPOSE 8000

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=8000

# Commande de démarrage
CMD ["npm", "start"]
