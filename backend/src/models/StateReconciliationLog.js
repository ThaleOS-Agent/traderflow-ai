import mongoose from 'mongoose';

const stateReconciliationLogSchema = new mongoose.Schema({
  connectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountConnection', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  exchange: { type: String, required: true },
  consistent: { type: Boolean, default: false },
  pausedTrading: { type: Boolean, default: true },
  diffs: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now, index: true }
});

export const StateReconciliationLog = mongoose.model('StateReconciliationLog', stateReconciliationLogSchema, 'state_reconciliation_logs');
