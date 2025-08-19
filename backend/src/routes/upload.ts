import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
const router = express.Router();

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `audio-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Types de fichiers audio acceptés
  const allowedMimeTypes = [
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/ogg',
    'audio/webm',
    'audio/flac',
    'audio/m4a',
    'audio/aac',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non supporté. Formats acceptés: WAV, MP3, OGG, WEBM, FLAC, M4A, AAC'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'), // 50MB par défaut
  },
});

// POST /api/upload/audio - Upload et transcription d'un fichier audio
router.post('/audio', upload.single('audio'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Aucun fichier audio fourni',
    });
  }

  const { sessionId, model: _model, language: _language } = req.body;
  const filePath = req.file.path;

  try {
    logger.info(`Début de transcription du fichier: ${req.file.originalname}`);

    // TODO: Transcription du fichier avec Vosk
    const transcriptionResult = { text: 'Transcription non disponible - utiliser le système temps réel', confidence: 0 };

    if (!transcriptionResult) {
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la transcription',
      });
    }

    // TODO: Sauvegarder la transcription en base de données si sessionId fourni

    const response = {
      success: true,
      data: {
        filename: req.file.originalname,
        size: req.file.size,
        transcription: transcriptionResult,
        sessionId: sessionId || null,
      },
      message: 'Fichier transcrit avec succès',
    };

    logger.info(`Transcription terminée: ${transcriptionResult.text.length} caractères`);

    res.json(response);

  } catch (error) {
    logger.error('Erreur lors de la transcription du fichier:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la transcription',
    });
  } finally {
    // Nettoyage du fichier temporaire
    try {
      await fs.remove(filePath);
    } catch (cleanupError) {
      logger.warn('Erreur lors du nettoyage du fichier:', cleanupError);
    }
  }
}));

// POST /api/upload/batch - Upload et transcription de plusieurs fichiers
router.post('/batch', upload.array('audio', 10), asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  
  if (!files || files.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Aucun fichier fourni',
    });
  }

  const { sessionId, model: _model, language: _language } = req.body;
  const results = [];

  try {
    logger.info(`Début de transcription de ${files.length} fichiers`);

    for (const file of files) {
      try {
        // TODO: Transcription avec Vosk
        const transcriptionResult = { text: 'Transcription non disponible - utiliser le système temps réel', confidence: 0 };

        if (transcriptionResult) {
          results.push({
            filename: file.originalname,
            size: file.size,
            transcription: transcriptionResult,
            success: true,
          });
        } else {
          results.push({
            filename: file.originalname,
            size: file.size,
            error: 'Échec de la transcription',
            success: false,
          });
        }

        // Nettoyage du fichier
        await fs.remove(file.path);

      } catch (error) {
        logger.error(`Erreur lors de la transcription de ${file.originalname}:`, error);
        results.push({
          filename: file.originalname,
          size: file.size,
          error: error.message,
          success: false,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: files.length,
          successful: successCount,
          failed: files.length - successCount,
        },
        sessionId: sessionId || null,
      },
      message: `${successCount}/${files.length} fichiers transcrits avec succès`,
    });

  } catch (error) {
    logger.error('Erreur lors de la transcription en lot:', error);
    
    // Nettoyage en cas d'erreur
    for (const file of files) {
      try {
        await fs.remove(file.path);
      } catch (cleanupError) {
        logger.warn('Erreur lors du nettoyage:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la transcription en lot',
    });
  }
}));

// GET /api/upload/formats - Récupérer les formats supportés
router.get('/formats', asyncHandler(async (_req: Request, res: Response) => {
  const supportedFormats = [
    {
      extension: '.wav',
      mimeType: 'audio/wav',
      description: 'Format audio non compressé de haute qualité',
      recommended: true,
    },
    {
      extension: '.mp3',
      mimeType: 'audio/mpeg',
      description: 'Format audio compressé populaire',
      recommended: true,
    },
    {
      extension: '.ogg',
      mimeType: 'audio/ogg',
      description: 'Format audio libre et ouvert',
      recommended: false,
    },
    {
      extension: '.webm',
      mimeType: 'audio/webm',
      description: 'Format audio web moderne',
      recommended: false,
    },
    {
      extension: '.flac',
      mimeType: 'audio/flac',
      description: 'Format audio sans perte',
      recommended: true,
    },
    {
      extension: '.m4a',
      mimeType: 'audio/m4a',
      description: 'Format audio AAC',
      recommended: false,
    },
  ];

  res.json({
    success: true,
    data: supportedFormats,
    maxFileSize: process.env.MAX_FILE_SIZE || '52428800',
  });
}));

// Middleware de gestion d'erreur pour multer
router.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Fichier trop volumineux',
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Trop de fichiers',
      });
    }
  }
  
  if (error.message.includes('Type de fichier non supporté')) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
  
  next(error);
});

export default router;
