import mongoose from 'mongoose';

const strategySchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  
  // Strategy type
  type: { 
    type: String, 
    enum: ['trend_following', 'mean_reversion', 'breakout', 'scalping', 'ai_ml', 'arbitrage'],
    required: true 
  },
  
  // Supported assets
  supportedAssets: [{ 
    type: String, 
    enum: ['crypto', 'forex', 'commodity', 'stock'] 
  }],
  
  // Default parameters
  defaultParams: {
    timeframe: { type: String, default: '1h' },
    rsiPeriod: { type: Number, default: 14 },
    rsiOverbought: { type: Number, default: 70 },
    rsiOversold: { type: Number, default: 30 },
    emaFast: { type: Number, default: 12 },
    emaSlow: { type: Number, default: 26 },
    macdFast: { type: Number, default: 12 },
    macdSlow: { type: Number, default: 26 },
    macdSignal: { type: Number, default: 9 },
    bbPeriod: { type: Number, default: 20 },
    bbStdDev: { type: Number, default: 2 },
    atrPeriod: { type: Number, default: 14 },
    volumeThreshold: { type: Number, default: 1.5 }
  },
  
  // Performance metrics
  performance: {
    totalTrades: { type: Number, default: 0 },
    winningTrades: { type: Number, default: 0 },
    losingTrades: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    avgProfit: { type: Number, default: 0 },
    avgLoss: { type: Number, default: 0 },
    profitFactor: { type: Number, default: 0 },
    sharpeRatio: { type: Number, default: 0 },
    maxDrawdown: { type: Number, default: 0 }
  },
  
  // Risk settings
  riskSettings: {
    maxRiskPerTrade: { type: Number, default: 2 }, // percentage
    maxDailyRisk: { type: Number, default: 6 },
    maxPositions: { type: Number, default: 5 }
  },
  
  // Status
  isActive: { type: Boolean, default: true },
  isPublic: { type: Boolean, default: true },
  
  // Creator
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Strategy = mongoose.model('Strategy', strategySchema);
