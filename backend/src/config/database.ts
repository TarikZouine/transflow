import mongoose from 'mongoose';
import { logger } from '../utils/logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/transflow';

export const connectDatabase = async (): Promise<void> => {
  try {
    const options = {
      maxPoolSize: 10, // Maintenir jusqu'à 10 connexions socket
      serverSelectionTimeoutMS: 5000, // Garder en essayant d'envoyer des opérations pendant 5 secondes
      socketTimeoutMS: 45000, // Fermer les sockets après 45 secondes d'inactivité
      bufferMaxEntries: 0, // Désactiver le buffering mongoose
      bufferCommands: false, // Désactiver le buffering des commandes mongoose
    };

    await mongoose.connect(MONGODB_URI, options);
    
    logger.info(`✅ Base de données connectée: ${MONGODB_URI}`);
    
    // Gestion des événements de connexion
    mongoose.connection.on('error', (error) => {
      logger.error('Erreur de base de données:', error);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('Base de données déconnectée');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('Base de données reconnectée');
    });
    
  } catch (error) {
    logger.error('Erreur de connexion à la base de données:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('Base de données déconnectée proprement');
  } catch (error) {
    logger.error('Erreur lors de la déconnexion de la base de données:', error);
    throw error;
  }
};
