// Serveur de test simple pour vérifier le fonctionnement
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createStreamingEndpoint } = require('./streaming-endpoint');
const SLNStreamer = require('./sln-streamer');

const app = express();
const PORT = process.env.PORT || 5002;
let SERVER_STARTED = false;
// WebSocket + Redis + MySQL (pour transcription temps réel)
let io = null;
try {
  const httpServer = require('http').createServer(app);
  const { Server } = require('socket.io');
  io = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://ai.intelios.us:3000",
        "http://ai.intelios.us:3001"
      ],
      credentials: true
    }
  });

  // Redis subscriber pour recevoir les transcripts en temps réel
  const Redis = require('ioredis');
  const crypto = require('crypto');
  const redis = new Redis(process.env.REDIS_URL || undefined);
  const redisLeader = new Redis(process.env.REDIS_URL || undefined); // Connexion séparée pour le leadership
  const TRANSCRIPT_CHANNEL = process.env.TRANSCRIPT_CHANNEL || 'transcripts.realtime.v2';

  // Redis séparé pour la déduplication (pas en mode subscriber)
  let redisDedup = null;
  
  // Initialiser la connexion de déduplication après la subscription
  function initDedupConnection() {
    if (!redisDedup) {
      redisDedup = new Redis(process.env.REDIS_URL || undefined);
      console.log('🔒 Connexion Redis déduplication initialisée');
    }
  }

  // Leadership lock to avoid duplicate processing when multiple backend instances run
  const INSTANCE_ID = Math.random().toString(36).slice(2);
  const LEADER_KEY = 'transcripts.realtime.v2:leader';
  let IS_LEADER = false;

  async function acquireLeader() {
    try {
      const res = await redisLeader.set(LEADER_KEY, INSTANCE_ID, 'PX', 30000, 'NX');
      if (res === 'OK') {
        IS_LEADER = true;
        console.log('👑 Leadership acquis:', INSTANCE_ID);
      }
    } catch (e) {
      console.log('⚠️ Erreur acquisition leadership:', e.message);
    }
  }
  async function renewLeader() {
    try {
      if (IS_LEADER) {
        // Renew TTL only if we still hold the lock
        const cur = await redisLeader.get(LEADER_KEY);
        if (cur === INSTANCE_ID) {
          await redisLeader.pexpire(LEADER_KEY, 30000);
        } else {
          IS_LEADER = false;
          console.log('❌ Leadership perdu');
        }
      } else {
        await acquireLeader();
      }
    } catch (e) {
      console.log('⚠️ Erreur renouvellement leadership:', e.message);
    }
  }
  // Try to acquire and then renew periodically
  acquireLeader();
  setInterval(renewLeader, 10000).unref();

  // MySQL pool pour persistance
  const mysql = require('mysql2/promise');
  const mysqlConfig = {
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DB || 'transflow',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
  if (process.env.MYSQL_SOCKET || fs.existsSync('/var/run/mysqld/mysqld.sock')) {
    mysqlConfig.socketPath = process.env.MYSQL_SOCKET || '/var/run/mysqld/mysqld.sock';
    console.log(`🧷 MySQL via socket: ${mysqlConfig.socketPath}`);
  } else {
    mysqlConfig.host = process.env.MYSQL_HOST || '127.0.0.1';
    mysqlConfig.port = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306;
    console.log(`🌐 MySQL via TCP: ${mysqlConfig.host}:${mysqlConfig.port}`);
  }
  const mysqlPool = mysql.createPool(mysqlConfig);
  // Test connectivité
  mysqlPool.query('SELECT 1').then(()=>{
    console.log('✅ MySQL OK');
  }).catch((e)=>{
    console.error('❌ MySQL connexion KO:', e.message);
  });

  // Branche l'écoute Redis -> DB -> WebSocket
  redis.subscribe(TRANSCRIPT_CHANNEL, (err, count) => {
    if (err) {
      console.error('❌ Redis subscribe error:', err.message);
    } else {
      console.log(`📡 Abonné au canal Redis: ${TRANSCRIPT_CHANNEL} (count=${count})`);
    }
  });

  // Simple in-memory dedupe of recently processed transcripts
  const recentKeys = new Set();
  const recentQueue = [];
  const MAX_RECENT = 2000;

  function makeKey({ callId, tsMs, speaker, offsetBytes, text, processingTimeMs }) {
    const h = crypto.createHash('md5').update(String(text || '')).digest('hex').slice(0, 8);
    return `${callId}|${speaker}|${tsMs}|${offsetBytes}|${processingTimeMs || 'null'}|${h}`;
  }

  redis.on('message', async (channel, message) => {
    if (channel !== TRANSCRIPT_CHANNEL) return;
    try {
      const payload = JSON.parse(message);
      
      // Log de debug complet AVANT extraction
      console.log(`🔍 Payload complet reçu:`, JSON.stringify(payload, null, 2));
      
      // Extraire TOUS les champs du payload, y compris ceux non attendus
      const {
        callId,
        tsMs = Date.now(),
        speaker = 'mixed',
        lang = 'fr',
        confidence = null,
        offsetBytes = null,
        text,
        status = 'completed', // Par défaut pour compatibilité
        processingTimeMs, // Extraire directement sans valeur par défaut
        ...otherFields // Capturer tous les autres champs
      } = payload || {};
      
      // Log de debug après extraction
      console.log(`🔍 Champs extraits:`, { 
        callId, 
        tsMs, 
        speaker, 
        lang, 
        confidence, 
        offsetBytes, 
        text, 
        status, 
        processingTimeMs, 
        otherFields 
      });
      
      // Vérifier et corriger le champ processingTimeMs
      let finalProcessingTimeMs = processingTimeMs;
      if (payload.processingTimeMs !== undefined) {
        finalProcessingTimeMs = payload.processingTimeMs;
        console.log(`🔧 processingTimeMs extrait du payload:`, finalProcessingTimeMs);
      } else if (payload.processing_time !== undefined) {
        // Fallback pour la compatibilité avec l'ancien format
        finalProcessingTimeMs = payload.processing_time;
        console.log(`🔧 processing_time (fallback) extrait:`, finalProcessingTimeMs);
      } else {
        console.log(`⚠️ Aucun champ de temps de traitement trouvé dans le payload`);
        finalProcessingTimeMs = null;
      }

      if (!callId || !text) {
        console.warn('⚠️ Transcript ignoré: callId ou text manquant');
        return;
      }

      // Pour les événements "transcribing", on ne fait que l'affichage WebSocket
      if (status === 'transcribing') {
        const wsPayload = {
          callId,
          tsMs,
          speaker,
          lang,
          confidence,
          offsetBytes,
          text,
          status,
          processingTimeMs: finalProcessingTimeMs // Inclure le temps de traitement
        };
        // Emettre sur WebSocket (room par callId et global)
        io.to(`call:${callId}`).emit('transcript', wsPayload);
        io.emit('transcript_all', wsPayload);
        return; // Ne pas persister en base ni en log
      }

      // Process only if we are leader to avoid duplicates across instances
      if (!IS_LEADER) {
        return;
      }

      // Distributed dedupe using Redis (best-effort)
      const key = makeKey({ callId, tsMs, speaker, offsetBytes, text, processingTimeMs: finalProcessingTimeMs });
      const redisDedupeKey = `transcripts:dedupe:${key}`;
      try {
        // Initialiser la connexion de déduplication si nécessaire
        initDedupConnection();
        
        const setOk = await redisDedup.set(redisDedupeKey, '1', 'EX', 120, 'NX');
        if (setOk !== 'OK') {
          console.log(`⏩ Transcript déjà traité (dédup): ${callId} - ${text.substring(0, 30)}`);
          return; // already processed by another instance
        }
      } catch (e) {
        console.log(`⚠️ Erreur dédup Redis, fallback local: ${e.message}`);
        // ignore network errors; local dedupe still applies
      }

      // Dedupe within this instance
      if (recentKeys.has(key)) {
        return;
      }
      recentKeys.add(key);
      recentQueue.push(key);
      if (recentQueue.length > MAX_RECENT) {
        const old = recentQueue.shift();
        if (old) recentKeys.delete(old);
      }

      // Persister en base (leader uniquement)
      try {
        const [result] = await mysqlPool.execute(
          'INSERT INTO transcripts (call_id, ts_ms, speaker, lang, confidence, offset_bytes, text, processing_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [callId, tsMs, speaker, lang, confidence, offsetBytes, text, finalProcessingTimeMs]
        );
        console.log(`📝 Transcript inséré call=${callId} id=${result?.insertId ?? 'n/a'} time=${finalProcessingTimeMs}ms`);
      } catch (dbErr) {
        console.error('❌ Insertion MySQL transcript échouée:', dbErr.message);
      }

      // Écrire en fichier texte (/tmp/transcripts.log) (après dédup leader)
      const logLine = JSON.stringify({
        ts: new Date().toISOString(),
        callId,
        tsMs,
        speaker,
        lang,
        confidence,
        offsetBytes,
        text,
        processingTimeMs: finalProcessingTimeMs
      }) + '\n';
      fs.appendFile('/tmp/transcripts.log', logLine, (err) => {
        if (err) console.error('❌ Écriture transcript /tmp/transcripts.log échouée:', err.message);
      });

      const wsPayload = {
        callId,
        tsMs,
        speaker,
        lang,
        confidence,
        offsetBytes,
        text,
        processingTimeMs: finalProcessingTimeMs
      };
      // Emettre sur WebSocket (room par callId)
      io.to(`call:${callId}`).emit('transcript', wsPayload);
      // Emettre globalement (tous les clients) pour vues "tous les appels"
      io.emit('transcript_all', wsPayload);
    } catch (e) {
      console.error('❌ Erreur traitement transcript Redis:', e.message, message);
    }
  });

  // Gestion connexion WS
  io.on('connection', (socket) => {
    // rejoindre une room de call pour recevoir ses transcripts
    socket.on('subscribe-call', (callId) => {
      if (!callId) return;
      socket.join(`call:${callId}`);
    });
    socket.on('unsubscribe-call', (callId) => {
      if (!callId) return;
      socket.leave(`call:${callId}`);
    });
  });

  // Middleware
  app.use(cors({
    origin: [
      "http://localhost:3000", 
      "http://localhost:3001", 
      "http://ai.intelios.us:3000",
      "http://ai.intelios.us:3001"
    ],
    credentials: true
  }));
  app.use(express.json());

  // Route de santé
  app.get('/health', (req, res) => {
    res.json({
      status: 'OK',
      service: 'TransFlow Backend',
      timestamp: new Date().toISOString(),
      port: PORT
    });
  });

  // Route pour récupérer l'historique des transcripts d'un appel
  app.get('/api/transcripts/:callId', async (req, res) => {
    try {
      const { callId } = req.params;
      const { limit = 100, offset = 0 } = req.query;
      
      const [rows] = await mysqlPool.execute(
        'SELECT call_id, ts_ms, speaker, lang, confidence, offset_bytes, text, created_at FROM transcripts WHERE call_id = ? ORDER BY ts_ms ASC LIMIT ? OFFSET ?',
        [callId, parseInt(limit), parseInt(offset)]
      );
      
      res.json({
        success: true,
        data: rows,
        count: rows.length
      });
    } catch (error) {
      console.error('❌ Erreur récupération transcripts:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erreur récupération transcripts'
      });
    }
  });

  // Route pour récupérer tous les transcripts récents
  app.get('/api/transcripts', async (req, res) => {
    try {
      const { limit = 200, hours = 24 } = req.query;
      
      const [rows] = await mysqlPool.execute(
        'SELECT call_id, ts_ms, speaker, lang, confidence, offset_bytes, text, created_at FROM transcripts WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR) ORDER BY ts_ms DESC LIMIT ?',
        [parseInt(hours), parseInt(limit)]
      );
      
      res.json({
        success: true,
        data: rows,
        count: rows.length
      });
    } catch (error) {
      console.error('❌ Erreur récupération transcripts récents:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erreur récupération transcripts récents'
      });
    }
  });

  // Démarrer le serveur HTTP via httpServer pour partager le port
  const server = httpServer.listen(PORT, () => {
    console.log(`🚀 Serveur de test + WebSocket démarré sur le port ${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
  });
  server.keepAliveTimeout = 0;
  server.timeout = 0;
  SERVER_STARTED = true;
  module.exports = { app, io };
} catch (e) {
  console.error('⚠️ WebSocket/Redis/MySQL init failed, fallback HTTP only:', e.message);
}

// Fonction pour scanner les appels
function scanCalls() {
  const monitorPath = '/home/nfs_proxip_monitor/';
  
  try {
    if (!fs.existsSync(monitorPath)) {
      return [];
    }

    const files = fs.readdirSync(monitorPath);
    // Support des fichiers SLN (Signed Linear) d'Asterisk MixMonitor
    const audioFiles = files.filter(file => file.endsWith('.sln') || file.endsWith('.wav'));
    
    const callGroups = new Map();
    const now = new Date();
    
    for (const file of audioFiles) {
      // Support des formats SLN et WAV
      // Nouveau format avec numéro appelé : timestamp.sessionId-phoneNumber-numeroAppele-type.sln
      let match = file.match(/^(\d+\.\d+)-(.+)-(\d+)-(in|out)\.(sln|wav)$/);
      let phoneNumber, calledNumber = null, type, timestampStr, extension;
      
      if (match) {
        // Nouveau format avec numéro appelé
        [, timestampStr, phoneNumber, calledNumber, type, extension] = match;
      } else {
        // Ancien format sans numéro appelé : timestamp.sessionId-phoneNumber-type.sln
        match = file.match(/^(\d+\.\d+)-(.+)-(in|out)\.(sln|wav)$/);
        if (!match) continue;
        [, timestampStr, phoneNumber, type, extension] = match;
      }
      
      const callId = `${timestampStr}-${phoneNumber}`; // Garde le timestamp pour différencier les appels
      const filePath = path.join(monitorPath, file);
      const stats = fs.statSync(filePath);
      
      // Vérifier si le fichier a été modifié dans les 30 dernières secondes
      const timeSinceModified = now.getTime() - stats.mtime.getTime();
      const isActive = timeSinceModified <= 30000; // 30 secondes
      
      if (!callGroups.has(callId)) {
        callGroups.set(callId, {
          id: callId,
          phoneNumber,
          calledNumber,
          startTime: stats.birthtime || stats.mtime, // Utiliser la date de création
          lastActivity: stats.mtime,
          status: isActive ? 'active' : 'completed',
          clientFile: null,
          agentFile: null,
        });
      }
      
      const call = callGroups.get(callId);
      // Mettre à jour le numéro appelé si il n'était pas présent avant
      if (calledNumber && !call.calledNumber) {
        call.calledNumber = calledNumber;
      }
      // Utiliser la date de création la plus ancienne comme startTime
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
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()); // Tri par ancienneté (plus ancien en premier)
  } catch (error) {
    console.error('Erreur scan appels:', error);
    return [];
  }
}

// Endpoint pour obtenir tous les appels en streaming continu (DOIT être avant les routes avec paramètres)
app.get('/api/calls/stream-all', (req, res) => {
  // Configuration SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  let isStreaming = true;
  
  const streamAllCalls = () => {
    if (!isStreaming) return;
    
    try {
      const calls = scanCalls();
      
      // Envoyer la liste complète des appels
      res.write(`event: calls-update\ndata: ${JSON.stringify({
        calls: calls.map(call => ({
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
        timestamp: Date.now()
      })}\n\n`);
      
      // Continuer le streaming
      setTimeout(streamAllCalls, 1000); // Mise à jour toutes les secondes
      
    } catch (error) {
      console.error('Erreur streaming tous appels:', error);
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      setTimeout(streamAllCalls, 2000);
    }
  };
  
  // Démarrer le streaming
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Streaming de tous les appels connecté' })}\n\n`);
  streamAllCalls();
  
  // Gérer la déconnexion
  req.on('close', () => {
    isStreaming = false;
    console.log('🔌 Streaming tous appels déconnecté');
  });
  
  req.on('aborted', () => {
    isStreaming = false;
    console.log('❌ Streaming tous appels interrompu');
  });
});

// Routes pour les appels
app.get('/api/calls', (req, res) => {
  const calls = scanCalls();
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
});

app.get('/api/calls/active', (req, res) => {
  const calls = scanCalls().filter(call => call.status === 'active');
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
});

// Routes de streaming audio
app.get('/api/calls/:id/stream/:type', (req, res) => {
  const { id, type } = req.params; // type = 'in' ou 'out'
  
  try {
    // Trouver l'appel correspondant
    const calls = scanCalls();
    const call = calls.find(c => c.id === id);
    
    if (!call) {
      return res.status(404).json({ error: 'Appel non trouvé' });
    }
    
    // Sélectionner le bon fichier selon le type
    let filePath;
    if (type === 'in' && call.clientFile) {
      filePath = call.clientFile.path;
    } else if (type === 'out' && call.agentFile) {
      filePath = call.agentFile.path;
    } else {
      return res.status(404).json({ error: `Fichier ${type} non trouvé pour cet appel` });
    }
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier audio non trouvé sur le disque' });
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      // Streaming avec support Range (pour seeking)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      const stream = fs.createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/wav',
        'Cache-Control': 'public, max-age=30'
      });
      
      stream.pipe(res);
    } else {
      // Streaming complet
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/wav',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=30'
      });
      
      fs.createReadStream(filePath).pipe(res);
    }
    
  } catch (error) {
    console.error('Erreur streaming audio:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Nouveau endpoint pour obtenir les infos du fichier en temps réel
app.get('/api/calls/:id/fileinfo/:type', (req, res) => {
  const { id, type } = req.params;
  
  try {
    const calls = scanCalls();
    const call = calls.find(c => c.id === id);
    
    if (!call) {
      return res.status(404).json({ error: 'Appel non trouvé' });
    }
    
    let filePath;
    if (type === 'in' && call.clientFile) {
      filePath = call.clientFile.path;
    } else if (type === 'out' && call.agentFile) {
      filePath = call.agentFile.path;
    } else {
      return res.status(404).json({ error: `Fichier ${type} non trouvé` });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier non trouvé sur le disque' });
    }
    
    const stat = fs.statSync(filePath);
    
    // Estimation approximative de la durée basée sur la taille du fichier WAV
    // WAV standard: ~176400 bytes par seconde (44.1kHz, 16-bit, stéréo)
    // Mais c'est approximatif, la vraie durée peut varier
    const estimatedDuration = Math.max(1, stat.size / 176400);
    
    res.json({
      success: true,
      data: {
        size: stat.size,
        estimatedDuration: estimatedDuration,
        lastModified: stat.mtime,
        created: stat.birthtime || stat.mtime,
        callStatus: call.status
      }
    });
  } catch (error) {
    console.error('Erreur fileinfo:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des infos' });
  }
});

// Endpoint de monitoring continu pour surveiller l'évolution des fichiers
app.get('/api/calls/:id/monitor', (req, res) => {
  const { id } = req.params;
  
  try {
    const calls = scanCalls();
    const call = calls.find(c => c.id === id);
    
    if (!call) {
      return res.status(404).json({ error: 'Appel non trouvé' });
    }
    
    const clientFilePath = call.clientFile?.path;
    const agentFilePath = call.agentFile?.path;
    
    if (!clientFilePath || !fs.existsSync(clientFilePath)) {
      return res.status(404).json({ error: 'Fichier client non trouvé' });
    }
    
    const clientStat = fs.statSync(clientFilePath);
    const agentStat = agentFilePath && fs.existsSync(agentFilePath) ? fs.statSync(agentFilePath) : null;
    
    // Calcul plus précis de la durée basé sur la taille
    // WAV header = 44 bytes, puis données audio
    const clientDataSize = Math.max(0, clientStat.size - 44);
    const agentDataSize = agentStat ? Math.max(0, agentStat.size - 44) : 0;
    
    // Estimation plus précise : 176400 bytes/sec pour du 44.1kHz 16-bit stéréo
    const clientDuration = clientDataSize / 176400;
    const agentDuration = agentDataSize / 176400;
    const maxDuration = Math.max(clientDuration, agentDuration);
    
    // Déterminer si le fichier grandit (modifié dans les 3 dernières secondes)
    const now = new Date();
    const clientLastModified = clientStat.mtime;
    const agentLastModified = agentStat ? agentStat.mtime : new Date(0);
    const lastModified = new Date(Math.max(clientLastModified.getTime(), agentLastModified.getTime()));
    
    const timeSinceModified = now.getTime() - lastModified.getTime();
    const isGrowing = timeSinceModified <= 3000; // Modifié dans les 3 dernières secondes
    
    res.json({
      success: true,
      data: {
        callId: id,
        clientSize: clientStat.size,
        agentSize: agentStat ? agentStat.size : 0,
        clientDuration: clientDuration,
        agentDuration: agentDuration,
        maxDuration: maxDuration,
        lastModified: lastModified,
        timeSinceModified: timeSinceModified,
        isGrowing: isGrowing,
        status: call.status,
        timestamp: now
      }
    });
  } catch (error) {
    console.error('Erreur monitoring:', error);
    res.status(500).json({ error: 'Erreur lors du monitoring' });
  }
});

// Vrai streaming par chunks - lit le fichier par blocs en temps réel
app.get('/api/calls/:id/realstream/:type', (req, res) => {
  const { id, type } = req.params;
  const { offset = 0 } = req.query;
  
  try {
    const calls = scanCalls();
    const call = calls.find(c => c.id === id);
    
    if (!call) {
      return res.status(404).json({ error: 'Appel non trouvé' });
    }
    
    let filePath;
    if (type === 'in' && call.clientFile) {
      filePath = call.clientFile.path;
    } else if (type === 'out' && call.agentFile) {
      filePath = call.agentFile.path;
    } else {
      return res.status(404).json({ error: `Fichier ${type} non trouvé` });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier non trouvé sur le disque' });
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const startOffset = parseInt(offset, 10) || 0;
    
    // Lire seulement les nouveaux données depuis l'offset
    if (startOffset >= fileSize) {
      // Pas de nouvelles données
      return res.json({
        hasData: false,
        currentSize: fileSize,
        offset: startOffset
      });
    }
    
    // Lire les nouvelles données
    const chunkSize = Math.min(64 * 1024, fileSize - startOffset); // 64KB max
    const buffer = Buffer.alloc(chunkSize);
    
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, startOffset);
    fs.closeSync(fd);
    
    res.json({
      hasData: true,
      data: buffer.subarray(0, bytesRead).toString('base64'),
      currentSize: fileSize,
      offset: startOffset,
      nextOffset: startOffset + bytesRead,
      chunkSize: bytesRead
    });
    
  } catch (error) {
    console.error('Erreur real streaming:', error);
    res.status(500).json({ error: 'Erreur lors du streaming' });
  }
});

// Route pour obtenir les infos d'un appel spécifique
app.get('/api/calls/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    const calls = scanCalls();
    const call = calls.find(c => c.id === id);
    
    if (!call) {
      return res.status(404).json({ error: 'Appel non trouvé' });
    }
    
    res.json({
      success: true,
      data: {
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
      }
    });
  } catch (error) {
    console.error('Erreur récupération appel:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Routes de test (anciennes)
app.get('/api/sessions', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Test endpoint working'
  });
});

