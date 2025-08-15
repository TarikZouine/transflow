import mongoose, { Schema, Document } from 'mongoose';

export interface ICallSession extends Document {
  userId?: string;
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

const CallSessionSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'error'],
    default: 'active',
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
  },
  duration: {
    type: Number, // en millisecondes
  },
  participants: [{
    type: String,
    trim: true,
  }],
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Index pour optimiser les recherches
CallSessionSchema.index({ userId: 1, createdAt: -1 });
CallSessionSchema.index({ status: 1 });
CallSessionSchema.index({ startTime: -1 });

// Middleware pour calculer la durée avant la sauvegarde
CallSessionSchema.pre('save', function(next) {
  if (this.endTime && this.startTime) {
    this.duration = this.endTime.getTime() - this.startTime.getTime();
  }
  next();
});

export const CallSession = mongoose.model<ICallSession>('CallSession', CallSessionSchema);
