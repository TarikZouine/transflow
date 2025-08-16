import React, { useRef, useEffect, useState } from 'react';
import {
  Box, Typography, Slider, IconButton, Paper, Grid,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, VolumeUp, VolumeOff, Close,
} from '@mui/icons-material';

interface RealTimePlayerProps {
  callId: string;
  phoneNumber: string;
  calledNumber?: string;
  hasClientFile: boolean;
  hasAgentFile: boolean;
  status: 'active' | 'completed';
  onClose?: () => void;
}

const RealTimePlayer: React.FC<RealTimePlayerProps> = ({
  callId, phoneNumber, calledNumber, hasClientFile, hasAgentFile, status, onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [streamInfo, setStreamInfo] = useState('Initialisation...');
  const [realTimePosition, setRealTimePosition] = useState(0);

  const clientAudioRef = useRef<HTMLAudioElement>(null);
  const agentAudioRef = useRef<HTMLAudioElement>(null);
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // Calculer la position temps réel basée sur la création du fichier
  const calculateRealTimePosition = async () => {
    try {
      const response = await fetch(`/api/calls/${callId}/fileinfo/in`);
      const data = await response.json();
      
      if (data.success) {
        const fileCreated = new Date(data.data.created);
        const now = new Date();
        const elapsedSeconds = (now.getTime() - fileCreated.getTime()) / 1000;
        const estimatedDuration = data.data.estimatedDuration;
        
        // Position temps réel = temps écoulé depuis création
        // Mais limitée à la durée estimée du fichier
        const realTimePos = Math.min(elapsedSeconds, estimatedDuration);
        
        console.log(`📍 Temps réel: ${elapsedSeconds}s, Fichier: ${estimatedDuration}s, Position: ${realTimePos}s`);
        
        setRealTimePosition(realTimePos);
        setDuration(estimatedDuration);
        
        return realTimePos;
      }
    } catch (error) {
      console.error('Erreur calcul position temps réel:', error);
    }
    return 0;
  };

  // Positionner les lecteurs audio à la position temps réel
  const positionToRealTime = async () => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;
    
    if (!clientAudio) return;

    const realTimePos = await calculateRealTimePosition();
    
    // Attendre que les métadonnées soient chargées
    const waitForMetadata = (audio: HTMLAudioElement): Promise<void> => {
      return new Promise((resolve) => {
        if (audio.readyState >= 1) {
          resolve();
        } else {
          const onLoad = () => {
            audio.removeEventListener('loadedmetadata', onLoad);
            resolve();
          };
          audio.addEventListener('loadedmetadata', onLoad);
        }
      });
    };

    await waitForMetadata(clientAudio);
    if (agentAudio) await waitForMetadata(agentAudio);

    // Positionner au plus proche du temps réel possible
    // Si le temps réel dépasse la durée du fichier, se positionner à 2s de la fin
    let targetPosition;
    if (realTimePos >= clientAudio.duration) {
      targetPosition = Math.max(0, clientAudio.duration - 2);
    } else {
      // Sinon, se positionner exactement au temps réel
      targetPosition = Math.max(0, realTimePos);
    }
    
    clientAudio.currentTime = targetPosition;
    if (agentAudio) agentAudio.currentTime = targetPosition;
    setCurrentTime(targetPosition);
    
    console.log(`🎯 Positionné à ${targetPosition}s (durée audio: ${clientAudio.duration}s)`);
    setStreamInfo(`Positionné en temps réel: ${Math.floor(targetPosition)}s`);
  };

  // Monitoring continu pour mise à jour temps réel
  useEffect(() => {
    if (status !== 'active') return;

    const monitor = async () => {
      try {
        const realTimePos = await calculateRealTimePosition();
        const clientAudio = clientAudioRef.current;
        
        if (clientAudio && isPlaying) {
          // Si on est loin derrière le temps réel, avancer
          const currentPos = clientAudio.currentTime;
          const lag = realTimePos - currentPos;
          
          if (lag > 10) { // Plus de 10s de retard
            console.log(`⏩ Rattrapage: ${lag}s de retard`);
            clientAudio.currentTime = Math.max(0, realTimePos - 5);
            if (agentAudioRef.current) {
              agentAudioRef.current.currentTime = Math.max(0, realTimePos - 5);
            }
            setStreamInfo(`Rattrapage temps réel (-${Math.floor(lag)}s)`);
          }
          
          // Si on arrive à la fin mais le fichier continue de grandir
          if (currentPos >= clientAudio.duration - 2 && realTimePos > clientAudio.duration) {
            console.log('🔄 Rechargement pour nouvelles données');
            const timestamp = Date.now();
            clientAudio.src = `/api/calls/${callId}/stream/in?t=${timestamp}`;
            if (agentAudioRef.current) {
              agentAudioRef.current.src = `/api/calls/${callId}/stream/out?t=${timestamp}`;
            }
            
            // Attendre le rechargement et repositionner
            clientAudio.addEventListener('loadedmetadata', () => {
              const newPos = Math.max(0, realTimePos - 3);
              clientAudio.currentTime = newPos;
              if (agentAudioRef.current) agentAudioRef.current.currentTime = newPos;
              if (isPlaying) {
                clientAudio.play();
                if (agentAudioRef.current) agentAudioRef.current.play();
              }
            }, { once: true });
            
            clientAudio.load();
            if (agentAudioRef.current) agentAudioRef.current.load();
          }
        }
      } catch (error) {
        console.error('Erreur monitoring:', error);
      }
    };

    monitorIntervalRef.current = setInterval(monitor, 3000); // Toutes les 3 secondes
    monitor(); // Premier check immédiat

    return () => {
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
      }
    };
  }, [callId, status, isPlaying]);

  // Events audio
  useEffect(() => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (!clientAudio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(clientAudio.currentTime);
    };

    const handleLoadedMetadata = async () => {
      setDuration(clientAudio.duration);
      
      // Positionnement initial en temps réel
      if (!isInitializedRef.current && status === 'active') {
        isInitializedRef.current = true;
        await positionToRealTime();
      }
    };

    const handleCanPlay = () => {
      if (status === 'active') {
        setStreamInfo('Prêt pour streaming temps réel');
      } else {
        setStreamInfo('Prêt');
      }
    };

    const handleEnded = () => {
      if (status === 'completed') {
        setIsPlaying(false);
        setStreamInfo('Terminé');
      }
      // Pour les appels actifs, le monitoring gérera la suite
    };

    clientAudio.addEventListener('timeupdate', handleTimeUpdate);
    clientAudio.addEventListener('loadedmetadata', handleLoadedMetadata);
    clientAudio.addEventListener('canplay', handleCanPlay);
    clientAudio.addEventListener('ended', handleEnded);

    return () => {
      clientAudio.removeEventListener('timeupdate', handleTimeUpdate);
      clientAudio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      clientAudio.removeEventListener('canplay', handleCanPlay);
      clientAudio.removeEventListener('ended', handleEnded);
    };
  }, [callId, status]);

  // Reset lors du changement de fichier
  useEffect(() => {
    isInitializedRef.current = false;
    setCurrentTime(0);
    setDuration(0);
    setRealTimePosition(0);
    setStreamInfo('Nouveau fichier...');
  }, [callId]);

  // Auto-start pour appels actifs
  useEffect(() => {
    if (status === 'active' && hasClientFile && !isInitializedRef.current) {
      setTimeout(async () => {
        await positionToRealTime();
        handlePlayPause();
      }, 2000);
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
        // TOUJOURS recalculer et repositionner en temps réel pour les appels actifs
        if (status === 'active') {
          setStreamInfo('Repositionnement temps réel...');
          
          // Recharger les sources pour avoir les dernières données
          const timestamp = Date.now();
          clientAudio.src = `/api/calls/${callId}/stream/in?t=${timestamp}`;
          if (agentAudio) {
            agentAudio.src = `/api/calls/${callId}/stream/out?t=${timestamp}`;
          }
          
          // Attendre le rechargement
          const waitForLoad = (audio: HTMLAudioElement): Promise<void> => {
            return new Promise((resolve) => {
              const onLoad = () => {
                audio.removeEventListener('loadedmetadata', onLoad);
                resolve();
              };
              audio.addEventListener('loadedmetadata', onLoad);
              audio.load();
            });
          };

          await waitForLoad(clientAudio);
          if (agentAudio) await waitForLoad(agentAudio);
          
          // Maintenant positionner en temps réel
          await positionToRealTime();
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
        setStreamInfo(status === 'active' ? 'Streaming temps réel...' : 'Lecture...');
        isInitializedRef.current = true;
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
    isInitializedRef.current = false;
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
            {status === 'active' ? '🔴 TEMPS RÉEL' : '📁 PLAYBACK'} - {phoneNumber} {calledNumber && `→ ${calledNumber}`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {streamInfo}
          </Typography>
          {status === 'active' && (
            <Typography variant="caption" display="block" color="info.main">
              Position temps réel: {formatTime(realTimePosition)}
            </Typography>
          )}
        </Box>
        {onClose && (
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        )}
      </Box>

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
          <Box sx={{ minWidth: 140, textAlign: 'right' }}>
            <Typography variant="body2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </Typography>
            {status === 'active' && (
              <Typography variant="caption" color="success.main">
                ● LIVE {formatTime(realTimePosition)}
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

export default RealTimePlayer;
