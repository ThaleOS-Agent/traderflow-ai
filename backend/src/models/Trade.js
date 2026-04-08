import mongoose from 'mongoose';

const tradeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  signalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Signal', default: null },
  
  // Trade details
  symbol: { type: String, required: true },
  assetType: { type: String, enum: ['crypto', 'forex', 'commodity', 'stock'], required: true },
  side: { type: String, enum: ['buy', 'sell'], required: true },
  
  // Entry/Exit
  entryPrice: { type: Number, required: true },
  exitPrice: { type: Number, default: null },
  quantity: { type: Number, required: true },
  
  // Risk Management
  stopLoss: { type: Number, required: true },
  takeProfit: { type: Number, required: true },
  
  // P&L
  profit: { type: Number, default: 0 },
  profitPercent: { type: Number, default: 0 },
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'open', 'closed', 'cancelled', 'error'], 
    default: 'pending' 
  },
  
  // Execution
  orderType: { type: String, enum: ['market', 'limit', 'stop'], default: 'market' },
  exchange: { type: String, default: 'binance' },
  exchangeOrderId: { type: String, default: null },
  
  // Strategy
  strategy: { type: String, default: 'manual' },
  isAutoTrade: { type: Boolean, default: false },
  isPaperTrade: { type: Boolean, default: true },
  
  // Timestamps
  openedAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
  
  // Metadata
  notes: { type: String, default: '' },
  metadata: { type: Object, default: {} }
});

// Indexes for performance
tradeSchema.index({ userId: 1, status: 1 });
tradeSchema.index({ userId: 1, openedAt: -1 });
tradeSchema.index({ symbol: 1, status: 1 });

// Calculate profit before saving
tradeSchema.pre('save', function(next) {
  if (this.isModified('exitPrice') && this.exitPrice && this.status === 'closed') {
    const priceDiff = this.side === 'buy' 
      ? this.exitPrice - this.entryPrice 
      : this.entryPrice - this.exitPrice;
    this.profit = priceDiff * this.quantity;
    this.profitPercent = (priceDiff / this.entryPrice) * 100;
  }
  next();
});

export const Trade = mongoose.model('Trade', tradeSchema);
