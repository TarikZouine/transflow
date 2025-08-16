import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Paper,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  VolumeUp,
  VolumeDown,
  Person,
  Support,
} from '@mui/icons-material';

interface AudioPlayerProps {
  callId: string;
  phoneNumber: string;
  calledNumber?: string;
  hasClientFile: boolean;
  hasAgentFile: boolean;
  status: 'active' | 'completed'; // Ajouter le statut pour savoir si c'est un appel actif
  onClose?: () => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  callId,
  phoneNumber,
  calledNumber,
  hasClientFile,
  hasAgentFile,
  status,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [clientVolume, setClientVolume] = useState(0.8);
  const [agentVolume, setAgentVolume] = useState(0.8);
  const [loading, setLoading] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isWaitingForData, setIsWaitingForData] = useState(false);
  const [bufferLength, setBufferLength] = useState(0);
  const [targetBufferSize, setTargetBufferSize] = useState(10); // Taille de buffer cible en secondes

  const clientAudioRef = useRef<HTMLAudioElement>(null);
  const agentAudioRef = useRef<HTMLAudioElement>(null);

  // URLs des streams audio
  const clientStreamUrl = `/api/calls/${callId}/stream/in`;
  const agentStreamUrl = `/api/calls/${callId}/stream/out`;

  // Synchroniser les deux lecteurs audio
  const syncAudios = () => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (clientAudio && agentAudio) {
      const maxDuration = Math.max(
        clientAudio.duration || 0,
        agentAudio.duration || 0
      );
      setDuration(maxDuration);
    }
  };

  // Gestion de la lecture/pause
  const handlePlayPause = async () => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (!clientAudio || !agentAudio) return;

    setLoading(true);

    try {
      if (isPlaying) {
        // Pause
        clientAudio.pause();
        agentAudio.pause();
        setIsPlaying(false);
      } else {
        // Play - synchroniser les deux flux
        const promises = [];
        
        if (hasClientFile) {
          promises.push(clientAudio.play());
        }
        if (hasAgentFile) {
          promises.push(agentAudio.play());
        }
        
        await Promise.all(promises);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Erreur lecture audio:', error);
    } finally {
      setLoading(false);
    }
  };

  // Arrêter la lecture
  const handleStop = () => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (clientAudio) {
      clientAudio.pause();
      clientAudio.currentTime = 0;
    }
    if (agentAudio) {
      agentAudio.pause();
      agentAudio.currentTime = 0;
    }

    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Seeking dans la timeline
  const handleSeek = (_: Event, newValue: number | number[]) => {
    const time = newValue as number;
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (clientAudio) clientAudio.currentTime = time;
    if (agentAudio) agentAudio.currentTime = time;
    
    setCurrentTime(time);
  };

  // Ajuster le volume client
  const handleClientVolumeChange = (_: Event, newValue: number | number[]) => {
    const volume = newValue as number;
    setClientVolume(volume);
    if (clientAudioRef.current) {
      clientAudioRef.current.volume = volume;
    }
  };

  // Ajuster le volume agent
  const handleAgentVolumeChange = (_: Event, newValue: number | number[]) => {
    const volume = newValue as number;
    setAgentVolume(volume);
    if (agentAudioRef.current) {
      agentAudioRef.current.volume = volume;
    }
  };

  // Formater le temps en mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Mise à jour du temps de lecture
  useEffect(() => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    const updateTime = () => {
      const maxTime = Math.max(
        clientAudio?.currentTime || 0,
        agentAudio?.currentTime || 0
      );
      setCurrentTime(maxTime);
      
      // Calculer la longueur du buffer
      if (clientAudio) {
        try {
          const buffered = clientAudio.buffered;
          if (buffered.length > 0) {
            // Prendre le dernier segment bufferisé
            const bufferEnd = buffered.end(buffered.length - 1);
            const bufferStart = buffered.start(buffered.length - 1);
            const bufferDuration = bufferEnd - bufferStart;
            setBufferLength(bufferDuration);
          }
        } catch (error) {
          // Ignore les erreurs de buffer
        }
      }
    };

    const handleLoadedMetadata = () => {
      syncAudios();
      
      // Auto-play et se positionner près de la fin pour le streaming temps réel
      const clientAudio = clientAudioRef.current;
      const agentAudio = agentAudioRef.current;
      
      if (clientAudio && clientAudio.duration > 0) {
        let startPosition;
        
        if (status === 'active') {
          // Pour les appels actifs, se positionner plus intelligemment
          if (clientAudio.duration > 10) {
            // Se positionner 10 secondes avant la fin pour avoir du contexte
            startPosition = Math.max(0, clientAudio.duration - 10);
          } else {
            // Si l'appel est court, commencer au début
            startPosition = 0;
          }
        } else {
          // Pour les appels terminés, commencer au début
          startPosition = 0;
        }
        
        clientAudio.currentTime = startPosition;
        if (agentAudio) agentAudio.currentTime = startPosition;
        
        // Démarrer automatiquement la lecture seulement pour les appels actifs
        if (status === 'active') {
          setTimeout(() => {
            clientAudio.play().catch(console.error);
            agentAudio?.play().catch(console.error);
            setIsPlaying(true);
            setCurrentTime(startPosition);
          }, 200); // Délai un peu plus long pour la stabilité
        } else {
          setCurrentTime(startPosition);
        }
      }
    };

    const handleEnded = () => {
      if (status === 'active') {
        console.log('Fin atteinte - le streaming va recharger automatiquement');
        setIsWaitingForData(true);
      } else {
        setIsPlaying(false);
        setIsWaitingForData(false);
      }
    };

    if (clientAudio) {
      clientAudio.addEventListener('timeupdate', updateTime);
      clientAudio.addEventListener('loadedmetadata', handleLoadedMetadata);
      clientAudio.addEventListener('ended', handleEnded);
      clientAudio.volume = clientVolume;
    }

    if (agentAudio) {
      agentAudio.addEventListener('timeupdate', updateTime);
      agentAudio.addEventListener('loadedmetadata', handleLoadedMetadata);
      agentAudio.addEventListener('ended', handleEnded);
      agentAudio.volume = agentVolume;
    }

    return () => {
      if (clientAudio) {
        clientAudio.removeEventListener('timeupdate', updateTime);
        clientAudio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        clientAudio.removeEventListener('ended', handleEnded);
      }
      if (agentAudio) {
        agentAudio.removeEventListener('timeupdate', updateTime);
        agentAudio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        agentAudio.removeEventListener('ended', handleEnded);
      }
    };
  }, [clientVolume, agentVolume]);

  // Streaming adaptatif basé sur la taille de buffer
  useEffect(() => {
    if (status !== 'active') return;

    const streamingInterval = setInterval(() => {
      const clientAudio = clientAudioRef.current;
      const agentAudio = agentAudioRef.current;
      
      if (!clientAudio || !agentAudio) return;
      
      // Calculer si on a besoin de recharger basé sur le buffer
      const currentBuffer = bufferLength - clientAudio.currentTime;
      const needsReload = currentBuffer < targetBufferSize || isWaitingForData;
      
      if (!needsReload) {
        console.log(`Buffer OK: ${currentBuffer.toFixed(1)}s / ${targetBufferSize}s cible`);
        return;
      }
      
      console.log(`Rechargement buffer: ${currentBuffer.toFixed(1)}s < ${targetBufferSize}s`);
      
      // Forcer le rechargement des sources avec timestamp pour éviter le cache
      const timestamp = Date.now();
      const baseUrl = `/api/calls/${callId}/stream`;
      
      // Sauvegarder l'état actuel
      const wasPlaying = !clientAudio.paused;
      const currentPosition = clientAudio.currentTime;
      
      // Recharger les sources
      clientAudio.src = `${baseUrl}/in?t=${timestamp}`;
      agentAudio.src = `${baseUrl}/out?t=${timestamp}`;
      
      clientAudio.load();
      agentAudio.load();
      
      // Restaurer l'état après le rechargement
      const restoreState = () => {
        // Mettre à jour la durée
        if (clientAudio.duration && clientAudio.duration > duration) {
          setDuration(clientAudio.duration);
        }
        
        // Restaurer la position
        clientAudio.currentTime = currentPosition;
        agentAudio.currentTime = currentPosition;
        
        // Restaurer la lecture si elle était en cours
        if (wasPlaying) {
          clientAudio.play().catch(console.error);
          agentAudio.play().catch(console.error);
          setIsPlaying(true);
          setIsWaitingForData(false);
        }
      };
      
      clientAudio.addEventListener('loadeddata', restoreState, { once: true });
      
    }, 2000); // Vérifier toutes les 2 secondes
    
    return () => clearInterval(streamingInterval);
  }, [callId, status, duration, bufferLength, targetBufferSize, isWaitingForData]);

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 2, mb: 2 }}>
      {/* En-tête */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6" component="h3">
            {status === 'active' ? '🔴 Streaming Temps Réel' : '📁 Lecture Audio'} - Appel {phoneNumber}
            {calledNumber && ` → ${calledNumber}`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            {status === 'active' && (
              <Chip
                label={isWaitingForData ? "ATTENTE DONNÉES..." : "EN DIRECT"}
                color={isWaitingForData ? "warning" : "error"}
                size="small"
                sx={{ animation: 'pulse 2s infinite' }}
              />
            )}
            {hasClientFile && (
              <Chip
                icon={<Person />}
                label="Client"
                color="primary"
                variant="outlined"
                size="small"
              />
            )}
            {hasAgentFile && (
              <Chip
                icon={<Support />}
                label="Agent"
                color="secondary"
                variant="outlined"
                size="small"
              />
            )}
          </Box>
        </Box>
        {onClose && (
          <IconButton onClick={onClose} size="small">
            ×
          </IconButton>
        )}
      </Box>

      {/* Lecteurs audio cachés */}
      {hasClientFile && (
        <audio
          ref={clientAudioRef}
          src={clientStreamUrl}
          preload="metadata"
          style={{ display: 'none' }}
        />
      )}
      {hasAgentFile && (
        <audio
          ref={agentAudioRef}
          src={agentStreamUrl}
          preload="metadata"
          style={{ display: 'none' }}
        />
      )}

      {/* Contrôles principaux */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <IconButton
          onClick={handlePlayPause}
          disabled={loading || (!hasClientFile && !hasAgentFile)}
          color="primary"
          size="large"
        >
          {loading ? (
            <LinearProgress sx={{ width: 24, height: 24 }} />
          ) : isPlaying ? (
            <Pause />
          ) : (
            <PlayArrow />
          )}
        </IconButton>

        <IconButton onClick={handleStop} disabled={!isPlaying}>
          <Stop />
        </IconButton>

        <Box sx={{ minWidth: 80 }}>
          <Typography variant="body2">
            {formatTime(currentTime)}
          </Typography>
          <Typography variant="caption" color="primary">
            +{formatTime(Math.max(0, bufferLength - currentTime))}
          </Typography>
        </Box>

        <Slider
          value={currentTime}
          max={duration}
          onChange={handleSeek}
          disabled={!duration}
          sx={{ flexGrow: 1 }}
        />

        <Box sx={{ minWidth: 80, textAlign: 'right' }}>
          <Typography variant="body2">
            {formatTime(duration)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Buf: {formatTime(bufferLength)}
          </Typography>
        </Box>
      </Box>

      {/* Contrôles de volume */}
      <Box sx={{ display: 'flex', gap: 4 }}>
        {/* Volume Client */}
        {hasClientFile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <Person fontSize="small" />
            <Typography variant="body2" sx={{ minWidth: 50 }}>
              Client
            </Typography>
            <VolumeDown fontSize="small" />
            <Slider
              value={clientVolume}
              min={0}
              max={1}
              step={0.1}
              onChange={handleClientVolumeChange}
              sx={{ flex: 1 }}
            />
            <VolumeUp fontSize="small" />
          </Box>
        )}

        {/* Volume Agent */}
        {hasAgentFile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <Support fontSize="small" />
            <Typography variant="body2" sx={{ minWidth: 50 }}>
              Agent
            </Typography>
            <VolumeDown fontSize="small" />
            <Slider
              value={agentVolume}
              min={0}
              max={1}
              step={0.1}
              onChange={handleAgentVolumeChange}
              sx={{ flex: 1 }}
            />
            <VolumeUp fontSize="small" />
          </Box>
        )}
      </Box>

      {/* Contrôle de la taille de buffer */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2" sx={{ minWidth: 100 }}>
          Buffer cible:
        </Typography>
        <Slider
          value={targetBufferSize}
          min={2}
          max={30}
          step={1}
          onChange={(_, newValue) => setTargetBufferSize(newValue as number)}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value}s`}
          sx={{ flexGrow: 1 }}
        />
        <Typography variant="body2" sx={{ minWidth: 60 }}>
          {targetBufferSize}s
        </Typography>
        <Box sx={{ minWidth: 120, textAlign: 'right' }}>
          <Typography variant="caption" color={bufferLength - currentTime >= targetBufferSize ? 'success.main' : 'warning.main'}>
            Buffer: {formatTime(Math.max(0, bufferLength - currentTime))}
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary">
            {bufferLength - currentTime >= targetBufferSize ? '✅ OK' : '⚠️ Faible'}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default AudioPlayer;
