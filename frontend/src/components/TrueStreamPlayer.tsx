import React, { useRef, useEffect, useState } from 'react';
import {
  Box, Typography, Slider, IconButton, Paper, Grid,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, VolumeUp, VolumeOff, Close,
} from '@mui/icons-material';

interface TrueStreamPlayerProps {
  callId: string;
  phoneNumber: string;
  calledNumber?: string;
  hasClientFile: boolean;
  hasAgentFile: boolean;
  status: 'active' | 'completed';
  onClose?: () => void;
}

const TrueStreamPlayer: React.FC<TrueStreamPlayerProps> = ({
  callId, phoneNumber, calledNumber, hasClientFile, hasAgentFile, status, onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [streamStatus, setStreamStatus] = useState('Initialisation...');

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const isStreamingRef = useRef(false);
  const audioDataRef = useRef<Uint8Array>(new Uint8Array());

  // Initialize Web Audio API
  useEffect(() => {
    const initAudio = async () => {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        gainNodeRef.current.gain.value = volume;
        setStreamStatus('Audio initialisé');
      } catch (error) {
        console.error('Erreur Web Audio:', error);
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

  // Stream audio data progressively
  const streamAudio = async () => {
    if (!audioContextRef.current || isStreamingRef.current) return;
    
    isStreamingRef.current = true;
    setStreamStatus('Streaming...');
    let offset = 0;

    const streamLoop = async () => {
      try {
        // Fetch audio chunk
        const response = await fetch(`/api/calls/${callId}/stream/in`, {
          headers: {
            'Range': `bytes=${offset}-${offset + 65536}` // 64KB chunks
          }
        });

        if (response.status === 206 || response.status === 200) {
          const arrayBuffer = await response.arrayBuffer();
          const chunk = new Uint8Array(arrayBuffer);
          
          if (chunk.length > 0) {
            // Append to audio data
            const newData = new Uint8Array(audioDataRef.current.length + chunk.length);
            newData.set(audioDataRef.current);
            newData.set(chunk, audioDataRef.current.length);
            audioDataRef.current = newData;
            
            offset += chunk.length;
            
            // Try to decode and play if we have enough data
            if (audioDataRef.current.length >= 1024 && audioContextRef.current) {
              try {
                const audioBuffer = await audioContextRef.current.decodeAudioData(audioDataRef.current.buffer.slice(0));
                
                // Stop previous source
                if (sourceNodeRef.current) {
                  sourceNodeRef.current.stop();
                }
                
                // Create new source
                sourceNodeRef.current = audioContextRef.current.createBufferSource();
                sourceNodeRef.current.buffer = audioBuffer;
                sourceNodeRef.current.connect(gainNodeRef.current!);
                
                // Start from where we left off
                const when = audioContextRef.current.currentTime;
                sourceNodeRef.current.start(when, nextStartTimeRef.current);
                
                setDuration(audioBuffer.duration);
                setStreamStatus(`Lecture: ${Math.floor(audioBuffer.duration)}s`);
                
                // Schedule next chunk
                nextStartTimeRef.current = audioBuffer.duration;
                
              } catch (decodeError) {
                // Not enough data or invalid format, continue streaming
                console.log('Décodage en attente...');
              }
            }
          }
        }
        
        // Continue streaming for active calls
        if (status === 'active' && isStreamingRef.current) {
          setTimeout(streamLoop, 500);
        }
        
      } catch (error) {
        console.error('Erreur streaming:', error);
        setStreamStatus('Erreur streaming');
      }
    };

    // Start from near the end for live streaming
    if (status === 'active') {
      try {
        const response = await fetch(`/api/calls/${callId}/fileinfo/in`);
        const data = await response.json();
        if (data.success && data.data.clientSize > 100000) {
          offset = Math.max(0, data.data.clientSize - 100000); // Start 100KB from end
        }
      } catch (error) {
        // Start from beginning
      }
    }

    streamLoop();
  };

  const handlePlayPause = async () => {
    if (!audioContextRef.current) return;

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
      isStreamingRef.current = false;
      setIsPlaying(false);
      setStreamStatus('Pausé');
    } else {
      setIsPlaying(true);
      await streamAudio();
    }
  };

  const handleStop = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
    }
    isStreamingRef.current = false;
    setIsPlaying(false);
    setCurrentTime(0);
    nextStartTimeRef.current = 0;
    audioDataRef.current = new Uint8Array();
    setStreamStatus('Arrêté');
  };

  // Auto-start for active calls
  useEffect(() => {
    if (status === 'active' && hasClientFile) {
      setTimeout(() => {
        handlePlayPause();
      }, 1000);
    }
  }, [status, hasClientFile]);

  // Update current time
  useEffect(() => {
    if (!isPlaying || !audioContextRef.current) return;

    const updateTime = () => {
      if (audioContextRef.current) {
        setCurrentTime(audioContextRef.current.currentTime);
      }
    };

    const interval = setInterval(updateTime, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

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
            🎵 True Streaming - {phoneNumber} {calledNumber && `→ ${calledNumber}`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {streamStatus}
          </Typography>
        </Box>
        {onClose && (
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        )}
      </Box>

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
              onChange={(_, v) => {
                const newVolume = (v as number) / 100;
                setVolume(newVolume);
                if (gainNodeRef.current) {
                  gainNodeRef.current.gain.value = newVolume;
                }
              }}
            />
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default TrueStreamPlayer;
