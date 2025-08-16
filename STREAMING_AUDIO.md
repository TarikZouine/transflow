# 🎵 TransFlow - Streaming Audio en Temps Réel

## 🎯 Fonctionnalité Implémentée

**Streaming audio par chunks** avec lecture simultanée des flux client (in) et agent (out) pour chaque appel.

---

## 🛠️ Architecture Technique

### **Backend - Routes de Streaming**

#### **Route principale :**
```
GET /api/calls/:id/stream/:type
```

**Paramètres :**
- `:id` : ID de l'appel (ex: `1755266689.1231947-33667375555`)
- `:type` : Type de flux (`in` pour client, `out` pour agent)

#### **Support Range Headers**
```javascript
// Support du seeking natif HTML5
if (range) {
  // Streaming partiel (206 Partial Content)
  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunksize,
    'Content-Type': 'audio/wav'
  });
}
```

#### **En-têtes HTTP :**
- **Content-Type:** `audio/wav`
- **Accept-Ranges:** `bytes` (support seeking)
- **Cache-Control:** `no-cache`
- **Content-Length:** Taille du fichier

---

## 🎮 Frontend - Composant AudioPlayer

### **Fonctionnalités :**
✅ **Lecture simultanée** client + agent  
✅ **Contrôles indépendants** de volume  
✅ **Seeking/timeline** synchronisée  
✅ **Play/Pause/Stop** natifs HTML5  
✅ **Interface Material-UI** moderne  

### **URLs de streaming :**
```javascript
const clientStreamUrl = `http://ai.intelios.us:5002/api/calls/${callId}/stream/in`;
const agentStreamUrl = `http://ai.intelios.us:5002/api/calls/${callId}/stream/out`;
```

### **Synchronisation :**
```javascript
// Synchroniser les deux lecteurs
const handlePlayPause = async () => {
  const promises = [];
  if (hasClientFile) promises.push(clientAudio.play());
  if (hasAgentFile) promises.push(agentAudio.play());
  await Promise.all(promises);
};
```

---

## 🎛️ Interface Utilisateur

### **Boutons dans le Tableau**
- **🎧 Icône casque** : Lancer la lecture
- **⏹️ Icône stop** : Arrêter la lecture (si en cours)
- **État visuel** : Bouton coloré quand actif

### **Lecteur Audio Intégré**
```
┌─────────────────────────────────────────────────┐
│ 🎵 Lecture Audio - Appel 33667375555 → 50008   │
│ [👤 Client] [🎧 Agent]                          │
├─────────────────────────────────────────────────┤
│ ▶️ ⏹️ 02:15 ████████████████░░░░░░ 04:30        │
├─────────────────────────────────────────────────┤
│ 👤 Client  🔉 ████████████ 🔊                   │
│ 🎧 Agent   🔉 ██████████░░ 🔊                   │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Utilisation

### **1. Dans l'Interface**
1. Aller sur **http://ai.intelios.us:3000/calls**
2. Cliquer sur l'icône **🎧** dans la colonne Actions
3. Le lecteur audio s'affiche sous le tableau
4. Contrôler la lecture avec les boutons standard

### **2. Fonctionnalités Disponibles**
- **▶️ Play/Pause** : Lecture simultanée des deux flux
- **⏹️ Stop** : Arrêt et remise à zéro
- **Timeline** : Seeking dans l'enregistrement
- **Volume** : Contrôle indépendant client/agent
- **❌ Fermer** : Fermer le lecteur

---

## 🌐 URLs d'API

### **Streaming Audio**
```bash
# Stream du client (in)
GET http://ai.intelios.us:5002/api/calls/{callId}/stream/in

# Stream de l'agent (out)  
GET http://ai.intelios.us:5002/api/calls/{callId}/stream/out

# Infos d'un appel
GET http://ai.intelios.us:5002/api/calls/{callId}
```

### **Exemples d'utilisation :**
```bash
# Écouter directement dans le navigateur
http://ai.intelios.us:5002/api/calls/1755266689.1231947-33667375555/stream/in

# Test avec curl
curl -I http://ai.intelios.us:5002/api/calls/1755266689.1231947-33667375555/stream/in
```

---

## ⚡ Avantages Techniques

### **✅ Performance**
- **Pas de latence** WebSocket
- **Streaming par chunks** efficace
- **Support Range requests** pour seeking instantané
- **Cache désactivé** pour données temps réel

### **✅ Compatibilité**
- **HTML5 `<audio>`** standard
- **Tous navigateurs** modernes
- **Mobile responsive**
- **APIs natives** du navigateur

### **✅ Expérience Utilisateur**
- **Lecture simultanée** naturelle
- **Contrôles familiers** (play/pause/seek)
- **Volumes indépendants** pour chaque flux
- **Interface intuitive** Material-UI

---

## 🔍 Débogage

### **Vérifier le streaming :**
```bash
# Test des en-têtes
curl -I http://ai.intelios.us:5002/api/calls/{callId}/stream/in

# Vérifier la réponse
# ✅ HTTP/1.1 200 OK
# ✅ Content-Type: audio/wav
# ✅ Accept-Ranges: bytes
```

### **Logs Backend :**
```javascript
console.log('Streaming audio pour:', callId, type);
console.log('Fichier:', filePath);
console.log('Taille:', fileSize);
```

---

## 🚀 Extensions Possibles

### **Fonctionnalités Futures**
1. **Vitesse de lecture** (0.5x, 1x, 1.5x, 2x)
2. **Bookmarks** dans la timeline
3. **Waveform** visualisation
4. **Export** segments audio
5. **Transcription** synchronisée avec audio
6. **Annotations** temporelles

### **Optimisations**
1. **Compression** audio à la volée
2. **Cache** intelligent côté client
3. **Préchargement** des appels suivants
4. **WebRTC** pour streaming ultra-faible latence

---

## 📊 Status

**🟢 FONCTIONNEL** - Prêt pour production

- ✅ **Backend** : Routes streaming opérationnelles
- ✅ **Frontend** : Composant AudioPlayer intégré  
- ✅ **Interface** : Boutons et contrôles actifs
- ✅ **Tests** : Streaming vérifié et fonctionnel

**Accès direct :** http://ai.intelios.us:3000/calls

---
**Implémentation terminée** - $(date)  
**Streaming audio par chunks** ✅  
**Lecture simultanée client+agent** ✅
