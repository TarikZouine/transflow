import React, { useRef, useEffect, useState } from 'react';
import {
  Box, Typography, Slider, IconButton, Paper, Grid,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, VolumeUp, VolumeOff, Close,
} from '@mui/icons-material';

interface SimpleRealTimePlayerProps {
  callId: string;
  phoneNumber: string;
  calledNumber?: string;
  hasClientFile: boolean;
  hasAgentFile: boolean;
  status: 'active' | 'completed';
  onClose?: () => void;
}

const SimpleRealTimePlayer: React.FC<SimpleRealTimePlayerProps> = ({
  callId, phoneNumber, calledNumber, hasClientFile, hasAgentFile, status, onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [streamInfo, setStreamInfo] = useState('Initialisation...');
  const [bufferSeconds, setBufferSeconds] = useState(10); // Buffer par défaut

  const clientAudioRef = useRef<HTMLAudioElement>(null);
  const agentAudioRef = useRef<HTMLAudioElement>(null);
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fonction simple : se positionner à la fin - buffer
  const positionToLiveEnd = async () => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;
    
    if (!clientAudio) return;

    // Recharger d'abord pour avoir la dernière version
    const timestamp = Date.now();
    clientAudio.src = `/api/calls/${callId}/stream/in?t=${timestamp}`;
    if (agentAudio) {
      agentAudio.src = `/api/calls/${callId}/stream/out?t=${timestamp}`;
    }

    // Attendre le chargement
    const waitForLoad = (): Promise<void> => {
      return new Promise((resolve) => {
        const onLoad = () => {
          clientAudio.removeEventListener('loadedmetadata', onLoad);
          resolve();
        };
        clientAudio.addEventListener('loadedmetadata', onLoad);
        clientAudio.load();
      });
    };

    await waitForLoad();
    if (agentAudio) {
      agentAudio.load();
      await new Promise(resolve => {
        const onLoad = () => {
          agentAudio.removeEventListener('loadedmetadata', onLoad);
          resolve(undefined);
        };
        agentAudio.addEventListener('loadedmetadata', onLoad);
      });
    }

    // Se positionner à la fin - buffer
    const audioDuration = clientAudio.duration;
    const targetPosition = Math.max(0, audioDuration - bufferSeconds);
    
    clientAudio.currentTime = targetPosition;
    if (agentAudio) agentAudio.currentTime = targetPosition;
    
    setCurrentTime(targetPosition);
    setDuration(audioDuration);
    
    console.log(`📍 Positionné à ${targetPosition}s (durée: ${audioDuration}s, buffer: ${bufferSeconds}s)`);
    setStreamInfo(`Live - ${Math.floor(audioDuration - targetPosition)}s de buffer`);
  };

  // Monitoring pour mise à jour continue
  useEffect(() => {
    if (status !== 'active') return;

    const monitor = async () => {
      try {
        const response = await fetch(`/api/calls/${callId}/fileinfo/in`);
        const data = await response.json();
        
        if (data.success) {
          const newDuration = data.data.estimatedDuration;
          
          // Si la durée a augmenté significativement
          if (newDuration > duration + 2) {
            setDuration(newDuration);
            
            const clientAudio = clientAudioRef.current;
            if (clientAudio && isPlaying) {
              // Vérifier si on est proche de la fin
              const currentPos = clientAudio.currentTime;
              const remainingTime = clientAudio.duration - currentPos;
              
              // Si moins de 5s restant, recharger et repositionner
              if (remainingTime < 5) {
                console.log('🔄 Rechargement - proche de la fin');
                const wasPlaying = !clientAudio.paused;
                
                await positionToLiveEnd();
                
                if (wasPlaying) {
                  await clientAudio.play();
                  if (agentAudioRef.current) await agentAudioRef.current.play();
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Erreur monitoring:', error);
      }
    };

    monitorIntervalRef.current = setInterval(monitor, 3000);
    monitor();

    return () => {
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
      }
    };
  }, [callId, status, duration, isPlaying, bufferSeconds]);

  // Events audio basiques
  useEffect(() => {
    const clientAudio = clientAudioRef.current;

    if (!clientAudio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(clientAudio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(clientAudio.duration);
    };

    const handleEnded = () => {
      if (status === 'completed') {
        setIsPlaying(false);
        setStreamInfo('Terminé');
      }
      // Pour les appels actifs, le monitoring gérera
    };

    clientAudio.addEventListener('timeupdate', handleTimeUpdate);
    clientAudio.addEventListener('loadedmetadata', handleLoadedMetadata);
    clientAudio.addEventListener('ended', handleEnded);

    return () => {
      clientAudio.removeEventListener('timeupdate', handleTimeUpdate);
      clientAudio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      clientAudio.removeEventListener('ended', handleEnded);
    };
  }, [status]);

  // Reset lors changement de fichier
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setStreamInfo('Nouveau fichier...');
  }, [callId]);

  // Auto-start pour appels actifs
  useEffect(() => {
    if (status === 'active' && hasClientFile) {
      setTimeout(() => {
        handlePlayPause();
      }, 1500);
    }
  }, [status, hasClientFile]);

  const handlePlayPause = async () => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (!clientAudio) return;

    try {
      if (isPlaying) {
        clientAudio.pause();
        agentAudio?.pause();
        setIsPlaying(false);
        setStreamInfo('Pausé');
      } else {
        // TOUJOURS se repositionner à la fin pour les appels actifs
        if (status === 'active') {
          setStreamInfo('Positionnement en direct...');
          await positionToLiveEnd();
        }

        clientAudio.volume = volume;
        clientAudio.muted = isMuted;
        if (agentAudio) {
          agentAudio.volume = volume;
          agentAudio.muted = isMuted;
        }

        await clientAudio.play();
        if (agentAudio) await agentAudio.play();
        setIsPlaying(true);
        setStreamInfo(status === 'active' ? 'Streaming live...' : 'Lecture...');
      }
    } catch (error) {
      console.error('Erreur play/pause:', error);
      setStreamInfo('Erreur lecture');
    }
  };

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
    setStreamInfo('Arrêté');
  };

  const handleSeek = (event: Event, newValue: number | number[]) => {
    const time = newValue as number;
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (clientAudio) clientAudio.currentTime = time;
    if (agentAudio) agentAudio.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Paper elevation={6} sx={{ p: 3, mt: 4, position: 'sticky', bottom: 0, zIndex: 1000 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">
            {status === 'active' ? '🔴 LIVE END' : '📁 PLAYBACK'} - {phoneNumber} {calledNumber && `→ ${calledNumber}`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {streamInfo}
          </Typography>
        </Box>
        {onClose && (
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        )}
      </Box>

      {/* Contrôle du buffer */}
      {status === 'active' && (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" gutterBottom>
            Buffer de sécurité: {bufferSeconds}s
          </Typography>
          <Slider
            value={bufferSeconds}
            min={5}
            max={30}
            step={1}
            onChange={(_, value) => setBufferSeconds(value as number)}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}s`}
          />
          <Typography variant="caption" color="text.secondary">
            Position = Fin du fichier - {bufferSeconds}s
          </Typography>
        </Box>
      )}

      {/* Audio elements */}
      {hasClientFile && (
        <audio
          ref={clientAudioRef}
          src={`/api/calls/${callId}/stream/in`}
          preload="auto"
          style={{ display: 'none' }}
        />
      )}
      {hasAgentFile && (
        <audio
          ref={agentAudioRef}
          src={`/api/calls/${callId}/stream/out`}
          preload="auto"
          style={{ display: 'none' }}
        />
      )}

      {/* Controls */}
      <Grid container spacing={2} alignItems="center">
        <Grid item>
          <IconButton onClick={handlePlayPause} disabled={!hasClientFile}>
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
          <IconButton onClick={handleStop}>
            <Stop />
          </IconButton>
        </Grid>

        <Grid item xs>
          <Slider
            value={currentTime}
            max={duration}
            onChange={handleSeek}
            disabled={!duration}
          />
        </Grid>

        <Grid item>
          <Box sx={{ minWidth: 120, textAlign: 'right' }}>
            <Typography variant="body2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </Typography>
            {status === 'active' && (
              <Typography variant="caption" color="success.main">
                ● LIVE -{bufferSeconds}s
              </Typography>
            )}
          </Box>
        </Grid>

        <Grid item>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 150 }}>
            <IconButton onClick={() => {
              setIsMuted(!isMuted);
              const clientAudio = clientAudioRef.current;
              const agentAudio = agentAudioRef.current;
              if (clientAudio) clientAudio.muted = !isMuted;
              if (agentAudio) agentAudio.muted = !isMuted;
            }}>
              {isMuted ? <VolumeOff /> : <VolumeUp />}
            </IconButton>
            <Slider
              value={volume * 100}
              min={0}
              max={100}
              onChange={(_, v) => {
                const newVolume = (v as number) / 100;
                setVolume(newVolume);
                const clientAudio = clientAudioRef.current;
                const agentAudio = agentAudioRef.current;
                if (clientAudio) clientAudio.volume = newVolume;
                if (agentAudio) agentAudio.volume = newVolume;
              }}
            />
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default SimpleRealTimePlayer;
