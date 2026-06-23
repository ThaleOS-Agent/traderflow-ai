/**
 * Seed script — creates demo users only.
 * Run once: node backend/src/scripts/seed.js
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const envDir = join(dirname(fileURLToPath(import.meta.url)), '../../../');
dotenv.config({ path: join(envDir, '.env.local') });
dotenv.config({ path: join(envDir, '.env'), override: false });

import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';

const ACCOUNTS = [
  {
    email: 'demo@tradeflow.ai',
    password: 'TradeFlow@Demo1',
    firstName: 'Demo',
    lastName: 'User',
    role: 'user',
    isFounder: false,
    subscription: { tier: 'gold', status: 'active' },
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tradeflow');
  logger.info('Connected to MongoDB');

  for (const account of ACCOUNTS) {
    const accountData = {
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      role: account.role,
      isFounder: account.isFounder,
      isActive: true,
      isVerified: true,
      authMethod: 'email',
      subscription: {
        ...account.subscription,
        startedAt: new Date(),
        expiresAt: account.subscription.status === 'lifetime' ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      portfolio: {
        totalBalance: account.isFounder ? 100000 : 10000,
        availableBalance: account.isFounder ? 100000 : 10000,
        investedAmount: 0,
        totalProfit: 0,
        totalLoss: 0,
        winRate: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
      },
      tradingSettings: {
        autoTrading: false,
        paperTrading: true,
        defaultStrategy: account.isFounder ? 'quantum_ai' : 'xq_trade_m8',
        riskLevel: 'medium',
        maxDailyLoss: 500,
        maxPositionSize: 5000,
        stopLossPercent: 2,
        takeProfitPercent: 4,
        leverage: 1,
      },
    };

    const existing = await User.findOne({ email: account.email });
    if (existing) {
      existing.set(accountData);
      existing.password = account.password;
      await existing.save();
      logger.info(`Updated: ${account.email} (${account.role})`);
      continue;
    }

    const user = new User({
      ...accountData,
      password: account.password,
    });

    await user.save();
    logger.info(`Created: ${account.email} (${account.role})`);
  }

  console.log('\n─────────────────────────────────────────');
  console.log('  TradeFlow AI — Seeded Accounts');
  console.log('─────────────────────────────────────────');
  console.log('  DEMO (Gold tier):');
  console.log('    Email   : demo@tradeflow.ai');
  console.log('    Password: TradeFlow@Demo1');
  console.log('    Tier    : gold');
  console.log('');
  console.log('  Founder access is no longer seeded.');
  console.log('  Provision Founder tier through wallet allowlisting and controlled account updates only.');
  console.log('─────────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
