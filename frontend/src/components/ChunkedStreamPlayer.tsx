import React, { useRef, useEffect, useState } from 'react';
import {
  Box, Typography, Slider, IconButton, Paper, Grid, LinearProgress,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, VolumeUp, VolumeOff, Close,
} from '@mui/icons-material';

interface ChunkedStreamPlayerProps {
  callId: string;
  phoneNumber: string;
  calledNumber?: string;
  hasClientFile: boolean;
  hasAgentFile: boolean;
  status: 'active' | 'completed';
  onClose?: () => void;
}

const ChunkedStreamPlayer: React.FC<ChunkedStreamPlayerProps> = ({
  callId, phoneNumber, calledNumber, hasClientFile, hasAgentFile, status, onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [streamInfo, setStreamInfo] = useState('Initialisation...');
  const [bufferProgress, setBufferProgress] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioBufferRef = useRef<Float32Array>(new Float32Array());
  const playPositionRef = useRef(0);
  const nextByteRef = useRef(0);
  const isStreamingRef = useRef(false);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Web Audio API
  useEffect(() => {
    const initAudio = async () => {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        gainNodeRef.current.gain.value = volume;
        setStreamInfo('Audio initialisé');
      } catch (error) {
        console.error('Erreur Web Audio:', error);
        setStreamInfo('Erreur audio');
      }
    };
    initAudio();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, []);

  // Fetch and decode audio chunks
  const fetchAudioChunk = async () => {
    if (!audioContextRef.current) return false;

    try {
      const response = await fetch(`/api/calls/${callId}/chunked-stream/in?start=${nextByteRef.current}`);
      const data = await response.json();

      if (data.hasData) {
        // Decode base64 audio data
        const binaryString = atob(data.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Convert to audio buffer (simplified WAV processing)
        // Note: This is a simplified approach - real WAV parsing would be more complex
        const audioData = new Float32Array(bytes.length / 2);
        for (let i = 0; i < audioData.length; i++) {
          // Convert 16-bit PCM to float
          const sample = (bytes[i * 2] | (bytes[i * 2 + 1] << 8));
          audioData[i] = sample < 32768 ? sample / 32768 : (sample - 65536) / 32768;
        }

        // Append to buffer
        const newBuffer = new Float32Array(audioBufferRef.current.length + audioData.length);
        newBuffer.set(audioBufferRef.current);
        newBuffer.set(audioData, audioBufferRef.current.length);
        audioBufferRef.current = newBuffer;

        nextByteRef.current = data.nextStart;
        
        // Update duration estimate (44100 samples per second for WAV)
        const newDuration = audioBufferRef.current.length / 44100;
        setDuration(newDuration);
        
        const progress = (data.nextStart / data.fileSize) * 100;
        setBufferProgress(progress);
        setStreamInfo(`Buffer: ${Math.floor(newDuration)}s (${Math.floor(progress)}%)`);

        return data.isActive; // Continue if active
      } else {
        setStreamInfo(data.isActive ? 'En attente de données...' : 'Terminé');
        return data.isActive;
      }
    } catch (error) {
      console.error('Erreur fetch chunk:', error);
      setStreamInfo('Erreur réseau');
      return false;
    }
  };

  // Start streaming
  const startStreaming = async () => {
    if (isStreamingRef.current || !audioContextRef.current) return;
    
    isStreamingRef.current = true;
    setStreamInfo('Démarrage streaming...');

    // For active calls, start near the end
    if (status === 'active') {
      try {
        const response = await fetch(`/api/calls/${callId}/fileinfo/in`);
        const data = await response.json();
        if (data.success && data.data.size > 100000) {
          nextByteRef.current = Math.max(0, data.data.size - 100000);
        }
      } catch (error) {
        // Start from beginning
      }
    }

    // Fetch initial chunks
    let continueStreaming = await fetchAudioChunk();
    
    if (continueStreaming || status === 'active') {
      streamIntervalRef.current = setInterval(async () => {
        const shouldContinue = await fetchAudioChunk();
        if (!shouldContinue && status === 'completed') {
          if (streamIntervalRef.current) {
            clearInterval(streamIntervalRef.current);
            streamIntervalRef.current = null;
          }
          isStreamingRef.current = false;
        }
      }, 1000); // Fetch new chunks every second
    }
  };

  // Play audio from buffer
  const playAudio = async () => {
    if (!audioContextRef.current || audioBufferRef.current.length === 0) return;

    try {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Create audio buffer
      const audioBuffer = audioContextRef.current.createBuffer(1, audioBufferRef.current.length, 44100);
      audioBuffer.getChannelData(0).set(audioBufferRef.current);

      // Create source
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNodeRef.current!);

      // Start from current position
      const startOffset = playPositionRef.current;
      source.start(0, startOffset);
      
      // Track time
      const startTime = audioContextRef.current.currentTime;
      const updateTime = () => {
        if (isPlaying && audioContextRef.current) {
          const elapsed = audioContextRef.current.currentTime - startTime;
          setCurrentTime(startOffset + elapsed);
          if (isPlaying) {
            requestAnimationFrame(updateTime);
          }
        }
      };
      requestAnimationFrame(updateTime);

      setIsPlaying(true);
      setStreamInfo('Lecture en cours');

    } catch (error) {
      console.error('Erreur lecture:', error);
      setStreamInfo('Erreur lecture');
    }
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      // Stop current playback
      setIsPlaying(false);
      playPositionRef.current = currentTime;
      setStreamInfo('Pausé');
    } else {
      if (!isStreamingRef.current) {
        await startStreaming();
        // Wait a bit for initial data
        setTimeout(() => {
          playAudio();
        }, 2000);
      } else {
        await playAudio();
      }
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    playPositionRef.current = 0;
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    isStreamingRef.current = false;
    setStreamInfo('Arrêté');
  };

  // Auto-start for active calls
  useEffect(() => {
    if (status === 'active' && hasClientFile) {
      setTimeout(() => {
        handlePlayPause();
      }, 1000);
    }
  }, [status, hasClientFile]);

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
            🎵 Chunked Stream - {phoneNumber} {calledNumber && `→ ${calledNumber}`}
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

      {/* Buffer progress */}
      {isStreamingRef.current && (
        <LinearProgress 
          variant="determinate" 
          value={bufferProgress} 
          sx={{ mb: 2, height: 6, borderRadius: 3 }} 
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
            disabled={true} // Disable seeking for now
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

export default ChunkedStreamPlayer;
