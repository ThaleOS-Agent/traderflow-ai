import express from 'express';
import { oandaForexService } from '../services/oandaForex.js';
import { authenticate } from '../middleware/auth.js';
import { requireFeature, requireTier } from '../middleware/paywall.js';

const router = express.Router();

/**
 * @route POST /api/forex/initialize
 * @desc Initialize OANDA connection
 * @access Private (Platinum+)
 */
router.post('/initialize', authenticate, requireTier('platinum'), async (req, res) => {
  try {
    const { apiKey, accountId, isPractice = true } = req.body;
    
    if (!apiKey || !accountId) {
      return res.status(400).json({
        success: false,
        error: 'API key and account ID required'
      });
    }
    
    const result = await oandaForexService.initialize(apiKey, accountId, isPractice);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/forex/status
 * @desc Get OANDA connection status
 * @access Private
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = oandaForexService.getStatus();
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/forex/account
 * @desc Get OANDA account information
 * @access Private (Platinum+)
 */
router.get('/account', authenticate, requireTier('platinum'), async (req, res) => {
  try {
    const account = await oandaForexService.getAccount();
    
    res.json({
      success: true,
      account
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/forex/account/summary
 * @desc Get OANDA account summary
 * @access Private (Platinum+)
 */
router.get('/account/summary', authenticate, requireTier('platinum'), async (req, res) => {
  try {
    const summary = await oandaForexService.getAccountSummary();
    
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/forex/pairs
 * @desc Get available FOREX pairs
 * @access Private
 */
router.get('/pairs', authenticate, async (req, res) => {
  try {
    const { category = 'all' } = req.query;
    
    const pairs = oandaForexService.getForexPairs(category);
    
    res.json({
      success: true,
      category,
      pairs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/forex/prices
 * @desc Get current prices for instruments
 * @access Private
 */
router.get('/prices', authenticate, async (req, res) => {
  try {
    const { instruments } = req.query;
    
    if (!instruments) {
      return res.status(400).json({
        success: false,
        error: 'Instruments parameter required'
      });
    }
    
    const instrumentList = instruments.split(',');
    const prices = await oandaForexService.getPrices(instrumentList);
    
    res.json({
      success: true,
      prices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/forex/candles/:instrument
 * @desc Get candlestick data
 * @access Private
 */
router.get('/candles/:instrument', authenticate, async (req, res) => {
  try {
    const { instrument } = req.params;
    const { granularity = 'H1', count = 500 } = req.query;
    
    const candles = await oandaForexService.getCandles(
      instrument,
      granularity,
      parseInt(count)
    );
    
    res.json({
      success: true,
      instrument,
      granularity,
      count: candles.length,
      candles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/forex/orderbook/:instrument
 * @desc Get order book
 * @access Private (Platinum+)
 */
router.get('/orderbook/:instrument', authenticate, requireTier('platinum'), async (req, res) => {
  try {
    const { instrument } = req.params;
    
    const orderBook = await oandaForexService.getOrderBook(instrument);
    
    res.json({
      success: true,
      instrument,
      orderBook
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/forex/positionbook/:instrument
 * @desc Get position book
 * @access Private (Platinum+)
 */
router.get('/positionbook/:instrument', authenticate, requireTier('platinum'), async (req, res) => {
  try {
    const { instrument } = req.params;
    
    const positionBook = await oandaForexService.getPositionBook(instrument);
    
    res.json({
      success: true,
      instrument,
      positionBook
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/forex/order/market
 * @desc Create market order
 * @access Private (Platinum+)
 */
router.post('/order/market', authenticate, requireTier('platinum'), async (req, res) => {
  try {
    const { instrument, units, stopLoss, takeProfit, trailingStop } = req.body;
    
    if (!instrument || !units) {
      return res.status(400).json({
        success: false,
        error: 'Instrument and units required'
      });
    }
    
    const order = await oandaForexService.createMarketOrder(
      instrument,
      parseFloat(units),
      stopLoss ? parseFloat(stopLoss) : null,
      takeProfit ? parseFloat(takeProfit) : null,
      trailingStop ? parseFloat(trailingStop) : null
    );
    
    res.json({
      success: true,
      order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/forex/order/limit
 * @desc Create limit order
 * @access Private (Platinum+)
 */
router.post('/order/limit', authenticate, requireTier('platinum'), async (req, res) => {
  try {
    const { instrument, units, price, stopLoss, takeProfit } = req.body;
    
    if (!instrument || !units || !price) {
      return res.status(400).json({
        success: false,
        error: 'Instrument, units, and price required'
      });
    }
    
    const order = await oandaForexService.createLimitOrder(
      instrument,
      parseFloat(units),
      parseFloat(price),
      stopLoss ? parseFloat(stopLoss) : null,
      takeProfit ? parseFloat(takeProfit) : null
    );
    
    res.json({
      success: true,
      order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/forex/position/close
 * @desc Close position
 * @access Private (Platinum+)
 */
router.post('/position/close', authenticate, requireTier('platinum'), async (req, res) => {
  try {
    const { instrument, units } = req.body;
    
    if (!instrument) {
      return res.status(400).json({
        success: false,
        error: 'Instrument required'
      });
    }
    
    const result = await oandaForexService.closePosition(
      instrument,
      units ? parseFloat(units) : null
    );
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/forex/positions
 * @desc Get open positions
 * @access Private (Platinum+)
 */
router.get('/positions', authenticate, requireTier('platinum'), async (req, res) => {
  try {
    const positions = await oandaForexService.getOpenPositions();
    
    res.json({
      success: true,
      count: positions.length,
      positions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/forex/orders/pending
 * @desc Get pending orders
 * @access Private (Platinum+)
 */
router.get('/orders/pending', authenticate, requireTier('platinum'), async (req, res) => {
  try {
    const orders = await oandaForexService.getPendingOrders();
    
    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/forex/order/cancel
 * @desc Cancel order
 * @access Private (Platinum+)
 */
router.post('/order/cancel', authenticate, requireTier('platinum'), async (req, res) => {
  try {
    const { orderId } = req.body;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID required'
      });
    }
    
    const result = await oandaForexService.cancelOrder(orderId);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/forex/history
 * @desc Get trade history
 * @access Private (Platinum+)
 */
router.get('/history', authenticate, requireTier('platinum'), async (req, res) => {
  try {
    const { from, to, count = 100 } = req.query;
    
    const transactions = await oandaForexService.getTradeHistory(from, to, parseInt(count));
    
    res.json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/forex/calculate/position-size
 * @desc Calculate position size based on risk
 * @access Private
 */
router.post('/calculate/position-size', authenticate, async (req, res) => {
  try {
    const { accountBalance, riskPercent, stopLossPips, pipValue } = req.body;
    
    if (!accountBalance || !riskPercent || !stopLossPips || !pipValue) {
      return res.status(400).json({
        success: false,
        error: 'All parameters required'
      });
    }
    
    const positionSize = oandaForexService.calculatePositionSize(
      parseFloat(accountBalance),
      parseFloat(riskPercent),
      parseFloat(stopLossPips),
      parseFloat(pipValue)
    );
    
    res.json({
      success: true,
      positionSize,
      inputs: {
        accountBalance,
        riskPercent,
        stopLossPips,
        pipValue
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
