import mongoose, { Schema, Document } from 'mongoose';

export interface ITranscriptionSegment extends Document {
  sessionId: string;
  speaker?: string;
  text: string;
  confidence: number;
  startTime: number;
  endTime: number;
  language?: string;
  createdAt: Date;
}

const TranscriptionSegmentSchema: Schema = new Schema({
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'CallSession',
    required: true,
  },
  speaker: {
    type: String,
    trim: true,
  },
  text: {
    type: String,
    required: true,
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
  },
  startTime: {
    type: Number,
    required: true,
  },
  endTime: {
    type: Number,
    required: true,
  },
  language: {
    type: String,
    default: 'fr',
  },
}, {
  timestamps: true,
});

// Index pour optimiser les recherches
TranscriptionSegmentSchema.index({ sessionId: 1, startTime: 1 });
TranscriptionSegmentSchema.index({ text: 'text' }); // Index de recherche textuelle
TranscriptionSegmentSchema.index({ confidence: -1 });
TranscriptionSegmentSchema.index({ createdAt: -1 });

export const TranscriptionSegment = mongoose.model<ITranscriptionSegment>('TranscriptionSegment', TranscriptionSegmentSchema);
