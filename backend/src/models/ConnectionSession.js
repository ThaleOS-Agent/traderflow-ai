import mongoose from 'mongoose';

const connectionSessionSchema = new mongoose.Schema({
  connectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountConnection', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  exchange: { type: String, required: true },
  connectionState: { type: String, default: 'DISCONNECTED' },
  heartbeatState: { type: String, default: 'DISCONNECTED' },
  reconnectCount: { type: Number, default: 0 },
  reconnectReason: { type: String, default: '' },
  lastError: { type: String, default: '' },
  lastSuccessfulAuthAt: { type: Date, default: null },
  lastReconnectAt: { type: Date, default: null },
  lastPongAt: { type: Date, default: null },
  nextSessionRotationAt: { type: Date, default: null },
  nextListenKeyRefreshAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now, index: true }
});

export const ConnectionSession = mongoose.model('ConnectionSession', connectionSessionSchema, 'connection_sessions');
