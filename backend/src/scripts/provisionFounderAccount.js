/**
 * Provision or rotate a Founder account directly in MongoDB.
 *
 * Usage:
 *   FOUNDER_EMAIL=founder@example.com FOUNDER_PASSWORD='strong-password' node backend/src/scripts/provisionFounderAccount.js
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';

const envDir = join(dirname(fileURLToPath(import.meta.url)), '../../../');
dotenv.config({ path: join(envDir, '.env.local') });
dotenv.config({ path: join(envDir, '.env'), override: false });

function getFounderConfig() {
  const email = String(process.env.FOUNDER_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.FOUNDER_PASSWORD || '');
  const firstName = String(process.env.FOUNDER_FIRST_NAME || 'Founder').trim();
  const lastName = String(process.env.FOUNDER_LAST_NAME || 'Account').trim();

  if (!email) {
    throw new Error('FOUNDER_EMAIL is required');
  }

  if (!password || password.length < 12) {
    throw new Error('FOUNDER_PASSWORD is required and must be at least 12 characters');
  }

  return { email, password, firstName, lastName };
}

async function provisionFounderAccount() {
  const { email, password, firstName, lastName } = getFounderConfig();

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tradeflow');
  logger.info('Connected to MongoDB for founder provisioning');

  const founderData = {
    email,
    firstName,
    lastName,
    authMethod: 'email',
    isActive: true,
    isVerified: true,
    subscription: {
      tier: 'founder',
      status: 'lifetime',
      startedAt: new Date(),
      expiresAt: null,
      paymentMethod: 'manual_provision',
      txHash: '',
      autoRenew: false
    },
    portfolio: {
      totalBalance: 100000,
      availableBalance: 100000,
      investedAmount: 0,
      totalProfit: 0,
      totalLoss: 0,
      winRate: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0
    },
    tradingSettings: {
      autoTrading: false,
      paperTrading: true,
      defaultStrategy: 'quantum_ai',
      riskLevel: 'medium',
      maxDailyLoss: 500,
      maxPositionSize: 5000,
      stopLossPercent: 2,
      takeProfitPercent: 4,
      leverage: 1
    },
    updatedAt: new Date()
  };

  let user = await User.findOne({ email });
  const action = user ? 'updated' : 'created';

  if (!user) {
    user = new User(founderData);
  } else {
    user.set(founderData);
  }

  user.password = password;
  await user.save();

  console.log(`Founder account ${action}: ${email}`);

  await mongoose.disconnect();
}

provisionFounderAccount().catch(err => {
  console.error(`Founder account provisioning failed: ${err.message}`);
  process.exit(1);
});
