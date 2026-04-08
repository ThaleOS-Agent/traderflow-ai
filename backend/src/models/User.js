import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const exchangeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  apiKey: { type: String, default: '' },
  apiSecret: { type: String, default: '' },
  isTestnet: { type: Boolean, default: true },
  isActive: { type: Boolean, default: false }
});

const tradingSettingsSchema = new mongoose.Schema({
  autoTrading: { type: Boolean, default: false },
  paperTrading: { type: Boolean, default: true },
  defaultStrategy: { type: String, default: 'xq_trade_m8' },
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  maxDailyLoss: { type: Number, default: 100 },
  maxPositionSize: { type: Number, default: 1000 },
  stopLossPercent: { type: Number, default: 2 },
  takeProfitPercent: { type: Number, default: 4 },
  leverage: { type: Number, default: 1 },
  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: true }
  }
});

const portfolioSchema = new mongoose.Schema({
  totalBalance: { type: Number, default: 0 },
  availableBalance: { type: Number, default: 0 },
  investedAmount: { type: Number, default: 0 },
  totalProfit: { type: Number, default: 0 },
  totalLoss: { type: Number, default: 0 },
  winRate: { type: Number, default: 0 },
  totalTrades: { type: Number, default: 0 },
  winningTrades: { type: Number, default: 0 },
  losingTrades: { type: Number, default: 0 }
});

const subscriptionSchema = new mongoose.Schema({
  tier: { 
    type: String, 
    enum: ['free', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'founder'], 
    default: 'free' 
  },
  status: { 
    type: String, 
    enum: ['active', 'expired', 'cancelled', 'lifetime'], 
    default: 'active' 
  },
  startedAt: { type: Date },
  expiresAt: { type: Date },
  paymentMethod: { type: String, default: '' },
  txHash: { type: String, default: '' },
  autoRenew: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
  // Authentication
  email: { type: String, unique: true, sparse: true },
  password: { type: String },
  walletAddress: { type: String, unique: true, sparse: true },
  authMethod: { type: String, enum: ['email', 'wallet'], default: 'email' },
  chainId: { type: String, default: '' },
  
  // Profile
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  username: { type: String, unique: true, sparse: true },
  phone: { type: String, default: '' },
  country: { type: String, default: '' },
  
  // Status
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isFounder: { type: Boolean, default: false },
  role: { type: String, enum: ['user', 'admin', 'founder'], default: 'user' },
  
  // Subscription & Features
  subscription: subscriptionSchema,
  
  // Trading
  exchanges: [exchangeSchema],
  tradingSettings: tradingSettingsSchema,
  portfolio: portfolioSchema,
  
  // Social Trading
  socialTrading: {
    isTrader: { type: Boolean, default: false },
    traderProfile: { type: Object, default: null },
    copying: [{ type: Object }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  
  // Notifications
  notifications: {
    pushEnabled: { type: Boolean, default: false },
    pushSubscription: { type: Object, default: null },
    emailEnabled: { type: Boolean, default: true },
    smsEnabled: { type: Boolean, default: false }
  },
  
  // Timestamps
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.exchanges;
  return obj;
};

export const User = mongoose.model('User', userSchema);
