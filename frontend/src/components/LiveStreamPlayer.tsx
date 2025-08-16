import React, { useRef, useEffect, useState } from 'react';
import {
  Box, Typography, Slider, IconButton, Paper, Grid, LinearProgress,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, VolumeUp, VolumeOff, Close,
} from '@mui/icons-material';

interface LiveStreamPlayerProps {
  callId: string;
  phoneNumber: string;
  calledNumber?: string;
  hasClientFile: boolean;
  hasAgentFile: boolean;
  status: 'active' | 'completed';
  onClose?: () => void;
}

const LiveStreamPlayer: React.FC<LiveStreamPlayerProps> = ({
  callId, phoneNumber, calledNumber, hasClientFile, hasAgentFile, status, onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [bufferAhead, setBufferAhead] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const clientAudioRef = useRef<HTMLAudioElement>(null);
  const agentAudioRef = useRef<HTMLAudioElement>(null);
  const lastUpdateRef = useRef(0);
  const currentSourceRef = useRef('');

  // Update file info and manage streaming
  useEffect(() => {
    if (status !== 'active') return;

    const updateStream = async () => {
      try {
        const response = await fetch(`/api/calls/${callId}/fileinfo/in`);
        const data = await response.json();
        
        if (data.success) {
          const newDuration = data.data.estimatedDuration;
          const fileSize = data.data.size;
          
          // Update duration if it changed significantly
          if (Math.abs(newDuration - duration) > 1) {
            setDuration(newDuration);
            setBufferAhead(Math.max(0, newDuration - currentTime));
            
            // If we have new data and we're near the end, refresh the audio source
            const clientAudio = clientAudioRef.current;
            if (clientAudio && isPlaying && (newDuration - currentTime) < 2) {
              setIsLoading(true);
              
              // Create new URL with cache buster
              const newSource = `/api/calls/${callId}/stream/in?t=${Date.now()}`;
              
              if (newSource !== currentSourceRef.current) {
                const savedTime = clientAudio.currentTime;
                const savedPlaying = !clientAudio.paused;
                
                // Update source
                clientAudio.src = newSource;
                currentSourceRef.current = newSource;
                
                // Wait for load and restore position
                clientAudio.addEventListener('loadeddata', () => {
                  clientAudio.currentTime = savedTime;
                  if (savedPlaying) {
                    clientAudio.play().then(() => {
                      setIsLoading(false);
                    }).catch(() => {
                      setIsLoading(false);
                    });
                  } else {
                    setIsLoading(false);
                  }
                }, { once: true });
                
                clientAudio.load();
              } else {
                setIsLoading(false);
              }
            }
          }
        }
      } catch (error) {
        console.error('Erreur mise à jour stream:', error);
      }
    };

    // Update every 2 seconds for active calls
    const interval = setInterval(updateStream, 2000);
    updateStream(); // Initial update

    return () => clearInterval(interval);
  }, [callId, status, duration, currentTime, isPlaying]);

  // Handle audio events
  useEffect(() => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (!clientAudio) return;

    const handleTimeUpdate = () => {
      const time = clientAudio.currentTime;
      setCurrentTime(time);
      setBufferAhead(Math.max(0, duration - time));
    };

    const handleLoadedMetadata = () => {
      if (clientAudio.duration && clientAudio.duration > duration) {
        setDuration(clientAudio.duration);
      }
      
      // Auto-position for active calls
      if (status === 'active' && clientAudio.duration > 10) {
        const startPos = Math.max(0, clientAudio.duration - 10);
        clientAudio.currentTime = startPos;
        if (agentAudio) agentAudio.currentTime = startPos;
        setCurrentTime(startPos);
      }
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handleWaiting = () => {
      if (status === 'active') {
        setIsLoading(true);
      }
    };

    const handleEnded = () => {
      if (status === 'completed') {
        setIsPlaying(false);
      }
      // For active calls, the update loop will handle refreshing
    };

    clientAudio.addEventListener('timeupdate', handleTimeUpdate);
    clientAudio.addEventListener('loadedmetadata', handleLoadedMetadata);
    clientAudio.addEventListener('canplay', handleCanPlay);
    clientAudio.addEventListener('waiting', handleWaiting);
    clientAudio.addEventListener('ended', handleEnded);

    return () => {
      clientAudio.removeEventListener('timeupdate', handleTimeUpdate);
      clientAudio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      clientAudio.removeEventListener('canplay', handleCanPlay);
      clientAudio.removeEventListener('waiting', handleWaiting);
      clientAudio.removeEventListener('ended', handleEnded);
    };
  }, [duration, status]);

  // Auto-start for active calls
  useEffect(() => {
    if (status === 'active' && hasClientFile) {
      setTimeout(() => {
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
      } else {
        // Set initial source if not set
        if (!clientAudio.src || !currentSourceRef.current) {
          const initialSource = `/api/calls/${callId}/stream/in?t=${Date.now()}`;
          clientAudio.src = initialSource;
          currentSourceRef.current = initialSource;
          if (agentAudio) {
            agentAudio.src = `/api/calls/${callId}/stream/out?t=${Date.now()}`;
          }
        }

        await clientAudio.play();
        if (agentAudio) await agentAudio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Erreur play/pause:', error);
      setIsLoading(false);
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
    setIsLoading(false);
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

  const getStatusColor = () => {
    if (isLoading) return 'warning.main';
    if (status === 'active') {
      return bufferAhead <= 3 ? 'error.main' : 'success.main';
    }
    return 'text.secondary';
  };

  const getStatusText = () => {
    if (isLoading) return '🔄 Chargement...';
    if (status === 'active') {
      if (bufferAhead <= 3) return '⚠️ Buffer faible';
      return '🔴 EN DIRECT';
    }
    return '📁 Terminé';
  };

  return (
    <Paper elevation={6} sx={{ p: 3, mt: 4, position: 'sticky', bottom: 0, zIndex: 1000 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">
            🎵 Live Stream - {phoneNumber} {calledNumber && `→ ${calledNumber}`}
          </Typography>
          <Typography variant="caption" sx={{ color: getStatusColor() }}>
            {getStatusText()} {status === 'active' && `- Buffer: ${formatTime(bufferAhead)}`}
          </Typography>
        </Box>
        {onClose && (
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        )}
      </Box>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Audio elements */}
      {hasClientFile && (
        <audio
          ref={clientAudioRef}
          volume={volume}
          muted={isMuted}
          preload="metadata"
          style={{ display: 'none' }}
        />
      )}
      {hasAgentFile && (
        <audio
          ref={agentAudioRef}
          volume={volume}
          muted={isMuted}
          preload="metadata"
          style={{ display: 'none' }}
        />
      )}

      {/* Controls */}
      <Grid container spacing={2} alignItems="center">
        <Grid item>
          <IconButton onClick={handlePlayPause} disabled={!hasClientFile || isLoading}>
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
          <IconButton onClick={handleStop} disabled={isLoading}>
            <Stop />
          </IconButton>
        </Grid>

        <Grid item xs>
          <Slider
            value={currentTime}
            max={duration}
            onChange={handleSeek}
            disabled={!duration || isLoading}
            sx={{
              '& .MuiSlider-track': {
                backgroundColor: getStatusColor()
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
              <Typography variant="caption" sx={{ color: getStatusColor() }}>
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
              disabled={isLoading}
            />
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default LiveStreamPlayer;
