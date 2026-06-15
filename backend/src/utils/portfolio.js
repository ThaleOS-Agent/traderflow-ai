import mongoose from 'mongoose';
import { Trade } from '../models/Trade.js';
import { User } from '../models/User.js';

export function toObjectId(id) {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : id;
}

export async function recalculatePortfolio(userId, { persist = true } = {}) {
  const user = await User.findById(userId);
  if (!user) return null;

  const trades = await Trade.find({ userId });
  const openTrades = trades.filter(trade => ['open', 'pending'].includes(trade.status));
  const closedTrades = trades.filter(trade => trade.status === 'closed');

  const investedAmount = openTrades.reduce((sum, trade) => {
    return sum + (Number(trade.entryPrice) || 0) * (Number(trade.quantity) || 0);
  }, 0);

  const totalProfit = closedTrades.reduce((sum, trade) => {
    const profit = Number(trade.profit) || 0;
    return profit > 0 ? sum + profit : sum;
  }, 0);

  const totalLoss = closedTrades.reduce((sum, trade) => {
    const profit = Number(trade.profit) || 0;
    return profit < 0 ? sum + Math.abs(profit) : sum;
  }, 0);

  const winningTrades = closedTrades.filter(trade => (Number(trade.profit) || 0) > 0).length;
  const losingTrades = closedTrades.filter(trade => (Number(trade.profit) || 0) < 0).length;
  const totalBalance = Number(user.portfolio?.totalBalance ?? user.portfolio?.availableBalance ?? 0);
  const netProfit = totalProfit - totalLoss;

  const portfolio = {
    totalBalance,
    availableBalance: Math.max(totalBalance + netProfit - investedAmount, 0),
    investedAmount,
    totalProfit,
    totalLoss,
    winRate: closedTrades.length ? (winningTrades / closedTrades.length) * 100 : 0,
    totalTrades: trades.length,
    winningTrades,
    losingTrades
  };

  if (persist) {
    user.portfolio = {
      ...(user.portfolio?.toObject?.() || user.portfolio || {}),
      ...portfolio
    };
    await user.save();
  }

  return portfolio;
}
