#!/bin/bash

# Script de déploiement sécurisé pour TransFlow
# Usage: ./deploy-secure.sh [environment]

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-"production"}
PROJECT_NAME="transflow"
DOMAIN=${DOMAIN:-"votre-domaine.com"}

echo -e "${BLUE}🚀 Déploiement sécurisé TransFlow - ${ENVIRONMENT}${NC}"
echo "=================================================="

# Vérifications préalables
echo -e "${YELLOW}🔍 Vérifications préalables...${NC}"

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker n'est pas installé${NC}"
    exit 1
fi

# Vérifier Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose n'est pas installé${NC}"
    exit 1
fi

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Ce script doit être exécuté depuis le répertoire frontend${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Vérifications préalables OK${NC}"

# Configuration de l'environnement
echo -e "\n${YELLOW}⚙️  Configuration de l'environnement: ${ENVIRONMENT}${NC}"

if [ "$ENVIRONMENT" = "production" ]; then
    ENV_FILE=".env.production"
    COMPOSE_FILE="docker-compose.security.yml"
    BUILD_CMD="npm run build"
else
    ENV_FILE=".env"
    COMPOSE_FILE="docker-compose.yml"
    BUILD_CMD="npm run dev"
fi

# Vérifier que le fichier d'environnement existe
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Fichier d'environnement $ENV_FILE non trouvé${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Fichier d'environnement: $ENV_FILE${NC}"

# Génération des mots de passe sécurisés
echo -e "\n${YELLOW}🔐 Génération des mots de passe sécurisés...${NC}"

# Générer un mot de passe sécurisé pour l'application
APP_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
echo "VITE_APP_PASSWORD=$APP_PASSWORD" >> "$ENV_FILE"

# Générer un mot de passe sécurisé pour la base de données
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
echo "DB_PASSWORD=$DB_PASSWORD" >> "$ENV_FILE"

# Générer un secret de session
SESSION_SECRET=$(openssl rand -base64 64)
echo "SESSION_SECRET=$SESSION_SECRET" >> "$ENV_FILE"

# Générer un secret JWT
JWT_SECRET=$(openssl rand -base64 64)
echo "JWT_SECRET=$JWT_SECRET" >> "$ENV_FILE"

echo -e "${GREEN}✅ Mots de passe générés et ajoutés à $ENV_FILE${NC}"

# Génération du fichier htpasswd
echo -e "\n${YELLOW}🔑 Génération du fichier htpasswd...${NC}"

if [ -f "generate-htpasswd.sh" ]; then
    chmod +x generate-htpasswd.sh
    echo "$APP_PASSWORD" | ./generate-htpasswd.sh "admin" "$APP_PASSWORD"
else
    echo -e "${YELLOW}⚠️  Script generate-htpasswd.sh non trouvé, création manuelle...${NC}"
    
    # Créer le fichier htpasswd manuellement
    if command -v htpasswd &> /dev/null; then
        echo "$APP_PASSWORD" | htpasswd -c .htpasswd "admin"
        echo -e "${GREEN}✅ Fichier .htpasswd créé${NC}"
    else
        echo -e "${RED}❌ htpasswd non disponible, création manuelle impossible${NC}"
        echo "Installez apache2-utils ou créez le fichier manuellement"
    fi
fi

# Construction de l'application
echo -e "\n${YELLOW}🏗️  Construction de l'application...${NC}"

if [ "$ENVIRONMENT" = "production" ]; then
    echo "Construction en mode production..."
    npm run build
    echo -e "${GREEN}✅ Application construite${NC}"
else
    echo "Mode développement, pas de construction nécessaire"
fi

# Déploiement avec Docker Compose
echo -e "\n${YELLOW}🐳 Déploiement avec Docker Compose...${NC}"

if [ -f "$COMPOSE_FILE" ]; then
    echo "Utilisation de $COMPOSE_FILE..."
    
    # Arrêter les conteneurs existants
    echo "Arrêt des conteneurs existants..."
    docker-compose -f "$COMPOSE_FILE" down || true
    
    # Démarrer les nouveaux conteneurs
    echo "Démarrage des nouveaux conteneurs..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    echo -e "${GREEN}✅ Conteneurs démarrés${NC}"
else
    echo -e "${YELLOW}⚠️  Fichier $COMPOSE_FILE non trouvé, déploiement manuel...${NC}"
    
    # Démarrage manuel
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "Démarrage en mode production..."
        npm run preview &
    else
        echo "Démarrage en mode développement..."
        npm run dev &
    fi
    
    echo -e "${GREEN}✅ Application démarrée manuellement${NC}"
fi

# Vérification du déploiement
echo -e "\n${YELLOW}🔍 Vérification du déploiement...${NC}"

# Attendre que l'application soit prête
echo "Attente du démarrage de l'application..."
sleep 10

# Tester l'accès
if curl -s -f "http://localhost:3000" > /dev/null; then
    echo -e "${GREEN}✅ Application accessible sur http://localhost:3000${NC}"
else
    echo -e "${RED}❌ Application non accessible${NC}"
    echo "Vérifiez les logs: docker-compose logs"
fi

# Affichage des informations de connexion
echo -e "\n${GREEN}🎉 Déploiement terminé!${NC}"
echo "=================================================="
echo -e "${BLUE}📱 Informations de connexion:${NC}"
echo "  URL: http://localhost:3000"
echo "  Mot de passe: $APP_PASSWORD"
echo ""
echo -e "${BLUE}🔐 Fichiers de sécurité créés:${NC}"
echo "  .env: $ENV_FILE"
echo "  .htpasswd: Fichier de protection Nginx"
echo "  nginx-auth.conf: Configuration Nginx"
echo ""
echo -e "${BLUE}🐳 Conteneurs Docker:${NC}"
echo "  Frontend: transflow-frontend-secure"
echo "  Backend: transflow-backend-secure"
echo "  Base de données: transflow-db-secure"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "  - Sauvegardez le mot de passe: $APP_PASSWORD"
echo "  - Changez les mots de passe par défaut"
echo "  - Activez HTTPS en production"
echo "  - Surveillez les logs d'accès"

# Sauvegarde des informations de connexion
echo -e "\n${BLUE}💾 Sauvegarde des informations de connexion...${NC}"
cat > "deployment-info.txt" << EOF
TransFlow - Informations de déploiement
========================================
Date: $(date)
Environnement: $ENVIRONMENT
URL: http://localhost:3000
Mot de passe: $APP_PASSWORD
Base de données: $DB_PASSWORD
Session secret: $SESSION_SECRET
JWT secret: $JWT_SECRET

Fichiers créés:
- $ENV_FILE
- .htpasswd
- nginx-auth.conf
- deployment-info.txt

⚠️  ATTENTION: Ces informations sont sensibles!
EOF

echo -e "${GREEN}✅ Informations sauvegardées dans deployment-info.txt${NC}"
echo ""
echo -e "${GREEN}🎯 Déploiement sécurisé terminé avec succès!${NC}"



