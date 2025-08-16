// Serveur SLN optimisé avec cache pour éviter les timeouts
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const SLNStreamer = require('./sln-streamer');

const app = express();
const PORT = 5003;

app.use(cors());
app.use(express.json());

// Cache pour éviter de rescanner constamment
let callsCache = null;
let lastScanTime = 0;
const CACHE_DURATION = 5000; // 5 secondes

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'TransFlow SLN Fast',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Fonction optimisée pour scanner les appels SLN avec cache
function scanCallsSLNFast() {
  const now = Date.now();
  
  // Utiliser le cache si il est récent
  if (callsCache && (now - lastScanTime) < CACHE_DURATION) {
    console.log('📋 Utilisation du cache des appels');
    return callsCache;
  }
  
  const monitorPath = '/home/nfs_proxip_monitor/';
  
  try {
    console.log('🔍 Scan rapide des fichiers SLN...');
    const startTime = Date.now();
    
    if (!fs.existsSync(monitorPath)) {
      console.log('❌ Répertoire n\'existe pas:', monitorPath);
      return [];
    }

    const files = fs.readdirSync(monitorPath);
    const audioFiles = files.filter(file => file.endsWith('.sln'));
    
    console.log(`📁 ${audioFiles.length} fichiers SLN trouvés`);
    
    const callGroups = new Map();
    const scanTime = new Date();
    
    // Traitement optimisé - pas de logs détaillés
    for (const file of audioFiles) {
      let match = file.match(/^(\d+\.\d+)-(.+)-(\d+)-(in|out)\.sln$/);
      let phoneNumber, calledNumber = null, type, timestampStr;
      
      if (match) {
        [, timestampStr, phoneNumber, calledNumber, type] = match;
      } else {
        match = file.match(/^(\d+\.\d+)-(.+)-(in|out)\.sln$/);
        if (!match) continue;
        [, timestampStr, phoneNumber, type] = match;
      }
      
      const callId = `${timestampStr}-${phoneNumber}`;
      const filePath = path.join(monitorPath, file);
      const stats = fs.statSync(filePath);
      
      const timeSinceModified = scanTime.getTime() - stats.mtime.getTime();
      const isActive = timeSinceModified <= 30000; // 30 secondes
      
      if (!callGroups.has(callId)) {
        callGroups.set(callId, {
          id: callId,
          phoneNumber,
          calledNumber,
          startTime: stats.birthtime || stats.mtime,
          lastActivity: stats.mtime,
          status: isActive ? 'active' : 'completed',
          clientFile: null,
          agentFile: null,
        });
      }
      
      const call = callGroups.get(callId);
      if (calledNumber && !call.calledNumber) {
        call.calledNumber = calledNumber;
      }
      
      const fileCreationTime = stats.birthtime || stats.mtime;
      if (fileCreationTime < call.startTime) {
        call.startTime = fileCreationTime;
      }
      if (stats.mtime > call.lastActivity) {
        call.lastActivity = stats.mtime;
        call.status = isActive ? 'active' : 'completed';
      }
      
      if (type === 'in') {
        call.clientFile = { path: filePath, size: stats.size };
      } else {
        call.agentFile = { path: filePath, size: stats.size };
      }
    }
    
    const result = Array.from(callGroups.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime()); // Plus récents en premier
    
    const scanDuration = Date.now() - startTime;
    console.log(`✅ Scan terminé: ${result.length} appels en ${scanDuration}ms`);
    
    // Mettre en cache
    callsCache = result;
    lastScanTime = now;
    
    return result;
  } catch (error) {
    console.error('❌ Erreur scan appels:', error);
    return callsCache || []; // Retourner le cache même en cas d'erreur
  }
}

