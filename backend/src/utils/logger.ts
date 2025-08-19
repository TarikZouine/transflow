import winston from 'winston';
import path from 'path';

// Configuration des niveaux de log
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Configuration des couleurs pour la console
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Format pour la console
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Format pour les fichiers
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Configuration des transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),
  
  // Fichier pour toutes les erreurs
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    format: fileFormat,
  }),
  
  // Fichier pour tous les logs
  new winston.transports.File({
    filename: path.join('logs', 'combined.log'),
    format: fileFormat,
  }),
];

// Création du logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: fileFormat,
  transports,
  exitOnError: false,
});

// En production, ne pas logger sur la console
if (process.env.NODE_ENV === 'production') {
  const consoleTransport = logger.transports.find(t => t.constructor.name === 'Console');
  if (consoleTransport) {
    logger.remove(consoleTransport); // Retire le transport console
  }
}

// Fonction utilitaire pour logger les requêtes HTTP
export const logRequest = (req: any, res: any, responseTime?: number): void => {
  const message = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${req.ip} - ${responseTime || 0}ms`;
  
  if (res.statusCode >= 400) {
    logger.error(message);
  } else {
    logger.http(message);
  }
};

// Fonction utilitaire pour logger les erreurs avec contexte
export const logError = (error: Error, context?: string): void => {
  const message = context ? `[${context}] ${error.message}` : error.message;
  logger.error(message, {
    stack: error.stack,
    context,
  });
};

export default logger;
