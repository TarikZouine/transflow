import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Box, Paper, Typography, Chip, Grid } from '@mui/material';
import apiService from '../services/api';
import { getSocket } from '../services/ws';
import { keyframes } from '@mui/system';

// Animation pour les trois points
const dotsAnimation = keyframes`
  0%, 20% {
    color: rgba(0, 0, 0, 0);
    text-shadow: 0.25em 0 0 rgba(0, 0, 0, 0), 0.5em 0 0 rgba(0, 0, 0, 0);
  }
  40% {
    color: rgba(0, 0, 0, 0.8);
    text-shadow: 0.25em 0 0 rgba(0, 0, 0, 0), 0.5em 0 0 rgba(0, 0, 0, 0);
  }
  60% {
    text-shadow: 0.25em 0 0 rgba(0, 0, 0, 0.8), 0.5em 0 0 rgba(0, 0, 0, 0);
  }
  80%, 100% {
    text-shadow: 0.25em 0 0 rgba(0, 0, 0, 0.8), 0.5em 0 0 rgba(0, 0, 0, 0.8);
  }
`;

// Composant pour l'indicateur de transcription
const TranscriptionIndicator = () => (
  <Box
    component="span"
    sx={{
      display: 'inline-block',
      fontFamily: 'monospace',
      fontSize: '1.2em',
      animation: `${dotsAnimation} 1.4s infinite linear`,
      '&::after': {
        content: '""',
        display: 'inline-block',
        width: '0.5em',
        textAlign: 'left',
        animation: `${dotsAnimation} 1.4s infinite linear`,
        animationDelay: '0.2s',
      },
      '&::before': {
        content: '""',
        display: 'inline-block',
        width: '0.5em',
        textAlign: 'left',
        animation: `${dotsAnimation} 1.4s infinite linear`,
        animationDelay: '0.4s',
      }
    }}
  >
    ⏳
  </Box>
);

interface CallBrief {
  id: string;
  phoneNumber: string;
  calledNumber?: string;
  status: 'active' | 'completed';
}

