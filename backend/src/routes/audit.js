import express from 'express';
import mongoose from 'mongoose';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Trade } from '../models/Trade.js';
import { Signal } from '../models/Signal.js';
import { Strategy } from '../models/Strategy.js';

const router = express.Router();

router.get('/database', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collections = db
      ? (await db.listCollections().toArray()).map(collection => collection.name).sort()
      : [];

    const counts = {
      users: await User.countDocuments(),
      founderUsers: await User.countDocuments({
        $or: [
          { role: 'founder' },
          { isFounder: true },
          { 'subscription.tier': 'founder' }
        ]
      }),
      walletUsers: await User.countDocuments({
        walletAddress: { $exists: true, $ne: null }
      }),
      usersWithSubscriptions: await User.countDocuments({
        'subscription.tier': { $exists: true }
      }),
      usersWithExchangeConnections: await User.countDocuments({
        'exchanges.0': { $exists: true }
      }),
      usersWithActiveExchangeConnections: await User.countDocuments({
        'exchanges.isActive': true
      }),
      usersWithMetatraderAccounts: await User.countDocuments({
        'metatraderAccounts.0': { $exists: true }
      }),
      usersWithPushNotifications: await User.countDocuments({
        'notifications.pushEnabled': true
      }),
      usersWithPushSubscriptions: await User.countDocuments({
        'notifications.pushSubscription': { $ne: null }
      }),
      trades: await Trade.countDocuments(),
      openTrades: await Trade.countDocuments({ status: { $in: ['open', 'pending'] } }),
      closedTrades: await Trade.countDocuments({ status: 'closed' }),
      paperTrades: await Trade.countDocuments({ isPaperTrade: true }),
      autoTrades: await Trade.countDocuments({ isAutoTrade: true }),
      signals: await Signal.countDocuments(),
      ensembleSignals: await Signal.countDocuments({ strategy: 'ensemble_master' }),
      trainingGeneratedSignals: await Signal.countDocuments({
        'metadata.generatedBy': 'training.generate-signal'
      }),
      signalsWithAutoTrades: await Signal.countDocuments({
        'autoTrades.0': { $exists: true }
      }),
      strategies: await Strategy.countDocuments()
    };

    const indexCounts = {
      users: (await User.collection.indexes()).length,
      trades: (await Trade.collection.indexes()).length,
      signals: (await Signal.collection.indexes()).length,
      strategies: (await Strategy.collection.indexes()).length
    };

    res.json({
      success: true,
      database: {
        connected: mongoose.connection.readyState === 1,
        name: db?.databaseName || null,
        collections,
        counts,
        indexCounts,
        embeddedData: {
          exchanges: 'users.exchanges',
          subscriptions: 'users.subscription',
          wallets: 'users.walletAddress',
          notifications: 'users.notifications',
          metatraderAccounts: 'users.metatraderAccounts',
          trainingOutput: 'signals.metadata.generatedBy and signals.autoTrades'
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to build database audit'
    });
  }
});

export default router;