// API rapide pour les appels
app.get('/api/calls', (req, res) => {
  try {
    console.log('📞 API calls - réponse rapide');
    const calls = scanCallsSLNFast();
    
    res.json({
      success: true,
      data: calls.map(call => ({
        id: call.id,
        phoneNumber: call.phoneNumber,
        calledNumber: call.calledNumber,
        startTime: call.startTime,
        lastActivity: call.lastActivity,
        duration: call.lastActivity.getTime() - call.startTime.getTime(),
        status: call.status,
        hasClientFile: !!call.clientFile,
        hasAgentFile: !!call.agentFile,
        clientFileSize: call.clientFile?.size || 0,
        agentFileSize: call.agentFile?.size || 0,
      })),
      count: calls.length,
      cached: (Date.now() - lastScanTime) < CACHE_DURATION
    });
  } catch (error) {
    console.error('❌ Erreur API calls:', error);
    res.status(500).json({ error: error.message });
  }
});

// API pour les appels actifs seulement
app.get('/api/calls/active', (req, res) => {
  try {
    const calls = scanCallsSLNFast().filter(call => call.status === 'active');
    
    res.json({
      success: true,
      data: calls.map(call => ({
        id: call.id,
        phoneNumber: call.phoneNumber,
        calledNumber: call.calledNumber,
        startTime: call.startTime,
        lastActivity: call.lastActivity,
        duration: call.lastActivity.getTime() - call.startTime.getTime(),
        status: call.status,
        hasClientFile: !!call.clientFile,
        hasAgentFile: !!call.agentFile,
        clientFileSize: call.clientFile?.size || 0,
        agentFileSize: call.agentFile?.size || 0,
      })),
      count: calls.length,
    });
  } catch (error) {
    console.error('❌ Erreur API active calls:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint de streaming SLN mixé (conversation complète)
app.get('/api/calls/:id/stream-sln/mixed', async (req, res) => {
  const { id: callId } = req.params;
  
  console.log(`📞 Demande stream mixé pour call: ${callId}`);
  
  // Headers pour SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Message de connexion
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ message: 'Streaming mixé connecté', callId })}\n\n`);

  const calls = await scanCallsSLN();
  const call = calls.find(c => c.id === callId);
  
  if (!call || (!call.clientFile && !call.agentFile)) {
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: 'Aucun fichier audio trouvé' })}\n\n`);
    return res.end();
  }

  // Prendre le premier fichier disponible (on va simplifier pour l'instant)
  const filePath = call.clientFile?.path || call.agentFile?.path;
  const SLNStreamer = require('./sln-streamer');
  const streamer = new SLNStreamer(filePath);
  
  let streamActive = true;
  let chunkIndex = 0;
  
  const streamLoop = async () => {
    while (streamActive) {
      try {
        const chunk = await streamer.readNextChunk();
        if (!chunk || !chunk.data) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        
        const base64Data = chunk.audioData;
        chunkIndex++;
        
        res.write(`event: audio-chunk\n`);
        res.write(`data: ${JSON.stringify({
          data: base64Data,
          chunkSize: chunk.data.length,
          chunkIndex,
          offset: streamer.offset,
          fileSize: chunk.fileSize || 0,
          callStatus: chunk.isComplete ? 'completed' : 'active'
        })}\n\n`);
        
        console.log(`🎵 Chunk mixé ${chunkIndex}: ${chunk.data.length} bytes`);
        
        // Attendre 100ms pour chunks fluides
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error('Erreur streaming mixé:', error);
        break;
      }
    }
  };

  streamLoop();

  // Nettoyage à la déconnexion
  req.on('close', () => {
    console.log(`🔌 Client déconnecté du stream mixé ${callId}`);
    streamActive = false;
    if (streamer.close) streamer.close();
  });
});

