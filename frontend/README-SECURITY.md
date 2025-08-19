# 🔐 Système de Sécurité TransFlow

## Vue d'ensemble

TransFlow est maintenant protégé par un système d'authentification à deux niveaux :

1. **Frontend React** : Protection par mot de passe avec redirection automatique
2. **Nginx (optionnel)** : Protection basique HTTP avec htpasswd

## 🚀 Démarrage rapide

### 1. Démarrer l'application
```bash
cd frontend
npm run dev
```

### 2. Accéder à l'application
- **URL principale** : http://localhost:3000
- **Page de connexion** : http://localhost:3000/login
- **Mot de passe** : `TransFlow2024!`

## 🔑 Configuration du mot de passe

### Option 1 : Variables d'environnement (recommandé)
```bash
# frontend/.env
VITE_APP_PASSWORD=VotreNouveauMotDePasse123!
```

### Option 2 : Fichier de configuration
```typescript
// frontend/src/config/auth.ts
export const AUTH_CONFIG = {
  PASSWORD: 'VotreNouveauMotDePasse123!',
  // ... autres options
} as const;
```

## 🛡️ Protection des routes

Toutes les routes sont automatiquement protégées :
- `/` → Page d'accueil (protégée)
- `/calls` → Appels en direct (protégée)
- `/transcription` → Transcription (protégée)
- `/history` → Historique (protégée)
- `/settings` → Paramètres (protégée)
- `/login` → Page de connexion (publique)

## 🔒 Sécurité Nginx (optionnel)

### Générer le fichier htpasswd
```bash
cd frontend
./generate-htpasswd.sh [username] [password]
```

### Utiliser la configuration Nginx
1. Copier `nginx-auth.conf` dans votre configuration Nginx
2. Redémarrer Nginx : `sudo systemctl restart nginx`

## 🧪 Tests et débogage

### Script de test automatique
```bash
cd frontend
node test-auth.js
```

### Page de test HTML
Ouvrir `test-auth.html` dans un navigateur pour tester l'authentification.

### Composant de statut
Le composant `AuthStatus` affiche le statut d'authentification sur la page d'accueil.

## 📁 Structure des fichiers

```
frontend/src/
├── contexts/
│   └── AuthContext.tsx          # Contexte d'authentification
├── components/
│   ├── Layout.tsx               # Layout avec bouton déconnexion
│   ├── ProtectedRoute.tsx       # Protection des routes
│   └── AuthStatus.tsx           # Composant de test
├── pages/
│   └── LoginPage.tsx            # Page de connexion
├── config/
│   └── auth.ts                  # Configuration d'authentification
└── App.tsx                      # Routes protégées

# Fichiers de configuration
frontend/
├── .env                         # Variables d'environnement
├── nginx-auth.conf             # Configuration Nginx
├── generate-htpasswd.sh        # Script htpasswd
├── test-auth.html              # Page de test HTML
├── test-auth.js                # Script de test Node.js
└── SECURITY.md                  # Documentation détaillée
```

## 🔄 Flux d'authentification

1. **Accès initial** → Redirection vers `/login`
2. **Saisie du mot de passe** → Validation côté client
3. **Authentification réussie** → Stockage en LocalStorage
4. **Accès aux routes** → Vérification automatique
5. **Déconnexion** → Suppression du LocalStorage

## 🎯 Fonctionnalités

- ✅ Protection automatique de toutes les routes
- ✅ Page de connexion moderne avec Material-UI
- ✅ Persistance de session (LocalStorage)
- ✅ Bouton de déconnexion dans le header
- ✅ Redirection automatique vers la connexion
- ✅ Configuration centralisée et modifiable
- ✅ Support des variables d'environnement
- ✅ Protection Nginx optionnelle
- ✅ Tests automatisés
- ✅ Documentation complète

## ⚠️ Sécurité en production

**ATTENTION** : Ce système de mot de passe en dur n'est pas sécurisé pour la production !

### Recommandations pour la production
- [ ] Implémenter une authentification par base de données
- [ ] Utiliser des tokens JWT avec expiration
- [ ] Ajouter une authentification à deux facteurs
- [ ] Implémenter une limitation de tentatives de connexion
- [ ] Utiliser HTTPS obligatoire
- [ ] Ajouter une journalisation des connexions
- [ ] Implémenter une gestion des sessions côté serveur
- [ ] Ajouter une validation des mots de passe forts

## 🐛 Dépannage

### Problème : Impossible de se connecter
- Vérifier le mot de passe dans la configuration
- Vérifier que l'application a été redémarrée
- Vérifier la console du navigateur pour les erreurs

### Problème : Déconnexion automatique
- Vérifier la durée de session dans la configuration
- Vérifier que le LocalStorage n'est pas désactivé
- Vérifier les paramètres de confidentialité du navigateur

### Problème : Routes non protégées
- Vérifier que `ProtectedRoute` entoure bien toutes les routes
- Vérifier que `AuthProvider` est bien au niveau racine
- Vérifier la console pour les erreurs de rendu

### Problème : Nginx ne fonctionne pas
- Vérifier que le fichier htpasswd a été généré
- Vérifier les permissions du fichier
- Vérifier la configuration Nginx
- Vérifier les logs Nginx : `sudo tail -f /var/log/nginx/error.log`

## 📚 Ressources supplémentaires

- [Documentation Material-UI](https://mui.com/)
- [Documentation React Router](https://reactrouter.com/)
- [Documentation Nginx](https://nginx.org/en/docs/)
- [Guide de sécurité OWASP](https://owasp.org/www-project-top-ten/)

## 🤝 Contribution

Pour améliorer la sécurité :
1. Créer une issue détaillant le problème
2. Proposer une solution avec code
3. Tester sur votre environnement
4. Soumettre une pull request

---

**Note** : Ce système est conçu pour un usage en développement et test. Pour la production, implémentez une authentification robuste et sécurisée.




