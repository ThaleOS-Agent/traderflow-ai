import mongoose from 'mongoose';

const privateStreamAuditLogSchema = new mongoose.Schema({
  connectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountConnection', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  exchange: { type: String, required: true },
  level: { type: String, enum: ['info', 'warning', 'error'], default: 'info' },
  message: { type: String, required: true },
  payload: { type: Object, default: null },
  createdAt: { type: Date, default: Date.now, index: true }
});

export const PrivateStreamAuditLog = mongoose.model('PrivateStreamAuditLog', privateStreamAuditLogSchema, 'private_stream_audit_logs');
