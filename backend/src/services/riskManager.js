import { logger } from '../utils/logger.js';

export class RiskManager {
  constructor(userSettings = {}) {
    this.settings = {
      maxRiskPerTrade: 2, // percentage of account
      maxDailyRisk: 6, // percentage of account
      maxPositions: 5,
      maxLeverage: 1,
      stopLossRequired: true,
      takeProfitRequired: true,
      minRiskRewardRatio: 1.5,
      ...userSettings
    };
    
    this.dailyStats = {
      date: new Date().toDateString(),
      totalRisk: 0,
      tradesCount: 0,
      losses: 0
    };
  }

  // Validate trade against risk rules
  validateTrade(tradeParams, accountBalance, openPositions = []) {
    const { symbol, side, entryPrice, stopLoss, takeProfit, quantity, leverage = 1 } = tradeParams;
    
    const errors = [];
    const warnings = [];
    
    // 1. Check if stop loss is required
    if (this.settings.stopLossRequired && !stopLoss) {
      errors.push('Stop loss is required');
    }
    
    // 2. Check if take profit is required
    if (this.settings.takeProfitRequired && !takeProfit) {
      errors.push('Take profit is required');
    }
    
    // 3. Calculate risk amount
    const riskAmount = this.calculateRiskAmount(entryPrice, stopLoss, quantity);
    const riskPercent = (riskAmount / accountBalance) * 100;
    
    // 4. Check max risk per trade
    if (riskPercent > this.settings.maxRiskPerTrade) {
      errors.push(`Risk per trade (${riskPercent.toFixed(2)}%) exceeds maximum (${this.settings.maxRiskPerTrade}%)`);
    }
    
    // 5. Check daily risk limit
    if (this.dailyStats.totalRisk + riskPercent > this.settings.maxDailyRisk) {
      warnings.push(`Daily risk limit (${this.settings.maxDailyRisk}%) would be exceeded`);
    }
    
    // 6. Check max positions
    if (openPositions.length >= this.settings.maxPositions) {
      errors.push(`Maximum number of positions (${this.settings.maxPositions}) reached`);
    }
    
    // 7. Check for duplicate positions
    const existingPosition = openPositions.find(p => p.symbol === symbol);
    if (existingPosition) {
      warnings.push(`Existing position in ${symbol}. Consider adding to position instead.`);
    }
    
    // 8. Validate risk/reward ratio
    if (stopLoss && takeProfit) {
      const risk = Math.abs(entryPrice - stopLoss);
      const reward = Math.abs(takeProfit - entryPrice);
      const rrRatio = reward / risk;
      
      if (rrRatio < this.settings.minRiskRewardRatio) {
        warnings.push(`Risk/Reward ratio (${rrRatio.toFixed(2)}) is below recommended (${this.settings.minRiskRewardRatio})`);
      }
    }
    
    // 9. Check leverage
    if (leverage > this.settings.maxLeverage) {
      errors.push(`Leverage (${leverage}x) exceeds maximum (${this.settings.maxLeverage}x)`);
    }
    
    // 10. Validate position size
    const positionValue = entryPrice * quantity;
    const maxPositionValue = accountBalance * (this.settings.maxRiskPerTrade / 100) * leverage;
    
    if (positionValue > maxPositionValue * 10) {
      errors.push('Position size too large for account balance');
    }
    
    // 11. Check for correlated positions
    const correlatedPairs = this.getCorrelatedPairs(symbol);
    const correlatedPositions = openPositions.filter(p => correlatedPairs.includes(p.symbol));
    if (correlatedPositions.length > 0) {
      warnings.push(`Correlated positions detected: ${correlatedPositions.map(p => p.symbol).join(', ')}`);
    }
    
    const isValid = errors.length === 0;
    
    if (!isValid) {
      logger.warn(`Trade validation failed for ${symbol}:`, { errors, warnings });
    }
    
    return {
      isValid,
      errors,
      warnings,
      riskPercent,
      riskAmount,
      rrRatio: stopLoss && takeProfit ? Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss) : 0
    };
  }

  // Calculate risk amount
  calculateRiskAmount(entryPrice, stopLoss, quantity) {
    if (!stopLoss) return 0;
    return Math.abs(entryPrice - stopLoss) * quantity;
  }

  // Calculate position size based on risk
  calculatePositionSize(entryPrice, stopLoss, accountBalance, riskPercent = null) {
    const risk = riskPercent || this.settings.maxRiskPerTrade;
    const riskAmount = accountBalance * (risk / 100);
    const priceRisk = Math.abs(entryPrice - stopLoss);
    
    if (priceRisk === 0) return 0;
    
    const quantity = riskAmount / priceRisk;
    return Math.floor(quantity * 10000) / 10000; // Round to 4 decimal places
  }

  // Get correlated currency pairs
  getCorrelatedPairs(symbol) {
    const correlations = {
      'EURUSD': ['GBPUSD', 'AUDUSD', 'NZDUSD'],
      'GBPUSD': ['EURUSD', 'AUDUSD'],
      'USDJPY': ['USDCHF'],
      'AUDUSD': ['NZDUSD', 'EURUSD', 'GBPUSD'],
      'USDCAD': ['USDOIL'],
      'XAUUSD': ['XAGUSD'],
      'BTCUSDT': ['ETHUSDT'],
      'ETHUSDT': ['BTCUSDT', 'BNBUSDT']
    };
    
    return correlations[symbol.replace('/', '')] || [];
  }

  // Update daily stats
  updateDailyStats(trade) {
    const today = new Date().toDateString();
    
    if (this.dailyStats.date !== today) {
      this.dailyStats = {
        date: today,
        totalRisk: 0,
        tradesCount: 0,
        losses: 0
      };
    }
    
    const riskAmount = this.calculateRiskAmount(trade.entryPrice, trade.stopLoss, trade.quantity);
    const riskPercent = (riskAmount / trade.accountBalance) * 100;
    
    this.dailyStats.totalRisk += riskPercent;
    this.dailyStats.tradesCount++;
    
    if (trade.profit < 0) {
      this.dailyStats.losses++;
    }
  }

  // Check if trading should be halted
  shouldHaltTrading() {
    // Halt if daily loss limit reached (3 consecutive losses)
    if (this.dailyStats.losses >= 3) {
      return {
        halted: true,
        reason: 'Daily loss limit reached (3 consecutive losses)'
      };
    }
    
    // Halt if daily risk exceeded
    if (this.dailyStats.totalRisk >= this.settings.maxDailyRisk) {
      return {
        halted: true,
        reason: `Daily risk limit (${this.settings.maxDailyRisk}%) exceeded`
      };
    }
    
    return { halted: false };
  }

  // Calculate Kelly Criterion for optimal position sizing
  calculateKellyCriterion(winRate, avgWin, avgLoss) {
    if (avgLoss === 0) return 0;
    const kelly = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
    return Math.max(0, Math.min(kelly, 0.25)); // Cap at 25%
  }

  // Get risk report
  getRiskReport() {
    return {
      settings: this.settings,
      dailyStats: this.dailyStats,
      shouldHalt: this.shouldHaltTrading()
    };
  }
}
