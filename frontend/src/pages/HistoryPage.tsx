import React from 'react';
import {
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
} from '@mui/material';
import {
  PlayArrow,
  Download,
  Delete,
  Visibility,
} from '@mui/icons-material';

// Données de test - à remplacer par des données réelles
const mockSessions = [
  {
    id: '1',
    title: 'Réunion équipe - 15/01/2024',
    date: '2024-01-15T14:30:00Z',
    duration: 3600000, // 1 heure en ms
    status: 'completed',
    participants: ['John Doe', 'Jane Smith'],
    transcriptionLength: 1250,
  },
  {
    id: '2',
    title: 'Call client ABC Corp',
    date: '2024-01-14T10:15:00Z',
    duration: 1800000, // 30 minutes en ms
    status: 'completed',
    participants: ['Client ABC'],
    transcriptionLength: 800,
  },
];

const HistoryPage: React.FC = () => {
  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}min`;
    }
    return `${remainingMinutes}min`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'completed': return 'success';
      case 'active': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'completed': return 'Terminée';
      case 'active': return 'En cours';
      case 'error': return 'Erreur';
      default: return 'Inconnu';
    }
  };

  const handleView = (sessionId: string): void => {
    console.log('Voir session:', sessionId);
    // TODO: Implémenter la navigation vers les détails de la session
  };

  const handleDownload = (sessionId: string): void => {
    console.log('Télécharger session:', sessionId);
    // TODO: Implémenter le téléchargement de la transcription
  };

  const handleDelete = (sessionId: string): void => {
    console.log('Supprimer session:', sessionId);
    // TODO: Implémenter la suppression avec confirmation
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Historique des sessions
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        Consultez et gérez toutes vos sessions de transcription passées
      </Typography>

      <TableContainer component={Paper} elevation={3}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Titre</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Durée</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell>Participants</TableCell>
              <TableCell>Mots transcrits</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Aucune session trouvée
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              mockSessions.map((session) => (
                <TableRow key={session.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">
                      {session.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {formatDate(session.date)}
                  </TableCell>
                  <TableCell>
                    {formatDuration(session.duration)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(session.status)}
                      color={getStatusColor(session.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {session.participants.join(', ')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {session.transcriptionLength.toLocaleString()} mots
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleView(session.id)}
                        title="Voir les détails"
                      >
                        <Visibility />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDownload(session.id)}
                        title="Télécharger"
                      >
                        <Download />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(session.id)}
                        title="Supprimer"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {mockSessions.length === 0 && (
        <Paper elevation={1} sx={{ p: 3, mt: 3, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Aucune session disponible
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Commencez votre première session de transcription pour voir l'historique ici.
          </Typography>
          <Button variant="contained" href="/transcription">
            Démarrer une session
          </Button>
        </Paper>
      )}
    </Box>
  );
};

export default HistoryPage;
