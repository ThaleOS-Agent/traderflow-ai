import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { encrypt, decrypt } from '../utils/encryption.js';
import { normalizeFounderState } from '../utils/founderAccess.js';

const exchangeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  apiKey: { type: String, default: '' },
  apiSecret: { type: String, default: '' },
  passphrase: { type: String, default: '' },
  isTestnet: { type: Boolean, default: true },
  isActive: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const metatraderAccountSchema = new mongoose.Schema({
  platform: { type: String, enum: ['mt4', 'mt5'], default: 'mt5' },
  provider: { type: String, enum: ['bridge', 'metaapi'], default: 'bridge' },
  label: { type: String, default: '' },
  login: { type: String, default: '' },
  server: { type: String, default: '' },
  accountId: { type: String, default: '' },
  apiUrl: { type: String, default: '' },
  apiKey: { type: String, default: '' },
  token: { type: String, default: '' },
  isDemo: { type: Boolean, default: true },
  isActive: { type: Boolean, default: false },
  connectionStatus: { type: String, enum: ['untested', 'connected', 'failed'], default: 'untested' },
  lastConnectedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
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
  metatraderAccounts: [metatraderAccountSchema],
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

userSchema.pre('validate', function(next) {
  normalizeFounderState(this);
  next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  // Encrypt exchange API keys at rest whenever the exchanges array is touched
  if (this.isModified('exchanges')) {
    for (const ex of this.exchanges) {
      if (ex.apiKey)    ex.apiKey    = encrypt(ex.apiKey);
      if (ex.apiSecret) ex.apiSecret = encrypt(ex.apiSecret);
      if (ex.passphrase) ex.passphrase = encrypt(ex.passphrase);
      ex.updatedAt = new Date();
    }
  }

  if (this.isModified('metatraderAccounts')) {
    for (const account of this.metatraderAccounts) {
      if (account.apiKey) account.apiKey = encrypt(account.apiKey);
      if (account.token) account.token = encrypt(account.token);
      account.updatedAt = new Date();
    }
  }

  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Returns the exchanges array with API keys decrypted.
 * Always use this when passing credentials to exchange connectors.
 */
userSchema.methods.getDecryptedExchanges = function() {
  return this.exchanges.map(ex => ({
    ...ex.toObject(),
    apiKey:    decrypt(ex.apiKey),
    apiSecret: decrypt(ex.apiSecret),
    passphrase: decrypt(ex.passphrase),
  }));
};

userSchema.methods.getDecryptedMetatraderAccounts = function() {
  return this.metatraderAccounts.map(account => ({
    ...account.toObject(),
    apiKey: decrypt(account.apiKey),
    token: decrypt(account.token),
  }));
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.exchanges;
  delete obj.metatraderAccounts;
  return obj;
};

export const User = mongoose.model('User', userSchema);
