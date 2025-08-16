import express from 'express';
import { CallMonitorService } from '../services/callMonitor';

const router = express.Router();
const callMonitor = new CallMonitorService();

// Démarrer le monitoring automatique
callMonitor.startMonitoring(5000); // Scan toutes les 5 secondes

// GET /api/calls/active - Récupérer les appels en cours
router.get('/active', (req, res) => {
  try {
    const activeCalls = callMonitor.getActiveCalls();
    
    res.json({
      success: true,
      data: activeCalls.map(call => ({
        id: call.callId,
        phoneNumber: call.phoneNumber,
        startTime: call.startTime,
        lastActivity: call.lastActivity,
        duration: call.duration,
        status: call.status,
        hasClientFile: !!call.clientFile,
        hasAgentFile: !!call.agentFile,
        clientFileSize: call.clientFile?.size || 0,
        agentFileSize: call.agentFile?.size || 0,
      })),
      count: activeCalls.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des appels actifs',
    });
  }
});

// GET /api/calls - Récupérer tous les appels (actifs + récents)
router.get('/', (req, res) => {
  try {
    // Forcer un scan avant de retourner les données
    callMonitor.scanDirectory();
    const allCalls = callMonitor.getAllCalls();
    
    res.json({
      success: true,
      data: allCalls.map(call => ({
        id: call.callId,
        phoneNumber: call.phoneNumber,
        startTime: call.startTime,
        lastActivity: call.lastActivity,
        duration: call.duration,
        status: call.status,
        hasClientFile: !!call.clientFile,
        hasAgentFile: !!call.agentFile,
        clientFileSize: call.clientFile?.size || 0,
        agentFileSize: call.agentFile?.size || 0,
      })),
      count: allCalls.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des appels',
    });
  }
});

// GET /api/calls/:id - Récupérer un appel spécifique
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const call = callMonitor.getCall(id);
    
    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Appel non trouvé',
      });
    }
    
    res.json({
      success: true,
      data: {
        id: call.callId,
        phoneNumber: call.phoneNumber,
        startTime: call.startTime,
        lastActivity: call.lastActivity,
        duration: call.duration,
        status: call.status,
        clientFile: call.clientFile ? {
          path: call.clientFile.filePath,
          size: call.clientFile.size,
          lastModified: call.clientFile.lastModified,
        } : null,
        agentFile: call.agentFile ? {
          path: call.agentFile.filePath,
          size: call.agentFile.size,
          lastModified: call.agentFile.lastModified,
        } : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'appel',
    });
  }
});

// GET /api/calls/stats - Statistiques des appels
router.get('/stats', (req, res) => {
  try {
    const stats = callMonitor.getStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques',
    });
  }
});

// POST /api/calls/:id/transcribe - Transcrire un appel
router.post('/:id/transcribe', async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'both' } = req.body; // 'client', 'agent', ou 'both'
    
    const call = callMonitor.getCall(id);
    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Appel non trouvé',
      });
    }

    // TODO: Implémenter la transcription via le service Whisper
    // Pour l'instant, on retourne une réponse simulée
    
    const transcriptionResults = [];
    
    if ((type === 'client' || type === 'both') && call.clientFile) {
      transcriptionResults.push({
        type: 'client',
        file: call.clientFile.filePath,
        text: `[Transcription simulée du client] Appel ${call.phoneNumber}...`,
        confidence: 0.85,
      });
    }
    
    if ((type === 'agent' || type === 'both') && call.agentFile) {
      transcriptionResults.push({
        type: 'agent',
        file: call.agentFile.filePath,
        text: `[Transcription simulée de l'agent] Réponse à ${call.phoneNumber}...`,
        confidence: 0.88,
      });
    }

    res.json({
      success: true,
      data: {
        callId: id,
        transcriptions: transcriptionResults,
      },
      message: 'Transcription terminée',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la transcription',
    });
  }
});

export default router;
