// Streamer optimisé pour fichiers SLN (Signed Linear) d'Asterisk MixMonitor
const fs = require('fs');
const path = require('path');

/**
 * Streamer spécialisé pour les fichiers SLN d'Asterisk
 * Les fichiers SLN sont du raw audio 16-bit signed linear à 8kHz
 * Parfait pour le streaming temps réel car pas d'en-tête à parser
 */
class SLNStreamer {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.chunkSize = options.chunkSize || 4800; // 300ms à 8kHz (8000 samples/sec * 0.3s * 2 bytes/sample)
    this.isActive = true;
    this.lastFileSize = 0;
    this.stableCount = 0;
    this.maxStableCount = 50; // 5 secondes sans changement = fichier probablement terminé
    
    // Configuration audio SLN
    this.sampleRate = 8000; // Hz
    this.bitsPerSample = 16;
    this.channels = 1; // Mono
    this.bytesPerSample = 2; // 16-bit = 2 bytes
    
    // DÉMARRER quelques secondes avant la fin du fichier pour streaming temps réel
    try {
      const stats = fs.statSync(filePath);
      const secondsBeforeEnd = 15; // 15 secondes avant la fin pour éviter boucles sur appels actifs
      const bytesBeforeEnd = secondsBeforeEnd * this.sampleRate * this.bytesPerSample; // 15s * 8000Hz * 2bytes = 240000 bytes
      this.offset = Math.max(0, stats.size - bytesBeforeEnd);
      this.lastFileSize = stats.size;
      console.log(`🚀 Démarrage streaming ${secondsBeforeEnd}s avant la fin: offset ${this.offset} (taille: ${stats.size})`);
    } catch (error) {
      this.offset = 0;
      console.log(`⚠️ Impossible de lire la taille du fichier, démarrage à 0`);
    }
    
