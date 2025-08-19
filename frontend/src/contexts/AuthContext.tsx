import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AUTH_CONFIG, isValidPassword } from '../config/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà connecté au chargement de l'app
    const checkAuthStatus = () => {
      try {
        const authStatus = localStorage.getItem(AUTH_CONFIG.STORAGE_KEY);
        const timestamp = localStorage.getItem(`${AUTH_CONFIG.STORAGE_KEY}_timestamp`);
        
        if (authStatus === 'true' && timestamp) {
          const sessionAge = Date.now() - parseInt(timestamp);
          const maxSessionAge = AUTH_CONFIG.SESSION_DURATION_HOURS * 60 * 60 * 1000; // en millisecondes
          
          // Vérifier si la session n'a pas expiré
          if (AUTH_CONFIG.SESSION_DURATION_HOURS === 0 || sessionAge < maxSessionAge) {
            setIsAuthenticated(true);
            console.log('Session valide trouvée, utilisateur authentifié');
          } else {
            // Session expirée, nettoyer
            console.log('Session expirée, nettoyage...');
            localStorage.removeItem(AUTH_CONFIG.STORAGE_KEY);
            localStorage.removeItem(`${AUTH_CONFIG.STORAGE_KEY}_timestamp`);
            setIsAuthenticated(false);
          }
        } else {
          console.log('Aucune session valide trouvée');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    // Vérifier immédiatement
    checkAuthStatus();
  }, []);

  const login = (password: string): boolean => {
    if (isValidPassword(password)) {
      try {
        setIsAuthenticated(true);
        localStorage.setItem(AUTH_CONFIG.STORAGE_KEY, 'true');
        // Ajouter un timestamp pour la session
        localStorage.setItem(`${AUTH_CONFIG.STORAGE_KEY}_timestamp`, Date.now().toString());
        return true;
      } catch (error) {
        console.error('Erreur lors de la sauvegarde de l\'authentification:', error);
        return false;
      }
    }
    return false;
  };

  const logout = () => {
    try {
      setIsAuthenticated(false);
      localStorage.removeItem(AUTH_CONFIG.STORAGE_KEY);
      localStorage.removeItem(`${AUTH_CONFIG.STORAGE_KEY}_timestamp`);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
