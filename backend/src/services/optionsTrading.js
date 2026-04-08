import { logger } from '../utils/logger.js';

/**
 * Options Trading Service
 * Black-Scholes pricing, Greeks calculation, and options strategies
 */
export class OptionsTradingService {
  constructor() {
    // Standard normal cumulative distribution function approximation
    this.normCDF = this.normalCDF;
    this.normPDF = this.normalPDF;
  }

  /**
   * Standard normal cumulative distribution function
   */
  normalCDF(x) {
    // Abramowitz and Stegun approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.sqrt(2);

    const t = 1 / (1 + p * absX);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

    return 0.5 * (1 + sign * y);
  }

  /**
   * Standard normal probability density function
   */
  normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  /**
   * Calculate option price using Black-Scholes model
   */
  calculateOptionPrice(spotPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, optionType) {
    try {
      const S = spotPrice;
      const K = strikePrice;
      const T = timeToExpiry;
      const r = riskFreeRate;
      const sigma = volatility;

      // Calculate d1 and d2
      const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
      const d2 = d1 - sigma * Math.sqrt(T);

      let price;
      if (optionType === 'call') {
        price = S * this.normCDF(d1) - K * Math.exp(-r * T) * this.normCDF(d2);
      } else { // put
        price = K * Math.exp(-r * T) * this.normCDF(-d2) - S * this.normCDF(-d1);
      }

      return {
        price: Math.max(0, price),
        d1,
        d2,
        inputs: { S, K, T, r, sigma, optionType }
      };
    } catch (error) {
      logger.error('Error calculating option price:', error.message);
      return { price: 0, error: error.message };
    }
  }

  /**
   * Calculate option Greeks
   */
  calculateGreeks(spotPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, optionType) {
    try {
      const S = spotPrice;
      const K = strikePrice;
      const T = timeToExpiry;
      const r = riskFreeRate;
      const sigma = volatility;

      // Calculate d1 and d2
      const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
      const d2 = d1 - sigma * Math.sqrt(T);

      // Delta
      let delta;
      if (optionType === 'call') {
        delta = this.normCDF(d1);
      } else {
        delta = -this.normCDF(-d1);
      }

      // Gamma (same for calls and puts)
      const gamma = this.normPDF(d1) / (S * sigma * Math.sqrt(T));

      // Theta
      const thetaTerm1 = -(S * this.normPDF(d1) * sigma) / (2 * Math.sqrt(T));
      let theta;
      if (optionType === 'call') {
        const thetaTerm2 = -r * K * Math.exp(-r * T) * this.normCDF(d2);
        theta = (thetaTerm1 + thetaTerm2) / 365; // Per day
      } else {
        const thetaTerm2 = r * K * Math.exp(-r * T) * this.normCDF(-d2);
        theta = (thetaTerm1 + thetaTerm2) / 365; // Per day
      }

      // Vega (same for calls and puts)
      const vega = S * this.normPDF(d1) * Math.sqrt(T) / 100; // Per 1% change

      // Rho
      let rho;
      if (optionType === 'call') {
        rho = K * T * Math.exp(-r * T) * this.normCDF(d2) / 100;
      } else {
        rho = -K * T * Math.exp(-r * T) * this.normCDF(-d2) / 100;
      }

      return {
        delta: parseFloat(delta.toFixed(4)),
        gamma: parseFloat(gamma.toFixed(6)),
        theta: parseFloat(theta.toFixed(4)),
        vega: parseFloat(vega.toFixed(4)),
        rho: parseFloat(rho.toFixed(4)),
        d1: parseFloat(d1.toFixed(4)),
        d2: parseFloat(d2.toFixed(4))
      };
    } catch (error) {
      logger.error('Error calculating Greeks:', error.message);
      return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
    }
  }

  /**
   * Calculate implied volatility using Newton-Raphson method
   */
  calculateImpliedVolatility(spotPrice, strikePrice, timeToExpiry, riskFreeRate, 
                             optionPrice, optionType, maxIterations = 100, tolerance = 0.0001) {
    try {
      let volatility = 0.2; // Initial guess
      
      for (let i = 0; i < maxIterations; i++) {
        const price = this.calculateOptionPrice(spotPrice, strikePrice, timeToExpiry, 
                                                riskFreeRate, volatility, optionType);
        const diff = price.price - optionPrice;
        
        if (Math.abs(diff) < tolerance) {
          return { impliedVolatility: volatility, iterations: i };
        }
        
        // Calculate vega for adjustment
        const greeks = this.calculateGreeks(spotPrice, strikePrice, timeToExpiry, 
                                           riskFreeRate, volatility, optionType);
        const vega = greeks.vega * 100; // Convert back
        
        if (vega === 0) break;
        
        volatility = volatility - diff / vega;
        volatility = Math.max(0.01, Math.min(5, volatility)); // Keep within bounds
      }
      
      return { impliedVolatility: volatility, iterations: maxIterations };
    } catch (error) {
      logger.error('Error calculating implied volatility:', error.message);
      return { impliedVolatility: 0.2, error: error.message };
    }
  }

