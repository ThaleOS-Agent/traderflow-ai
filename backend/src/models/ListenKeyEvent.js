import mongoose from 'mongoose';

const listenKeyEventSchema = new mongoose.Schema({
  connectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountConnection', index: true },
  exchange: { type: String, required: true },
  action: { type: String, enum: ['created', 'refreshed', 'rotated', 'failed'], required: true },
  status: { type: String, default: '' },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, index: true }
});

export const ListenKeyEvent = mongoose.model('ListenKeyEvent', listenKeyEventSchema, 'listen_key_events');