// Endpoint de streaming en temps réel avec Server-Sent Events
app.get('/api/calls/:id/stream-realtime/:type', (req, res) => {
  const { id, type } = req.params;
  
  // Configuration SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  let offset = 0;
  let isStreaming = true;
  
  const streamData = () => {
    if (!isStreaming) return;
    
    try {
      const calls = scanCalls();
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
        res.write(`event: waiting\ndata: ${JSON.stringify({ message: 'En attente du fichier...' })}\n\n`);
        setTimeout(streamData, 500);
        return;
      }
      
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      
      // Vérifier s'il y a de nouvelles données
      if (offset < fileSize) {
        // Lire le nouveau chunk
        const chunkSize = Math.min(8192, fileSize - offset); // 8KB chunks
        const buffer = Buffer.alloc(chunkSize);
        
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, offset);
        fs.closeSync(fd);
        
        if (bytesRead > 0) {
          const audioData = buffer.subarray(0, bytesRead).toString('base64');
          
          // Envoyer les données audio
          res.write(`event: audio-chunk\ndata: ${JSON.stringify({
            data: audioData,
            offset: offset,
            chunkSize: bytesRead,
            totalSize: fileSize,
            timestamp: Date.now(),
            callStatus: call.status
          })}\n\n`);
          
          offset += bytesRead;
        }
      }
      
      // Envoyer les infos de statut
      res.write(`event: status\ndata: ${JSON.stringify({
        callId: id,
        type: type,
        fileSize: fileSize,
        currentOffset: offset,
        progress: fileSize > 0 ? (offset / fileSize) * 100 : 0,
        callStatus: call.status,
        timestamp: Date.now()
      })}\n\n`);
      
      // Continuer le streaming
      setTimeout(streamData, 100); // Check toutes les 100ms
      
    } catch (error) {
      console.error('Erreur streaming temps réel:', error);
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      setTimeout(streamData, 1000);
    }
  };
  
  // Démarrer le streaming
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Streaming connecté', callId: id, type: type })}\n\n`);
  streamData();
  
  // Gérer la déconnexion
  req.on('close', () => {
    isStreaming = false;
    console.log(`🔌 Streaming déconnecté pour ${id}:${type}`);
  });
  
  req.on('aborted', () => {
    isStreaming = false;
    console.log(`❌ Streaming interrompu pour ${id}:${type}`);
  });
});