  /**
   * Build Long Call strategy
   */
  buildLongCall(underlying, strike, expiry, premium) {
    return {
      strategy: 'long_call',
      underlying,
      legs: [{
        action: 'buy',
        optionType: 'call',
        strike,
        expiry,
        premium,
        quantity: 1
      }],
      maxProfit: 'Unlimited',
      maxLoss: premium,
      breakeven: strike + premium,
      description: `Long ${underlying} ${strike} Call expiring ${expiry}`
    };
  }

  /**
   * Build Long Put strategy
   */
  buildLongPut(underlying, strike, expiry, premium) {
    return {
      strategy: 'long_put',
      underlying,
      legs: [{
        action: 'buy',
        optionType: 'put',
        strike,
        expiry,
        premium,
        quantity: 1
      }],
      maxProfit: strike - premium,
      maxLoss: premium,
      breakeven: strike - premium,
      description: `Long ${underlying} ${strike} Put expiring ${expiry}`
    };
  }

  /**
   * Build Bull Call Spread strategy
   */
  buildBullCallSpread(underlying, longStrike, shortStrike, expiry, longPremium, shortPremium) {
    const netDebit = longPremium - shortPremium;
    const maxProfit = shortStrike - longStrike - netDebit;
    const maxLoss = netDebit;
    const breakeven = longStrike + netDebit;

    return {
      strategy: 'bull_call_spread',
      underlying,
      legs: [
        { action: 'buy', optionType: 'call', strike: longStrike, expiry, premium: longPremium, quantity: 1 },
        { action: 'sell', optionType: 'call', strike: shortStrike, expiry, premium: shortPremium, quantity: 1 }
      ],
      maxProfit: parseFloat(maxProfit.toFixed(2)),
      maxLoss: parseFloat(maxLoss.toFixed(2)),
      breakeven: parseFloat(breakeven.toFixed(2)),
      netDebit: parseFloat(netDebit.toFixed(2)),
      description: `Bull Call Spread on ${underlying}: Buy ${longStrike} Call, Sell ${shortStrike} Call`
    };
  }

  /**
   * Build Bear Put Spread strategy
   */
  buildBearPutSpread(underlying, longStrike, shortStrike, expiry, longPremium, shortPremium) {
    const netDebit = longPremium - shortPremium;
    const maxProfit = longStrike - shortStrike - netDebit;
    const maxLoss = netDebit;
    const breakeven = longStrike - netDebit;

    return {
      strategy: 'bear_put_spread',
      underlying,
      legs: [
        { action: 'buy', optionType: 'put', strike: longStrike, expiry, premium: longPremium, quantity: 1 },
        { action: 'sell', optionType: 'put', strike: shortStrike, expiry, premium: shortPremium, quantity: 1 }
      ],
      maxProfit: parseFloat(maxProfit.toFixed(2)),
      maxLoss: parseFloat(maxLoss.toFixed(2)),
      breakeven: parseFloat(breakeven.toFixed(2)),
      netDebit: parseFloat(netDebit.toFixed(2)),
      description: `Bear Put Spread on ${underlying}: Buy ${longStrike} Put, Sell ${shortStrike} Put`
    };
  }

  /**
   * Build Straddle strategy
   */
  buildStraddle(underlying, strike, expiry, callPremium, putPremium) {
    const netDebit = callPremium + putPremium;
    const breakevenUp = strike + netDebit;
    const breakevenDown = strike - netDebit;

    return {
      strategy: 'straddle',
      underlying,
      legs: [
        { action: 'buy', optionType: 'call', strike, expiry, premium: callPremium, quantity: 1 },
        { action: 'buy', optionType: 'put', strike, expiry, premium: putPremium, quantity: 1 }
      ],
      maxProfit: 'Unlimited',
      maxLoss: parseFloat(netDebit.toFixed(2)),
      breakevenPoints: [parseFloat(breakevenDown.toFixed(2)), parseFloat(breakevenUp.toFixed(2))],
      netDebit: parseFloat(netDebit.toFixed(2)),
      description: `Long Straddle on ${underlying} at ${strike} strike`
    };
  }

