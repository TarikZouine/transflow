import React, { useRef, useEffect, useState } from 'react';
import {
  Box, Typography, Slider, IconButton, Paper, Grid,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, VolumeUp, VolumeOff, Close,
} from '@mui/icons-material';

interface ContinuousStreamPlayerProps {
  callId: string;
  phoneNumber: string;
  calledNumber?: string;
  hasClientFile: boolean;
  hasAgentFile: boolean;
  status: 'active' | 'completed';
  onClose?: () => void;
}

const ContinuousStreamPlayer: React.FC<ContinuousStreamPlayerProps> = ({
  callId, phoneNumber, calledNumber, hasClientFile, hasAgentFile, status, onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isWaitingForData, setIsWaitingForData] = useState(false);

  const clientAudioRef = useRef<HTMLAudioElement>(null);
  const agentAudioRef = useRef<HTMLAudioElement>(null);

  // Monitor file size and update duration
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
            
            // If we were waiting for data and now have more, continue playing
            if (isWaitingForData && clientAudioRef.current) {
              const audio = clientAudioRef.current;
              const currentPos = audio.currentTime;
              
              // Force browser to re-examine the file
              audio.load();
              audio.addEventListener('loadeddata', () => {
                audio.currentTime = currentPos;
                if (isPlaying) {
                  audio.play();
                  setIsWaitingForData(false);
                }
              }, { once: true });
            }
          }
        }
      } catch (error) {
        console.error('Erreur mise à jour durée:', error);
      }
    };

    const interval = setInterval(updateDuration, 1000); // Check every second
    updateDuration(); // Initial check

    return () => clearInterval(interval);
  }, [callId, status, duration, isWaitingForData, isPlaying]);

  // Audio event handlers
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
        console.log('Reached end, waiting for more data...');
        setIsWaitingForData(true);
        // Don't stop playing - wait for more data
      } else {
        setIsPlaying(false);
      }
    };

    const handleWaiting = () => {
      if (status === 'active') {
        console.log('Audio waiting for data...');
        setIsWaitingForData(true);
      }
    };

    const handleCanPlay = () => {
      if (isWaitingForData) {
        console.log('Can play again, resuming...');
        setIsWaitingForData(false);
      }
    };

    clientAudio.addEventListener('timeupdate', handleTimeUpdate);
    clientAudio.addEventListener('loadedmetadata', handleLoadedMetadata);
    clientAudio.addEventListener('ended', handleEnded);
    clientAudio.addEventListener('waiting', handleWaiting);
    clientAudio.addEventListener('canplay', handleCanPlay);

    return () => {
      clientAudio.removeEventListener('timeupdate', handleTimeUpdate);
      clientAudio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      clientAudio.removeEventListener('ended', handleEnded);
      clientAudio.removeEventListener('waiting', handleWaiting);
      clientAudio.removeEventListener('canplay', handleCanPlay);
    };
  }, [callId, status, isWaitingForData]);

  // Auto-start for active calls
  useEffect(() => {
    if (status === 'active' && hasClientFile) {
      setTimeout(() => {
        handlePlayPause();
      }, 500);
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
    setIsWaitingForData(false);
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

  const bufferAhead = Math.max(0, duration - currentTime);

  return (
    <Paper elevation={6} sx={{ p: 3, mt: 4, position: 'sticky', bottom: 0, zIndex: 1000 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">
            {status === 'active' ? '🔴 STREAMING CONTINU' : '📁 LECTURE'} - {phoneNumber} {calledNumber && `→ ${calledNumber}`}
          </Typography>
          <Typography variant="caption" color={isWaitingForData ? 'warning.main' : 'text.secondary'}>
            {isWaitingForData ? '⏳ Attente nouvelles données...' : `Buffer: ${formatTime(bufferAhead)}`}
          </Typography>
        </Box>
        {onClose && (
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        )}
      </Box>

      {/* Audio elements with special attributes for streaming */}
      {hasClientFile && (
        <audio
          ref={clientAudioRef}
          src={`/api/calls/${callId}/stream/in`}
          volume={volume}
          muted={isMuted}
          preload="auto"
          // These attributes help with streaming
          controls={false}
          crossOrigin="anonymous"
        />
      )}
      {hasAgentFile && (
        <audio
          ref={agentAudioRef}
          src={`/api/calls/${callId}/stream/out`}
          volume={volume}
          muted={isMuted}
          preload="auto"
          controls={false}
          crossOrigin="anonymous"
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
                backgroundColor: isWaitingForData ? 'warning.main' : 'primary.main'
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
              <Typography variant="caption" color={bufferAhead <= 5 ? 'warning.main' : 'success.main'}>
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

export default ContinuousStreamPlayer;
