#!/bin/bash

# Script de configuration pour le développement TransFlow

set -e

echo "🚀 Configuration de l'environnement de développement TransFlow"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    print_error "Node.js n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

print_status "Node.js version: $(node --version)"

# Vérifier si npm est installé
if ! command -v npm &> /dev/null; then
    print_error "npm n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

print_status "npm version: $(npm --version)"

# Installer les dépendances pour tous les modules
print_status "Installation des dépendances..."

print_status "Installation des dépendances du frontend..."
cd frontend && npm install
cd ..

print_status "Installation des dépendances du backend..."
cd backend && npm install
cd ..

print_status "Installation des dépendances du service Whisper..."
cd services/whisper && npm install
cd ..

# Créer les fichiers .env à partir des exemples
print_status "Configuration des variables d'environnement..."

if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    print_status "Fichier backend/.env créé à partir de l'exemple"
else
    print_warning "Le fichier backend/.env existe déjà"
fi

if [ ! -f "services/whisper/.env" ]; then
    cp services/whisper/.env.example services/whisper/.env
    print_status "Fichier services/whisper/.env créé à partir de l'exemple"
else
    print_warning "Le fichier services/whisper/.env existe déjà"
fi

if [ ! -f "frontend/.env" ]; then
    cp frontend/.env.example frontend/.env
    print_status "Fichier frontend/.env créé à partir de l'exemple"
else
    print_warning "Le fichier frontend/.env existe déjà"
fi

# Créer les dossiers nécessaires
print_status "Création des dossiers nécessaires..."
mkdir -p backend/uploads
mkdir -p backend/logs
mkdir -p backend/temp
mkdir -p services/whisper/temp
mkdir -p services/whisper/models

print_status "Configuration terminée avec succès!"

echo ""
echo "📋 Prochaines étapes:"
echo "1. Démarrer MongoDB (si pas déjà fait): mongod"
echo "2. Démarrer le service Whisper: cd services/whisper && npm run dev"
echo "3. Démarrer le backend: cd backend && npm run dev"
echo "4. Démarrer le frontend: cd frontend && npm run dev"
echo ""
echo "Ou utilisez les scripts npm du projet racine:"
echo "- npm run dev (démarre tous les services)"
echo "- npm run build (build tous les projets)"
echo "- npm run lint (lint tous les projets)"
echo ""
echo "🎉 Bonne développement!"
