import React, { useRef, useEffect, useState } from 'react';
import {
  Box, Typography, Slider, IconButton, Paper, Grid,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, VolumeUp, VolumeOff, Close,
} from '@mui/icons-material';

interface ProfessionalStreamPlayerProps {
  callId: string;
  phoneNumber: string;
  calledNumber?: string;
  hasClientFile: boolean;
  hasAgentFile: boolean;
  status: 'active' | 'completed';
  onClose?: () => void;
}

const ProfessionalStreamPlayer: React.FC<ProfessionalStreamPlayerProps> = ({
  callId, phoneNumber, calledNumber, hasClientFile, hasAgentFile, status, onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [realDuration, setRealDuration] = useState(0);

  const clientAudioRef = useRef<HTMLAudioElement>(null);
  const agentAudioRef = useRef<HTMLAudioElement>(null);
  const durationCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Monitor real file duration for active calls
  useEffect(() => {
    if (status !== 'active') return;

    const checkRealDuration = async () => {
      try {
        const response = await fetch(`/api/calls/${callId}/fileinfo/in`);
        const data = await response.json();
        if (data.success) {
          const newDuration = data.data.estimatedDuration;
          if (newDuration > realDuration) {
            setRealDuration(newDuration);
            setDuration(newDuration);
          }
        }
      } catch (error) {
        // Silent fail
      }
    };

    // Check duration every 2 seconds
    durationCheckIntervalRef.current = setInterval(checkRealDuration, 2000);
    checkRealDuration(); // Initial check

    return () => {
      if (durationCheckIntervalRef.current) {
        clearInterval(durationCheckIntervalRef.current);
      }
    };
  }, [callId, status, realDuration]);

  // Initialize audio
  useEffect(() => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (!clientAudio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(clientAudio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(clientAudio.duration);
      
      // For active calls, start near the end
      if (status === 'active') {
        const startPos = Math.max(0, clientAudio.duration - 10);
        clientAudio.currentTime = startPos;
        if (agentAudio) agentAudio.currentTime = startPos;
        setCurrentTime(startPos);
        
        // Auto-play
        setTimeout(() => {
          handlePlay();
        }, 500);
      }
    };

    const handleEnded = () => {
      // For active calls, just wait - duration will update automatically
      if (status === 'completed') {
        setIsPlaying(false);
      }
    };

    clientAudio.addEventListener('timeupdate', handleTimeUpdate);
    clientAudio.addEventListener('loadedmetadata', handleLoadedMetadata);
    clientAudio.addEventListener('ended', handleEnded);

    return () => {
      clientAudio.removeEventListener('timeupdate', handleTimeUpdate);
      clientAudio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      clientAudio.removeEventListener('ended', handleEnded);
    };
  }, [callId, status]);

  // Handle play without reloading
  const handlePlay = async () => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (!clientAudio) return;

    try {
      await clientAudio.play();
      if (agentAudio) await agentAudio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Erreur play:', error);
    }
  };

  const handlePlayPause = async () => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (!clientAudio) return;

    if (isPlaying) {
      clientAudio.pause();
      agentAudio?.pause();
      setIsPlaying(false);
    } else {
      await handlePlay();
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

  // Calculate buffer ahead
  const bufferAhead = Math.max(0, duration - currentTime);
  const isNearEnd = bufferAhead <= 5;

  return (
    <Paper elevation={6} sx={{ p: 3, mt: 4, position: 'sticky', bottom: 0, zIndex: 1000 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">
            {status === 'active' ? '🔴 DIRECT' : '📁 LECTURE'} - {phoneNumber} {calledNumber && `→ ${calledNumber}`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {status === 'active' && (
              isNearEnd ? 
                '⚠️ Proche de la fin du buffer' : 
                `✅ Buffer: ${formatTime(bufferAhead)} disponible`
            )}
          </Typography>
        </Box>
        {onClose && (
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        )}
      </Box>

      {/* Audio elements - NO reloading */}
      {hasClientFile && (
        <audio
          ref={clientAudioRef}
          src={`/api/calls/${callId}/stream/in`}
          volume={volume}
          muted={isMuted}
          preload="auto"
        />
      )}
      {hasAgentFile && (
        <audio
          ref={agentAudioRef}
          src={`/api/calls/${callId}/stream/out`}
          volume={volume}
          muted={isMuted}
          preload="auto"
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
            sx={{
              '& .MuiSlider-track': {
                backgroundColor: isNearEnd ? 'warning.main' : 'primary.main'
              }
            }}
          />
        </Grid>

        <Grid item>
          <Box sx={{ minWidth: 120, textAlign: 'right' }}>
            <Typography variant="body2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </Typography>
            {status === 'active' && (
              <Typography variant="caption" color={isNearEnd ? 'warning.main' : 'success.main'}>
                +{formatTime(bufferAhead)}
              </Typography>
            )}
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

export default ProfessionalStreamPlayer;
