import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export class ExchangeConnector {
  constructor(exchange = 'binance', isTestnet = true) {
    this.exchange = exchange;
    this.isTestnet = isTestnet;
    this.apiKey = null;
    this.apiSecret = null;
    
    // Base URLs
    this.baseUrls = {
      binance: {
        spot: isTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com',
        futures: isTestnet ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com'
      }
    };
    
    this.baseURL = this.baseUrls[exchange]?.spot || this.baseUrls.binance.spot;
  }

  setCredentials(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  // Generate signature for Binance
  generateSignature(queryString) {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  // Make authenticated request
  async makeRequest(method, endpoint, params = {}, isPrivate = false) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {};
    
    if (isPrivate) {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('API credentials not set');
      }
      
      const timestamp = Date.now();
      params.timestamp = timestamp;
      
      const queryString = Object.keys(params)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
      
      const signature = this.generateSignature(queryString);
      params.signature = signature;
      
      headers['X-MBX-APIKEY'] = this.apiKey;
    }

    try {
      const response = await axios({
        method,
        url,
        params: method === 'GET' ? params : undefined,
        data: method !== 'GET' ? params : undefined,
        headers,
        timeout: 30000
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Exchange API error: ${error.message}`, { 
        exchange: this.exchange, 
        endpoint,
        error: error.response?.data 
      });
      throw error;
    }
  }

  // Public endpoints
  async getTicker(symbol) {
    return this.makeRequest('GET', '/api/v3/ticker/24hr', { symbol });
  }

  async getOrderBook(symbol, limit = 100) {
    return this.makeRequest('GET', '/api/v3/depth', { symbol, limit });
  }

  async getKlines(symbol, interval = '1h', limit = 500) {
    return this.makeRequest('GET', '/api/v3/klines', { symbol, interval, limit });
  }

  async getRecentTrades(symbol, limit = 100) {
    return this.makeRequest('GET', '/api/v3/trades', { symbol, limit });
  }

  // Private endpoints (require API key)
  async getAccount() {
    return this.makeRequest('GET', '/api/v3/account', {}, true);
  }

  async getBalance(asset) {
    const account = await this.getAccount();
    const balance = account.balances.find(b => b.asset === asset);
    return balance ? parseFloat(balance.free) : 0;
  }

  async createOrder(params) {
    const orderParams = {
      symbol: params.symbol,
      side: params.side.toUpperCase(),
      type: params.type.toUpperCase(),
      quantity: params.quantity,
      ...params
    };
    
    if (params.stopLoss) {
      orderParams.stopLoss = params.stopLoss;
    }
    if (params.takeProfit) {
      orderParams.takeProfit = params.takeProfit;
    }
    
    logger.info(`Creating order: ${JSON.stringify(orderParams)}`);
    return this.makeRequest('POST', '/api/v3/order', orderParams, true);
  }

  async createTestOrder(params) {
    const orderParams = {
      symbol: params.symbol,
      side: params.side.toUpperCase(),
      type: params.type.toUpperCase(),
      quantity: params.quantity,
      ...params
    };
    
    logger.info(`Creating test order: ${JSON.stringify(orderParams)}`);
    return this.makeRequest('POST', '/api/v3/order/test', orderParams, true);
  }

  async getOrder(symbol, orderId) {
    return this.makeRequest('GET', '/api/v3/order', { symbol, orderId }, true);
  }

  async cancelOrder(symbol, orderId) {
    return this.makeRequest('DELETE', '/api/v3/order', { symbol, orderId }, true);
  }

  async getOpenOrders(symbol) {
    const params = symbol ? { symbol } : {};
    return this.makeRequest('GET', '/api/v3/openOrders', params, true);
  }

  async getAllOrders(symbol, limit = 500) {
    return this.makeRequest('GET', '/api/v3/allOrders', { symbol, limit }, true);
  }

  // Get historical data for backtesting
  async getHistoricalData(symbol, interval = '1h', startTime, endTime) {
    const params = { symbol, interval };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;
    
    return this.makeRequest('GET', '/api/v3/klines', params);
  }

  // Format market data for strategies
  async getMarketData(symbol, interval = '1h', limit = 100) {
    try {
      const klines = await this.getKlines(symbol, interval, limit);
      
      const prices = klines.map(k => parseFloat(k[4])); // Close prices
      const highs = klines.map(k => parseFloat(k[2]));
      const lows = klines.map(k => parseFloat(k[3]));
      const volumes = klines.map(k => parseFloat(k[5]));
      const currentPrice = prices[prices.length - 1];
      
      return {
        symbol,
        prices,
        highs,
        lows,
        volumes,
        currentPrice,
        timestamps: klines.map(k => k[0])
      };
    } catch (error) {
      logger.error(`Error getting market data for ${symbol}:`, error);
      throw error;
    }
  }

  // Paper trading simulation
  async simulateOrder(orderParams) {
    const { symbol, side, quantity, entryPrice, stopLoss, takeProfit } = orderParams;
    
    // Simulate order execution
    const orderId = `PAPER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const executedPrice = entryPrice * (1 + (Math.random() * 0.002 - 0.001)); // Small slippage
    
    logger.info(`Paper trade executed: ${side} ${quantity} ${symbol} @ ${executedPrice}`);
    
    return {
      orderId,
      symbol,
      side,
      quantity,
      price: executedPrice,
      status: 'FILLED',
      paperTrade: true,
      stopLoss,
      takeProfit,
      executedAt: new Date().toISOString()
    };
  }
}

// Factory function
export function createExchangeConnector(exchange, isTestnet = true) {
  return new ExchangeConnector(exchange, isTestnet);
}
