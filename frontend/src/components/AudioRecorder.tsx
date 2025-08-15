import React, { useState, useRef, useEffect } from 'react';
import {
  Button,
  Box,
  Typography,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  Mic,
  MicOff,
  Stop,
  Pause,
  PlayArrow,
} from '@mui/icons-material';

interface AudioRecorderProps {
  onAudioData?: (data: ArrayBuffer) => void;
  onTranscription?: (text: string) => void;
  isRecording: boolean;
  onRecordingChange: (recording: boolean) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onAudioData,
  onTranscription,
  isRecording,
  onRecordingChange,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        if (startTimeRef.current) {
          setDuration(Date.now() - startTimeRef.current);
        }
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, isPaused]);

  const startRecording = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });

      // Configuration de l'analyse audio
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      // Animation de visualisation
      const updateAudioLevel = (): void => {
        if (analyserRef.current && isRecording) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255 * 100);
          animationRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();

      // Configuration du MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && onAudioData) {
          event.data.arrayBuffer().then(onAudioData);
        }
      };

      mediaRecorderRef.current.start(1000); // Chunks de 1 seconde
      startTimeRef.current = Date.now();
      onRecordingChange(true);
      
    } catch (error) {
      console.error('Erreur lors du démarrage de l\'enregistrement:', error);
    }
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    onRecordingChange(false);
    setIsPaused(false);
    setAudioLevel(0);
    setDuration(0);
    startTimeRef.current = null;
  };

  const pauseRecording = (): void => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = (): void => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="h6" gutterBottom>
        Enregistrement Audio
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <div className="audio-visualizer">
          <LinearProgress 
            variant="determinate" 
            value={audioLevel} 
            sx={{ 
              width: '80%', 
              height: 8,
              backgroundColor: 'rgba(255,255,255,0.3)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#fff'
              }
            }} 
          />
        </div>
      </Box>

      <Typography variant="body1" sx={{ mb: 2 }}>
        Durée: {formatDuration(duration)}
        {isRecording && (
          <span style={{ marginLeft: 8 }}>
            <span className="recording-indicator" />
            {isPaused ? ' En pause' : ' Enregistrement...'}
          </span>
        )}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
        {!isRecording ? (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Mic />}
            onClick={startRecording}
            size="large"
          >
            Démarrer
          </Button>
        ) : (
          <>
            {!isPaused ? (
              <Button
                variant="outlined"
                startIcon={<Pause />}
                onClick={pauseRecording}
              >
                Pause
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                startIcon={<PlayArrow />}
                onClick={resumeRecording}
              >
                Reprendre
              </Button>
            )}
            <Button
              variant="contained"
              color="error"
              startIcon={<Stop />}
              onClick={stopRecording}
            >
              Arrêter
            </Button>
          </>
        )}
      </Box>
    </Paper>
  );
};

export default AudioRecorder;
