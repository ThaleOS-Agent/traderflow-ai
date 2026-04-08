import { logger } from '../utils/logger.js';
import { MultiExchangeConnector } from './exchanges/multiExchange.js';

/**
 * OANDA FOREX Trading Service
 * Configures and manages FOREX trading via OANDA API
 */
export class OandaForexService {
  constructor() {
    this.isInitialized = false;
    this.apiKey = null;
    this.accountId = null;
    this.isPractice = true;
    
    // OANDA API endpoints
    this.baseUrls = {
      practice: 'https://api-fxpractice.oanda.com/v3',
      live: 'https://api-fxtrade.oanda.com/v3'
    };
    
    // Supported FOREX pairs
    this.forexPairs = {
      majors: [
        { symbol: 'EUR_USD', name: 'EUR/USD', pipValue: 0.0001 },
        { symbol: 'GBP_USD', name: 'GBP/USD', pipValue: 0.0001 },
        { symbol: 'USD_JPY', name: 'USD/JPY', pipValue: 0.01 },
        { symbol: 'USD_CHF', name: 'USD/CHF', pipValue: 0.0001 },
        { symbol: 'AUD_USD', name: 'AUD/USD', pipValue: 0.0001 },
        { symbol: 'USD_CAD', name: 'USD/CAD', pipValue: 0.0001 },
        { symbol: 'NZD_USD', name: 'NZD/USD', pipValue: 0.0001 }
      ],
      minors: [
        { symbol: 'EUR_GBP', name: 'EUR/GBP', pipValue: 0.0001 },
        { symbol: 'EUR_JPY', name: 'EUR/JPY', pipValue: 0.01 },
        { symbol: 'GBP_JPY', name: 'GBP/JPY', pipValue: 0.01 },
        { symbol: 'CHF_JPY', name: 'CHF/JPY', pipValue: 0.01 },
        { symbol: 'EUR_CHF', name: 'EUR/CHF', pipValue: 0.0001 },
        { symbol: 'AUD_JPY', name: 'AUD/JPY', pipValue: 0.01 },
        { symbol: 'CAD_JPY', name: 'CAD/JPY', pipValue: 0.01 },
        { symbol: 'GBP_CHF', name: 'GBP/CHF', pipValue: 0.0001 },
        { symbol: 'EUR_AUD', name: 'EUR/AUD', pipValue: 0.0001 },
        { symbol: 'EUR_CAD', name: 'EUR/CAD', pipValue: 0.0001 }
      ],
      commodities: [
        { symbol: 'XAU_USD', name: 'Gold', pipValue: 0.01 },
        { symbol: 'XAG_USD', name: 'Silver', pipValue: 0.001 },
        { symbol: 'BCO_USD', name: 'Brent Crude Oil', pipValue: 0.01 },
        { symbol: 'WTICO_USD', name: 'WTI Crude Oil', pipValue: 0.01 },
        { symbol: 'NATGAS_USD', name: 'Natural Gas', pipValue: 0.001 }
      ],
      indices: [
        { symbol: 'SPX500_USD', name: 'S&P 500', pipValue: 0.1 },
        { symbol: 'NAS100_USD', name: 'NASDAQ 100', pipValue: 0.1 },
        { symbol: 'US30_USD', name: 'Dow Jones 30', pipValue: 0.1 },
        { symbol: 'UK100_GBP', name: 'FTSE 100', pipValue: 0.1 },
        { symbol: 'DE30_EUR', name: 'DAX 30', pipValue: 0.1 },
        { symbol: 'JP225_USD', name: 'Nikkei 225', pipValue: 0.1 }
      ]
    };
    
    // Trading configuration
    this.tradingConfig = {
      defaultLeverage: 50, // 1:50
      maxLeverage: 200,    // 1:200 for professional accounts
      minLotSize: 0.01,    // Micro lots
      maxLotSize: 100,     // Maximum position size
      defaultStopLoss: 50, // 50 pips
      defaultTakeProfit: 100, // 100 pips
      marginCallLevel: 100, // 100% margin call
      stopOutLevel: 50     // 50% stop out
    };
    
    // Account information
    this.accountInfo = null;
    this.openPositions = new Map();
    this.pendingOrders = new Map();
  }

  /**
   * Initialize OANDA connection
   */
  async initialize(apiKey, accountId, isPractice = true) {
    try {
      this.apiKey = apiKey;
      this.accountId = accountId;
      this.isPractice = isPractice;
      
      // Test connection
      const account = await this.getAccount();
      this.accountInfo = account;
      
      this.isInitialized = true;
      
      logger.info(`OANDA FOREX initialized - Account: ${accountId}, Practice: ${isPractice}`);
      logger.info(`Balance: ${account.balance} ${account.currency}`);
      
      return {
        success: true,
        account: {
          id: account.id,
          balance: account.balance,
          currency: account.currency,
          marginRate: account.marginRate,
          openTradeCount: account.openTradeCount,
          pendingOrderCount: account.pendingOrderCount
        }
      };
      
    } catch (error) {
      logger.error('OANDA initialization error:', error.message);
      throw error;
    }
  }

  /**
   * Make OANDA API request
   */
  async makeRequest(method, endpoint, body = null) {
    if (!this.isInitialized) {
      throw new Error('OANDA not initialized');
    }
    
    const baseUrl = this.isPractice ? this.baseUrls.practice : this.baseUrls.live;
    const url = `${baseUrl}${endpoint}`;
    
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept-Datetime-Format': 'RFC3339'
    };
    
