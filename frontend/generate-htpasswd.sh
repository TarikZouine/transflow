#!/bin/bash

# Script pour générer le fichier htpasswd pour Nginx
# Usage: ./generate-htpasswd.sh [username] [password]

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Générateur de fichier htpasswd pour TransFlow${NC}"
echo "=================================================="

# Vérifier que htpasswd est installé
if ! command -v htpasswd &> /dev/null; then
    echo -e "${RED}❌ htpasswd n'est pas installé${NC}"
    echo "Installez apache2-utils:"
    echo "  Ubuntu/Debian: sudo apt-get install apache2-utils"
    echo "  CentOS/RHEL: sudo yum install httpd-tools"
    echo "  macOS: brew install httpd"
    exit 1
fi

# Paramètres par défaut
USERNAME=${1:-"admin"}
PASSWORD=${2:-"TransFlow2024!"}

echo -e "${YELLOW}📝 Configuration:${NC}"
echo "  Username: $USERNAME"
echo "  Password: $PASSWORD"
echo ""

# Demander confirmation
read -p "Continuer avec ces paramètres? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Opération annulée${NC}"
    exit 0
fi

# Créer le répertoire nginx s'il n'existe pas
NGINX_DIR="/etc/nginx"
if [ ! -d "$NGINX_DIR" ]; then
    echo -e "${YELLOW}⚠️  Répertoire $NGINX_DIR n'existe pas${NC}"
    echo "Création du répertoire..."
    sudo mkdir -p "$NGINX_DIR"
fi

# Générer le fichier htpasswd
HTPASSWD_FILE="$NGINX_DIR/.htpasswd"
echo -e "${BLUE}🔑 Génération du fichier htpasswd...${NC}"

if [ -f "$HTPASSWD_FILE" ]; then
    echo -e "${YELLOW}⚠️  Le fichier $HTPASSWD_FILE existe déjà${NC}"
    read -p "Le remplacer? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠️  Opération annulée${NC}"
        exit 0
    fi
    sudo rm "$HTPASSWD_FILE"
fi

# Générer le fichier htpasswd
echo "$PASSWORD" | sudo htpasswd -c "$HTPASSWD_FILE" "$USERNAME"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Fichier htpasswd généré avec succès!${NC}"
    echo "  Fichier: $HTPASSWD_FILE"
    echo ""
    
    # Afficher le contenu du fichier
    echo -e "${BLUE}📄 Contenu du fichier htpasswd:${NC}"
    sudo cat "$HTPASSWD_FILE"
    echo ""
    
    # Vérifier les permissions
    echo -e "${BLUE}🔒 Vérification des permissions:${NC}"
    ls -la "$HTPASSWD_FILE"
    echo ""
    
    # Instructions d'utilisation
    echo -e "${GREEN}🎯 Instructions d'utilisation:${NC}"
    echo "1. Copiez le fichier nginx-auth.conf dans votre configuration Nginx"
    echo "2. Redémarrez Nginx: sudo systemctl restart nginx"
    echo "3. Testez l'accès à votre application"
    echo ""
    echo -e "${YELLOW}⚠️  Note: Ce fichier contient des informations sensibles${NC}"
    echo "  - Gardez-le sécurisé"
    echo "  - Ne le committez pas dans Git"
    echo "  - Changez le mot de passe régulièrement"
    
else
    echo -e "${RED}❌ Erreur lors de la génération du fichier htpasswd${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Génération terminée!${NC}"




