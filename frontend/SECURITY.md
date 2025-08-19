# Sécurité Frontend TransFlow

## Protection par mot de passe

L'application TransFlow est protégée par un système d'authentification simple basé sur un mot de passe en dur.

### Configuration actuelle

- **Mot de passe**: `TransFlow2024!`
- **Stockage**: LocalStorage du navigateur
- **Expiration**: 24 heures (configurable)
- **Protection**: Toutes les routes sont protégées sauf `/login`

### Comment modifier le mot de passe

1. **Modifier le fichier de configuration** :
   ```typescript
   // frontend/src/config/auth.ts
   export const AUTH_CONFIG = {
     PASSWORD: 'VotreNouveauMotDePasse123!',
     // ... autres options
   } as const;
   ```

2. **Redémarrer l'application** :
   ```bash
   cd frontend
   npm run dev
   ```

### Sécurité en production

⚠️ **ATTENTION** : Ce système de mot de passe en dur n'est pas sécurisé pour la production !

**Recommandations pour la production** :
- Implémenter une authentification par base de données
- Utiliser des tokens JWT avec expiration
- Ajouter une authentification à deux facteurs
- Implémenter une limitation de tentatives de connexion
- Utiliser HTTPS obligatoire
- Ajouter une journalisation des connexions

### Structure des fichiers

```
frontend/src/
├── contexts/
│   └── AuthContext.tsx          # Contexte d'authentification
├── components/
│   ├── Layout.tsx               # Layout avec bouton déconnexion
│   └── ProtectedRoute.tsx       # Protection des routes
├── pages/
│   └── LoginPage.tsx            # Page de connexion
├── config/
│   └── auth.ts                  # Configuration d'authentification
└── App.tsx                      # Routes protégées
```

### Fonctionnalités

- ✅ Protection de toutes les routes
- ✅ Page de connexion sécurisée
- ✅ Bouton de déconnexion dans le header
- ✅ Persistance de session (LocalStorage)
- ✅ Redirection automatique vers la connexion
- ✅ Interface utilisateur moderne avec Material-UI

### Test de la sécurité

1. Accéder à l'application sans mot de passe → Redirection vers `/login`
2. Saisir un mauvais mot de passe → Message d'erreur
3. Saisir le bon mot de passe → Accès à l'application
4. Cliquer sur "Déconnexion" → Retour à la page de connexion
5. Rafraîchir la page → Session maintenue (si < 24h)

### Dépannage

**Problème** : Impossible de se connecter
- Vérifier le mot de passe dans `frontend/src/config/auth.ts`
- Vérifier que l'application a été redémarrée

**Problème** : Déconnexion automatique
- Vérifier la durée de session dans la configuration
- Vérifier que le LocalStorage n'est pas désactivé

**Problème** : Routes non protégées
- Vérifier que `ProtectedRoute` entoure bien toutes les routes
- Vérifier que `AuthProvider` est bien au niveau racine



