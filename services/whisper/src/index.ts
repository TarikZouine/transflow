import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import dotenv from 'dotenv';

// Configuration de l'environnement
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Configuration CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5000",
  credentials: true
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration de multer pour les uploads
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const tempDir = process.env.TEMP_DIR || path.join(process.cwd(), 'temp');
    await fs.ensureDir(tempDir);
    cb(null, tempDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `audio-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'audio/wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/ogg',
      'audio/webm',
      'audio/flac',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté'));
    }
  }
});

// Route de santé
app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'Whisper Transcription Service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    models: ['tiny', 'base', 'small', 'medium', 'large'],
  });
});

// Route pour lister les modèles disponibles
app.get('/v1/models', (_req, res) => {
  const models = [
    {
      id: 'whisper-tiny',
      object: 'model',
      created: Date.now(),
      owned_by: 'openai',
      size: '39MB',
      description: 'Le plus rapide, moins précis',
    },
    {
      id: 'whisper-base',
      object: 'model',
      created: Date.now(),
      owned_by: 'openai',
      size: '74MB',
      description: 'Équilibré entre vitesse et précision',
    },
    {
      id: 'whisper-small',
      object: 'model',
      created: Date.now(),
      owned_by: 'openai',
      size: '244MB',
      description: 'Plus précis, un peu plus lent',
    },
    {
      id: 'whisper-medium',
      object: 'model',
      created: Date.now(),
      owned_by: 'openai',
      size: '769MB',
      description: 'Très précis',
    },
    {
      id: 'whisper-large',
      object: 'model',
      created: Date.now(),
      owned_by: 'openai',
      size: '1550MB',
      description: 'Maximum de précision',
    },
  ];

  res.json({
    object: 'list',
    data: models,
  });
});

// Route principale de transcription
app.post('/v1/audio/transcriptions', upload.single('audio'), async (req, res): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        error: {
          message: 'Aucun fichier audio fourni',
          type: 'invalid_request_error',
        }
      });
      return;
    }

    const {
      model = 'base',
      language = 'fr',
      response_format = 'json',
      task = 'transcribe'
    } = req.body;

    console.log(`Transcription demandée - Modèle: ${model}, Langue: ${language}, Format: ${response_format}`);

    // Simulation de traitement Whisper
    // Dans un environnement réel, ici on appellerait l'API Whisper ou on utiliserait le modèle local
    const startTime = Date.now();
    
    // Simulation d'un délai de traitement basé sur la taille du fichier
    const processingDelay = Math.min(2000, req.file.size / 1000); // Max 2 secondes
    await new Promise(resolve => setTimeout(resolve, processingDelay));

    // Transcription simulée basée sur le nom du fichier ou contenu fictif
    const mockTranscriptions = [
      "Bonjour, ceci est un exemple de transcription automatique générée par le service Whisper.",
      "Cette transcription est simulée pour les besoins de développement et de test.",
      "Dans un environnement de production, le véritable modèle Whisper serait utilisé.",
      "La qualité de la transcription dépend du modèle choisi et de la qualité audio.",
      "Merci d'utiliser TransFlow pour vos besoins de transcription en temps réel.",
    ];

    const transcriptionText = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
    const processingTime = Date.now() - startTime;
    const confidence = 0.7 + Math.random() * 0.25; // Entre 0.7 et 0.95

    const result = {
      text: transcriptionText,
      language: language,
      confidence: parseFloat(confidence.toFixed(2)),
      processing_time: processingTime,
      model_used: model,
      task: task,
    };

    // Format de réponse selon le paramètre response_format
    if (response_format === 'text') {
      res.setHeader('Content-Type', 'text/plain');
      res.send(result.text);
    } else {
      res.json(result);
    }

    console.log(`Transcription terminée en ${processingTime}ms: "${result.text.substring(0, 50)}..."`);

  } catch (error) {
    console.error('Erreur lors de la transcription:', error);
    res.status(500).json({
      error: {
        message: 'Erreur interne du serveur de transcription',
        type: 'server_error',
      }
    });
  } finally {
    // Nettoyage du fichier temporaire
    if (req.file && req.file.path) {
      try {
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        console.warn('Erreur lors du nettoyage:', cleanupError);
      }
    }
  }
});

// Route de traduction (task=translate)
app.post('/v1/audio/translations', upload.single('audio'), async (req, res) => {
  // Réutiliser la logique de transcription mais avec task=translate
  req.body.task = 'translate';
  req.body.language = 'en'; // La traduction est toujours vers l'anglais dans Whisper
  
  // Rediriger vers la route de transcription
  return app._router.handle(req, res);
});

// Gestion des erreurs
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction): void => {
  console.error('Erreur dans le service Whisper:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: {
          message: 'Fichier trop volumineux',
          type: 'invalid_request_error',
        }
      });
      return;
    }
  }

  res.status(500).json({
    error: {
      message: 'Erreur interne du serveur',
      type: 'server_error',
    }
  });
});

// Route 404
app.use('*', (_req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint non trouvé',
      type: 'invalid_request_error',
    }
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🎤 Service Whisper démarré sur le port ${PORT}`);
  console.log(`📋 API disponible sur: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📝 Modèles: http://localhost:${PORT}/v1/models`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
});

// Gestion des signaux de fermeture
process.on('SIGTERM', () => {
  console.log('Signal SIGTERM reçu, fermeture du service Whisper...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Signal SIGINT reçu, fermeture du service Whisper...');
  process.exit(0);
});
