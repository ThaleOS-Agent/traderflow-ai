import { logger } from '../utils/logger.js';
import { MultiExchangeConnector } from './exchanges/multiExchange.js';

/**
 * Cross-Exchange Arbitrage Detector
 * Monitors price differences across exchanges for arbitrage opportunities
 */
export class ArbitrageDetector {
  constructor(wss) {
    this.wss = wss;
    this.isRunning = false;
    this.exchanges = new Map();
    this.priceMatrix = new Map(); // symbol -> { exchange, bid, ask, timestamp }
    this.arbitrageOpportunities = [];
    
    // Configuration
    this.config = {
      minProfitPercent: 0.3,      // Minimum 0.3% profit after fees
      maxTradeAmount: 10000,      // Maximum $10k per arbitrage
      minTradeAmount: 100,        // Minimum $100 per arbitrage
      scanInterval: 5000,         // 5 seconds between scans
      feeEstimate: 0.002,         // 0.2% estimated fees per trade
      slippageEstimate: 0.001,    // 0.1% estimated slippage
      maxAgeMs: 30000,            // Max 30 seconds for price data
      minVolume24h: 50000,        // Minimum $50k daily volume
      concurrentScans: 10         // Max concurrent symbol scans
    };
    
    // Statistics
    this.stats = {
      totalScans: 0,
      opportunitiesFound: 0,
      totalProfitPotential: 0,
      lastScanTime: null
    };
  }

  /**
   * Initialize arbitrage detector with exchange connections
   */
  async initialize(exchangeConfigs) {
    logger.info('Initializing Arbitrage Detector...');
    
    for (const config of exchangeConfigs) {
      try {
        const connector = new MultiExchangeConnector(config.exchange, config.isTestnet);
        
        if (config.apiKey && config.apiSecret) {
          connector.setCredentials(config.apiKey, config.apiSecret, config.passphrase);
        }
        
        this.exchanges.set(config.exchange, {
          connector,
          config,
          symbols: [],
          fees: config.fees || { maker: 0.001, taker: 0.002 }
        });
        
        logger.info(`Arbitrage: Exchange connected: ${config.exchange}`);
      } catch (error) {
        logger.error(`Arbitrage: Failed to connect ${config.exchange}:`, error.message);
      }
    }
    
    // Discover common symbols across exchanges
    await this.discoverCommonSymbols();
    
    // Start price monitoring
    this.startMonitoring();
    
    this.isRunning = true;
    logger.info(`Arbitrage Detector initialized with ${this.exchanges.size} exchanges`);
  }

  /**
   * Discover symbols available on multiple exchanges
   */
  async discoverCommonSymbols() {
    logger.info('Discovering common symbols across exchanges...');
    
    const exchangeSymbols = new Map();
    
    for (const [exchangeName, exchangeData] of this.exchanges) {
      try {
        const { connector } = exchangeData;
        const pairs = await connector.getTradingPairs();
        
        // Filter for major quote currencies
        const validPairs = pairs.filter(p => 
          ['USDT', 'USD', 'USDC', 'BTC', 'ETH'].includes(p.quote)
        );
        
        exchangeSymbols.set(exchangeName, new Set(validPairs.map(p => p.symbol)));
        exchangeData.symbols = validPairs.map(p => p.symbol);
        
        logger.info(`Arbitrage: ${exchangeName} has ${validPairs.length} valid pairs`);
      } catch (error) {
        logger.error(`Arbitrage: Failed to get pairs from ${exchangeName}:`, error.message);
      }
    }
    
    // Find common symbols (available on at least 2 exchanges)
    const symbolCount = new Map();
    for (const symbols of exchangeSymbols.values()) {
      for (const symbol of symbols) {
        symbolCount.set(symbol, (symbolCount.get(symbol) || 0) + 1);
      }
    }
    
    // Store common symbols
    this.commonSymbols = Array.from(symbolCount.entries())
      .filter(([symbol, count]) => count >= 2)
      .map(([symbol]) => symbol)
      .slice(0, 200); // Limit to top 200
    
    logger.info(`Arbitrage: Found ${this.commonSymbols.length} common symbols`);
  }

  /**
   * Start continuous price monitoring
   */
  startMonitoring() {
    logger.info('Starting arbitrage price monitoring...');
    
    // Monitor prices continuously
    this.monitorInterval = setInterval(async () => {
      await this.scanPrices();
    }, this.config.scanInterval);
    
    // Detect arbitrage opportunities
    this.detectInterval = setInterval(async () => {
      await this.detectArbitrage();
    }, this.config.scanInterval * 2);
  }