const TranscriptsLive: React.FC = () => {
  const [calls, setCalls] = useState<CallBrief[]>([]);
  const [lines, setLines] = useState<Record<string, string[]>>({});

  const baseUrl = useMemo(() => {
    const env = (import.meta as any).env;
    const api = env?.VITE_API_URL || env?.VITE_API_BASE || 'http://ai.intelios.us:5002/api';
    const base = String(api).replace(/\/api$/, '');
    // Forcer http://hostname:5002 comme base WS
    return base;
  }, []);

  // Déduplication des transcripts pour éviter les doublons
  const processedTranscripts = useRef(new Set());
  const scrollRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Fonction pour charger l'historique des transcripts d'un appel
  const loadTranscriptHistory = async (callId: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/transcripts/${callId}?limit=100`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          setLines((prev) => {
            const existingLines = prev[callId] || [];
            const newLines = data.data.map((t: any) => {
              const prefix = t.speaker ? `${t.speaker}: ` : '';
              return `${new Date(t.ts_ms).toLocaleTimeString()} — ${prefix}${t.text}`;
            });
            
            // Combiner l'historique existant avec les nouveaux transcripts
            const combinedLines = [...existingLines, ...newLines];
            // Supprimer les doublons et garder les 200 plus récents
            const uniqueLines = Array.from(new Set(combinedLines)).slice(-200);
            
            return { ...prev, [callId]: uniqueLines };
          });
        }
      }
    } catch (error) {
      console.error('Erreur chargement historique:', error);
    }
  };

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const res = await apiService.getActiveCalls();
        if (res.success) {
          const newCalls = res.data.map((c: any) => ({ id: c.id, phoneNumber: c.phoneNumber, calledNumber: c.calledNumber, status: c.status }));
          setCalls(newCalls);
          
          // Charger l'historique pour chaque appel
          newCalls.forEach(call => {
            loadTranscriptHistory(call.id);
          });
        }
      } catch {}
    };
    fetchActive();
    const interval = setInterval(fetchActive, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = getSocket(baseUrl);
    const handler = (t: any) => {
      if (!t?.callId) return;
      
      // Créer une clé unique pour ce transcript
      const transcriptKey = `${t.callId}|${t.tsMs}|${t.speaker}|${t.offsetBytes}|${t.text}`;
      
      // Vérifier si ce transcript a déjà été traité
      if (processedTranscripts.current.has(transcriptKey)) {
        return; // Déjà traité, ignorer
      }
      
      // Marquer comme traité
      processedTranscripts.current.add(transcriptKey);
      
      // Limiter la taille du Set de déduplication
      if (processedTranscripts.current.size > 1000) {
        const firstKey = processedTranscripts.current.values().next().value;
        processedTranscripts.current.delete(firstKey);
      }
      
      setLines((prev) => {
        const arr = prev[t.callId] ? [...prev[t.callId]] : [];
        const prefix = t.speaker ? `${t.speaker}: ` : '';
        
        // Gérer les différents statuts
        if (t.status === 'transcribing') {
          // Remplacer ou ajouter l'indicateur "en cours"
          const existingIndex = arr.findIndex(line => 
            line.includes('⏳') && line.includes(t.speaker || '')
          );
          
          if (existingIndex >= 0) {
            // Mettre à jour l'indicateur existant (garder le même timestamp)
            const timestamp = arr[existingIndex].split(' — ')[0];
            arr[existingIndex] = `${timestamp} — ${prefix}⏳`;
          } else {
            // Ajouter un nouvel indicateur
            arr.push(`${new Date(t.tsMs).toLocaleTimeString()} — ${prefix}⏳`);
          }
        } else {
          // Remplacer l'indicateur "en cours" par le texte final
          const existingIndex = arr.findIndex(line => 
            line.includes('⏳') && line.includes(t.speaker || '')
          );
          
          // Ajouter le temps de traitement au texte
          const textWithTime = t.processingTimeMs ? 
            `${t.text} [${t.processingTimeMs}ms]` : 
            t.text;
          
          if (existingIndex >= 0) {
            arr[existingIndex] = `${new Date(t.tsMs).toLocaleTimeString()} — ${prefix}${textWithTime}`;
          } else {
            arr.push(`${new Date(t.tsMs).toLocaleTimeString()} — ${prefix}${textWithTime}`);
          }
        }
        
        // Faire défiler automatiquement vers le bas
        setTimeout(() => {
          const scrollEl = scrollRefs.current[t.callId];
          if (scrollEl) {
            scrollEl.scrollTop = scrollEl.scrollHeight;
          }
        }, 100);
        
        return { ...prev, [t.callId]: arr.slice(-200) };
      });
    };
    
    // Écouter seulement l'événement global pour éviter les doublons
    socket.on('transcript_all', handler);
    return () => {
      socket.off('transcript_all', handler);
    };
  }, [baseUrl]);

  // Abonnement par call pour recevoir aussi l'event 'transcript' (room)
  useEffect(() => {
    const socket = getSocket(baseUrl);
    // subscribe to each active call room
    calls.forEach(c => socket.emit('subscribe-call', c.id));
    
    // Pas besoin de handler ici car on écoute déjà transcript_all
    // Cela évite les doublons
  }, [baseUrl, calls.map(c => c.id).join(',')]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Transcriptions en temps réel</Typography>
      <Grid container spacing={2}>
        {calls.map((c) => (
          <Grid item xs={12} md={6} key={c.id}>
            <Paper elevation={2} sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" fontFamily="monospace">{c.phoneNumber} → {c.calledNumber || '-'}</Typography>
                <Chip size="small" label={c.status === 'active' ? 'En cours' : 'Terminé'} color={c.status === 'active' ? 'success' : 'default'} />
              </Box>
              <Box 
                ref={(el) => { scrollRefs.current[c.id] = el; }}
                sx={{ 
                  mt: 1, 
                  maxHeight: 300, 
                  overflow: 'auto', 
                  fontFamily: 'system-ui', 
                  fontSize: 14, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 0.5,
                  scrollBehavior: 'smooth',
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: '#f1f1f1',
                    borderRadius: '4px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: '#c1c1c1',
                    borderRadius: '4px',
                  },
                  '&::-webkit-scrollbar-thumb:hover': {
                    background: '#a8a8a8',
                  }
                }}
              >
                {(lines[c.id] || []).map((line, i) => {
                  // Heuristique simple: préfixes "client:" / "agent:" si présents
                  const isAgent = /\bagent\b\s*[:\-]/i.test(line);
                  const isClient = /\bclient\b\s*[:\-]/i.test(line);
                  const align = isAgent ? 'flex-end' : 'flex-start';
                  const bg = isAgent ? '#ffe3f1' : '#e6f0ff';
                  const color = '#222';
                  
                  // Vérifier si c'est un indicateur de transcription
                  const isTranscribing = line.includes('⏳');
                  
                  return (
                    <Box key={i} sx={{ display: 'flex', justifyContent: align }}>
                      <Box sx={{
                        maxWidth: '85%',
                        bgcolor: bg,
                        color,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 2,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                      }}>
                        {isTranscribing ? (
                          // Remplacer "⏳" par le composant animé
                          line.replace('⏳', '')
                            .split('⏳')
                            .map((part, index) => (
                              <React.Fragment key={index}>
                                {part}
                                {index < line.split('⏳').length - 1 && <TranscriptionIndicator />}
                              </React.Fragment>
                            ))
                        ) : (
                          // Afficher le temps de traitement si disponible
                          (() => {
                            const parts = line.split(' — ');
                            if (parts.length >= 2) {
                              const text = parts[1];
                              const timeMatch = text.match(/\[(\d+)ms\]$/);
                              if (timeMatch) {
                                const processingTime = timeMatch[1];
                                const textWithoutTime = text.replace(/\[\d+ms\]$/, '');
                                return (
                                  <>
                                    {textWithoutTime}
                                    <Box component="span" sx={{ 
                                      fontSize: '0.8em', 
                                      color: '#666', 
                                      ml: 1,
                                      fontFamily: 'monospace'
                                    }}>
                                      [{processingTime}ms]
                                    </Box>
                                  </>
                                );
                              }
                            }
                            return line;
                          })()
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default TranscriptsLive;