    console.log(`🎵 SLN Streamer initialisé pour: ${path.basename(filePath)}`);
    console.log(`📊 Chunk size: ${this.chunkSize} bytes (${this.getChunkDurationMs()}ms)`);
  }
  
  /**
   * Calcule la durée d'un chunk en millisecondes
   */
  getChunkDurationMs() {
    const samplesPerChunk = this.chunkSize / this.bytesPerSample;
    return Math.round((samplesPerChunk / this.sampleRate) * 1000);
  }
  
  /**
   * Vérifie si le fichier est encore en cours d'écriture par MixMonitor
   */
  checkIfFileIsGrowing() {
    try {
      const stats = fs.statSync(this.filePath);
      const currentSize = stats.size;
      
      if (currentSize > this.lastFileSize) {
        // Le fichier grandit, MixMonitor écrit encore
        this.lastFileSize = currentSize;
        this.stableCount = 0;
        return true;
      } else if (currentSize === this.lastFileSize) {
        // Taille stable, compter les vérifications
        this.stableCount++;
        
        // Si la taille est stable depuis trop longtemps, considérer comme terminé
        if (this.stableCount >= this.maxStableCount) {
          console.log(`📋 Fichier probablement terminé (stable depuis ${this.stableCount * 250}ms)`);
          return false;
        }
        // Pour streaming temps réel, si stable depuis 2 secondes = probablement fini
        if (this.stableCount >= 8) { // 8 * 250ms = 2 secondes
          console.log(`📋 Fichier stable depuis ${this.stableCount * 250}ms - ARRÊT streaming`);
          return false;
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification du fichier:', error.message);
      return false;
    }
  }
  
  /**
   * Lit le prochain chunk de données audio
   */
  readNextChunk() {
    try {
      if (!fs.existsSync(this.filePath)) {
        console.log('📁 Fichier n\'existe plus');
        return null;
      }
      
      const stats = fs.statSync(this.filePath);
      const fileSize = stats.size;
      
      // Si on a atteint la fin du fichier actuel
      if (this.offset >= fileSize) {
        // Vérifier si le fichier grandit encore
        if (this.checkIfFileIsGrowing()) {
          return { waiting: true, reason: 'Fichier en croissance...' };
        } else {
          // Fichier stable = terminé
          return null;
        }
      }
      
      // Calculer la taille du chunk à lire
      const remainingBytes = fileSize - this.offset;
      let actualChunkSize = Math.min(this.chunkSize, remainingBytes);
      
      // Si on est très proche de la fin du fichier (chunk incomplet)
      if (actualChunkSize < this.chunkSize && actualChunkSize > 0) {
        // Attendre que le fichier grandisse pour avoir un chunk complet
        const currentStats = fs.statSync(this.filePath);
        if (currentStats.size > fileSize) {
          // Le fichier a grandi depuis la dernière vérification, recalculer
          const newRemainingBytes = currentStats.size - this.offset;
          actualChunkSize = Math.min(this.chunkSize, newRemainingBytes);
        } else {
          // Fichier n'a pas grandi, attendre un chunk complet
          return { waiting: true, reason: `Chunk incomplet (${actualChunkSize}/${this.chunkSize}), attente...` };
        }
      }
      
      if (actualChunkSize === 0) {
        return { waiting: true, reason: 'En attente de nouvelles données...' };
      }
      
      // Lire le chunk
      const fd = fs.openSync(this.filePath, 'r');
      const buffer = Buffer.alloc(actualChunkSize);
      const bytesRead = fs.readSync(fd, buffer, 0, actualChunkSize, this.offset);
      fs.closeSync(fd);
      
      if (bytesRead > 0) {
        this.offset += bytesRead;
        
        return {
          data: buffer.slice(0, bytesRead),
          offset: this.offset,
          fileSize: fileSize,
          progress: (this.offset / fileSize) * 100,
          chunkNumber: Math.floor(this.offset / this.chunkSize),
          isComplete: this.offset >= fileSize && !this.checkIfFileIsGrowing()
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur lors de la lecture du chunk:', error.message);
      return null;
    }
  }
  
  /**
   * Convertit les données SLN en WAV pour la compatibilité navigateur
   */
  slnToWav(slnData) {
    const sampleRate = this.sampleRate;
    const numChannels = this.channels;
    const bitsPerSample = this.bitsPerSample;
    const dataLength = slnData.length;
    
    // Calcul des tailles
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const wavHeaderSize = 44;
    const totalSize = wavHeaderSize + dataLength;
    
    // Créer le buffer WAV
    const wavBuffer = Buffer.alloc(totalSize);
    let offset = 0;
    
    // En-tête RIFF
    wavBuffer.write('RIFF', offset); offset += 4;
    wavBuffer.writeUInt32LE(totalSize - 8, offset); offset += 4;
    wavBuffer.write('WAVE', offset); offset += 4;
    
    // Sous-chunk fmt
    wavBuffer.write('fmt ', offset); offset += 4;
    wavBuffer.writeUInt32LE(16, offset); offset += 4; // Taille du sous-chunk fmt
    wavBuffer.writeUInt16LE(1, offset); offset += 2;  // Format audio (PCM)
    wavBuffer.writeUInt16LE(numChannels, offset); offset += 2;
    wavBuffer.writeUInt32LE(sampleRate, offset); offset += 4;
    wavBuffer.writeUInt32LE(byteRate, offset); offset += 4;
    wavBuffer.writeUInt16LE(blockAlign, offset); offset += 2;
    wavBuffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
    
    // Sous-chunk data
    wavBuffer.write('data', offset); offset += 4;
    wavBuffer.writeUInt32LE(dataLength, offset); offset += 4;
    
    // Copier les données audio
    slnData.copy(wavBuffer, offset);
    
    return wavBuffer;
  }
  
  /**
   * Remet le streamer au début
   */
  reset() {
    this.offset = 0;
    this.lastFileSize = 0;
    this.stableCount = 0;
    console.log('🔄 Streamer remis à zéro');
  }
  
  /**
   * Obtient des informations sur le fichier
   */
  getFileInfo() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return null;
      }
      
      const stats = fs.statSync(this.filePath);
      const durationSeconds = (stats.size / this.bytesPerSample / this.sampleRate);
      
      return {
        filePath: this.filePath,
        fileName: path.basename(this.filePath),
        fileSize: stats.size,
        durationSeconds: durationSeconds,
        durationFormatted: this.formatDuration(durationSeconds),
        sampleRate: this.sampleRate,
        bitsPerSample: this.bitsPerSample,
        channels: this.channels,
        lastModified: stats.mtime,
        isActive: this.checkIfFileIsGrowing()
      };
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des infos fichier:', error.message);
      return null;
    }
  }
  
  /**
   * Formate une durée en secondes vers mm:ss
   */
  formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

module.exports = SLNStreamer;

