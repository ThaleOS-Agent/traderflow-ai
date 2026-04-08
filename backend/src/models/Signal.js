import mongoose from 'mongoose';

const signalSchema = new mongoose.Schema({
  // Signal identification
  signalId: { type: String, required: true, unique: true },
  
  // Asset details
  symbol: { type: String, required: true },
  assetType: { type: String, enum: ['crypto', 'forex', 'commodity', 'stock'], required: true },
  
  // Signal type
  side: { type: String, enum: ['buy', 'sell'], required: true },
  
  // Price levels
  entryPrice: { type: Number, required: true },
  stopLoss: { type: Number, required: true },
  takeProfit: { type: Number, required: true },
  
  // Current market data
  currentPrice: { type: Number, default: null },
  
  // Risk/Reward
  riskRewardRatio: { type: Number, default: 0 },
  
  // Strategy that generated this signal
  strategy: { type: String, required: true },
  
  // Timeframe
  timeframe: { type: String, default: '1h' },
  
  // Signal strength/confidence
  confidence: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'very_high'], 
    default: 'medium' 
  },
  confidenceScore: { type: Number, default: 0 }, // 0-100
  
  // Technical indicators used
  indicators: [{
    name: String,
    value: Number,
    signal: String
  }],
  
  // Analysis/Reasoning
  analysis: { type: String, default: '' },
  
  // Status
  status: { 
    type: String, 
    enum: ['active', 'executed', 'expired', 'cancelled', 'hit_sl', 'hit_tp'], 
    default: 'active' 
  },
  
  // Expiration
  expiresAt: { type: Date, required: true },
  
  // Execution tracking
  executedAt: { type: Date, default: null },
  executedPrice: { type: Number, default: null },
  
  // Performance tracking
  result: { type: String, enum: ['win', 'loss', 'breakeven', null], default: null },
  profit: { type: Number, default: null },
  
  // Auto-trade tracking
  autoTrades: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade' },
    executedAt: { type: Date, default: Date.now }
  }],
  
  // Metadata
  metadata: { type: Object, default: {} },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Calculate risk/reward before saving
signalSchema.pre('save', function(next) {
  if (this.isModified('entryPrice') || this.isModified('stopLoss') || this.isModified('takeProfit')) {
    const risk = Math.abs(this.entryPrice - this.stopLoss);
    const reward = Math.abs(this.takeProfit - this.entryPrice);
    this.riskRewardRatio = risk > 0 ? reward / risk : 0;
  }
  next();
});

// Indexes
signalSchema.index({ status: 1, createdAt: -1 });
signalSchema.index({ symbol: 1, status: 1 });
signalSchema.index({ strategy: 1, status: 1 });

export const Signal = mongoose.model('Signal', signalSchema);
