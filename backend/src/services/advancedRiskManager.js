import { logger } from '../utils/logger.js';
import { Trade } from '../models/Trade.js';
import { User } from '../models/User.js';

/**
 * Advanced Risk Management System
 * Comprehensive risk management with VaR, Sharpe ratio, and portfolio analytics
 */
export class AdvancedRiskManager {
  constructor() {
    this.riskLimits = {
      maxPositionSize: 0.10,        // 10% of portfolio per position
      maxPortfolioExposure: 0.95,    // 95% max portfolio exposure
      maxCorrelation: 0.7,           // Max correlation between positions
      maxSectorConcentration: 0.3,   // Max 30% in any sector
      maxDailyVaR: 0.02,            // 2% daily VaR limit
      maxPortfolioVaR: 0.05,        // 5% portfolio VaR limit
      maxDrawdown: 0.10,             // 10% max drawdown
      minSharpeRatio: 1.0,          // Minimum Sharpe ratio
      maxPositionVolatility: 0.5,   // 50% max position volatility
      maxPortfolioVolatility: 0.3,  // 30% max portfolio volatility
      minDailyVolume: 1000000,      // $1M minimum daily volume
      maxMarketImpact: 0.001,       // 0.1% max market impact
      emergencyStopLoss: 0.15,      // 15% emergency stop
      riskOffThreshold: 0.08,       // 8% risk-off threshold
      autoHedgeThreshold: 0.06      // 6% auto-hedge threshold
    };
    
    this.riskHistory = [];
    this.portfolioHistory = [];
    this.activeAlerts = [];
    this.emergencyStop = false;
  }

  /**
   * Assess position risk
   */
  async assessPositionRisk(symbol, positionSize, currentPrice, portfolioValue, marketData = null) {
    try {
      const positionValue = positionSize * currentPrice;
      const positionWeight = positionValue / portfolioValue;
      
      // Calculate VaR
      const { var1d, var5d } = this.calculateVaR(positionValue, marketData);
      
      // Calculate expected shortfall
      const expectedShortfall = this.calculateExpectedShortfall(positionValue, marketData);
      
      // Calculate correlation risk
      const correlationRisk = await this.calculateCorrelationRisk(symbol);
      
      // Calculate liquidity risk
      const liquidityRisk = this.calculateLiquidityRisk(symbol, positionSize);
      
      // Calculate volatility
      const volatility = this.calculateVolatility(marketData);
      
      // Generate risk metrics
      const riskMetrics = [];
      
      // Position size check
      riskMetrics.push({
        type: 'position_size',
        current: positionWeight,
        limit: this.riskLimits.maxPositionSize,
        level: positionWeight > this.riskLimits.maxPositionSize ? 'critical' : 
               positionWeight > this.riskLimits.maxPositionSize * 0.8 ? 'warning' : 'normal',
        description: `Position weight: ${(positionWeight * 100).toFixed(2)}% vs limit ${(this.riskLimits.maxPositionSize * 100).toFixed(2)}%`
      });
      
      // VaR check
      const varPct = var1d / portfolioValue;
      riskMetrics.push({
        type: 'var',
        current: varPct,
        limit: this.riskLimits.maxDailyVaR,
        level: varPct > this.riskLimits.maxDailyVaR ? 'critical' : 
               varPct > this.riskLimits.maxDailyVaR * 0.8 ? 'warning' : 'normal',
        description: `Daily VaR: ${(varPct * 100).toFixed(2)}% ($${var1d.toFixed(2)})`
      });
      
      // Volatility check
      riskMetrics.push({
        type: 'volatility',
        current: volatility,
        limit: this.riskLimits.maxPositionVolatility,
        level: volatility > this.riskLimits.maxPositionVolatility ? 'critical' : 
               volatility > this.riskLimits.maxPositionVolatility * 0.8 ? 'warning' : 'normal',
        description: `Volatility: ${(volatility * 100).toFixed(2)}%`
      });
      
      // Calculate overall risk score
      const riskScore = this.calculateRiskScore(positionWeight, varPct, correlationRisk, liquidityRisk, volatility);
      
      return {
        symbol,
        positionSize,
        positionValue,
        riskScore: Math.min(100, riskScore),
        var1d,
        var5d,
        expectedShortfall,
        correlationRisk,
        liquidityRisk,
        volatility,
        riskMetrics,
        approved: riskScore < 80 && !this.emergencyStop
      };
      
    } catch (error) {
      logger.error('Error assessing position risk:', error.message);
      return { approved: false, error: error.message };
    }
  }

