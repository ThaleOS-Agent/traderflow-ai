import mongoose from 'mongoose';

const rateLimitEventSchema = new mongoose.Schema({
  connectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountConnection', index: true },
  exchange: { type: String, required: true },
  eventType: { type: String, required: true },
  limitKey: { type: String, default: '' },
  observedValue: { type: Number, default: 0 },
  threshold: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, index: true }
});

export const RateLimitEvent = mongoose.model('RateLimitEvent', rateLimitEventSchema, 'rate_limit_events');
