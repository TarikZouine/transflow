import React, { useRef, useEffect, useState } from 'react';
import {
  Box, Typography, Slider, IconButton, Paper, Grid,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, VolumeUp, VolumeOff, Close,
} from '@mui/icons-material';

interface PerfectStreamPlayerProps {
  callId: string;
  phoneNumber: string;
  calledNumber?: string;
  hasClientFile: boolean;
  hasAgentFile: boolean;
  status: 'active' | 'completed';
  onClose?: () => void;
}

const PerfectStreamPlayer: React.FC<PerfectStreamPlayerProps> = ({
  callId, phoneNumber, calledNumber, hasClientFile, hasAgentFile, status, onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [streamInfo, setStreamInfo] = useState('Initialisation...');

  const clientAudioRef = useRef<HTMLAudioElement>(null);
  const agentAudioRef = useRef<HTMLAudioElement>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSizeRef = useRef(0);
  const targetPositionRef = useRef(0);
  const isUpdatingRef = useRef(false);

  // Fonction pour recharger les sources avec la position sauvée
  const reloadSources = async (savedPosition: number) => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;

    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (!clientAudio) {
      isUpdatingRef.current = false;
      return;
    }

    const wasPlaying = !clientAudio.paused;
    
    try {
      // Pause first
      clientAudio.pause();
      if (agentAudio) agentAudio.pause();

      // Generate new URLs with timestamp to force reload
      const timestamp = Date.now();
      const newClientUrl = `/api/calls/${callId}/stream/in?t=${timestamp}`;
      const newAgentUrl = `/api/calls/${callId}/stream/out?t=${timestamp}`;

      // Update sources
      clientAudio.src = newClientUrl;
      if (agentAudio) agentAudio.src = newAgentUrl;

      // Wait for metadata to load
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

      // Update duration
      if (clientAudio.duration) {
        setDuration(clientAudio.duration);
      }

      // Restore position
      clientAudio.currentTime = savedPosition;
      if (agentAudio) agentAudio.currentTime = savedPosition;
      setCurrentTime(savedPosition);

      // Resume playing if it was playing
      if (wasPlaying) {
        await clientAudio.play();
        if (agentAudio) await agentAudio.play();
      }

      setStreamInfo(`Mis à jour - ${Math.floor(clientAudio.duration || 0)}s`);

    } catch (error) {
      console.error('Erreur reload:', error);
      setStreamInfo('Erreur mise à jour');
    }

    isUpdatingRef.current = false;
  };

  // Monitor file size and reload when needed
  useEffect(() => {
    if (status !== 'active') return;

    const checkForUpdates = async () => {
      try {
        const response = await fetch(`/api/calls/${callId}/fileinfo/in`);
        const data = await response.json();
        
        if (data.success) {
          const currentSize = data.data.size;
          const estimatedDuration = data.data.estimatedDuration;

          // If file size increased significantly, reload
          if (currentSize > lastSizeRef.current + 50000) { // 50KB threshold
            lastSizeRef.current = currentSize;
            
            const clientAudio = clientAudioRef.current;
            if (clientAudio && !isUpdatingRef.current) {
              const currentPos = clientAudio.currentTime;
              
              // Only reload if we're near the end or if duration changed significantly
              const nearEnd = currentPos > (clientAudio.duration - 5);
              const durationChanged = Math.abs(estimatedDuration - duration) > 2;
              
              if (nearEnd || durationChanged) {
                console.log(`🔄 Reloading: size ${currentSize}, pos ${currentPos}, dur ${estimatedDuration}`);
                await reloadSources(currentPos);
              }
            }
          }
        }
      } catch (error) {
        console.error('Erreur check updates:', error);
      }
    };

    updateIntervalRef.current = setInterval(checkForUpdates, 2000);
    checkForUpdates();

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [callId, status, duration]);

  // Audio events
  useEffect(() => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (!clientAudio) return;

    const handleTimeUpdate = () => {
      if (!isUpdatingRef.current) {
        setCurrentTime(clientAudio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      if (clientAudio.duration) {
        setDuration(clientAudio.duration);
        lastSizeRef.current = 0; // Reset size tracking
      }
      
      // Auto-position for active calls on first load
      if (status === 'active' && clientAudio.duration > 10 && targetPositionRef.current === 0) {
        const startPos = Math.max(0, clientAudio.duration - 10);
        clientAudio.currentTime = startPos;
        if (agentAudio) agentAudio.currentTime = startPos;
        setCurrentTime(startPos);
        targetPositionRef.current = startPos;
      }
    };

    const handleCanPlay = () => {
      setStreamInfo(status === 'active' ? 'Streaming live' : 'Prêt');
    };

    const handleEnded = async () => {
      if (status === 'active' && !isUpdatingRef.current) {
        console.log('🔚 Reached end, checking for new data...');
        setStreamInfo('Vérification nouvelles données...');
        
        // Wait a bit and check for new data
        setTimeout(async () => {
          const currentPos = clientAudio.currentTime;
          await reloadSources(currentPos);
        }, 1000);
      } else if (status === 'completed') {
        setIsPlaying(false);
        setStreamInfo('Terminé');
      }
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

  // Auto-start for active calls
  useEffect(() => {
    if (status === 'active' && hasClientFile) {
      setTimeout(() => {
        handlePlayPause();
      }, 1500);
    }
  }, [status, hasClientFile]);

  // Reset when callId changes
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    targetPositionRef.current = 0;
    lastSizeRef.current = 0;
    setStreamInfo('Nouveau fichier...');
  }, [callId]);

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
        // Ensure proper setup
        clientAudio.volume = volume;
        clientAudio.muted = isMuted;
        if (agentAudio) {
          agentAudio.volume = volume;
          agentAudio.muted = isMuted;
        }

        await clientAudio.play();
        if (agentAudio) await agentAudio.play();
        setIsPlaying(true);
        setStreamInfo(status === 'active' ? 'Streaming...' : 'Lecture...');
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
    targetPositionRef.current = 0;
    setStreamInfo('Arrêté');
  };

  const handleSeek = (event: Event, newValue: number | number[]) => {
    const time = newValue as number;
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (clientAudio) clientAudio.currentTime = time;
    if (agentAudio) agentAudio.currentTime = time;
    setCurrentTime(time);
    targetPositionRef.current = time;
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
            {status === 'active' ? '🔴 PERFECT STREAM' : '📁 PLAYBACK'} - {phoneNumber} {calledNumber && `→ ${calledNumber}`}
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
            disabled={!duration || isUpdatingRef.current}
          />
        </Grid>

        <Grid item>
          <Box sx={{ minWidth: 120, textAlign: 'right' }}>
            <Typography variant="body2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </Typography>
            {status === 'active' && (
              <Typography variant="caption" color="success.main">
                ● LIVE
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

export default PerfectStreamPlayer;
