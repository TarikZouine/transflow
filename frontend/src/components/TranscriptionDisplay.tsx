import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  Divider,
} from '@mui/material';

interface TranscriptionSegment {
  id: string;
  text: string;
  speaker?: string;
  confidence: number;
  timestamp: number;
}

interface TranscriptionDisplayProps {
  segments: TranscriptionSegment[];
  isLive?: boolean;
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  segments,
  isLive = false,
}) => {
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getConfidenceColor = (confidence: number): 'success' | 'warning' | 'error' => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  return (
    <Paper elevation={3} sx={{ p: 3, maxHeight: 600, overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Transcription {isLive && '(En direct)'}
        {isLive && (
          <Chip 
            label="LIVE" 
            color="error" 
            size="small" 
            sx={{ ml: 1 }}
          />
        )}
      </Typography>
      
      <Divider sx={{ mb: 2 }} />
      
      {segments.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          {isLive ? 'En attente de transcription...' : 'Aucune transcription disponible'}
        </Typography>
      ) : (
        <Box>
          {segments.map((segment) => (
            <Box key={segment.id} sx={{ mb: 2, pb: 2, borderBottom: '1px solid #f0f0f0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {formatTimestamp(segment.timestamp)}
                </Typography>
                {segment.speaker && (
                  <Chip 
                    label={segment.speaker}
                    size="small"
                    variant="outlined"
                  />
                )}
                <Chip
                  label={`${Math.round(segment.confidence * 100)}%`}
                  size="small"
                  color={getConfidenceColor(segment.confidence)}
                  variant="outlined"
                />
              </Box>
              <Typography 
                variant="body1" 
                className="transcription-text"
                sx={{ 
                  pl: 1,
                  opacity: segment.confidence < 0.5 ? 0.7 : 1,
                  fontStyle: segment.confidence < 0.5 ? 'italic' : 'normal'
                }}
              >
                {segment.text}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
};

export default TranscriptionDisplay;
