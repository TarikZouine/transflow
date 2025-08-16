import React, { useRef, useEffect, useState } from 'react';
import {
  Box, Typography, Slider, IconButton, Paper, Grid,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, VolumeUp, VolumeOff, Close,
} from '@mui/icons-material';

interface WorkingStreamPlayerProps {
  callId: string;
  phoneNumber: string;
  calledNumber?: string;
  hasClientFile: boolean;
  hasAgentFile: boolean;
  status: 'active' | 'completed';
  onClose?: () => void;
}

const WorkingStreamPlayer: React.FC<WorkingStreamPlayerProps> = ({
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
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastDurationRef = useRef(0);

  // Update duration for active calls
  useEffect(() => {
    if (status !== 'active') return;

    const updateDuration = async () => {
      try {
        const response = await fetch(`/api/calls/${callId}/fileinfo/in`);
        const data = await response.json();
        
        if (data.success) {
          const newDuration = data.data.estimatedDuration;
          
          // Only update if duration increased significantly
          if (newDuration > lastDurationRef.current + 1) {
            setDuration(newDuration);
            lastDurationRef.current = newDuration;
            
            const clientAudio = clientAudioRef.current;
            if (clientAudio && isPlaying) {
              // Force browser to recognize new data by updating currentTime slightly
              const currentPos = clientAudio.currentTime;
              clientAudio.currentTime = currentPos + 0.01;
              setTimeout(() => {
                if (clientAudio && !clientAudio.paused) {
                  clientAudio.currentTime = currentPos;
                }
              }, 100);
            }
            
            setStreamInfo(`Live - Durée: ${Math.floor(newDuration)}s`);
          }
        }
      } catch (error) {
        console.error('Erreur durée:', error);
      }
    };

    refreshIntervalRef.current = setInterval(updateDuration, 2000);
    updateDuration();

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [callId, status, isPlaying]);

  // Audio events
  useEffect(() => {
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;

    if (!clientAudio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(clientAudio.currentTime);
    };

    const handleLoadedMetadata = () => {
      const audioDuration = clientAudio.duration;
      if (audioDuration && audioDuration > duration) {
        setDuration(audioDuration);
        lastDurationRef.current = audioDuration;
      }
      
      // Auto-position for active calls
      if (status === 'active' && audioDuration > 10) {
        const startPos = Math.max(0, audioDuration - 10);
        clientAudio.currentTime = startPos;
        if (agentAudio) agentAudio.currentTime = startPos;
        setCurrentTime(startPos);
      }
      
      setStreamInfo('Prêt');
    };

    const handleCanPlay = () => {
      setStreamInfo(status === 'active' ? 'Streaming live' : 'Prêt à lire');
    };

    const handleEnded = () => {
      if (status === 'completed') {
        setIsPlaying(false);
        setStreamInfo('Terminé');
      } else {
        // For active calls, try to continue
        setStreamInfo('Attente données...');
        setTimeout(() => {
          if (clientAudio && isPlaying) {
            clientAudio.play().catch(() => {
              console.log('Pas de nouvelles données pour le moment');
            });
          }
        }, 1000);
      }
    };

    const handleError = (e: Event) => {
      console.error('Erreur audio:', e);
      setStreamInfo('Erreur lecture');
    };

    const handleWaiting = () => {
      if (status === 'active') {
        setStreamInfo('Chargement...');
      }
    };

    clientAudio.addEventListener('timeupdate', handleTimeUpdate);
    clientAudio.addEventListener('loadedmetadata', handleLoadedMetadata);
    clientAudio.addEventListener('canplay', handleCanPlay);
    clientAudio.addEventListener('ended', handleEnded);
    clientAudio.addEventListener('error', handleError);
    clientAudio.addEventListener('waiting', handleWaiting);

    return () => {
      clientAudio.removeEventListener('timeupdate', handleTimeUpdate);
      clientAudio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      clientAudio.removeEventListener('canplay', handleCanPlay);
      clientAudio.removeEventListener('ended', handleEnded);
      clientAudio.removeEventListener('error', handleError);
      clientAudio.removeEventListener('waiting', handleWaiting);
    };
  }, [status, duration, isPlaying]);

  // Auto-start for active calls
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
        // Ensure volume is set
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

  const handleVolumeChange = (event: Event, newValue: number | number[]) => {
    const newVolume = (newValue as number) / 100;
    setVolume(newVolume);
    
    const clientAudio = clientAudioRef.current;
    const agentAudio = agentAudioRef.current;
    
    if (clientAudio) clientAudio.volume = newVolume;
    if (agentAudio) agentAudio.volume = newVolume;
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
            {status === 'active' ? '🔴 LIVE STREAM' : '📁 PLAYBACK'} - {phoneNumber} {calledNumber && `→ ${calledNumber}`}
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

      {/* Audio elements with proper settings */}
      {hasClientFile && (
        <audio
          ref={clientAudioRef}
          src={`/api/calls/${callId}/stream/in`}
          preload="auto"
          style={{ display: 'none' }}
          crossOrigin="anonymous"
        />
      )}
      {hasAgentFile && (
        <audio
          ref={agentAudioRef}
          src={`/api/calls/${callId}/stream/out`}
          preload="auto"
          style={{ display: 'none' }}
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
              onChange={handleVolumeChange}
            />
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default WorkingStreamPlayer;
