import React, { useRef, useEffect, useState } from 'react';
import {
  Box, Typography, Slider, IconButton, Paper, Grid,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, VolumeUp, VolumeOff, Close,
} from '@mui/icons-material';

interface SimpleStreamPlayerProps {
  callId: string;
  phoneNumber: string;
  calledNumber?: string;
  hasClientFile: boolean;
  hasAgentFile: boolean;
  status: 'active' | 'completed';
  onClose?: () => void;
}

const SimpleStreamPlayer: React.FC<SimpleStreamPlayerProps> = ({
  callId, phoneNumber, calledNumber, hasClientFile, hasAgentFile, status, onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  const clientAudioRef = useRef<HTMLAudioElement>(null);
  const agentAudioRef = useRef<HTMLAudioElement>(null);

  // Auto-start for active calls
  useEffect(() => {
    if (status === 'active' && hasClientFile) {
      // Auto-play after a short delay
      setTimeout(() => {
        handlePlayPause();
      }, 500);
    }
  }, [status, hasClientFile]);

  // Update time
  useEffect(() => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    const updateTime = () => {
      if (clientAudio) {
        setCurrentTime(clientAudio.currentTime);
        if (clientAudio.duration) {
          setDuration(clientAudio.duration);
        }
      }
    };

    const handleLoadedMetadata = () => {
      if (clientAudio && clientAudio.duration) {
        setDuration(clientAudio.duration);
        
        // For active calls, start near the end
        if (status === 'active') {
          const startPos = Math.max(0, clientAudio.duration - 10);
          clientAudio.currentTime = startPos;
          if (agentAudio) agentAudio.currentTime = startPos;
          setCurrentTime(startPos);
        }
      }
    };

    const handleEnded = () => {
      if (status === 'active') {
        // For active calls, reload and continue
        setTimeout(() => {
          const timestamp = Date.now();
          if (clientAudio) {
            const pos = clientAudio.currentTime;
            clientAudio.src = `/api/calls/${callId}/stream/in?t=${timestamp}`;
            clientAudio.load();
            clientAudio.addEventListener('loadeddata', () => {
              clientAudio.currentTime = pos;
              if (isPlaying) clientAudio.play();
            }, { once: true });
          }
          if (agentAudio) {
            const pos = agentAudio.currentTime;
            agentAudio.src = `/api/calls/${callId}/stream/out?t=${timestamp}`;
            agentAudio.load();
            agentAudio.addEventListener('loadeddata', () => {
              agentAudio.currentTime = pos;
              if (isPlaying) agentAudio.play();
            }, { once: true });
          }
        }, 1000);
      } else {
        setIsPlaying(false);
      }
    };

    if (clientAudio) {
      clientAudio.addEventListener('timeupdate', updateTime);
      clientAudio.addEventListener('loadedmetadata', handleLoadedMetadata);
      clientAudio.addEventListener('ended', handleEnded);
    }

    return () => {
      if (clientAudio) {
        clientAudio.removeEventListener('timeupdate', updateTime);
        clientAudio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        clientAudio.removeEventListener('ended', handleEnded);
      }
    };
  }, [callId, isPlaying, status]);

  // Periodic refresh for active calls
  useEffect(() => {
    if (status !== 'active' || !isPlaying) return;

    const refreshInterval = setInterval(() => {
      const clientAudio = clientAudioRef.current;
      const agentAudio = agentAudioRef.current;
      
      if (clientAudio && agentAudio) {
        const timeFromEnd = clientAudio.duration - clientAudio.currentTime;
        
        // Refresh if close to end
        if (timeFromEnd <= 3) {
          console.log('Refresh proche de la fin');
          const pos = clientAudio.currentTime;
          const timestamp = Date.now();
          
          clientAudio.src = `/api/calls/${callId}/stream/in?t=${timestamp}`;
          agentAudio.src = `/api/calls/${callId}/stream/out?t=${timestamp}`;
          
          clientAudio.load();
          agentAudio.load();
          
          clientAudio.addEventListener('loadeddata', () => {
            if (clientAudio.duration > duration) {
              setDuration(clientAudio.duration);
            }
            clientAudio.currentTime = pos;
            agentAudio.currentTime = pos;
            clientAudio.play();
            agentAudio.play();
          }, { once: true });
        }
      }
    }, 2000);

    return () => clearInterval(refreshInterval);
  }, [status, isPlaying, callId, duration]);

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
        await clientAudio.play();
        if (agentAudio) await agentAudio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Erreur play/pause:', error);
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

  return (
    <Paper elevation={6} sx={{ p: 3, mt: 4, position: 'sticky', bottom: 0, zIndex: 1000 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          {status === 'active' ? '🔴 LIVE' : '📁'} Streaming - {phoneNumber} {calledNumber && `→ ${calledNumber}`}
        </Typography>
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
          />
        </Grid>

        <Grid item>
          <Typography variant="body2">
            {formatTime(currentTime)} / {formatTime(duration)}
          </Typography>
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

export default SimpleStreamPlayer;
