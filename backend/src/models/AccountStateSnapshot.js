import mongoose from 'mongoose';

const accountStateSnapshotSchema = new mongoose.Schema({
  connectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountConnection', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  exchange: { type: String, required: true },
  balances: { type: Object, default: null },
  openOrders: { type: Object, default: null },
  positions: { type: Object, default: null },
  recentFills: { type: Object, default: null },
  consistent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true }
});

export const AccountStateSnapshot = mongoose.model('AccountStateSnapshot', accountStateSnapshotSchema, 'account_state_snapshots');
