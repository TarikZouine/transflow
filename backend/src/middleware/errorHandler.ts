import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface CustomError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log de l'erreur
  logger.error('Erreur dans l\'application:', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Définition du code de statut par défaut
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Erreur interne du serveur';

  // Gestion des erreurs spécifiques
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Données de validation invalides';
  }

  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'ID invalide';
  }

  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token invalide';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expiré';
  }

  if (error.name === 'MongoError' && (error as any).code === 11000) {
    statusCode = 400;
    message = 'Données dupliquées';
  }

  // Réponse d'erreur
  const errorResponse: any = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  };

  // En développement, inclure la stack trace
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = error;
  }

  res.status(statusCode).json(errorResponse);
};

// Middleware pour capturer les erreurs async
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Middleware pour les erreurs 404
export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  const error = new Error(`Route non trouvée - ${req.originalUrl}`) as CustomError;
  error.statusCode = 404;
  next(error);
};

// Classe d'erreur personnalisée
export class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
