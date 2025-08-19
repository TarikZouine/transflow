// Configuration d'authentification
// ATTENTION: Ce mot de passe est en dur et doit être changé en production
export const AUTH_CONFIG = {
  // Mot de passe principal pour accéder à l'application
  PASSWORD: import.meta.env.VITE_APP_PASSWORD || 'TransFlow2024!',
  
  // Durée de session en heures (0 = pas d'expiration)
  SESSION_DURATION_HOURS: 24,
  
  // Clé de stockage local
  STORAGE_KEY: 'transflow_auth',
  
  // Messages d'erreur
  MESSAGES: {
    INVALID_PASSWORD: 'Mot de passe incorrect',
    SESSION_EXPIRED: 'Session expirée, veuillez vous reconnecter',
    LOGIN_REQUIRED: 'Veuillez vous connecter pour accéder à cette page',
  },
} as const;

// Fonction pour vérifier si le mot de passe est valide
export const isValidPassword = (password: string): boolean => {
  return password === AUTH_CONFIG.PASSWORD;
};

// Fonction pour obtenir le mot de passe (pour debug uniquement)
export const getPassword = (): string => {
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️  Mot de passe de développement:', AUTH_CONFIG.PASSWORD);
  }
  return AUTH_CONFIG.PASSWORD;
};
