import React from 'react';
import { Box, Chip, Typography, Button } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { AUTH_CONFIG } from '../config/auth';

const AuthStatus: React.FC = () => {
  const { isAuthenticated, isLoading, logout } = useAuth();

  return (
    <Box sx={{ p: 2, border: '1px solid #ddd', borderRadius: 1, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Statut d'authentification
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
        <Typography variant="body2">
          Statut:
        </Typography>
        <Chip
          label={isLoading ? 'Chargement...' : (isAuthenticated ? 'Connecté' : 'Non connecté')}
          color={isLoading ? 'warning' : (isAuthenticated ? 'success' : 'error')}
          size="small"
        />
      </Box>

      {isAuthenticated && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography variant="body2">
            Mot de passe configuré: {AUTH_CONFIG.PASSWORD ? 'Oui' : 'Non'}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={logout}
            color="warning"
          >
            Déconnexion
          </Button>
        </Box>
      )}

      <Box sx={{ mt: 2, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Clé de stockage: {AUTH_CONFIG.STORAGE_KEY}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Durée de session: {AUTH_CONFIG.SESSION_DURATION_HOURS}h
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          LocalStorage disponible: {typeof localStorage !== 'undefined' ? 'Oui' : 'Non'}
        </Typography>
        {isAuthenticated && (
          <Typography variant="caption" color="text.secondary" display="block">
            Timestamp session: {localStorage.getItem(`${AUTH_CONFIG.STORAGE_KEY}_timestamp`) || 'Non défini'}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default AuthStatus;