  /**
   * Assess portfolio risk
   */
  async assessPortfolioRisk(userId) {
    try {
      // Get user's open positions
      const positions = await Trade.find({
        userId,
        status: { $in: ['open', 'pending'] }
      });
      
      // Get user data
      const user = await User.findById(userId);
      const portfolioValue = user?.portfolio?.totalValue || 10000;
      
      // Calculate total exposure
      const totalExposure = positions.reduce((sum, pos) => 
        sum + (pos.quantity * pos.entryPrice), 0
      );
      
      // Calculate portfolio VaR
      const portfolioVaR = this.calculatePortfolioVaR(positions, portfolioValue);
      
      // Calculate drawdown
      const { maxDrawdown, currentDrawdown } = this.calculateDrawdown(userId, portfolioValue);
      
      // Calculate Sharpe ratio
      const sharpeRatio = this.calculateSharpeRatio(userId);
      
      // Calculate Sortino ratio
      const sortinoRatio = this.calculateSortinoRatio(userId);
      
      // Calculate concentration risk
      const concentrationRisk = this.calculateConcentrationRisk(positions, portfolioValue);
      
      // Check for risk alerts
      const alerts = this.checkRiskAlerts({
        portfolioValue,
        totalExposure,
        portfolioVaR,
        currentDrawdown,
        sharpeRatio
      });
      
      // Update portfolio history
      this.portfolioHistory.push({
        timestamp: new Date(),
        userId,
        portfolioValue,
        totalExposure,
        drawdown: currentDrawdown,
        var: portfolioVaR,
        sharpeRatio
      });
      
      // Keep only last 252 days
      if (this.portfolioHistory.length > 252) {
        this.portfolioHistory = this.portfolioHistory.slice(-252);
      }
      
      return {
        userId,
        portfolioValue,
        totalExposure,
        exposurePct: (totalExposure / portfolioValue * 100).toFixed(2),
        portfolioVaR: portfolioVaR.toFixed(2),
        maxDrawdown: (maxDrawdown * 100).toFixed(2),
        currentDrawdown: (currentDrawdown * 100).toFixed(2),
        sharpeRatio: sharpeRatio.toFixed(2),
        sortinoRatio: sortinoRatio.toFixed(2),
        concentrationRisk,
        positionCount: positions.length,
        alerts,
        emergencyStop: this.emergencyStop,
        timestamp: new Date()
      };
      
    } catch (error) {
      logger.error('Error assessing portfolio risk:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Calculate Value at Risk
   */
  calculateVaR(positionValue, marketData, confidence = 0.95) {
    // Use historical simulation or parametric method
    let dailyVolatility = 0.04; // Default 4% daily volatility
    
    if (marketData && marketData.prices && marketData.prices.length > 30) {
      const returns = [];
      for (let i = 1; i < marketData.prices.length; i++) {
        returns.push((marketData.prices[i] - marketData.prices[i - 1]) / marketData.prices[i - 1]);
      }
      
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      dailyVolatility = Math.sqrt(variance);
    }
    
    // VaR = Position Value * Z-score * Daily Volatility
    const zScore = confidence === 0.95 ? 1.645 : confidence === 0.99 ? 2.326 : 1.645;
    const var1d = positionValue * zScore * dailyVolatility;
    const var5d = var1d * Math.sqrt(5);
    
    return { var1d, var5d, dailyVolatility };
  }

  /**
   * Calculate Expected Shortfall (Conditional VaR)
   */
  calculateExpectedShortfall(positionValue, marketData) {
    const { var1d } = this.calculateVaR(positionValue, marketData, 0.95);
    // ES is typically 1.3x VaR for normal distributions
    return var1d * 1.3;
  }

  /**
   * Calculate correlation risk
   */
  async calculateCorrelationRisk(symbol) {
    // Simplified correlation calculation
    // In production, calculate actual correlations with existing positions
    const baseCorrelation = 0.3;
    
    // Major cryptos have higher correlation
    if (['BTC', 'ETH', 'BNB'].some(s => symbol.includes(s))) {
      return Math.min(0.8, baseCorrelation * 1.5);
    }
    
    return baseCorrelation;
  }

  /**
   * Calculate liquidity risk
   */
  calculateLiquidityRisk(symbol, positionSize) {
    // Higher risk for larger positions and less liquid assets
    const baseRisk = ['BTC', 'ETH'].some(s => symbol.includes(s)) ? 0.1 : 0.3;
    const sizeFactor = Math.min(1, positionSize / 100000);
    
    return Math.min(1, baseRisk + sizeFactor);
  }

  /**
   * Calculate volatility
   */
  calculateVolatility(marketData) {
    if (!marketData || !marketData.prices || marketData.prices.length < 20) {
      return 0.05; // Default 5%
    }
    
    const returns = [];
    for (let i = 1; i < marketData.prices.length; i++) {
      returns.push((marketData.prices[i] - marketData.prices[i - 1]) / marketData.prices[i - 1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 252); // Annualized
  }

  /**
   * Calculate portfolio VaR
   */
  calculatePortfolioVaR(positions, portfolioValue) {
    if (positions.length === 0) return 0;
    
    // Simplified portfolio VaR calculation
    let totalVaR = 0;
    
    for (const pos of positions) {
      const positionValue = pos.quantity * pos.entryPrice;
      const { var1d } = this.calculateVaR(positionValue);
      totalVaR += var1d;
    }
    
    // Apply diversification benefit (simplified)
    const diversificationFactor = 0.7;
    return totalVaR * diversificationFactor;
  }

  /**
   * Calculate drawdown metrics
   */
  calculateDrawdown(userId, currentValue) {
    const userHistory = this.portfolioHistory.filter(h => h.userId === userId);
    
    if (userHistory.length === 0) {
      return { maxDrawdown: 0, currentDrawdown: 0 };
    }
    
    const values = userHistory.map(h => h.portfolioValue);
    values.push(currentValue);
    
    let peak = values[0];
    let maxDrawdown = 0;
    
    for (const value of values) {
      if (value > peak) peak = value;
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    const currentDrawdown = (peak - currentValue) / peak;
    
    return { maxDrawdown, currentDrawdown };
  }

  /**
   * Calculate Sharpe ratio
   */
  calculateSharpeRatio(userId) {
    const userHistory = this.portfolioHistory.filter(h => h.userId === userId);
    
    if (userHistory.length < 30) return 0;
    
    const returns = [];
    for (let i = 1; i < userHistory.length; i++) {
      returns.push((userHistory[i].portfolioValue - userHistory[i - 1].portfolioValue) / userHistory[i - 1].portfolioValue);
    }
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    
    // Assume 2% risk-free rate
    const riskFreeRate = 0.02 / 252;
    
    return stdReturn > 0 ? (avgReturn - riskFreeRate) / stdReturn * Math.sqrt(252) : 0;
  }

  /**
   * Calculate Sortino ratio
   */
  calculateSortinoRatio(userId) {
    const userHistory = this.portfolioHistory.filter(h => h.userId === userId);
    
    if (userHistory.length < 30) return 0;
    
    const returns = [];
    for (let i = 1; i < userHistory.length; i++) {
      returns.push((userHistory[i].portfolioValue - userHistory[i - 1].portfolioValue) / userHistory[i - 1].portfolioValue);
    }
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    // Downside deviation (only negative returns)
    const negativeReturns = returns.filter(r => r < 0);
    const downsideDev = negativeReturns.length > 0 ?
      Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length) : 0;
    
    const riskFreeRate = 0.02 / 252;
    
    return downsideDev > 0 ? (avgReturn - riskFreeRate) / downsideDev * Math.sqrt(252) : 0;
  }

  /**
   * Calculate concentration risk
   */
  calculateConcentrationRisk(positions, portfolioValue) {
    if (positions.length === 0) return {};
    
    const weights = {};
    for (const pos of positions) {
      const weight = (pos.quantity * pos.entryPrice) / portfolioValue;
      weights[pos.symbol] = {
        weight: (weight * 100).toFixed(2),
        level: weight > this.riskLimits.maxSectorConcentration ? 'high' : 
               weight > this.riskLimits.maxSectorConcentration * 0.7 ? 'medium' : 'normal'
      };
    }
    
    return weights;
  }

  /**
   * Calculate overall risk score
   */
  calculateRiskScore(positionWeight, varPct, correlationRisk, liquidityRisk, volatility) {
    const weights = {
      positionWeight: 0.25,
      var: 0.30,
      correlation: 0.20,
      liquidity: 0.15,
      volatility: 0.10
    };
    
    const positionScore = Math.min(100, (positionWeight / this.riskLimits.maxPositionSize) * 100);
    const varScore = Math.min(100, (varPct / this.riskLimits.maxDailyVaR) * 100);
    const correlationScore = correlationRisk * 100;
    const liquidityScore = liquidityRisk * 100;
    const volatilityScore = Math.min(100, (volatility / this.riskLimits.maxPositionVolatility) * 100);
    
    return (
      weights.positionWeight * positionScore +
      weights.var * varScore +
      weights.correlation * correlationScore +
      weights.liquidity * liquidityScore +
      weights.volatility * volatilityScore
    );
  }

  /**
   * Check for risk alerts
   */
  checkRiskAlerts(metrics) {
    const alerts = [];
    
    // Drawdown alert
    if (metrics.currentDrawdown > this.riskLimits.maxDrawdown) {
      alerts.push({
        level: 'critical',
        type: 'max_drawdown',
        message: `Max drawdown exceeded: ${(metrics.currentDrawdown * 100).toFixed(2)}%`,
        action: 'emergency_stop'
      });
      this.emergencyStop = true;
    } else if (metrics.currentDrawdown > this.riskLimits.riskOffThreshold) {
      alerts.push({
        level: 'warning',
        type: 'high_drawdown',
        message: `High drawdown: ${(metrics.currentDrawdown * 100).toFixed(2)}%`,
        action: 'reduce_exposure'
      });
    }
    
    // VaR alert
    if (metrics.portfolioVaR > this.riskLimits.maxPortfolioVaR * metrics.portfolioValue) {
      alerts.push({
        level: 'high',
        type: 'var_breach',
        message: `Portfolio VaR exceeded: $${metrics.portfolioVaR.toFixed(2)}`,
        action: 'reduce_positions'
      });
    }
    
    // Sharpe ratio alert
    if (metrics.sharpeRatio < this.riskLimits.minSharpeRatio && metrics.sharpeRatio > 0) {
      alerts.push({
        level: 'warning',
        type: 'low_sharpe',
        message: `Low Sharpe ratio: ${metrics.sharpeRatio.toFixed(2)}`,
        action: 'review_strategy'
      });
    }
    
    this.activeAlerts = alerts;
    return alerts;
  }

  /**
   * Pre-trade risk check
   */
  async preTradeCheck(userId, tradeParams) {
    const { symbol, side, quantity, entryPrice, stopLoss } = tradeParams;
    
    const user = await User.findById(userId);
    const portfolioValue = user?.portfolio?.totalValue || 10000;
    
    // Assess position risk
    const positionRisk = await this.assessPositionRisk(
      symbol,
      quantity,
      entryPrice,
      portfolioValue
    );
    
    // Assess portfolio risk
    const portfolioRisk = await this.assessPortfolioRisk(userId);
    
    // Combine assessments
    const approved = positionRisk.approved && 
                     portfolioRisk.alerts.filter(a => a.level === 'critical').length === 0 &&
                     !this.emergencyStop;
    
    return {
      approved,
      positionRisk,
      portfolioRisk,
      emergencyStop: this.emergencyStop,
      timestamp: new Date()
    };
  }

  /**
   * Reset emergency stop
   */
  resetEmergencyStop() {
    this.emergencyStop = false;
    logger.info('Emergency stop reset');
  }

  /**
   * Get risk dashboard data
   */
  async getRiskDashboard(userId) {
    const portfolioRisk = await this.assessPortfolioRisk(userId);
    
    return {
      ...portfolioRisk,
      riskLimits: this.riskLimits,
      activeAlerts: this.activeAlerts,
      history: this.portfolioHistory.filter(h => h.userId === userId).slice(-30)
    };
  }
}

export const advancedRiskManager = new AdvancedRiskManager();
