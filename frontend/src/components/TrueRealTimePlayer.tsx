import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, IconButton, Paper, Grid, LinearProgress, Chip, Button,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, VolumeUp, VolumeOff, Close,
} from '@mui/icons-material';

interface TrueRealTimePlayerProps {
  callId: string;
  phoneNumber: string;
  calledNumber?: string;
  hasClientFile: boolean;
  hasAgentFile: boolean;
  status: 'active' | 'completed';
  onClose?: () => void;
}

const TrueRealTimePlayer: React.FC<TrueRealTimePlayerProps> = ({
  callId, phoneNumber, calledNumber, hasClientFile, hasAgentFile, status, onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [streamInfo, setStreamInfo] = useState('Initialisation...');
  const [bytesReceived, setBytesReceived] = useState(0);
  const [progress, setProgress] = useState(0);
  const [callStatus, setCallStatus] = useState(status);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [chunksReceived, setChunksReceived] = useState(0);
  const [chunksPlayed, setChunksPlayed] = useState(0);
  const [audioContextState, setAudioContextState] = useState('unknown');
  const [streamType, setStreamType] = useState<'in' | 'out' | 'both'>('both');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const audioBuffersRef = useRef<AudioBuffer[]>([]);
  const nextBufferTimeRef = useRef<number>(0);

  const addDebug = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [...prev.slice(-4), `${timestamp}: ${message}`]);
  }, []);

  const testWavFile = async () => {
    try {
      await initAudioContext();
      if (!audioContextRef.current) {
        addDebug('❌ Impossible de créer AudioContext pour WAV');
        return;
      }
      
      const ctx = audioContextRef.current;
      
      // Créer un fichier WAV simple avec un ton de test
      const sampleRate = 8000;
      const duration = 1; // 1 seconde
      const numSamples = sampleRate * duration;
      
      // En-tête WAV
      const wavHeader = new ArrayBuffer(44);
      const headerView = new DataView(wavHeader);
      
      // RIFF header
      headerView.setUint32(0, 0x52494646, false); // "RIFF"
      headerView.setUint32(4, 36 + numSamples * 2, true); // file size
      headerView.setUint32(8, 0x57415645, false); // "WAVE"
      
      // fmt chunk
      headerView.setUint32(12, 0x666d7420, false); // "fmt "
      headerView.setUint32(16, 16, true); // chunk size
      headerView.setUint16(20, 1, true); // PCM
      headerView.setUint16(22, 1, true); // mono
      headerView.setUint32(24, sampleRate, true);
      headerView.setUint32(28, sampleRate * 2, true);
      headerView.setUint16(32, 2, true);
      headerView.setUint16(34, 16, true);
      
      // data chunk
      headerView.setUint32(36, 0x64617461, false); // "data"
      headerView.setUint32(40, numSamples * 2, true);
      
      // Données audio - ton de test 440Hz
      const audioData = new ArrayBuffer(numSamples * 2);
      const audioView = new DataView(audioData);
      
      for (let i = 0; i < numSamples; i++) {
        const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 16383;
        audioView.setInt16(i * 2, sample, true);
      }
      
      // Combiner header + data
      const wavFile = new ArrayBuffer(44 + numSamples * 2);
      const wavView = new Uint8Array(wavFile);
      wavView.set(new Uint8Array(wavHeader), 0);
      wavView.set(new Uint8Array(audioData), 44);
      
      addDebug(`🎵 WAV créé: ${wavFile.byteLength} bytes`);
      
      // Décoder et jouer
      const audioBuffer = await ctx.decodeAudioData(wavFile.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
      
      addDebug(`🎵 WAV joué: ${audioBuffer.duration}s, ${audioBuffer.sampleRate}Hz`);
    } catch (error) {
      addDebug(`❌ Erreur test WAV: ${error.message}`);
    }
  };

  // Initialiser le contexte audio
  const initAudioContext = useCallback(async () => {
    try {
      // Si l'AudioContext est fermé, on le recrée complètement
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        addDebug('🆕 Création nouveau AudioContext');
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        gainNodeRef.current.gain.value = volume;
        addDebug(`AudioContext créé, volume: ${volume}`);
      }

      // Seulement reprendre si suspendu (pas fermé)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        addDebug(`AudioContext repris: ${audioContextRef.current.state}`);
      }
      
      setAudioContextState(audioContextRef.current.state);
      addDebug(`✅ AudioContext final state: ${audioContextRef.current.state}`);
      
      return audioContextRef.current.state === 'running';
    } catch (error) {
      addDebug(`❌ Erreur AudioContext: ${error}`);
      // En cas d'erreur, forcer une nouvelle création
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        gainNodeRef.current.gain.value = volume;
        addDebug('🔄 AudioContext recréé après erreur');
        setAudioContextState(audioContextRef.current.state);
        return audioContextRef.current.state === 'running';
      } catch (error2) {
        addDebug(`❌ Échec total AudioContext: ${error2}`);
        return false;
      }
    }
  }, [volume, addDebug]);

  // Convertir les données base64 en AudioBuffer
  const decodeAudioData = useCallback(async (base64Data: string) => {
    if (!audioContextRef.current) {
      addDebug('❌ Pas d\'AudioContext pour décoder');
      return null;
    }

    try {
      const binaryString = atob(base64Data);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      addDebug(`✅ Décodé: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels}ch`);
      return audioBuffer;
    } catch (error) {
      addDebug(`❌ Erreur décodage: ${error}`);
      console.error('Erreur décodage audio:', error);
      return null;
    }
  }, [addDebug]);

  // Jouer un buffer audio
  const playAudioBuffer = useCallback((audioBuffer: AudioBuffer) => {
    if (!audioContextRef.current || !gainNodeRef.current) {
      addDebug('❌ Pas d\'AudioContext/GainNode pour jouer');
      return;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNodeRef.current);
    
    // Timing séquentiel strict pour éviter l'écho
    const currentTime = audioContextRef.current.currentTime;
    const startTime = Math.max(currentTime + 0.01, nextBufferTimeRef.current); // +10ms buffer minimum
    source.start(startTime);
    
    // Pas d'overlap - chunks séquentiels stricts
    nextBufferTimeRef.current = startTime + audioBuffer.duration;
    setChunksPlayed(prev => prev + 1);
    addDebug(`🎵 Joué: chunk ${chunksPlayed + 1}, startTime: ${startTime.toFixed(3)}s, next: ${nextBufferTimeRef.current.toFixed(3)}s`);
  }, [addDebug, chunksPlayed]);

  // Démarrer le streaming temps réel
  const startRealTimeStream = useCallback(async () => {
    // FORCER la fermeture de toutes les connexions précédentes
    if (eventSourceRef.current) {
      console.log('🔌 Fermeture connexion précédente...');
      
      // Attendre la fermeture RÉELLE avec un Promise
      await new Promise<void>((resolve) => {
        const currentEventSource = eventSourceRef.current!;
        
        // Écouter l'événement de fermeture
        const onClose = () => {
          console.log('✅ Connexion précédente fermée');
          resolve();
        };
        
        // Fermer et attendre
        currentEventSource.addEventListener('error', onClose);
        currentEventSource.close();
        
        // Fallback au cas où l'événement ne se déclenche pas
        setTimeout(() => {
          console.log('⏰ Timeout fermeture connexion');
          resolve();
        }, 500);
      });
      
      eventSourceRef.current = null;
    }

    // Réinitialiser le buffer timing pour éviter l'écho
    nextBufferTimeRef.current = 0;
    setChunksPlayed(0);
    
    await initAudioContext();

    // Utiliser le stream mixé pour entendre les deux voix
    const streamUrl = `http://ai.intelios.us:5002/api/calls/${callId}/stream-sln/mixed`;
    
    setStreamInfo(`Connexion au streaming ${streamType}...`);
    
    eventSourceRef.current = new EventSource(streamUrl);

    eventSourceRef.current.addEventListener('connected', (event) => {
      const data = JSON.parse(event.data);
      setStreamInfo(`🔗 Connecté: ${data.message}`);
      addDebug('🔗 Stream connecté, FORÇAGE lecture à true');
      setIsPlaying(true); // Force la lecture à true
      console.log('Stream connecté:', data);
    });

    eventSourceRef.current.addEventListener('audio-chunk', async (event) => {
      const data = JSON.parse(event.data);
      setBytesReceived(prev => prev + data.chunkSize);
      setProgress((data.offset / data.fileSize) * 100);
      setCallStatus(data.callStatus);
      setChunksReceived(prev => prev + 1);

      addDebug(`📦 Chunk ${chunksReceived + 1}: ${data.chunkSize} bytes, playing: ${isPlaying}`);

      // Décoder et jouer le chunk audio
      const audioBuffer = await decodeAudioData(data.data);
      
      // Jouer directement si AudioContext est prêt
      if (audioBuffer && audioContextRef.current?.state === 'running') {
        playAudioBuffer(audioBuffer);
      } else if (!audioBuffer) {
        addDebug('❌ Échec décodage chunk');
      } else if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        addDebug('⚠️ AudioContext fermé, chunk mis en attente');
        // On pourrait stocker les chunks en attente ici
      } else {
        addDebug(`⏸️ AudioContext ${audioContextRef.current?.state}, chunk ignoré`);
      }

      setStreamInfo(`🎵 Lecture: ${(data.offset / 1024 / 1024).toFixed(1)} MB / ${(data.fileSize / 1024 / 1024).toFixed(1)} MB`);
    });

    eventSourceRef.current.addEventListener('status', (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress);
      setCallStatus(data.callStatus);
      
      if (data.callStatus === 'completed' && data.progress >= 100) {
        setStreamInfo('✅ Appel terminé - Lecture complète');
      } else if (data.callStatus === 'active') {
        setStreamInfo(`🔴 En cours: ${data.progress.toFixed(1)}%`);
      }
    });

    eventSourceRef.current.addEventListener('waiting', (event) => {
      const data = JSON.parse(event.data);
      setStreamInfo(`⏳ ${data.message}`);
    });

    eventSourceRef.current.addEventListener('error', (event) => {
      console.error('Erreur streaming:', event);
      setStreamInfo('❌ Erreur de connexion');
    });

    eventSourceRef.current.onerror = (error) => {
      console.error('EventSource error:', error);
      setStreamInfo('❌ Connexion perdue - Reconnexion...');
      
      // Reconnexion automatique après 2 secondes
      setTimeout(() => {
        if (isPlaying) {
          startRealTimeStream();
        }
      }, 2000);
    };
  }, [callId, hasClientFile, isPlaying, initAudioContext, decodeAudioData, playAudioBuffer]);

  // Contrôles de lecture
  const handlePlay = async () => {
    addDebug('🎬 Bouton Play cliqué - FORÇAGE isPlaying = true');
    setIsPlaying(true);
    await startRealTimeStream();
    addDebug('✅ Streaming démarré, isPlaying devrait être true');
    // Double vérification
    setTimeout(() => {
      addDebug(`🔍 Vérification: isPlaying = ${isPlaying}`);
    }, 100);
  };

  const handlePause = async () => {
    console.log('⏸️ Pause demandée - fermeture connexion');
    setIsPlaying(false);
    
    // Fermeture propre de la connexion avec attente
    if (eventSourceRef.current) {
      await new Promise<void>((resolve) => {
        const currentEventSource = eventSourceRef.current!;
        
        const onClose = () => {
          console.log('✅ Connexion fermée sur pause');
          resolve();
        };
        
        currentEventSource.addEventListener('error', onClose);
        currentEventSource.close();
        
        setTimeout(() => {
          console.log('⏰ Timeout fermeture pause');
          resolve();
        }, 300);
      });
      
      eventSourceRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.stop();
    }
    
    // Réinitialiser le timing pour éviter l'écho
    nextBufferTimeRef.current = 0;
    addDebug('⏸️ Pause + fermeture connexion confirmée');
  };

  const handleStop = () => {
    setIsPlaying(false);
    setBytesReceived(0);
    setProgress(0);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (sourceRef.current) {
      sourceRef.current.stop();
    }
    setStreamInfo('Arrêté');
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVolume;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? volume : 0;
    }
  };

  // Démarrage automatique
  useEffect(() => {
    let mounted = true;
    const autoStart = async () => {
      if (!mounted) return;
      addDebug('🚀 Composant monté, démarrage auto');
      setIsPlaying(true);
      await startRealTimeStream();
      if (mounted) addDebug('✅ Streaming auto-démarré');
    };
    autoStart();
    return () => { mounted = false; };
  }, []); // Pas de dépendances

  // Nettoyage
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (sourceRef.current) {
        sourceRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <Paper elevation={4} sx={{ p: 3, mt: 2, backgroundColor: '#f5f5f5' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" color="primary">
          🎧 Lecteur Temps Réel - {phoneNumber}
          {calledNumber && ` → ${calledNumber}`}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip 
            label={callStatus === 'active' ? 'EN COURS' : 'TERMINÉ'} 
            color={callStatus === 'active' ? 'success' : 'default'} 
            size="small"
          />
          {onClose && (
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Informations de streaming */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {streamInfo}
        </Typography>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ mt: 1, height: 8, borderRadius: 4 }}
        />
        <Typography variant="caption" color="text.secondary">
          {(bytesReceived / 1024 / 1024).toFixed(1)} MB reçus - {progress.toFixed(1)}%
        </Typography>
      </Box>

      {/* Contrôles */}
      <Grid container spacing={2} alignItems="center">
        <Grid item>
          <IconButton
            onClick={() => {
              addDebug(`🎮 Bouton ${isPlaying ? 'Pause' : 'Play'} cliqué (isPlaying: ${isPlaying})`);
              if (isPlaying) {
                handlePause();
              } else {
                handlePlay();
              }
            }}
            color="primary"
            size="large"
            disabled={!hasClientFile && !hasAgentFile}
          >
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
        </Grid>
        
        <Grid item>
          <IconButton onClick={handleStop} color="secondary">
            <Stop />
          </IconButton>
        </Grid>

        {audioContextState === 'closed' && (
          <Grid item>
            <Button 
              variant="contained" 
              color="secondary" 
              onClick={async () => {
                addDebug('🔴 Bouton Démarrer Audio cliqué');
                const success = await initAudioContext();
                if (success) {
                  setIsPlaying(true);
                  addDebug('✅ Audio démarré + lecture activée');
                } else {
                  addDebug('❌ Échec démarrage audio');
                }
              }}
              startIcon={<VolumeUp />}
              size="small"
            >
              Démarrer Audio
            </Button>
          </Grid>
        )}

        <Grid item>
          <Button 
            variant="outlined" 
            color="warning"
            onClick={async () => {
              // Test son simple
              const ctx = new AudioContext();
              const oscillator = ctx.createOscillator();
              const gain = ctx.createGain();
              
              oscillator.connect(gain);
              gain.connect(ctx.destination);
              
              oscillator.frequency.value = 440; // La note
              gain.gain.value = 0.1;
              
              oscillator.start();
              setTimeout(() => oscillator.stop(), 200);
              
              addDebug(`🔊 Test son: AudioContext.state = ${ctx.state}`);
            }}
            size="small"
          >
            🔊 Test Son
          </Button>
        </Grid>
        
        {/* Test WAV */}
        <Grid item>
          <Button
            variant="contained"
            color="secondary"
            onClick={testWavFile}
            size="small"
          >
            🎵 Test WAV
          </Button>
        </Grid>

        {/* Info: Stream mixé */}
        <Grid item>
          <Typography variant="caption" color="primary">
            🎭 Conversation complète (Client + Agent)
          </Typography>
        </Grid>

        <Grid item xs>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={toggleMute} size="small">
              {isMuted ? <VolumeOff /> : <VolumeUp />}
            </IconButton>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              style={{ width: '100px' }}
            />
            <Typography variant="caption">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Debug Info */}
      <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
        <Typography variant="caption" fontWeight="bold">
          🔧 Debug Audio:
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" display="block">
            AudioContext: {audioContextState} | Chunks: {chunksReceived} reçus, {chunksPlayed} joués | Volume: {Math.round(volume * 100)}%
          </Typography>
          {debugInfo.map((info, i) => (
            <Typography key={i} variant="caption" display="block" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {info}
            </Typography>
          ))}
        </Box>
      </Box>

      {/* Instructions */}
      <Box sx={{ mt: 2, p: 2, backgroundColor: '#e3f2fd', borderRadius: 1 }}>
        <Typography variant="caption" color="primary">
          💡 <strong>Temps Réel:</strong> Ce lecteur reçoit l'audio au fur et à mesure qu'il est généré.
          {callStatus === 'active' && ' L\'appel est en cours, vous entendez en direct !'}
        </Typography>
      </Box>
    </Paper>
  );
};

export default TrueRealTimePlayer;
