import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

// GET /api/settings - Récupérer les paramètres utilisateur
router.get('/', asyncHandler(async (req, res) => {
  // TODO: Implémenter la récupération depuis la base de données ou fichier de config
  const defaultSettings = {
    language: 'fr',
    model: 'base',
    autoSave: true,
    realTimeTranscription: true,
    speakerDetection: false,
    confidenceThreshold: 0.7,
    audioQuality: 'high',
    maxSessionDuration: 3600, // 1 heure en secondes
    autoCleanup: true,
    cleanupAfterDays: 30,
  };
  
  res.json({
    success: true,
    data: defaultSettings,
  });
}));

// PUT /api/settings - Mettre à jour les paramètres utilisateur
router.put('/', asyncHandler(async (req, res) => {
  const settings = req.body;
  
  // Validation des paramètres
  const allowedSettings = [
    'language',
    'model',
    'autoSave',
    'realTimeTranscription',
    'speakerDetection',
    'confidenceThreshold',
    'audioQuality',
    'maxSessionDuration',
    'autoCleanup',
    'cleanupAfterDays',
  ];
  
  const validSettings: any = {};
  
  for (const [key, value] of Object.entries(settings)) {
    if (allowedSettings.includes(key)) {
      validSettings[key] = value;
    }
  }
  
  // Validation spécifique
  if (validSettings.confidenceThreshold !== undefined) {
    const threshold = parseFloat(validSettings.confidenceThreshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      return res.status(400).json({
        success: false,
        error: 'Le seuil de confiance doit être entre 0 et 1',
      });
    }
  }
  
  if (validSettings.language && !['fr', 'en', 'es', 'de', 'it'].includes(validSettings.language)) {
    return res.status(400).json({
      success: false,
      error: 'Langue non supportée',
    });
  }
  
  if (validSettings.model && !['tiny', 'base', 'small', 'medium', 'large'].includes(validSettings.model)) {
    return res.status(400).json({
      success: false,
      error: 'Modèle non supporté',
    });
  }
  
  // TODO: Implémenter la sauvegarde en base de données
  logger.info('Paramètres mis à jour:', validSettings);
  
  res.json({
    success: true,
    data: validSettings,
    message: 'Paramètres mis à jour avec succès',
  });
}));

// POST /api/settings/reset - Réinitialiser les paramètres par défaut
router.post('/reset', asyncHandler(async (req, res) => {
  const defaultSettings = {
    language: 'fr',
    model: 'base',
    autoSave: true,
    realTimeTranscription: true,
    speakerDetection: false,
    confidenceThreshold: 0.7,
    audioQuality: 'high',
    maxSessionDuration: 3600,
    autoCleanup: true,
    cleanupAfterDays: 30,
  };
  
  // TODO: Implémenter la réinitialisation en base de données
  logger.info('Paramètres réinitialisés aux valeurs par défaut');
  
  res.json({
    success: true,
    data: defaultSettings,
    message: 'Paramètres réinitialisés avec succès',
  });
}));

// GET /api/settings/models - Récupérer les modèles disponibles
router.get('/models', asyncHandler(async (req, res) => {
  // TODO: Récupérer les modèles depuis le service Whisper
  const availableModels = [
    {
      name: 'tiny',
      description: 'Le plus rapide, moins précis (~39 MB)',
      size: '39MB',
      speed: 'Très rapide',
      accuracy: 'Faible',
    },
    {
      name: 'base',
      description: 'Équilibré entre vitesse et précision (~74 MB)',
      size: '74MB',
      speed: 'Rapide',
      accuracy: 'Moyenne',
    },
    {
      name: 'small',
      description: 'Plus précis, un peu plus lent (~244 MB)',
      size: '244MB',
      speed: 'Moyen',
      accuracy: 'Bonne',
    },
    {
      name: 'medium',
      description: 'Très précis (~769 MB)',
      size: '769MB',
      speed: 'Lent',
      accuracy: 'Très bonne',
    },
    {
      name: 'large',
      description: 'Maximum de précision (~1550 MB)',
      size: '1550MB',
      speed: 'Très lent',
      accuracy: 'Excellente',
    },
  ];
  
  res.json({
    success: true,
    data: availableModels,
  });
}));

// GET /api/settings/languages - Récupérer les langues supportées
router.get('/languages', asyncHandler(async (req, res) => {
  const supportedLanguages = [
    { code: 'fr', name: 'Français', nativeName: 'Français' },
    { code: 'en', name: 'Anglais', nativeName: 'English' },
    { code: 'es', name: 'Espagnol', nativeName: 'Español' },
    { code: 'de', name: 'Allemand', nativeName: 'Deutsch' },
    { code: 'it', name: 'Italien', nativeName: 'Italiano' },
  ];
  
  res.json({
    success: true,
    data: supportedLanguages,
  });
}));

export default router;