// Map pour tracker les connexions actives par callId
const activeConnections = new Map();

// Endpoint optimisé pour streaming SLN temps réel (MixMonitor)
// Endpoint de streaming SLN mixé (conversation complète)
app.get('/api/calls/:id/stream-sln/mixed', async (req, res) => {
  const { id: callId } = req.params;
  const connectionId = Math.random().toString(36).substr(2, 9);
  
  // FERMER TOUTES les anciennes connexions pour ce callId
  if (activeConnections.has(callId)) {
    const oldConnections = activeConnections.get(callId);
    console.log(`🧹 [${connectionId}] FERMETURE de ${oldConnections.length} anciennes connexions pour ${callId}`);
    
    oldConnections.forEach((oldConn, index) => {
      try {
        oldConn.res.end();
        if (oldConn.cleanup) oldConn.cleanup();
        console.log(`❌ [${connectionId}] Ancienne connexion ${index + 1} fermée`);
      } catch (e) {
        console.log(`⚠️ [${connectionId}] Erreur fermeture connexion ${index + 1}:`, e.message);
      }
    });
    
    // Vider la liste
    activeConnections.delete(callId);
  }
  
  console.log(`📞 [${connectionId}] NOUVELLE connexion pour call: ${callId}`);
  
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

  const calls = scanCalls();
  const call = calls.find(c => c.id === callId);
  
  if (!call || (!call.clientFile && !call.agentFile)) {
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: 'Aucun fichier audio trouvé' })}\n\n`);
    return res.end();
  }

  // Enregistrer cette connexion
  const connectionData = {
    res,
    connectionId,
    cleanup: null
  };
  
  if (!activeConnections.has(callId)) {
    activeConnections.set(callId, []);
  }
  activeConnections.get(callId).push(connectionData);
  
  // Vraiment mélanger les deux voix (client + agent)
  console.log(`🎭 [${connectionId}] Fichiers disponibles: Client=${!!call.clientFile?.path}, Agent=${!!call.agentFile?.path}`);
  const SLNStreamer = require('./sln-streamer');
  let clientStreamer = null;
  let agentStreamer = null;
  
  if (call.clientFile?.path) {
    clientStreamer = new SLNStreamer(call.clientFile.path);
    console.log(`🎧 [${connectionId}] Client streamer: ${call.clientFile.path}`);
  }
  if (call.agentFile?.path) {
    agentStreamer = new SLNStreamer(call.agentFile.path);
    console.log(`👤 [${connectionId}] Agent streamer: ${call.agentFile.path}`);
  }
  
  let streamActive = true;
  let chunkIndex = 0;
  
  const streamLoop = async () => {
    while (streamActive) {
      try {
        let clientChunk = null;
        let agentChunk = null;
        
        // Lire les chunks des deux streams
        if (clientStreamer) {
          clientChunk = await clientStreamer.readNextChunk();
        }
        if (agentStreamer) {
          agentChunk = await agentStreamer.readNextChunk();
        }
        
        // Si aucun chunk, vérifier si on doit continuer ou arrêter
        if (!clientChunk?.data && !agentChunk?.data) {
          // Si les deux streamers indiquent "waiting", on attend
          if ((clientChunk?.waiting || agentChunk?.waiting)) {
            await new Promise(resolve => setTimeout(resolve, 250));
            continue;
          } else {
            // Aucune donnée et pas en attente = fin du streaming
            console.log(`📞 [${connectionId}] Fin de stream pour call: ${callId}`);
            break;
          }
        }
        
        // Mélanger les données audio (simple addition des échantillons)
        let mixedData;
        let fileSize = 0;
        let offset = 0;
        
        if (clientChunk?.data && agentChunk?.data) {
          // Les deux voix sont disponibles - les mélanger
          const clientSamples = new Int16Array(clientChunk.data.buffer, clientChunk.data.byteOffset, clientChunk.data.length / 2);
          const agentSamples = new Int16Array(agentChunk.data.buffer, agentChunk.data.byteOffset, agentChunk.data.length / 2);
          
          const mixedSamples = new Int16Array(Math.max(clientSamples.length, agentSamples.length));
          
          for (let i = 0; i < mixedSamples.length; i++) {
            const clientSample = i < clientSamples.length ? clientSamples[i] : 0;
            const agentSample = i < agentSamples.length ? agentSamples[i] : 0;
            // Mélanger avec atténuation réduite pour moins d'écho
            mixedSamples[i] = Math.max(-32767, Math.min(32767, (clientSample + agentSample) * 0.5));
          }
          
          mixedData = Buffer.from(mixedSamples.buffer);
          fileSize = Math.max(clientChunk.fileSize || 0, agentChunk.fileSize || 0);
          offset = Math.max(clientStreamer.offset, agentStreamer.offset);
          console.log(`🎭 [${connectionId}] Mix: Client(${clientChunk.data.length}b) + Agent(${agentChunk.data.length}b) = ${mixedData.length}b`);
        } else if (clientChunk?.data) {
          // Seulement le client
          mixedData = clientChunk.data;
          fileSize = clientChunk.fileSize || 0;
          offset = clientStreamer.offset;
          console.log(`🎧 [${connectionId}] Client seul: ${mixedData.length}b`);
        } else if (agentChunk?.data) {
          // Seulement l'agent
          mixedData = agentChunk.data;
          fileSize = agentChunk.fileSize || 0;
          offset = agentStreamer.offset;
          console.log(`👤 [${connectionId}] Agent seul: ${mixedData.length}b`);
        }
        
        // Convertir en WAV et envoyer
        const wavData = clientStreamer ? clientStreamer.slnToWav(mixedData) : agentStreamer.slnToWav(mixedData);
        const base64Data = wavData.toString('base64');
        chunkIndex++;
        
        const audioPayload = {
          data: base64Data,
          chunkSize: mixedData.length,
          chunkIndex,
          offset,
          fileSize,
          callStatus: 'active'
        };
        
        res.write(`event: audio-chunk\n`);
        res.write(`data: ${JSON.stringify(audioPayload)}\n\n`);
        
        console.log(`🎵 [${connectionId}] Chunk mixé ${chunkIndex}: ${mixedData.length} bytes`);
        
        // Attendre 250ms pour chunks de 300ms - streaming naturel
        await new Promise(resolve => setTimeout(resolve, 250));
        
      } catch (error) {
        console.error('Erreur streaming mixé:', error);
        break;
      }
    }
  };

  streamLoop();

  // Fonction de nettoyage
  const cleanupFunction = () => {
    console.log(`🔌 [${connectionId}] Nettoyage stream mixé ${callId}`);
    streamActive = false;
    if (clientStreamer && clientStreamer.close) clientStreamer.close();
    if (agentStreamer && agentStreamer.close) agentStreamer.close();
    
    // Retirer de la liste des connexions actives
    if (activeConnections.has(callId)) {
      const connections = activeConnections.get(callId);
      const index = connections.findIndex(conn => conn.connectionId === connectionId);
      if (index > -1) {
        connections.splice(index, 1);
        if (connections.length === 0) {
          activeConnections.delete(callId);
        }
        console.log(`🗑️ [${connectionId}] Connexion retirée, reste ${connections.length} connexions pour ${callId}`);
      }
    }
  };
  
  // Assigner la fonction de nettoyage
  connectionData.cleanup = cleanupFunction;
  
  // Nettoyage à la déconnexion
  req.on('close', cleanupFunction);
  res.on('close', cleanupFunction);
});

// Endpoint de test avec fichier WAV simple
app.get('/api/test-audio', (req, res) => {
  console.log(`🎵 Test audio demandé`);
  
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
  res.write(`data: ${JSON.stringify({ message: 'Test audio connecté' })}\n\n`);

  const fs = require('fs');
  const testWavPath = '/tmp/test-tone.wav';
  
  if (!fs.existsSync(testWavPath)) {
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: 'Fichier test non trouvé' })}\n\n`);
    return res.end();
  }

  const wavData = fs.readFileSync(testWavPath);
  const base64Data = wavData.toString('base64');
  
  console.log(`🎵 Test WAV: ${wavData.length} bytes → Base64: ${base64Data.length} chars`);
  
  res.write(`event: audio-chunk\n`);
  res.write(`data: ${JSON.stringify({
    data: base64Data,
    chunkSize: wavData.length,
    chunkIndex: 1,
    offset: wavData.length,
    fileSize: wavData.length,
    callStatus: 'completed'
  })}\n\n`);
  
  setTimeout(() => res.end(), 1000);
});

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
      const calls = scanCalls();
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
        
        // Continuer le streaming
        if (!result.isComplete) {
          setTimeout(streamNextChunk, streamer.getChunkDurationMs()); // Respecter le timing audio
        } else {
          res.write(`event: complete\ndata: ${JSON.stringify({ 
            message: 'Fichier complètement lu',
            totalChunks: result.chunkNumber + 1
          })}\n\n`);
        }
      };
      
      // Démarrer le streaming
      streamNextChunk();
      
    } catch (error) {
      console.error('Erreur streaming SLN:', error);
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

// Ajouter les endpoints de streaming par chunks
createStreamingEndpoint(app, scanCalls);

// Gestion des signaux pour éviter l'arrêt inattendu
process.on('SIGINT', () => {
  console.log('\n⚠️ Signal SIGINT reçu, maintien du serveur...');
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Signal SIGTERM reçu, maintien du serveur...');
});

process.on('uncaughtException', (error) => {
  console.error('❌ Exception non capturée:', error);
  console.log('🔄 Le serveur continue de fonctionner...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  console.log('🔄 Le serveur continue de fonctionner...');
});

if (!SERVER_STARTED) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Serveur de test démarré sur le port ${PORT} (HTTP only)`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
    console.log(`🔄 Mode streaming continu activé`);
  });
  server.keepAliveTimeout = 0;
  server.timeout = 0;
}
