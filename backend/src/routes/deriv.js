import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { derivService } from '../services/derivService.js';
import { tradingEngine } from '../server.js';

const router = express.Router();

function getDerivConnection(user) {
  return (user.getDecryptedExchanges?.() || []).find(exchange => exchange.name === 'deriv') || null;
}

router.get('/symbols', async (req, res) => {
  try {
    const { market, limit } = req.query;
    const symbols = await derivService.getActiveSymbols({ market, limit });
    res.json({ success: true, symbols });
  } catch (error) {
    logger.error('Deriv symbols error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to load Deriv symbols' });
  }
});

router.get('/candles/:symbol', async (req, res) => {
  try {
    const { interval = '1h', count = 200 } = req.query;
    const candles = await derivService.getCandles(req.params.symbol, interval, count);
    res.json({ success: true, candles });
  } catch (error) {
    logger.error('Deriv candles error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to load Deriv candles' });
  }
});

router.get('/contracts/:symbol', async (req, res) => {
  try {
    const { currency = 'USD' } = req.query;
    const contracts = await derivService.getContractsFor(req.params.symbol, currency);
    res.json({ success: true, contracts });
  } catch (error) {
    logger.error('Deriv contracts error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to load Deriv contracts' });
  }
});

router.post('/proposal', async (req, res) => {
  try {
    const proposal = await derivService.getProposal(req.body || {});
    res.json({ success: true, proposal });
  } catch (error) {
    logger.error('Deriv proposal error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to build Deriv proposal' });
  }
});

router.get('/balance', authenticate, async (req, res) => {
  try {
    const derivConnection = getDerivConnection(req.user);
    if (!derivConnection?.apiKey) {
      return res.status(400).json({ success: false, error: 'Save a Deriv API token before loading balance' });
    }

    const account = await derivService.getBalance({
      token: derivConnection.apiKey,
      appId: derivConnection.passphrase
    });

    res.json({ success: true, account });
  } catch (error) {
    logger.error('Deriv balance error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to load Deriv balance' });
  }
});

router.post('/buy', authenticate, async (req, res) => {
  try {
    const { proposalId, price, symbol, contractType } = req.body || {};
    if (!proposalId || !price) {
      return res.status(400).json({ success: false, error: 'proposalId and price are required' });
    }

    const derivConnection = getDerivConnection(req.user);
    if (!derivConnection?.apiKey) {
      return res.status(400).json({ success: false, error: 'Save a Deriv API token in Exchange / Broker settings before buying a contract' });
    }

    const buy = await derivService.buyContract({
      token: derivConnection.apiKey,
      appId: derivConnection.passphrase,
      proposalId,
      price
    });

    tradingEngine.broadcast('orderExecuted', {
      userId: req.userId,
      order: {
        symbol: symbol || buy.shortcode || 'deriv_contract',
        side: contractType === 'PUT' ? 'sell' : 'buy',
        exchange: 'deriv',
        status: 'filled',
        exchangeOrderId: String(buy.transaction_id || buy.contract_id || proposalId),
        metadata: buy
      },
      isPaperTrade: false
    });

    res.json({ success: true, buy });
  } catch (error) {
    logger.error('Deriv buy error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to buy Deriv contract' });
  }
});

export default router;
