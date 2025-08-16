import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface CallFile {
  timestamp: number;
  callId: string;
  phoneNumber: string;
  type: 'in' | 'out';
  filePath: string;
  size: number;
  lastModified: Date;
}

export interface ActiveCall {
  callId: string;
  phoneNumber: string;
  startTime: Date;
  lastActivity: Date;
  duration: number;
  clientFile: CallFile | null;
  agentFile: CallFile | null;
  status: 'active' | 'completed';
}

export class CallMonitorService {
  private monitorPath: string;
  private activeCalls: Map<string, ActiveCall> = new Map();
  private readonly ACTIVE_THRESHOLD = 30 * 1000; // 30 secondes

  constructor(monitorPath: string = '/home/nfs_proxip_monitor/') {
    this.monitorPath = monitorPath;
  }

  /**
   * Parse le nom de fichier pour extraire les informations
   * Format: timestamp.sessionId-phoneNumber-type.wav
   */
  private parseFileName(fileName: string): CallFile | null {
    try {
      const match = fileName.match(/^(\d+\.\d+)-(.+)-(in|out)\.wav$/);
      if (!match) {
        return null;
      }

      const [, timestampStr, phoneNumber, type] = match;
      const timestamp = parseFloat(timestampStr);
      const callId = `${timestampStr}-${phoneNumber}`;

      const filePath = path.join(this.monitorPath, fileName);
      const stats = fs.statSync(filePath);

      return {
        timestamp,
        callId,
        phoneNumber,
        type: type as 'in' | 'out',
        filePath,
        size: stats.size,
        lastModified: stats.mtime,
      };
    } catch (error) {
      logger.error(`Erreur lors du parsing du fichier ${fileName}:`, error);
      return null;
    }
  }

  /**
   * Scan le répertoire et met à jour la liste des appels
   */
  public scanDirectory(): ActiveCall[] {
    try {
      if (!fs.existsSync(this.monitorPath)) {
        logger.warn(`Répertoire de monitoring non trouvé: ${this.monitorPath}`);
        return [];
      }

      const files = fs.readdirSync(this.monitorPath);
      const wavFiles = files.filter(file => file.endsWith('.wav'));

      // Parse tous les fichiers WAV
      const callFiles: CallFile[] = [];
      for (const file of wavFiles) {
        const callFile = this.parseFileName(file);
        if (callFile) {
          callFiles.push(callFile);
        }
      }

      // Groupe par callId
      const callGroups = new Map<string, { in?: CallFile; out?: CallFile }>();
      for (const file of callFiles) {
        if (!callGroups.has(file.callId)) {
          callGroups.set(file.callId, {});
        }
        const group = callGroups.get(file.callId)!;
        group[file.type] = file;
      }

      // Crée ou met à jour les appels actifs
      const now = new Date();
      const updatedCalls: ActiveCall[] = [];

      for (const [callId, group] of callGroups) {
        const clientFile = group.in || null;
        const agentFile = group.out || null;

        // Détermine la dernière activité
        let lastActivity = new Date(0);
        if (clientFile && clientFile.lastModified > lastActivity) {
          lastActivity = clientFile.lastModified;
        }
        if (agentFile && agentFile.lastModified > lastActivity) {
          lastActivity = agentFile.lastModified;
        }

        // Vérifie si l'appel est encore actif (modifié dans les 30 dernières secondes)
        const timeSinceLastActivity = now.getTime() - lastActivity.getTime();
        const isActive = timeSinceLastActivity <= this.ACTIVE_THRESHOLD;

        if (isActive || this.activeCalls.has(callId)) {
          const existingCall = this.activeCalls.get(callId);
          const startTime = existingCall?.startTime || lastActivity;
          const duration = now.getTime() - startTime.getTime();

          const activeCall: ActiveCall = {
            callId,
            phoneNumber: clientFile?.phoneNumber || agentFile?.phoneNumber || 'Unknown',
            startTime,
            lastActivity,
            duration,
            clientFile,
            agentFile,
            status: isActive ? 'active' : 'completed',
          };

          this.activeCalls.set(callId, activeCall);
          updatedCalls.push(activeCall);

          // Log des nouveaux appels
          if (!existingCall) {
            logger.info(`Nouvel appel détecté: ${callId} (${activeCall.phoneNumber})`);
          }
        }
      }

      // Nettoie les anciens appels inactifs
      this.cleanupInactiveCalls();

      return updatedCalls;
    } catch (error) {
      logger.error('Erreur lors du scan du répertoire:', error);
      return [];
    }
  }

  /**
   * Nettoie les appels inactifs depuis plus de 5 minutes
   */
  private cleanupInactiveCalls(): void {
    const now = new Date();
    const cleanupThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [callId, call] of this.activeCalls) {
      const timeSinceLastActivity = now.getTime() - call.lastActivity.getTime();
      if (timeSinceLastActivity > cleanupThreshold && call.status === 'completed') {
        this.activeCalls.delete(callId);
        logger.info(`Appel nettoyé: ${callId}`);
      }
    }
  }

  /**
   * Retourne tous les appels actifs
   */
  public getActiveCalls(): ActiveCall[] {
    return Array.from(this.activeCalls.values())
      .filter(call => call.status === 'active')
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  /**
   * Retourne tous les appels (actifs et récemment terminés)
   */
  public getAllCalls(): ActiveCall[] {
    return Array.from(this.activeCalls.values())
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  /**
   * Retourne un appel spécifique
   */
  public getCall(callId: string): ActiveCall | null {
    return this.activeCalls.get(callId) || null;
  }

  /**
   * Démarre le monitoring automatique
   */
  public startMonitoring(intervalMs: number = 5000): NodeJS.Timeout {
    logger.info(`Démarrage du monitoring des appels (intervalle: ${intervalMs}ms)`);
    
    // Scan initial
    this.scanDirectory();
    
    // Scan périodique
    return setInterval(() => {
      this.scanDirectory();
    }, intervalMs);
  }

  /**
   * Retourne les statistiques
   */
  public getStats() {
    const allCalls = Array.from(this.activeCalls.values());
    const activeCalls = allCalls.filter(call => call.status === 'active');
    
    return {
      totalCalls: allCalls.length,
      activeCalls: activeCalls.length,
      completedCalls: allCalls.length - activeCalls.length,
      monitorPath: this.monitorPath,
      lastScan: new Date(),
    };
  }
}