  /**
   * Scan prices from all exchanges
   */
  async scanPrices() {
    const symbols = this.commonSymbols.slice(0, this.config.concurrentScans);
    
    for (const symbol of symbols) {
      for (const [exchangeName, exchangeData] of this.exchanges) {
        try {
          const { connector } = exchangeData;
          const ticker = await connector.getTicker(symbol);
          
          // Extract price data based on exchange format
          const bid = this.extractPrice(ticker, 'bid', exchangeName);
          const ask = this.extractPrice(ticker, 'ask', exchangeName);
          const volume = this.extractVolume(ticker, exchangeName);
          
          if (bid && ask && volume > this.config.minVolume24h) {
            if (!this.priceMatrix.has(symbol)) {
              this.priceMatrix.set(symbol, new Map());
            }
            
            this.priceMatrix.get(symbol).set(exchangeName, {
              bid,
              ask,
              volume,
              timestamp: Date.now()
            });
          }
        } catch (error) {
          // Silently skip failed price fetches
        }
      }
    }
    
    this.stats.totalScans++;
    this.stats.lastScanTime = new Date();
  }

  /**
   * Extract price from ticker based on exchange format
   */
  extractPrice(ticker, type, exchange) {
    try {
      switch (exchange) {
        case 'binance':
          return parseFloat(type === 'bid' ? ticker.bidPrice : ticker.askPrice);
        case 'coinbase':
          return parseFloat(type === 'bid' ? ticker.bid : ticker.ask);
        case 'kraken':
          const pair = Object.keys(ticker)[0];
          return parseFloat(ticker[pair][type === 'bid' ? 0 : 1]);
        case 'kucoin':
          return parseFloat(type === 'bid' ? ticker.bestBid : ticker.bestAsk);
        case 'bybit':
          return parseFloat(type === 'bid' ? ticker.bid1Price : ticker.ask1Price);
        case 'ftx':
          return parseFloat(type === 'bid' ? ticker.bid : ticker.ask);
        case 'gemini':
          return parseFloat(type === 'bid' ? ticker.bid : ticker.ask);
        case 'bitfinex':
          return parseFloat(type === 'bid' ? ticker.bid : ticker.ask);
        case 'oanda':
          const price = ticker.prices?.[0];
          return parseFloat(type === 'bid' ? price?.bids?.[0]?.price : price?.asks?.[0]?.price);
        default:
          return parseFloat(ticker[type === 'bid' ? 'bid' : 'ask']);
      }
    } catch (e) {
      return null;
    }
  }

  /**
   * Extract volume from ticker
   */
  extractVolume(ticker, exchange) {
    try {
      switch (exchange) {
        case 'binance':
          return parseFloat(ticker.volume) * parseFloat(ticker.lastPrice);
        case 'coinbase':
          return parseFloat(ticker.volume) * parseFloat(ticker.price);
        case 'kraken':
          const pair = Object.keys(ticker)[0];
          return parseFloat(ticker[pair][5]) * parseFloat(ticker[pair][0]);
        case 'kucoin':
          return parseFloat(ticker.volValue);
        case 'bybit':
          return parseFloat(ticker.turnover24h);
        case 'ftx':
          return parseFloat(ticker.volumeUsd24h);
        case 'gemini':
          return parseFloat(ticker.volume?.USD) || 100000;
        case 'bitfinex':
          return parseFloat(ticker.volume) * parseFloat(ticker.lastPrice);
        default:
          return 100000; // Default assumption
      }
    } catch (e) {
      return 0;
    }
  }

