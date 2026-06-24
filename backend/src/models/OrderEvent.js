import mongoose from 'mongoose';

const orderEventSchema = new mongoose.Schema({
  connectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountConnection', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  exchange: { type: String, required: true },
  orderId: { type: String, default: '', index: true },
  clientOrderId: { type: String, default: '' },
  symbol: { type: String, default: '' },
  side: { type: String, default: '' },
  orderType: { type: String, default: '' },
  status: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  filledQuantity: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  payload: { type: Object, default: null },
  createdAt: { type: Date, default: Date.now, index: true }
});

export const OrderEvent = mongoose.model('OrderEvent', orderEventSchema, 'order_events');
