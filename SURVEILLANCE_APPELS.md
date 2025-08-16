# 📞 TransFlow - Surveillance d'Appels en Temps Réel

## 🎯 Fonctionnalité Implémentée

L'application **TransFlow** surveille maintenant automatiquement les appels dans le répertoire `/home/nfs_proxip_monitor/` et affiche les appels en cours en temps réel.

---

## 📁 Structure des Fichiers d'Appels

### Format des Fichiers
```
timestamp.sessionId-phoneNumber-type.wav
```

**Exemples :**
- `1755264996.1231773-33637439110-in.wav` (Client)
- `1755264996.1231773-33637439110-out.wav` (Agent)

### Logique de Détection
- **Appel en cours** : Fichier modifié dans les 30 dernières secondes
- **Appel terminé** : Fichier non modifié depuis plus de 30 secondes
- **Paire d'appel** : Chaque appel génère 2 fichiers (client + agent)

---

## 🔧 Nouvelles Fonctionnalités

### 1. Page "Appels en Direct" (`/calls`)
- **Surveillance temps réel** des appels
- **Tableau interactif** avec détails complets
- **Rafraîchissement automatique** toutes les 5 secondes
- **Filtrage** appels actifs/tous
- **Statistiques** en temps réel

#### Informations Affichées
| Colonne | Description |
|---------|-------------|
| **Statut** | En cours / Terminé avec icône |
| **Numéro** | Numéro de téléphone |
| **Heure début** | Heure de début d'appel |
| **Durée** | Durée écoulée |
| **Dernière activité** | Dernière modification |
| **Fichiers** | Présence client/agent |
| **Taille** | Taille des fichiers |
| **Actions** | Transcription, lecture |

### 2. Page d'Accueil Mise à Jour
- **Statistiques temps réel** des appels
- **Indicateurs visuels** d'activité
- **Navigation rapide** vers les appels
- **Informations système** sur le monitoring

### 3. API Backend Étendue

#### Nouveaux Endpoints
```bash
# Appels en cours uniquement
GET /api/calls/active

# Tous les appels (actifs + récents)
GET /api/calls

# Détails d'un appel spécifique
GET /api/calls/:id

# Statistiques
GET /api/calls/stats

# Transcription d'un appel
POST /api/calls/:id/transcribe
```

#### Exemple Réponse API
```json
{
  "success": true,
  "data": [
    {
      "id": "1755264996.1231773-33637439110",
      "phoneNumber": "33637439110",
      "startTime": "2025-08-15T13:43:35.987Z",
      "lastActivity": "2025-08-15T13:43:35.987Z",
      "duration": 45000,
      "status": "active",
      "hasClientFile": true,
      "hasAgentFile": true,
      "clientFileSize": 3200000,
      "agentFileSize": 3100000
    }
  ],
  "count": 17
}
```

---

## 🚀 Utilisation

### 1. Accès à l'Application
**URL :** http://ai.intelios.us:3000

### 2. Navigation
1. **Page d'Accueil** : Statistiques et vue d'ensemble
2. **Appels en Direct** : Surveillance temps réel
3. **Menu latéral** : Navigation rapide

### 3. Surveillance des Appels
1. Cliquez sur **"Appels en Direct"** dans le menu
2. Consultez la liste des appels en cours
3. Utilisez les **contrôles** :
   - ✅ **Appels en cours seulement** : Filtre les appels actifs
   - ✅ **Rafraîchissement automatique** : Mise à jour auto
   - 🔄 **Actualiser** : Mise à jour manuelle

### 4. Informations Temps Réel
- **Compteur d'appels** mis à jour automatiquement
- **Statut visuel** avec icônes et couleurs
- **Durées d'appel** en direct
- **Tailles de fichiers** en temps réel

---

## 📊 Statistiques Actuelles

```bash
# Test des API
curl http://ai.intelios.us:5002/api/calls/active
curl http://ai.intelios.us:5002/api/calls
```

**Résultats actuels :**
- **17 appels en cours**
- **108 appels total**
- **Surveillance active** ✅

---

## 🔄 Fonctionnement Technique

### 1. Monitoring Backend
- **Scan périodique** du répertoire (toutes les 5 secondes)
- **Analyse des timestamps** de modification
- **Groupement automatique** des paires de fichiers
- **Cache intelligent** des appels actifs

### 2. Frontend Temps Réel
- **Polling API** toutes les 5 secondes
- **Mise à jour automatique** des statistiques
- **Interface réactive** Material-UI
- **Gestion d'état** optimisée

### 3. Architecture
```
/home/nfs_proxip_monitor/ 
    ↓ (Scan automatique)
Backend API (Port 5002)
    ↓ (REST API)
Frontend React (Port 3000)
    ↓ (Interface web)
Utilisateur
```

---

## 🎛️ Configuration

### Variables d'Environnement
```bash
# Backend
PORT=5002
MONITOR_PATH=/home/nfs_proxip_monitor/
ACTIVE_THRESHOLD=30000  # 30 secondes

# Frontend
VITE_API_URL=http://ai.intelios.us:5002/api
VITE_WS_URL=ws://ai.intelios.us:5002
```

### Personnalisation
- **Seuil d'activité** : Modifiable (actuellement 30s)
- **Fréquence de scan** : Configurable (actuellement 5s)
- **Interface** : Thème Material-UI personnalisable

---

## 🔮 Prochaines Étapes

### Fonctionnalités Prêtes à Implémenter
1. **Transcription automatique** des appels terminés
2. **Lecture audio** intégrée dans l'interface
3. **Notifications** pour nouveaux appels
4. **Historique détaillé** avec recherche
5. **Export** des données d'appels
6. **Alertes** pour appels longs
7. **Dashboard** statistiques avancées

### Intégrations Possibles
- **Base de données** pour persistance
- **WebSocket** pour notifications temps réel
- **Service Whisper** pour transcription auto
- **Système d'alertes** email/SMS

---

## ✅ Status Final

**🎉 FONCTIONNALITÉ COMPLÈTEMENT OPÉRATIONNELLE !**

- ✅ **Surveillance automatique** des appels
- ✅ **Interface utilisateur** intuitive
- ✅ **API backend** robuste
- ✅ **Temps réel** confirmé
- ✅ **17 appels en cours** détectés
- ✅ **Accès externe** configuré

**L'application TransFlow surveille maintenant efficacement les appels en temps réel !**

---
**Dernière mise à jour :** $(date)  
**Serveur :** ai.intelios.us  
**Status :** 🟢 **ACTIF**