  /**
   * Detect arbitrage opportunities
   */
  async detectArbitrage() {
    const now = Date.now();
    const newOpportunities = [];
    
    for (const [symbol, exchangeData] of this.priceMatrix) {
      const validPrices = [];
      
      // Filter valid prices (not too old)
      for (const [exchangeName, data] of exchangeData) {
        if (now - data.timestamp < this.config.maxAgeMs) {
          validPrices.push({
            exchange: exchangeName,
            bid: data.bid,
            ask: data.ask,
            volume: data.volume
          });
        }
      }
      
      if (validPrices.length < 2) continue;
      
      // Find best arbitrage opportunities
      for (const buyExchange of validPrices) {
        for (const sellExchange of validPrices) {
          if (buyExchange.exchange === sellExchange.exchange) continue;
          
          // Calculate arbitrage profit
          const buyPrice = buyExchange.ask;
          const sellPrice = sellExchange.bid;
          
          if (sellPrice <= buyPrice) continue;
          
          const grossProfit = ((sellPrice - buyPrice) / buyPrice) * 100;
          
          // Calculate net profit after fees
          const buyFee = this.exchanges.get(buyExchange.exchange).fees.taker;
          const sellFee = this.exchanges.get(sellExchange.exchange).fees.taker;
          const totalFees = (buyFee + sellFee + this.config.slippageEstimate * 2) * 100;
          
          const netProfit = grossProfit - totalFees;
          
          if (netProfit >= this.config.minProfitPercent) {
            const opportunity = {
              id: `ARB_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              symbol,
              buyExchange: buyExchange.exchange,
              sellExchange: sellExchange.exchange,
              buyPrice,
              sellPrice,
              grossProfit: grossProfit.toFixed(3),
              netProfit: netProfit.toFixed(3),
              fees: totalFees.toFixed(3),
              potentialProfit: (this.config.maxTradeAmount * netProfit / 100).toFixed(2),
              timestamp: new Date(),
              confidence: netProfit > 1 ? 'high' : netProfit > 0.5 ? 'medium' : 'low',
              confidenceScore: Math.min(95, netProfit * 30 + 50),
              type: 'cross_exchange_arbitrage',
              executionTime: this.estimateExecutionTime(buyExchange.exchange, sellExchange.exchange)
            };
            
            newOpportunities.push(opportunity);
          }
        }
      }
    }
    
    // Sort by profit and update opportunities
    newOpportunities.sort((a, b) => parseFloat(b.netProfit) - parseFloat(a.netProfit));
    
    // Add new opportunities
    for (const opp of newOpportunities.slice(0, 10)) {
      const existingIndex = this.arbitrageOpportunities.findIndex(
        o => o.symbol === opp.symbol && o.buyExchange === opp.buyExchange && o.sellExchange === opp.sellExchange
      );
      
      if (existingIndex >= 0) {
        this.arbitrageOpportunities[existingIndex] = { ...opp, occurrences: (this.arbitrageOpportunities[existingIndex].occurrences || 1) + 1 };
      } else {
        this.arbitrageOpportunities.push(opp);
        this.stats.opportunitiesFound++;
        this.stats.totalProfitPotential += parseFloat(opp.potentialProfit);
        
        // Broadcast new opportunity
        this.broadcast('arbitrageOpportunity', opp);
        logger.info(`Arbitrage: ${opp.symbol} - Buy on ${opp.buyExchange} @ $${opp.buyPrice.toFixed(4)}, Sell on ${opp.sellExchange} @ $${opp.sellPrice.toFixed(4)} = ${opp.netProfit}% profit`);
      }
    }
    
    // Clean old opportunities
    this.arbitrageOpportunities = this.arbitrageOpportunities
      .filter(o => now - new Date(o.timestamp).getTime() < 300000) // 5 minutes
      .slice(0, 50);
  }

  /**
   * Estimate execution time for arbitrage
   */
  estimateExecutionTime(buyExchange, sellExchange) {
    const baseTime = 2; // Base 2 seconds
    const exchangeLatency = {
      binance: 0.5,
      coinbase: 0.8,
      kraken: 1.0,
      kucoin: 0.7,
      bybit: 0.6,
      ftx: 0.5,
      gemini: 0.8,
      bitfinex: 0.9,
      interactive_brokers: 1.5,
      oanda: 0.7
    };
    
    return baseTime + (exchangeLatency[buyExchange] || 1) + (exchangeLatency[sellExchange] || 1);
  }

  /**
   * Execute arbitrage trade (for future implementation)
   */
  async executeArbitrage(opportunityId) {
    const opportunity = this.arbitrageOpportunities.find(o => o.id === opportunityId);
    if (!opportunity) {
      throw new Error('Arbitrage opportunity not found');
    }
    
    logger.info(`Executing arbitrage: ${opportunity.symbol}`);
    
    // This would implement actual arbitrage execution
    // For now, return simulation
    return {
      status: 'simulated',
      opportunity,
      message: 'Arbitrage execution requires API credentials and balance verification'
    };
  }

  /**
   * Get current arbitrage opportunities
   */
  getOpportunities(minProfit = 0) {
    return this.arbitrageOpportunities
      .filter(o => parseFloat(o.netProfit) >= minProfit)
      .sort((a, b) => parseFloat(b.netProfit) - parseFloat(a.netProfit));
  }

  /**
   * Get arbitrage statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeOpportunities: this.arbitrageOpportunities.length,
      exchanges: this.exchanges.size,
      commonSymbols: this.commonSymbols?.length || 0
    };
  }

  /**
   * Broadcast message
   */
  broadcast(event, data) {
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ 
            event, 
            data, 
            timestamp: Date.now(),
            source: 'arbitrageDetector'
          }));
        }
      });
    }
  }

  /**
   * Stop arbitrage detector
   */
  stop() {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    if (this.detectInterval) clearInterval(this.detectInterval);
    this.isRunning = false;
    logger.info('Arbitrage Detector stopped');
  }
}

export const arbitrageDetector = new ArbitrageDetector();
