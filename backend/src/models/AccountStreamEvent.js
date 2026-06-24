import mongoose from 'mongoose';

const accountStreamEventSchema = new mongoose.Schema({
  connectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountConnection', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  exchange: { type: String, required: true },
  eventType: { type: String, required: true, index: true },
  symbol: { type: String, default: '' },
  orderId: { type: String, default: '' },
  accountId: { type: String, default: '' },
  status: { type: String, default: '' },
  latencyMs: { type: Number, default: 0 },
  sequence: { type: Number, default: null },
  payload: { type: Object, default: null },
  createdAt: { type: Date, default: Date.now, index: true }
});

export const AccountStreamEvent = mongoose.model('AccountStreamEvent', accountStreamEventSchema, 'account_stream_events');
