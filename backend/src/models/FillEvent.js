import mongoose from 'mongoose';

const fillEventSchema = new mongoose.Schema({
  connectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountConnection', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  exchange: { type: String, required: true },
  orderId: { type: String, default: '', index: true },
  symbol: { type: String, default: '' },
  filledQuantity: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  fee: { type: Number, default: 0 },
  feeAsset: { type: String, default: '' },
  payload: { type: Object, default: null },
  createdAt: { type: Date, default: Date.now, index: true }
});

export const FillEvent = mongoose.model('FillEvent', fillEventSchema, 'fill_events');
