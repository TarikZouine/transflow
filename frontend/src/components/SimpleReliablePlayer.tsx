import React, { useRef, useEffect, useState } from 'react';
import {
  Box, Typography, Slider, IconButton, Paper, Grid,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, VolumeUp, VolumeOff, Close,
} from '@mui/icons-material';

interface SimpleReliablePlayerProps {
  callId: string;
  phoneNumber: string;
  calledNumber?: string;
  hasClientFile: boolean;
  hasAgentFile: boolean;
  status: 'active' | 'completed';
  onClose?: () => void;
}

const SimpleReliablePlayer: React.FC<SimpleReliablePlayerProps> = ({
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
  const hasStartedRef = useRef(false);

  // Simple duration update without source reloading
  useEffect(() => {
    if (status !== 'active') return;

    const updateDuration = async () => {
      try {
        const response = await fetch(`/api/calls/${callId}/fileinfo/in`);
        const data = await response.json();
        
        if (data.success) {
          const newDuration = data.data.estimatedDuration;
          if (newDuration > duration) {
            setDuration(newDuration);
            const bufferAhead = Math.max(0, newDuration - currentTime);
            setStreamInfo(`Buffer: ${Math.floor(bufferAhead)}s`);
          }
        }
      } catch (error) {
        console.error('Erreur durée:', error);
      }
    };

    const interval = setInterval(updateDuration, 3000); // Moins fréquent
    updateDuration();

    return () => clearInterval(interval);
  }, [callId, status, duration, currentTime]);

  // Audio events - simple setup
  useEffect(() => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (!clientAudio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(clientAudio.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (clientAudio.duration) {
        setDuration(clientAudio.duration);
        setStreamInfo('Prêt à lire');
        
        // Position initiale pour appels actifs
        if (status === 'active' && !hasStartedRef.current) {
          const startPos = Math.max(0, clientAudio.duration - 5);
          clientAudio.currentTime = startPos;
          if (agentAudio) agentAudio.currentTime = startPos;
          setCurrentTime(startPos);
        }
      }
    };

    const handleCanPlay = () => {
      setStreamInfo(status === 'active' ? 'Streaming actif' : 'Prêt');
    };

    const handleEnded = () => {
      if (status === 'completed') {
        setIsPlaying(false);
        setStreamInfo('Terminé');
      } else {
        setStreamInfo('En attente...');
        // Pour les appels actifs, ne pas arrêter - laisser le navigateur gérer
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
  }, [status]);

  // Auto-start simple
  useEffect(() => {
    if (status === 'active' && hasClientFile && !hasStartedRef.current) {
      setTimeout(() => {
        hasStartedRef.current = true;
        handlePlayPause();
      }, 1000);
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
            {status === 'active' ? '🔴 LIVE' : '📁 AUDIO'} - {phoneNumber} {calledNumber && `→ ${calledNumber}`}
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

      {/* Audio elements - sources fixes */}
      {hasClientFile && (
        <audio
          ref={clientAudioRef}
          src={`/api/calls/${callId}/stream/in`}
          volume={volume}
          muted={isMuted}
          preload="auto"
          style={{ display: 'none' }}
        />
      )}
      {hasAgentFile && (
        <audio
          ref={agentAudioRef}
          src={`/api/calls/${callId}/stream/out`}
          volume={volume}
          muted={isMuted}
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
          </Box>
        </Grid>

        <Grid item>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 150 }}>
            <IconButton onClick={() => setIsMuted(!isMuted)}>
              {isMuted ? <VolumeOff /> : <VolumeUp />}
            </IconButton>
            <Slider
              value={volume * 100}
              min={0}
              max={100}
              onChange={(_, v) => setVolume((v as number) / 100)}
            />
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default SimpleReliablePlayer;
