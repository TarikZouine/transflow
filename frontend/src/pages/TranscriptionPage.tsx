import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Grid,
  Button,
  Paper,
  Alert,
} from '@mui/material';
import {
  Save,
  Download,
  Clear,
} from '@mui/icons-material';

import AudioRecorder from '../components/AudioRecorder';
import TranscriptionDisplay from '../components/TranscriptionDisplay';
import { useWebSocket } from '../hooks/useWebSocket';

interface TranscriptionSegment {
  id: string;
  text: string;
  speaker?: string;
  confidence: number;
  timestamp: number;
}

const TranscriptionPage: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { socket, isConnected } = useWebSocket('ws://localhost:5000');

  useEffect(() => {
    if (socket) {
      socket.on('transcription_update', (data) => {
        const newSegment: TranscriptionSegment = {
          id: Date.now().toString(),
          text: data.text,
          speaker: data.speaker,
          confidence: data.confidence || 0.8,
          timestamp: Date.now(),
        };
        
        setSegments(prev => [...prev, newSegment]);
      });

      socket.on('session_created', (data) => {
        setSessionId(data.sessionId);
      });

      socket.on('error', (data) => {
        setError(data.message);
      });

      return () => {
        socket.off('transcription_update');
        socket.off('session_created');
        socket.off('error');
      };
    }
  }, [socket]);

  const handleAudioData = (audioData: ArrayBuffer): void => {
    if (socket && isConnected && sessionId) {
      socket.emit('audio_chunk', {
        sessionId,
        audioData: Array.from(new Uint8Array(audioData)),
        timestamp: Date.now(),
      });
    }
  };

  const handleRecordingChange = (recording: boolean): void => {
    setIsRecording(recording);
    
    if (recording && socket && isConnected) {
      // Créer une nouvelle session
      socket.emit('create_session', {
        title: `Session ${new Date().toLocaleString('fr-FR')}`,
      });
    } else if (!recording && sessionId && socket) {
      // Terminer la session
      socket.emit('end_session', { sessionId });
      setSessionId(null);
    }
  };

  const handleSaveSession = (): void => {
    if (sessionId && socket) {
      socket.emit('save_session', { sessionId });
      // TODO: Afficher un message de confirmation
    }
  };

  const handleDownloadTranscription = (): void => {
    const transcriptionText = segments
      .map(segment => `[${new Date(segment.timestamp).toLocaleTimeString('fr-FR')}] ${segment.text}`)
      .join('\n');
    
    const blob = new Blob([transcriptionText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearTranscription = (): void => {
    setSegments([]);
    setError(null);
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Transcription en temps réel
      </Typography>

      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Connexion au serveur en cours...
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Contrôles d'enregistrement */}
        <Grid item xs={12} md={6}>
          <AudioRecorder
            onAudioData={handleAudioData}
            isRecording={isRecording}
            onRecordingChange={handleRecordingChange}
          />
          
          {/* Actions */}
          <Paper elevation={2} sx={{ p: 2, mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Actions
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSaveSession}
                disabled={!sessionId || segments.length === 0}
              >
                Sauvegarder
              </Button>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleDownloadTranscription}
                disabled={segments.length === 0}
              >
                Télécharger
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Clear />}
                onClick={handleClearTranscription}
                disabled={segments.length === 0}
              >
                Effacer
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Affichage de la transcription */}
        <Grid item xs={12} md={6}>
          <TranscriptionDisplay
            segments={segments}
            isLive={isRecording}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default TranscriptionPage;
