import React, { useState, useEffect } from 'react';
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
  Switch,
  FormControlLabel,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  Phone,
  PhoneInTalk,
  Refresh,
  Transcribe,
  PlayArrow,
  Stop,
  Headphones,
} from '@mui/icons-material';
import apiService from '../services/api';
import TrueRealTimePlayer from '../components/TrueRealTimePlayer';
import { subscribeToCall } from '../services/ws';

interface Call {
  id: string;
  phoneNumber: string;
  calledNumber?: string;
  startTime: string;
  lastActivity: string;
  duration: number;
  status: 'active' | 'completed';
  hasClientFile: boolean;
  hasAgentFile: boolean;
  clientFileSize: number;
  agentFileSize: number;
}

const CallsPage: React.FC = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const [liveTranscripts, setLiveTranscripts] = useState<Record<string, string[]>>({});

  // Fonction pour récupérer les appels
  const fetchCalls = async () => {
    try {
      setError(null);
      
      console.log('Fetching calls, showActiveOnly:', showActiveOnly);
      
      const data = showActiveOnly 
        ? await apiService.getActiveCalls()
        : await apiService.getCalls();
      
      console.log('API Response:', data);
      
      if (data.success) {
        setCalls(data.data);
        console.log('Calls loaded:', data.data.length);
      } else {
        setError('Erreur lors de la récupération des appels');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Erreur de connexion: ${errorMessage}`);
      console.error('Erreur fetch appels:', err);
    } finally {
      setLoading(false);
    }
  };

  // Effet pour le chargement initial et le rafraîchissement automatique
  useEffect(() => {
    fetchCalls();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchCalls, 5000); // Rafraîchir toutes les 5 secondes
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, showActiveOnly]);

  // S'abonner aux transcripts live pour l'appel en cours
  useEffect(() => {
    if (!playingCallId) return;
    const baseUrl = (import.meta as any).env?.VITE_API_URL?.replace('/api','')
      || (import.meta as any).env?.VITE_API_BASE?.replace('/api','')
      || 'http://ai.intelios.us:5002';
    const unsubscribe = subscribeToCall(baseUrl, playingCallId, (t: any) => {
      setLiveTranscripts((prev) => {
        const arr = prev[playingCallId] ? [...prev[playingCallId]] : [];
        arr.push(`${new Date(t.tsMs).toLocaleTimeString()} — ${t.text}`);
        return { ...prev, [playingCallId]: arr.slice(-100) };
      });
    });
    return () => unsubscribe();
  }, [playingCallId]);

  // Formater la durée
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Formater la taille de fichier en octets avec séparateurs
  const formatFileSize = (bytes: number): string => {
    return bytes.toLocaleString('fr-FR') + ' o';
  };

  // Formater l'heure
  const formatTime = (dateString: string): string => {
    return new Date(dateString).toLocaleTimeString('fr-FR');
  };

  // Couleur du statut
  const getStatusColor = (status: string): 'success' | 'default' => {
    return status === 'active' ? 'success' : 'default';
  };

  // Transcription d'un appel (simulée)
  const handleTranscribe = async (callId: string) => {
    try {
      // TODO: Implémenter la vraie transcription
      console.log('Transcription de l\'appel:', callId);
      // Simuler un délai de transcription
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Erreur transcription:', error);
    }
  };

  // Lecture audio d'un appel
  const handlePlayAudio = (callId: string) => {
    if (playingCallId === callId) {
      // Arrêter la lecture si c'est déjà en cours
      setPlayingCallId(null);
    } else {
      // TOUJOURS fermer le lecteur précédent et ouvrir le nouveau
      // Cela évite les connexions multiples côté serveur
      setPlayingCallId(null); // Fermer d'abord
      setTimeout(() => {
        setPlayingCallId(callId); // Puis ouvrir le nouveau
      }, 100); // Petit délai pour que la fermeture soit effective
    }
  };

  // Fermer le lecteur audio
  const handleCloseAudioPlayer = () => {
    setPlayingCallId(null);
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Appels en Temps Réel
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        Surveillance des appels dans /home/nfs_proxip_monitor/
      </Typography>

      {/* Contrôles */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
              />
            }
            label="Appels en cours seulement"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            }
            label="Rafraîchissement automatique"
          />
          
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchCalls}
            disabled={loading}
          >
            Actualiser
          </Button>
          
          <Typography variant="body2" color="text.secondary">
            {calls.length} appel(s) trouvé(s)
          </Typography>
        </Box>
      </Paper>

      {/* Barre de progression */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Message d'erreur */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Tableau des appels */}
      <TableContainer component={Paper} elevation={3}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Statut</TableCell>
              <TableCell>Appelant</TableCell>
              <TableCell>Appelé</TableCell>
              <TableCell>Heure début</TableCell>
              <TableCell>Durée</TableCell>
              <TableCell>Dernière activité</TableCell>
              <TableCell>Fichiers</TableCell>
              <TableCell>Taille</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {calls.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    {showActiveOnly ? 'Aucun appel en cours' : 'Aucun appel trouvé'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              calls.map((call) => (
                <TableRow key={call.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {call.status === 'active' ? (
                        <PhoneInTalk color="success" />
                      ) : (
                        <Phone color="disabled" />
                      )}
                      <Chip
                        label={call.status === 'active' ? 'En cours' : 'Terminé'}
                        color={getStatusColor(call.status)}
                        size="small"
                      />
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="subtitle2" fontFamily="monospace">
                      {call.phoneNumber}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    {call.calledNumber ? (
                      <Typography variant="subtitle2" fontFamily="monospace" color="primary">
                        {call.calledNumber}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.disabled">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {formatTime(call.startTime)}
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {formatDuration(call.duration)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatTime(call.lastActivity)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {call.hasClientFile && (
                        <Chip label="Client" size="small" variant="outlined" />
                      )}
                      {call.hasAgentFile && (
                        <Chip label="Agent" size="small" variant="outlined" />
                      )}
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {call.hasClientFile && (
                        <Typography variant="caption" fontFamily="monospace" color="primary">
                          C: {formatFileSize(call.clientFileSize)}
                        </Typography>
                      )}
                      {call.hasAgentFile && (
                        <Typography variant="caption" fontFamily="monospace" color="secondary">
                          A: {formatFileSize(call.agentFileSize)}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handlePlayAudio(call.id)}
                        title={playingCallId === call.id ? "Arrêter la lecture" : "Écouter l'appel"}
                        color={playingCallId === call.id ? "secondary" : "default"}
                        disabled={!call.hasClientFile && !call.hasAgentFile}
                      >
                        {playingCallId === call.id ? <Stop /> : <Headphones />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleTranscribe(call.id)}
                        title="Transcrire"
                        disabled={call.status === 'active'}
                      >
                        <Transcribe />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Lecteur Audio */}
      {playingCallId && (
        (() => {
          const playingCall = calls.find(call => call.id === playingCallId);
          if (!playingCall) return null;
          
          return (
            <TrueRealTimePlayer
              callId={playingCall.id}
              phoneNumber={playingCall.phoneNumber}
              calledNumber={playingCall.calledNumber}
              hasClientFile={playingCall.hasClientFile}
              hasAgentFile={playingCall.hasAgentFile}
              status={playingCall.status}
              onClose={handleCloseAudioPlayer}
            />
          );
        })()
      )}

      {/* Transcriptions live */}
      {playingCallId && (
        <Paper elevation={1} sx={{ p: 2, mt: 2 }}>
          <Typography variant="subtitle2">Transcriptions en direct</Typography>
          <Box sx={{ maxHeight: 200, overflow: 'auto', mt: 1, fontFamily: 'monospace', fontSize: 12 }}>
            {(liveTranscripts[playingCallId] || []).map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </Box>
        </Paper>
      )}

      {/* Statistiques en bas */}
      {calls.length > 0 && (
        <Paper elevation={1} sx={{ p: 2, mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Statistiques
          </Typography>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              Total: {calls.length} appel(s)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              En cours: {calls.filter(c => c.status === 'active').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Terminés: {calls.filter(c => c.status === 'completed').length}
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default CallsPage;
