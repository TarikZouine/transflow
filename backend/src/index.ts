import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// import { connectDatabase } from './config/database';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { setupWebSocket } from './services/websocket';

// Import des routes
import sessionRoutes from './routes/sessions';
import transcriptionRoutes from './routes/transcriptions';
import settingsRoutes from './routes/settings';
import uploadRoutes from './routes/upload';

// Configuration de l'environnement
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 5002;

// Middleware de sécurité
app.use(helmet());

// Configuration CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limite chaque IP à 100 requêtes par windowMs
  message: 'Trop de requêtes depuis cette IP, réessayez plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Middleware de logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));

// Compression
app.use(compression());

// Parsing des requêtes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes de santé
app.get('/health', (_req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Routes API
app.use('/api/sessions', sessionRoutes);
app.use('/api/transcriptions', transcriptionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);

// Configuration WebSocket
setupWebSocket(io);

// Middleware de gestion des erreurs (doit être en dernier)
app.use(errorHandler);

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée',
    path: req.originalUrl 
  });
});

// Démarrage du serveur
const startServer = async (): Promise<void> => {
  try {
    // Connexion à la base de données (désactivée temporairement)
    // await connectDatabase();
    logger.info('⚠️  Base de données désactivée temporairement');
    
    // Démarrage du serveur sur toutes les interfaces pour accès externe
    server.listen(Number(PORT), '0.0.0.0', () => {
      logger.info(`🚀 Serveur démarré sur le port ${PORT} (toutes interfaces)`);
      logger.info(`🌐 Accessible sur: http://ai.intelios.us:${PORT}`);
      logger.info(`📝 Documentation API: http://localhost:${PORT}/api/docs`);
      logger.info(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
    });
    
  } catch (error) {
    logger.error('Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
};

// Gestion des signaux de fermeture
process.on('SIGTERM', () => {
  logger.info('Signal SIGTERM reçu, fermeture du serveur...');
  server.close(() => {
    logger.info('Serveur fermé');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Signal SIGINT reçu, fermeture du serveur...');
  server.close(() => {
    logger.info('Serveur fermé');
    process.exit(0);
  });
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  logger.error('Exception non capturée:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesse rejetée non gérée:', { reason, promise });
  process.exit(1);
});

startServer();