    const options = {
      method,
      headers
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errorMessage || `HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      logger.error(`OANDA API error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get account information
   */
  async getAccount() {
    return this.makeRequest('GET', `/accounts/${this.accountId}`);
  }

  /**
   * Get account summary
   */
  async getAccountSummary() {
    return this.makeRequest('GET', `/accounts/${this.accountId}/summary`);
  }

  /**
   * Get available instruments
   */
  async getInstruments() {
    const response = await this.makeRequest('GET', `/accounts/${this.accountId}/instruments`);
    return response.instruments || [];
  }

  /**
   * Get current prices
   */
  async getPrices(instruments) {
    const instrumentList = Array.isArray(instruments) ? instruments.join(',') : instruments;
    const response = await this.makeRequest('GET', `/accounts/${this.accountId}/pricing?instruments=${instrumentList}`);
    return response.prices || [];
  }

  /**
   * Get candlestick data
   */
  async getCandles(instrument, granularity = 'H1', count = 500) {
    const response = await this.makeRequest(
      'GET', 
      `/instruments/${instrument}/candles?granularity=${granularity}&count=${count}&price=M`
    );
    return response.candles || [];
  }

  /**
   * Get order book
   */
  async getOrderBook(instrument) {
    const response = await this.makeRequest('GET', `/instruments/${instrument}/orderBook`);
    return response;
  }

  /**
   * Get position book
   */
  async getPositionBook(instrument) {
    const response = await this.makeRequest('GET', `/instruments/${instrument}/positionBook`);
    return response;
  }

  /**
   * Create market order
   */
  async createMarketOrder(instrument, units, stopLoss = null, takeProfit = null, trailingStop = null) {
    const order = {
      order: {
        type: 'MARKET',
        instrument,
        units: units.toString(),
        timeInForce: 'FOK' // Fill or Kill
      }
    };
    
    if (stopLoss) {
      order.order.stopLossOnFill = {
        price: stopLoss.toString(),
        timeInForce: 'GTC'
      };
    }
    
    if (takeProfit) {
      order.order.takeProfitOnFill = {
        price: takeProfit.toString(),
        timeInForce: 'GTC'
      };
    }
    
    if (trailingStop) {
      order.order.trailingStopLossOnFill = {
        distance: trailingStop.toString(),
        timeInForce: 'GTC'
      };
    }
    
    return this.makeRequest('POST', `/accounts/${this.accountId}/orders`, order);
  }

  /**
   * Create limit order
   */
  async createLimitOrder(instrument, units, price, stopLoss = null, takeProfit = null) {
    const order = {
      order: {
        type: 'LIMIT',
        instrument,
        units: units.toString(),
        price: price.toString(),
        timeInForce: 'GTC' // Good Till Cancelled
      }
    };
    
    if (stopLoss) {
      order.order.stopLossOnFill = {
        price: stopLoss.toString(),
        timeInForce: 'GTC'
      };
    }
    
    if (takeProfit) {
      order.order.takeProfitOnFill = {
        price: takeProfit.toString(),
        timeInForce: 'GTC'
      };
    }
    
    return this.makeRequest('POST', `/accounts/${this.accountId}/orders`, order);
  }

  /**
   * Close position
   */
  async closePosition(instrument, units = null) {
    const body = units ? { units: units.toString() } : { longUnits: 'ALL', shortUnits: 'ALL' };
    return this.makeRequest('PUT', `/accounts/${this.accountId}/positions/${instrument}/close`, body);
  }

  /**
   * Get open positions
   */
  async getOpenPositions() {
    const response = await this.makeRequest('GET', `/accounts/${this.accountId}/openPositions`);
    return response.positions || [];
  }

  /**
   * Get pending orders
   */
  async getPendingOrders() {
    const response = await this.makeRequest('GET', `/accounts/${this.accountId}/pendingOrders`);
    return response.orders || [];
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId) {
    return this.makeRequest('PUT', `/accounts/${this.accountId}/orders/${orderId}/cancel`);
  }

  /**
   * Get trade history
   */
  async getTradeHistory(from = null, to = null, count = 100) {
    let url = `/accounts/${this.accountId}/transactions?count=${count}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;
    
    const response = await this.makeRequest('GET', url);
    return response.transactions || [];
  }

  /**
   * Calculate position size based on risk
   */
  calculatePositionSize(accountBalance, riskPercent, stopLossPips, pipValue) {
    const riskAmount = accountBalance * (riskPercent / 100);
    const positionSize = riskAmount / (stopLossPips * pipValue);
    
    // Round to 2 decimal places (micro lots)
    return Math.round(positionSize * 100) / 100;
  }

  /**
   * Calculate pip value
   */
  calculatePipValue(lotSize, pipSize, exchangeRate) {
    return (lotSize * pipSize) / exchangeRate;
  }

  /**
   * Get FOREX pairs by category
   */
  getForexPairs(category = 'all') {
    if (category === 'all') {
      return {
        majors: this.forexPairs.majors,
        minors: this.forexPairs.minors,
        commodities: this.forexPairs.commodities,
        indices: this.forexPairs.indices
      };
    }
    
    return this.forexPairs[category] || [];
  }

  /**
   * Stream prices via WebSocket
   */
  async streamPrices(instruments, callback) {
    // In production, implement OANDA streaming API
    // For now, poll every second
    const interval = setInterval(async () => {
      try {
        const prices = await this.getPrices(instruments);
        callback(prices);
      } catch (error) {
        logger.error('Price stream error:', error.message);
      }
    }, 1000);
    
    return {
      stop: () => clearInterval(interval)
    };
  }

  /**
   * Get account status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      practice: this.isPractice,
      accountId: this.accountId,
      pairs: {
        majors: this.forexPairs.majors.length,
        minors: this.forexPairs.minors.length,
        commodities: this.forexPairs.commodities.length,
        indices: this.forexPairs.indices.length
      }
    };
  }
}

export const oandaForexService = new OandaForexService();
