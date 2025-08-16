import React, { useRef, useEffect, useState } from 'react';
import {
  Box, Typography, Slider, IconButton, Paper, Grid, Tooltip, LinearProgress,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, VolumeUp, VolumeOff, Close,
} from '@mui/icons-material';

interface RealAudioPlayerProps {
  callId: string;
  phoneNumber: string;
  calledNumber?: string;
  hasClientFile: boolean;
  hasAgentFile: boolean;
  status: 'active' | 'completed';
  onClose?: () => void;
}

const RealAudioPlayer: React.FC<RealAudioPlayerProps> = ({
  callId, phoneNumber, calledNumber, hasClientFile, hasAgentFile, status, onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [streamStatus, setStreamStatus] = useState('Initialisation...');

  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  // Streaming state
  const clientOffsetRef = useRef(0);
  const agentOffsetRef = useRef(0);
  const audioBuffersRef = useRef<Float32Array[]>([]);
  const isStreamingRef = useRef(false);

  // Initialize Web Audio API
  useEffect(() => {
    const initAudio = async () => {
      try {
        audioContextRef.current = new AudioContext();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        gainNodeRef.current.gain.value = volume;
        
        setStreamStatus('Audio initialisé');
      } catch (error) {
        console.error('Erreur initialisation audio:', error);
        setStreamStatus('Erreur audio');
      }
    };

    initAudio();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Simplified approach: use dynamic audio element with range requests
  const streamAudioData = async () => {
    if (!hasClientFile) return;
    
    setStreamStatus('Streaming simplifié...');
    
    // Create a dynamic audio element that we refresh periodically
    const audio = new Audio();
    audio.volume = volume;
    audio.muted = isMuted;
    
    // Start from near the end for live streaming
    const updateAudio = async () => {
      try {
        const timestamp = Date.now();
        audio.src = `/api/calls/${callId}/stream/in?t=${timestamp}`;
        
        audio.addEventListener('loadedmetadata', () => {
          const newDuration = audio.duration;
          if (newDuration > duration) {
            setDuration(newDuration);
            
            // For live streaming, start near the end
            if (status === 'active' && currentTime === 0) {
              const startPos = Math.max(0, newDuration - 10);
              audio.currentTime = startPos;
              setCurrentTime(startPos);
            }
          }
        }, { once: true });
        
        audio.addEventListener('timeupdate', () => {
          setCurrentTime(audio.currentTime);
        });
        
        if (isPlaying) {
          await audio.play();
          setStreamStatus('Lecture en cours');
        }
        
      } catch (error) {
        console.error('Erreur lecture:', error);
        setStreamStatus('Erreur lecture');
      }
    };
    
    // Initial load
    await updateAudio();
    
    // Refresh audio source every 3 seconds for live calls
    if (status === 'active') {
      const refreshInterval = setInterval(async () => {
        if (!isPlaying) return;
        
        const currentPos = audio.currentTime;
        const timeFromEnd = audio.duration - currentPos;
        
        // Only refresh if we're close to the end
        if (timeFromEnd <= 5) {
          console.log('Rafraîchissement pour nouvelles données');
          await updateAudio();
          audio.currentTime = currentPos;
        }
      }, 3000);
      
      // Cleanup
      return () => {
        clearInterval(refreshInterval);
        audio.pause();
        audio.src = '';
      };
    }
  };

  const handlePlayPause = async () => {
    if (!audioContextRef.current) return;

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      setIsPlaying(false);
      isStreamingRef.current = false;
      setStreamStatus('Pausé');
    } else {
      setIsPlaying(true);
      streamAudioData();
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    isStreamingRef.current = false;
    clientOffsetRef.current = 0;
    agentOffsetRef.current = 0;
    setCurrentTime(0);
    setStreamStatus('Arrêté');
  };

  const handleVolumeChange = (event: Event, newValue: number | number[]) => {
    const vol = Array.isArray(newValue) ? newValue[0] : newValue;
    setVolume(vol);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = vol;
    }
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
          🎵 Streaming Audio Temps Réel - {phoneNumber} {calledNumber && `→ ${calledNumber}`}
        </Typography>
        {onClose && (
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        )}
      </Box>

      {/* Status */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {streamStatus}
      </Typography>

      {/* Buffer Progress */}
      <LinearProgress 
        variant="determinate" 
        value={bufferProgress} 
        sx={{ mb: 2, height: 8, borderRadius: 4 }}
      />

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
              onChange={(e, v) => handleVolumeChange(e, (v as number) / 100)}
              sx={{ flexGrow: 1 }}
            />
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default RealAudioPlayer;