  /**
   * Build Iron Condor strategy
   */
  buildIronCondor(underlying, expiry, putLongStrike, putShortStrike, callShortStrike, callLongStrike, premiums) {
    const netCredit = (premiums.putShort + premiums.callShort - premiums.putLong - premiums.callLong);
    const maxProfit = netCredit;
    const maxLoss = (putShortStrike - putLongStrike) - netCredit;
    const breakevenLower = putShortStrike - netCredit;
    const breakevenUpper = callShortStrike + netCredit;

    return {
      strategy: 'iron_condor',
      underlying,
      legs: [
        { action: 'buy', optionType: 'put', strike: putLongStrike, expiry, premium: premiums.putLong, quantity: 1 },
        { action: 'sell', optionType: 'put', strike: putShortStrike, expiry, premium: premiums.putShort, quantity: 1 },
        { action: 'sell', optionType: 'call', strike: callShortStrike, expiry, premium: premiums.callShort, quantity: 1 },
        { action: 'buy', optionType: 'call', strike: callLongStrike, expiry, premium: premiums.callLong, quantity: 1 }
      ],
      maxProfit: parseFloat(maxProfit.toFixed(2)),
      maxLoss: parseFloat(maxLoss.toFixed(2)),
      breakevenPoints: [parseFloat(breakevenLower.toFixed(2)), parseFloat(breakevenUpper.toFixed(2))],
      netCredit: parseFloat(netCredit.toFixed(2)),
      description: `Iron Condor on ${underlying} with strikes ${putLongStrike}/${putShortStrike}/${callShortStrike}/${callLongStrike}`
    };
  }

  /**
   * Calculate option chain for a given underlying
   */
  calculateOptionChain(underlying, spotPrice, expiry, riskFreeRate = 0.05, volatility = 0.25) {
    try {
      const strikes = [];
      const atmStrike = Math.round(spotPrice / 5) * 5;
      
      // Generate strikes around ATM
      for (let i = -4; i <= 4; i++) {
        strikes.push(atmStrike + i * 5);
      }

      const timeToExpiry = this.daysToExpiry(expiry) / 365;

      const optionChain = strikes.map(strike => {
        const callPrice = this.calculateOptionPrice(spotPrice, strike, timeToExpiry, 
                                                     riskFreeRate, volatility, 'call');
        const putPrice = this.calculateOptionPrice(spotPrice, strike, timeToExpiry, 
                                                    riskFreeRate, volatility, 'put');
        
        const callGreeks = this.calculateGreeks(spotPrice, strike, timeToExpiry, 
                                                riskFreeRate, volatility, 'call');
        const putGreeks = this.calculateGreeks(spotPrice, strike, timeToExpiry, 
                                               riskFreeRate, volatility, 'put');

        return {
          strike,
          expiry,
          call: {
            price: parseFloat(callPrice.price.toFixed(2)),
            bid: parseFloat((callPrice.price * 0.98).toFixed(2)),
            ask: parseFloat((callPrice.price * 1.02).toFixed(2)),
            impliedVolatility: volatility,
            ...callGreeks
          },
          put: {
            price: parseFloat(putPrice.price.toFixed(2)),
            bid: parseFloat((putPrice.price * 0.98).toFixed(2)),
            ask: parseFloat((putPrice.price * 1.02).toFixed(2)),
            impliedVolatility: volatility,
            ...putGreeks
          }
        };
      });

      return {
        underlying,
        spotPrice,
        expiry,
        timeToExpiry: parseFloat(timeToExpiry.toFixed(4)),
        strikes: optionChain
      };
    } catch (error) {
      logger.error('Error calculating option chain:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Calculate days to expiry
   */
  daysToExpiry(expiry) {
    const expiryDate = new Date(expiry);
    const today = new Date();
    const diffTime = expiryDate - today;
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  /**
   * Analyze options strategy payoff
   */
  analyzeStrategyPayoff(strategy, priceRange) {
    try {
      const payoffs = [];
      
      for (const price of priceRange) {
        let payoff = 0;
        
        for (const leg of strategy.legs) {
          const intrinsicValue = leg.optionType === 'call' 
            ? Math.max(0, price - leg.strike)
            : Math.max(0, leg.strike - price);
          
          const legPayoff = leg.action === 'buy'
            ? intrinsicValue - leg.premium
            : leg.premium - intrinsicValue;
          
          payoff += legPayoff * leg.quantity;
        }
        
        payoffs.push({ price, payoff: parseFloat(payoff.toFixed(2)) });
      }

      return {
        strategy: strategy.strategy,
        underlying: strategy.underlying,
        payoffs,
        maxProfit: strategy.maxProfit,
        maxLoss: strategy.maxLoss,
        breakeven: strategy.breakeven || strategy.breakevenPoints
      };
    } catch (error) {
      logger.error('Error analyzing strategy payoff:', error.message);
      return { error: error.message };
    }
  }
}

export const optionsTradingService = new OptionsTradingService();
