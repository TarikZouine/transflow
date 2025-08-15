// Types spécifiques au frontend
export * from '../../../shared/types';

// Types pour les composants React
export interface AudioRecorderProps {
  onAudioData?: (data: ArrayBuffer) => void;
  onTranscription?: (text: string) => void;
  isRecording: boolean;
  onRecordingChange: (recording: boolean) => void;
}

export interface TranscriptionDisplayProps {
  segments: TranscriptionSegment[];
  isLive?: boolean;
}

// Types pour les hooks
export interface UseWebSocketReturn {
  socket: any;
  isConnected: boolean;
  error: string | null;
}

// Types pour l'état de l'application
export interface AppState {
  user: User | null;
  currentSession: CallSession | null;
  transcriptionSegments: TranscriptionSegment[];
  settings: UserSettings;
}

export interface UserSettings {
  language: string;
  model: string;
  autoSave: boolean;
  realTimeTranscription: boolean;
  speakerDetection: boolean;
  confidenceThreshold: number;
  audioQuality: string;
}

// Types pour les événements WebSocket
export interface WebSocketEvents {
  create_session: (data: { title: string; userId?: string }) => void;
  audio_chunk: (data: { sessionId: string; audioData: number[]; timestamp: number }) => void;
  end_session: (data: { sessionId: string }) => void;
  save_session: (data: { sessionId: string }) => void;
}

// Types pour les réponses de l'API
export interface SessionResponse {
  success: boolean;
  data: CallSession;
  message?: string;
}

export interface TranscriptionResponse {
  success: boolean;
  data: TranscriptionSegment[];
  message?: string;
}

export interface SettingsResponse {
  success: boolean;
  data: UserSettings;
  message?: string;
}
