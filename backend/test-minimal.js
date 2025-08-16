// Serveur minimal pour tester SLN
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const SLNStreamer = require('./sln-streamer');

const app = express();
const PORT = 5003;

app.use(cors());
app.use(express.json());

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'TransFlow SLN Test',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Fonction pour scanner les appels SLN
function scanCallsSLN() {
  const monitorPath = '/home/nfs_proxip_monitor/';
  
  try {
    if (!fs.existsSync(monitorPath)) {
      console.log('❌ Répertoire n\'existe pas:', monitorPath);
      return [];
    }

    const files = fs.readdirSync(monitorPath);
    const audioFiles = files.filter(file => file.endsWith('.sln') || file.endsWith('.wav'));
    
    console.log('📁 Fichiers audio détectés:', audioFiles.length);
    
    const callGroups = new Map();
    const now = new Date();
    
    for (const file of audioFiles) {
      console.log('🔍 Traitement:', file);
      
      let match = file.match(/^(\d+\.\d+)-(.+)-(\d+)-(in|out)\.(sln|wav)$/);
      let phoneNumber, calledNumber = null, type, timestampStr, extension;
      
      if (match) {
        [, timestampStr, phoneNumber, calledNumber, type, extension] = match;
      } else {
        match = file.match(/^(\d+\.\d+)-(.+)-(in|out)\.(sln|wav)$/);
        if (!match) continue;
        [, timestampStr, phoneNumber, type, extension] = match;
      }
      
      const callId = `${timestampStr}-${phoneNumber}`;
      const filePath = path.join(monitorPath, file);
      const stats = fs.statSync(filePath);
      
      const timeSinceModified = now.getTime() - stats.mtime.getTime();
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
    
    return Array.from(callGroups.values())
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  } catch (error) {
    console.error('❌ Erreur scan appels:', error);
    return [];
  }
}

// API pour tester
app.get('/api/calls', (req, res) => {
  try {
    console.log('📞 Requête API calls reçue');
    const calls = scanCallsSLN();
    console.log('📊 Appels trouvés:', calls.length);
    
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
    console.error('❌ Erreur API calls:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint de streaming SLN temps réel
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
      const calls = scanCallsSLN();
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
      
      console.log(`🎵 Démarrage streaming SLN: ${path.basename(filePath)}`);
      
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
          // Fin du fichier et plus de données attendues
          res.write(`event: complete\ndata: ${JSON.stringify({ 
            message: 'Streaming terminé',
            totalBytesRead: streamer.offset
          })}\n\n`);
          console.log(`✅ Streaming SLN terminé: ${streamer.offset} bytes`);
          return;
        }
        
        if (result.waiting) {
          // En attente de nouvelles données de MixMonitor
          res.write(`event: waiting\ndata: ${JSON.stringify({ 
            message: result.reason,
            currentOffset: streamer.offset
          })}\n\n`);
          setTimeout(streamNextChunk, 100); // Vérifier à nouveau dans 100ms
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
        
        console.log(`🎵 Chunk SLN envoyé: #${result.chunkNumber}, ${result.data.length} bytes -> ${wavData.length} bytes WAV`);
        
        // Continuer le streaming
        if (!result.isComplete) {
          setTimeout(streamNextChunk, streamer.getChunkDurationMs()); // Respecter le timing audio
        } else {
          res.write(`event: complete\ndata: ${JSON.stringify({ 
            message: 'Fichier complètement lu',
            totalChunks: result.chunkNumber + 1
          })}\n\n`);
          console.log(`🎉 Streaming SLN complet: ${result.chunkNumber + 1} chunks`);
        }
      };
      
      // Démarrer le streaming
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
  
  console.log(`🚀 Connexion streaming SLN: ${id}:${type}`);
  startSLNStreaming();
  
  // Gérer la déconnexion
  req.on('close', () => {
    isStreaming = false;
    streamer = null;
    console.log(`🔌 Streaming SLN déconnecté pour ${id}:${type}`);
  });
  
  req.on('aborted', () => {
    isStreaming = false;
    streamer = null;
    console.log(`❌ Streaming SLN interrompu pour ${id}:${type}`);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur SLN test démarré sur le port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`📞 API calls: http://localhost:${PORT}/api/calls`);
});