// Endpoint de streaming SLN temps réel (identique à avant)
app.get('/api/calls/:id/stream-sln/:type', (req, res) => {
  const { id, type } = req.params;
  
  // Configuration SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  let streamer = null;
  let isStreaming = true;
  
  const startSLNStreaming = () => {
    if (!isStreaming) return;
    
    try {
      const calls = scanCallsSLNFast();
      const call = calls.find(c => c.id === id);
      
      if (!call) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Appel non trouvé' })}\n\n`);
        return;
      }
      
      let filePath;
      if (type === 'in' && call.clientFile) {
        filePath = call.clientFile.path;
      } else if (type === 'out' && call.agentFile) {
        filePath = call.agentFile.path;
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ error: `Fichier ${type} non trouvé` })}\n\n`);
        return;
      }
      
      if (!fs.existsSync(filePath)) {
        res.write(`event: waiting\ndata: ${JSON.stringify({ message: 'En attente du fichier SLN...' })}\n\n`);
        setTimeout(startSLNStreaming, 1000);
        return;
      }
      
      console.log(`🎵 Streaming SLN: ${path.basename(filePath)}`);
      
      // Créer le streamer SLN optimisé
      streamer = new SLNStreamer(filePath, {
        chunkSize: 1600 // 100ms à 8kHz pour SLN
      });
      
      // Envoyer les infos du fichier
      const fileInfo = streamer.getFileInfo();
      res.write(`event: file-info\ndata: ${JSON.stringify(fileInfo)}\n\n`);
      
      // Fonction de streaming continu
      const streamNextChunk = () => {
        if (!isStreaming || !streamer) return;
        
        const result = streamer.readNextChunk();
        
        if (!result) {
          res.write(`event: complete\ndata: ${JSON.stringify({ 
            message: 'Streaming terminé',
            totalBytesRead: streamer.offset
          })}\n\n`);
          return;
        }
        
        if (result.waiting) {
          res.write(`event: waiting\ndata: ${JSON.stringify({ 
            message: result.reason,
            currentOffset: streamer.offset
          })}\n\n`);
          setTimeout(streamNextChunk, 100);
          return;
        }
        
        // Convertir SLN en WAV pour la compatibilité navigateur
        const wavData = streamer.slnToWav(result.data);
        const audioData = wavData.toString('base64');
        
        // Envoyer le chunk audio
        res.write(`event: audio-chunk\ndata: ${JSON.stringify({
          data: audioData,
          format: 'wav',
          originalFormat: 'sln',
          offset: result.offset,
          chunkSize: result.data.length,
          wavSize: wavData.length,
          fileSize: result.fileSize,
          progress: result.progress,
          chunkNumber: result.chunkNumber,
          duration: streamer.getChunkDurationMs(),
          isComplete: result.isComplete,
          callStatus: call.status,
          timestamp: Date.now()
        })}\n\n`);
        
        // Continuer le streaming
        if (!result.isComplete) {
          setTimeout(streamNextChunk, streamer.getChunkDurationMs());
        } else {
          res.write(`event: complete\ndata: ${JSON.stringify({ 
            message: 'Fichier complètement lu',
            totalChunks: result.chunkNumber + 1
          })}\n\n`);
        }
      };
      
      streamNextChunk();
      
    } catch (error) {
      console.error('❌ Erreur streaming SLN:', error);
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      setTimeout(startSLNStreaming, 2000);
    }
  };
  
  // Démarrer
  res.write(`event: connected\ndata: ${JSON.stringify({ 
    message: 'Streaming SLN connecté', 
    callId: id, 
    type: type,
    format: 'sln-to-wav'
  })}\n\n`);
  
  console.log(`🚀 Streaming SLN: ${id}:${type}`);
  startSLNStreaming();
  
  // Gérer la déconnexion
  req.on('close', () => {
    isStreaming = false;
    streamer = null;
    console.log(`🔌 Streaming SLN déconnecté: ${id}:${type}`);
  });
  
  req.on('aborted', () => {
    isStreaming = false;
    streamer = null;
    console.log(`❌ Streaming SLN interrompu: ${id}:${type}`);
  });
});

// Endpoint pour vider le cache
app.post('/api/cache/clear', (req, res) => {
  callsCache = null;
  lastScanTime = 0;
  console.log('🗑️ Cache vidé');
  res.json({ success: true, message: 'Cache vidé' });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur SLN RAPIDE démarré sur le port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`📞 API calls: http://localhost:${PORT}/api/calls`);
  console.log(`🎵 Streaming SLN: http://localhost:${PORT}/api/calls/{id}/stream-sln/{type}`);
});
