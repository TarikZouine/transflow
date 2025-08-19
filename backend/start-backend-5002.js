#!/usr/bin/env node

// Simple serveur Node.js pour exposer l'API backend sur port 5002
// Solution temporaire pour éviter les erreurs TypeScript

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 5002;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration MySQL
const mysqlConfig = {
  socketPath: '/var/run/mysqld/mysqld.sock',
  user: 'root',
  password: '',
  database: 'transflow'
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT 
  });
});

// API Calls Active
app.get('/api/calls/active', async (req, res) => {
  try {
    const connection = await mysql.createConnection(mysqlConfig);
    
    // Récupérer les appels actifs (enabled = 1)
    const [rows] = await connection.execute(
      'SELECT call_id, is_enabled, last_seen FROM transcription_control WHERE is_enabled = 1'
    );
    
    await connection.end();
    
    res.json({
      success: true,
      data: rows,
      count: rows.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erreur MySQL:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur base de données',
      timestamp: new Date().toISOString()
    });
  }
});

// API Calls (tous les appels)
app.get('/api/calls', async (req, res) => {
  try {
    const connection = await mysql.createConnection(mysqlConfig);
    
    const [rows] = await connection.execute(
      'SELECT call_id, is_enabled, created_at, updated_at, last_seen FROM transcription_control ORDER BY last_seen DESC LIMIT 50'
    );
    
    await connection.end();
    
    res.json({
      success: true,
      data: rows,
      count: rows.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erreur MySQL:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur base de données',
      timestamp: new Date().toISOString()
    });
  }
});

// Enable/disable transcription
app.post('/api/calls/:callId/toggle', async (req, res) => {
  try {
    const { callId } = req.params;
    const { enabled } = req.body;
    
    const connection = await mysql.createConnection(mysqlConfig);
    
    await connection.execute(
      'UPDATE transcription_control SET is_enabled = ? WHERE call_id = ?',
      [enabled ? 1 : 0, callId]
    );
    
    await connection.end();
    
    res.json({
      success: true,
      message: `Transcription ${enabled ? 'activée' : 'désactivée'} pour ${callId}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erreur toggle:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur mise à jour',
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée',
    path: req.originalUrl,
    availableEndpoints: [
      '/health',
      '/api/calls/active',
      '/api/calls',
      '/api/calls/:callId/toggle'
    ]
  });
});

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend simple démarré sur le port ${PORT} (toutes interfaces)`);
  console.log(`🌐 Accessible sur: http://ai.intelios.us:${PORT}`);
  console.log(`🔗 Endpoints disponibles:`);
  console.log(`   • GET  /health`);
  console.log(`   • GET  /api/calls/active`);
  console.log(`   • GET  /api/calls`);
  console.log(`   • POST /api/calls/:callId/toggle`);
});

// Gestion des erreurs
process.on('uncaughtException', (error) => {
  console.error('Erreur non gérée:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejetée:', reason, 'à', promise);
  process.exit(1);
});
