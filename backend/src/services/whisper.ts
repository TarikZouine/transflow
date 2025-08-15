import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  processingTime: number;
}

export class WhisperService {
  private whisperApiUrl: string;
  private tempDir: string;
  private defaultModel: string;
  private defaultLanguage: string;

  constructor() {
    this.whisperApiUrl = process.env.WHISPER_API_URL || 'http://localhost:8000';
    this.tempDir = process.env.TEMP_DIR || path.join(process.cwd(), 'temp');
    this.defaultModel = process.env.WHISPER_MODEL || 'base';
    this.defaultLanguage = process.env.WHISPER_LANGUAGE || 'fr';
    
    // Créer le dossier temporaire s'il n'existe pas
    fs.ensureDirSync(this.tempDir);
  }

  /**
   * Transcrit un buffer audio en utilisant le service Whisper
   */
  public async transcribeAudio(
    audioBuffer: Buffer,
    options: {
      model?: string;
      language?: string;
      task?: 'transcribe' | 'translate';
    } = {}
  ): Promise<TranscriptionResult | null> {
    const startTime = Date.now();
    let tempFilePath: string | null = null;

    try {
      // Créer un fichier temporaire pour l'audio
      const tempFileName = `audio_${uuidv4()}.wav`;
      tempFilePath = path.join(this.tempDir, tempFileName);
      
      await fs.writeFile(tempFilePath, audioBuffer);

      // Préparer les données pour l'API Whisper
      const formData = new FormData();
      formData.append('audio', fs.createReadStream(tempFilePath));
      formData.append('model', options.model || this.defaultModel);
      formData.append('language', options.language || this.defaultLanguage);
      formData.append('task', options.task || 'transcribe');
      formData.append('response_format', 'json');

      // Appel à l'API Whisper
      const response = await fetch(`${this.whisperApiUrl}/v1/audio/transcriptions`, {
        method: 'POST',
        body: formData,
        timeout: 30000, // 30 secondes de timeout
      });

      if (!response.ok) {
        throw new Error(`Erreur API Whisper: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;
      const processingTime = Date.now() - startTime;

      if (!result.text) {
        logger.warn('Aucun texte retourné par Whisper');
        return null;
      }

      const transcriptionResult: TranscriptionResult = {
        text: result.text.trim(),
        confidence: result.confidence || 0.8, // Whisper ne retourne pas toujours la confidence
        language: result.language || options.language || this.defaultLanguage,
        processingTime,
      };

      logger.debug(`Transcription réussie en ${processingTime}ms: "${transcriptionResult.text.substring(0, 50)}..."`);
      
      return transcriptionResult;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`Erreur lors de la transcription (${processingTime}ms):`, error);
      
      // En cas d'erreur de connexion au service Whisper, retourner un résultat de fallback
      if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
        logger.warn('Service Whisper indisponible, utilisation du mode dégradé');
        return {
          text: '[Service de transcription temporairement indisponible]',
          confidence: 0.0,
          language: this.defaultLanguage,
          processingTime,
        };
      }

      return null;

    } finally {
      // Nettoyage du fichier temporaire
      if (tempFilePath && await fs.pathExists(tempFilePath)) {
        try {
          await fs.remove(tempFilePath);
        } catch (cleanupError) {
          logger.warn('Erreur lors du nettoyage du fichier temporaire:', cleanupError);
        }
      }
    }
  }

  /**
   * Transcrit un fichier audio complet
   */
  public async transcribeFile(
    filePath: string,
    options: {
      model?: string;
      language?: string;
      task?: 'transcribe' | 'translate';
    } = {}
  ): Promise<TranscriptionResult | null> {
    try {
      const audioBuffer = await fs.readFile(filePath);
      return await this.transcribeAudio(audioBuffer, options);
    } catch (error) {
      logger.error('Erreur lors de la lecture du fichier audio:', error);
      return null;
    }
  }

  /**
   * Vérifie la santé du service Whisper
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.whisperApiUrl}/health`, {
        method: 'GET',
        timeout: 5000,
      });
      
      return response.ok;
    } catch (error) {
      logger.warn('Service Whisper non disponible:', error.message);
      return false;
    }
  }

  /**
   * Obtient les modèles disponibles
   */
  public async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.whisperApiUrl}/v1/models`, {
        method: 'GET',
        timeout: 5000,
      });

      if (!response.ok) {
        throw new Error('Impossible de récupérer les modèles');
      }

      const data = await response.json() as any;
      return data.models || ['tiny', 'base', 'small', 'medium', 'large'];
    } catch (error) {
      logger.warn('Impossible de récupérer les modèles Whisper:', error);
      return ['tiny', 'base', 'small', 'medium', 'large'];
    }
  }

  /**
   * Nettoie les fichiers temporaires anciens
   */
  public async cleanupTempFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 60 * 60 * 1000; // 1 heure

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.remove(filePath);
          logger.debug(`Fichier temporaire supprimé: ${file}`);
        }
      }
    } catch (error) {
      logger.warn('Erreur lors du nettoyage des fichiers temporaires:', error);
    }
  }
}
