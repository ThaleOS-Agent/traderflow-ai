import express from 'express';
import { backtestEngine } from '../services/backtestEngine.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/backtest/run
 * @desc Run backtest for a strategy
 * @access Private
 */
router.post('/run', authenticate, async (req, res) => {
  try {
    const {
      symbols,
      timeframes,
      strategies,
      startDate,
      endDate,
      initialCapital,
      positionSize,
      stopLoss,
      takeProfit
    } = req.body;
    
    const config = {
      symbols: symbols || ['BTC/USDT'],
      timeframes: timeframes || ['1h'],
      strategies: strategies || ['xq_trade_m8'],
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      endDate: endDate ? new Date(endDate) : new Date(),
      initialCapital: initialCapital || 10000,
      positionSize: positionSize || 10,
      stopLoss: stopLoss || 2,
      takeProfit: takeProfit || 4
    };
    
    // Run backtest asynchronously
    res.json({
      success: true,
      message: 'Backtest started',
      config
    });
    
    // Actually run the backtest
    const result = await backtestEngine.runBacktest(config);
    
    // Could emit result via WebSocket here
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/backtest/compare
 * @desc Compare multiple strategies
 * @access Private
 */
router.post('/compare', authenticate, async (req, res) => {
  try {
    const { strategies, config } = req.body;
    
    const results = await backtestEngine.compareStrategies(strategies, config);
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/backtest/results
 * @desc Get all backtest results
 * @access Private
 */
router.get('/results', authenticate, async (req, res) => {
  try {
    const results = backtestEngine.getResults();
    
    res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/backtest/results/latest
 * @desc Get latest backtest result
 * @access Private
 */
router.get('/results/latest', authenticate, async (req, res) => {
  try {
    const result = backtestEngine.getLatestResult();
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'No backtest results found'
      });
    }
    
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
 * @route GET /api/backtest/results/:id/export
 * @desc Export backtest results to CSV
 * @access Private
 */
router.get('/results/:id/export', authenticate, async (req, res) => {
  try {
    const result = backtestEngine.getResults().find(r => r.id === req.params.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Backtest result not found'
      });
    }
    
    const csv = backtestEngine.exportToCSV(result);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=backtest_${req.params.id}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/backtest/results
 * @desc Clear all backtest results
 * @access Private
 */
router.delete('/results', authenticate, async (req, res) => {
  try {
    backtestEngine.clearResults();
    
    res.json({
      success: true,
      message: 'Backtest results cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
