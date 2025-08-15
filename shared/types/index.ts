// Types partagés entre le frontend et le backend

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}

export interface CallSession {
  id: string;
  userId: string;
  title: string;
  status: 'active' | 'completed' | 'paused' | 'error';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  participants: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptionSegment {
  id: string;
  sessionId: string;
  speaker?: string;
  text: string;
  confidence: number;
  startTime: number;
  endTime: number;
  language?: string;
  createdAt: Date;
}

export interface AudioChunk {
  id: string;
  sessionId: string;
  data: Buffer | ArrayBuffer;
  format: 'wav' | 'mp3' | 'ogg';
  sampleRate: number;
  channels: number;
  timestamp: number;
}

export interface WebSocketMessage {
  type: 'audio_chunk' | 'transcription_update' | 'session_status' | 'error';
  payload: any;
  timestamp: number;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  segments: TranscriptionSegment[];
  processingTime: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
