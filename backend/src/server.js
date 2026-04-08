import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import { connectDB } from './config/database.js';
import { logger } from './utils/logger.js';
import { setupWebSocket } from './services/websocketService.js';
import { TradingEngine } from './services/tradingEngine.js';
import { PatternScanner } from './services/patternScanner.js';
import { assetScanner } from './services/assetScanner.js';
import { autoExecution } from './services/autoExecution.js';
import { arbitrageDetector } from './services/arbitrageDetector.js';
import { mlPredictor } from './services/mlPredictor.js';
import { notificationService } from './services/notificationService.js';
import { dexIntegration } from './services/dexIntegration.js';
import { advancedRiskManager } from './services/advancedRiskManager.js';
import { socialTradingService } from './services/socialTrading.js';
import { optionsTradingService } from './services/optionsTrading.js';
import { ensembleMaster } from './services/ensembleMasterStrategy.js';
import { mlTrainingService } from './services/mlTrainingService.js';
import { enhancedBacktestEngine } from './services/enhancedBacktestEngine.js';
import { walletConnectService } from './services/walletConnectService.js';
import { oandaForexService } from './services/oandaForex.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import tradeRoutes from './routes/trades.js';
import strategyRoutes from './routes/strategies.js';
import signalRoutes from './routes/signals.js';
import dashboardRoutes from './routes/dashboard.js';
import exchangeRoutes from './routes/exchange.js';
import patternRoutes from './routes/patterns.js';
import scannerRoutes from './routes/scanner.js';
import executionRoutes from './routes/execution.js';
import arbitrageRoutes from './routes/arbitrage.js';
import backtestRoutes from './routes/backtest.js';
import notificationRoutes from './routes/notifications.js';
import dexRoutes from './routes/dex.js';
import riskRoutes from './routes/risk.js';
import mlRoutes from './routes/ml.js';
import socialRoutes from './routes/social.js';
import optionsRoutes from './routes/options.js';
import trainingRoutes from './routes/training.js';
import walletRoutes from './routes/wallet.js';
import forexRoutes from './routes/forex.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to database
connectDB();

// Setup WebSocket
setupWebSocket(wss);

// Initialize Trading Engine
const tradingEngine = new TradingEngine(wss);
tradingEngine.initialize();

// Initialize Pattern Scanner
const patternScanner = new PatternScanner(wss);
patternScanner.initialize();

// Initialize Asset Scanner (with default exchange configs)
const exchangeConfigs = [
  { exchange: 'binance', isTestnet: true },
  { exchange: 'coinbase', isTestnet: true },
  { exchange: 'kraken', isTestnet: false },
  { exchange: 'kucoin', isTestnet: true },
  { exchange: 'bybit', isTestnet: true },
  { exchange: 'ftx', isTestnet: true },
  { exchange: 'gemini', isTestnet: true },
  { exchange: 'bitfinex', isTestnet: false },
  { exchange: 'oanda', isTestnet: true }
];

assetScanner.initialize(exchangeConfigs).then(() => {
  logger.info('Asset Scanner initialized with multi-exchange support');
}).catch(err => {
  logger.error('Failed to initialize Asset Scanner:', err);
});

// Initialize Arbitrage Detector
arbitrageDetector.initialize(exchangeConfigs).then(() => {
  logger.info('Arbitrage Detector initialized');
}).catch(err => {
  logger.error('Failed to initialize Arbitrage Detector:', err);
});

// Initialize ML Predictor
mlPredictor.initialize().then(() => {
  logger.info('ML Predictor initialized');
}).catch(err => {
  logger.error('Failed to initialize ML Predictor:', err);
});

// Initialize Notification Service
notificationService.initialize().then(() => {
  logger.info('Notification Service initialized');
}).catch(err => {
  logger.error('Failed to initialize Notification Service:', err);
});

// Initialize DEX Integration
dexIntegration.initialize(['pancakeswap', 'sushiswap', 'uniswap_v3']).then(() => {
  logger.info('DEX Integration initialized');
}).catch(err => {
  logger.error('Failed to initialize DEX Integration:', err);
});

// Initialize Auto-Execution Engine
autoExecution.wss = wss;

// Connect asset scanner to auto-execution
// When opportunities are found, auto-execute for users with auto-trading enabled
assetScanner.onOpportunity = async (opportunity) => {
  await autoExecution.executeOpportunity(opportunity);
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/strategies', strategyRoutes);
app.use('/api/signals', signalRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/patterns', patternRoutes);
app.use('/api/scanner', scannerRoutes);
app.use('/api/execution', executionRoutes);
app.use('/api/arbitrage', arbitrageRoutes);
app.use('/api/backtest', backtestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dex', dexRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/options', optionsRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/forex', forexRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    tradingEngine: tradingEngine.isRunning() ? 'running' : 'stopped',
    patternScanner: patternScanner.isRunning ? 'running' : 'stopped',
    assetScanner: assetScanner.isRunning ? 'running' : 'stopped',
    autoExecution: autoExecution.isRunning ? 'running' : 'stopped',
    arbitrageDetector: arbitrageDetector.isRunning ? 'running' : 'stopped',
    mlPredictor: 'initialized',
    notificationService: notificationService.isInitialized ? 'initialized' : 'not_initialized',
    dexIntegration: dexIntegration.isInitialized ? 'initialized' : 'not_initialized',
    advancedRiskManager: 'initialized',
    activePatterns: patternScanner.getActivePatterns?.() || 0,
    trackedAssets: assetScanner.stats?.totalAssets || 0,
    activeOpportunities: assetScanner.getOpportunities?.()?.length || 0,
    arbitrageOpportunities: arbitrageDetector.getOpportunities?.()?.length || 0,
    notificationSubscriptions: notificationService.getStats?.()?.totalSubscriptions || 0
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  logger.info(`TradeFlow AI Server running on port ${PORT}`);
  logger.info(`WebSocket server ready on ws://localhost:${PORT}/ws`);
});

export { 
  tradingEngine, 
  patternScanner, 
  assetScanner, 
  autoExecution, 
  arbitrageDetector,
  mlPredictor,
  notificationService,
  dexIntegration,
  advancedRiskManager,
  socialTradingService,
  optionsTradingService,
  ensembleMaster,
  mlTrainingService,
  enhancedBacktestEngine,
  walletConnectService,
  oandaForexService,
  wss 
};
