import mongoose from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption.js';

const accountConfigSchema = new mongoose.Schema({
  exchange: { type: String, required: true },
  environment: { type: String, default: 'testnet' },
  authMethod: { type: String, enum: ['HMAC_SHA256', 'ED25519', 'RSA'], default: 'HMAC_SHA256' },
  privateTrading: { type: Boolean, default: false },
  networkTuning: {
    tcpNoDelay: { type: Boolean, default: true },
    recvBufferSizeKb: { type: Number, default: 8192 },
    sendBufferSizeKb: { type: Number, default: 1024 }
  },
  rateLimits: {
    maxConnectionsPer5Min: { type: Number, default: 300 },
    maxInboundMsgPerSecond: { type: Number, default: 5 },
    recvWindowMs: { type: Number, default: 5000 }
  },
  heartbeat: {
    pingIntervalSeconds: { type: Number, default: 30 },
    pongTimeoutSeconds: { type: Number, default: 5 },
    listenKeyRefreshIntervalMinutes: { type: Number, default: 25 }
  },
  reconnectPolicy: {
    strategy: { type: String, default: 'exponential_backoff_with_jitter' },
    initialDelaySeconds: { type: Number, default: 1 },
    maxDelaySeconds: { type: Number, default: 60 },
    backoffFactor: { type: Number, default: 2 },
    jitterRange: {
      type: [Number],
      default: [0.1, 0.5]
    }
  },
  sessionRotation: {
    enabled: { type: Boolean, default: true },
    rotateBeforeHours: { type: Number, default: 23 }
  },
  permissions: {
    readAccount: { type: Boolean, default: true },
    readOrders: { type: Boolean, default: true },
    trade: { type: Boolean, default: false },
    withdraw: { type: Boolean, default: false }
  }
}, { _id: false });

const accountConnectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  label: { type: String, default: '' },
  exchange: { type: String, required: true, index: true },
  environment: { type: String, default: 'testnet' },
  accountId: { type: String, default: '' },
  apiKey: { type: String, default: '' },
  apiSecret: { type: String, default: '' },
  passphrase: { type: String, default: '' },
  authMethod: { type: String, enum: ['HMAC_SHA256', 'ED25519', 'RSA'], default: 'HMAC_SHA256' },
  privateTrading: { type: Boolean, default: false },
  tradingEnabled: { type: Boolean, default: false },
  authenticated: { type: Boolean, default: false },
  withdrawalPermissionDetected: { type: Boolean, default: false },
  ipWhitelistRecommended: { type: Boolean, default: true },
  safeForTrading: { type: Boolean, default: false },
  stateReconciliationStatus: { type: String, enum: ['pending', 'consistent', 'mismatch', 'paused'], default: 'pending' },
  lastAuthenticatedAt: { type: Date, default: null },
  lastBalanceEventAt: { type: Date, default: null },
  lastOrderEventAt: { type: Date, default: null },
  lastHeartbeatAt: { type: Date, default: null },
  lastPongAt: { type: Date, default: null },
  reconnectCount: { type: Number, default: 0 },
  nextSessionRotationAt: { type: Date, default: null },
  nextListenKeyRefreshAt: { type: Date, default: null },
  latestBalanceSummary: { type: Object, default: null },
  latestOrderSummary: { type: Object, default: null },
  assistantMessage: { type: String, default: '' },
  config: { type: accountConfigSchema, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

accountConnectionSchema.pre('save', function(next) {
  if (this.isModified('apiKey') && this.apiKey) this.apiKey = encrypt(this.apiKey);
  if (this.isModified('apiSecret') && this.apiSecret) this.apiSecret = encrypt(this.apiSecret);
  if (this.isModified('passphrase') && this.passphrase) this.passphrase = encrypt(this.passphrase);
  this.updatedAt = new Date();
  next();
});

accountConnectionSchema.methods.toSafeJSON = function() {
  const obj = this.toObject();
  delete obj.apiKey;
  delete obj.apiSecret;
  delete obj.passphrase;
  return obj;
};

accountConnectionSchema.methods.getDecryptedCredentials = function() {
  return {
    apiKey: decrypt(this.apiKey),
    apiSecret: decrypt(this.apiSecret),
    passphrase: decrypt(this.passphrase),
    accountId: this.accountId
  };
};

export const AccountConnection = mongoose.model('AccountConnection', accountConnectionSchema, 'account_connections');
