import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { WhisperService } from './whisper';

interface SessionData {
  id: string;
  userId?: string;
  title: string;
  startTime: Date;
  isActive: boolean;
}

class WebSocketService {
  private io: SocketIOServer;
  private whisperService: WhisperService;
  private activeSessions: Map<string, SessionData> = new Map();
  private socketSessions: Map<string, string> = new Map(); // socketId -> sessionId

  constructor(io: SocketIOServer) {
    this.io = io;
    this.whisperService = new WhisperService();
  }

  public setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connecté: ${socket.id}`);

      // Événement de création de session
      socket.on('create_session', async (data) => {
        try {
          const sessionId = this.generateSessionId();
          const sessionData: SessionData = {
            id: sessionId,
            userId: data.userId,
            title: data.title || `Session ${new Date().toLocaleString('fr-FR')}`,
            startTime: new Date(),
            isActive: true,
          };

          this.activeSessions.set(sessionId, sessionData);
          this.socketSessions.set(socket.id, sessionId);

          // Rejoindre la room de la session
          socket.join(sessionId);

          socket.emit('session_created', {
            sessionId,
            title: sessionData.title,
            startTime: sessionData.startTime,
          });

          logger.info(`Session créée: ${sessionId} pour le socket ${socket.id}`);
        } catch (error) {
          logger.error('Erreur lors de la création de session:', error);
          socket.emit('error', { message: 'Erreur lors de la création de session' });
        }
      });

      // Événement de réception de chunk audio
      socket.on('audio_chunk', async (data) => {
        try {
          const sessionId = this.socketSessions.get(socket.id);
          if (!sessionId) {
            socket.emit('error', { message: 'Aucune session active' });
            return;
          }

          const session = this.activeSessions.get(sessionId);
          if (!session || !session.isActive) {
            socket.emit('error', { message: 'Session inactive' });
            return;
          }

          // Traitement du chunk audio avec Whisper
          const audioBuffer = Buffer.from(data.audioData);
          const transcriptionResult = await this.whisperService.transcribeAudio(audioBuffer);

          if (transcriptionResult && transcriptionResult.text.trim()) {
            // Diffuser la transcription à tous les clients de la session
            this.io.to(sessionId).emit('transcription_update', {
              sessionId,
              text: transcriptionResult.text,
              confidence: transcriptionResult.confidence,
              timestamp: Date.now(),
              speaker: data.speaker,
            });

            logger.debug(`Transcription envoyée pour la session ${sessionId}: ${transcriptionResult.text.substring(0, 50)}...`);
          }
        } catch (error) {
          logger.error('Erreur lors du traitement audio:', error);
          socket.emit('error', { message: 'Erreur lors du traitement audio' });
        }
      });

      // Événement de fin de session
      socket.on('end_session', async (data) => {
        try {
          const sessionId = data.sessionId || this.socketSessions.get(socket.id);
          if (!sessionId) {
            return;
          }

          const session = this.activeSessions.get(sessionId);
          if (session) {
            session.isActive = false;
            
            // Notification de fin de session
            this.io.to(sessionId).emit('session_ended', {
              sessionId,
              endTime: new Date(),
              duration: Date.now() - session.startTime.getTime(),
            });

            logger.info(`Session terminée: ${sessionId}`);
          }

          // Nettoyage
          socket.leave(sessionId);
          this.socketSessions.delete(socket.id);
        } catch (error) {
          logger.error('Erreur lors de la fin de session:', error);
          socket.emit('error', { message: 'Erreur lors de la fin de session' });
        }
      });

      // Événement de sauvegarde de session
      socket.on('save_session', async (data) => {
        try {
          const sessionId = data.sessionId;
          const session = this.activeSessions.get(sessionId);
          
          if (!session) {
            socket.emit('error', { message: 'Session non trouvée' });
            return;
          }

          // TODO: Sauvegarder en base de données
          logger.info(`Sauvegarde de la session: ${sessionId}`);
          
          socket.emit('session_saved', {
            sessionId,
            message: 'Session sauvegardée avec succès',
          });
        } catch (error) {
          logger.error('Erreur lors de la sauvegarde:', error);
          socket.emit('error', { message: 'Erreur lors de la sauvegarde' });
        }
      });

      // Événement de déconnexion
      socket.on('disconnect', (reason) => {
        logger.info(`Client déconnecté: ${socket.id} - Raison: ${reason}`);
        
        const sessionId = this.socketSessions.get(socket.id);
        if (sessionId) {
          const session = this.activeSessions.get(sessionId);
          if (session && session.isActive) {
            // Marquer la session comme inactive si c'était le dernier client
            const roomSize = this.io.sockets.adapter.rooms.get(sessionId)?.size || 0;
            if (roomSize <= 1) {
              session.isActive = false;
              logger.info(`Session ${sessionId} marquée comme inactive (dernier client déconnecté)`);
            }
          }
          
          this.socketSessions.delete(socket.id);
        }
      });

      // Événement de ping pour maintenir la connexion
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  public getActiveSessions(): SessionData[] {
    return Array.from(this.activeSessions.values()).filter(session => session.isActive);
  }

  public getSessionById(sessionId: string): SessionData | undefined {
    return this.activeSessions.get(sessionId);
  }
}

export const setupWebSocket = (io: SocketIOServer): WebSocketService => {
  const webSocketService = new WebSocketService(io);
  webSocketService.setupEventHandlers();
  
  logger.info('WebSocket service configuré');
  return webSocketService;
};
