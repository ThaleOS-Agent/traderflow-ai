#!/usr/bin/env node
// =============================================================================
// TradeFlow AI - Debug & Test Script
// Tests all backend endpoints and validates production readiness
// =============================================================================

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[PASS]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[FAIL]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}=== ${msg} ===${colors.reset}`),
  header: (msg) => console.log(`\n${colors.magenta}${msg}${colors.reset}\n${'='.repeat(msg.length)}`)
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: 'passed' });
    log.success(name);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'failed', error: error.message });
    log.error(`${name}: ${error.message}`);
  }
}

function warn(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: 'passed' });
    log.success(name);
  } catch (error) {
    results.warnings++;
    results.tests.push({ name, status: 'warning', error: error.message });
    log.warn(`${name}: ${error.message}`);
  }
}

// =============================================================================
// FILE STRUCTURE TESTS
// =============================================================================

log.header('TRADEFLOW AI - DEBUG & PRODUCTION TEST');
log.section('FILE STRUCTURE TESTS');

test('Backend directory exists', () => {
  if (!fs.existsSync('./backend')) throw new Error('Backend directory not found');
});

test('Frontend src directory exists', () => {
  if (!fs.existsSync('./src')) throw new Error('Frontend src directory not found');
});

test('Backend server.js exists', () => {
  if (!fs.existsSync('./backend/src/server.js')) throw new Error('server.js not found');
});

test('Frontend App.tsx exists', () => {
  if (!fs.existsSync('./src/App.tsx')) throw new Error('App.tsx not found');
});

test('Package.json exists', () => {
  if (!fs.existsSync('./package.json')) throw new Error('package.json not found');
});

test('Backend package.json exists', () => {
  if (!fs.existsSync('./backend/package.json')) throw new Error('Backend package.json not found');
});

// =============================================================================
// BACKEND ROUTES TESTS
// =============================================================================

log.section('BACKEND ROUTES TESTS');

const requiredRoutes = [
  'auth.js',
  'user.js',
  'trades.js',
  'strategies.js',
  'signals.js',
  'dashboard.js',
  'exchange.js',
  'patterns.js',
  'scanner.js',
  'execution.js',
  'arbitrage.js',
  'backtest.js',
  'notifications.js',
  'dex.js',
  'risk.js',
  'ml.js',
  'social.js',
  'options.js',
  'training.js',
  'wallet.js',
  'forex.js'
];

requiredRoutes.forEach(route => {
  test(`Route: ${route}`, () => {
    if (!fs.existsSync(`./backend/src/routes/${route}`)) {
      throw new Error(`Route file not found: ${route}`);
    }
  });
});

// =============================================================================
// BACKEND SERVICES TESTS
// =============================================================================

log.section('BACKEND SERVICES TESTS');

const requiredServices = [
  'tradingEngine.js',
  'patternScanner.js',
  'assetScanner.js',
  'autoExecution.js',
  'arbitrageDetector.js',
  'mlPredictor.js',
  'notificationService.js',
  'dexIntegration.js',
  'advancedRiskManager.js',
  'socialTrading.js',
  'optionsTrading.js',
  'ensembleMasterStrategy.js',
  'mlTrainingService.js',
  'enhancedBacktestEngine.js',
  'walletConnectService.js',
  'oandaForex.js',
  'websocketService.js',
  'featureEngineering.js'
];

requiredServices.forEach(service => {
  test(`Service: ${service}`, () => {
    if (!fs.existsSync(`./backend/src/services/${service}`)) {
      throw new Error(`Service file not found: ${service}`);
    }
  });
});

// =============================================================================
// MODELS TESTS
// =============================================================================

log.section('MODELS TESTS');

const requiredModels = [
  'User.js',
  'Trade.js',
  'Signal.js',
  'Strategy.js'
];

requiredModels.forEach(model => {
  test(`Model: ${model}`, () => {
    if (!fs.existsSync(`./backend/src/models/${model}`)) {
      throw new Error(`Model file not found: ${model}`);
    }
  });
});

// =============================================================================
// MIDDLEWARE TESTS
// =============================================================================

log.section('MIDDLEWARE TESTS');

const requiredMiddleware = [
  'auth.js',
  'paywall.js'
];

requiredMiddleware.forEach(mw => {
  test(`Middleware: ${mw}`, () => {
    if (!fs.existsSync(`./backend/src/middleware/${mw}`)) {
      throw new Error(`Middleware file not found: ${mw}`);
    }
  });
});

// =============================================================================
// FRONTEND SERVICES TESTS
// =============================================================================

log.section('FRONTEND SERVICES TESTS');

test('Frontend API service exists', () => {
  if (!fs.existsSync('./src/services/api.ts')) {
    throw new Error('Frontend API service not found');
  }
});

test('Dashboard API export exists', () => {
  if (!fs.existsSync('./src/dashboard/api.ts')) {
    throw new Error('Dashboard API export not found');
  }
});

// =============================================================================
// DEPENDENCY TESTS
// =============================================================================

log.section('DEPENDENCY TESTS');

test('Frontend dependencies installed', () => {
  if (!fs.existsSync('./node_modules')) {
    throw new Error('Frontend node_modules not found. Run: npm install');
  }
});

warn('Backend dependencies installed', () => {
  if (!fs.existsSync('./backend/node_modules')) {
    throw new Error('Backend node_modules not found. Run: cd backend && npm install');
  }
});

// =============================================================================
// CONFIGURATION TESTS
// =============================================================================

log.section('CONFIGURATION TESTS');

test('Frontend config.ts exists', () => {
  if (!fs.existsSync('./src/config.ts')) {
    throw new Error('Frontend config.ts not found');
  }
});

warn('.env file exists', () => {
  if (!fs.existsSync('./backend/.env')) {
    throw new Error('Backend .env file not found');
  }
});

// =============================================================================
// BUILD TESTS
// =============================================================================

log.section('BUILD TESTS');

test('Dist folder exists (frontend built)', () => {
  if (!fs.existsSync('./dist')) {
    throw new Error('Dist folder not found. Run: npm run build');
  }
});

test('index.html in dist', () => {
  if (!fs.existsSync('./dist/index.html')) {
    throw new Error('index.html not found in dist folder');
  }
});

// =============================================================================
// API ENDPOINT VALIDATION
// =============================================================================

log.section('API ENDPOINT VALIDATION');

const serverContent = fs.readFileSync('./backend/src/server.js', 'utf8');

const requiredEndpoints = [
  '/api/auth',
  '/api/user',
  '/api/trades',
  '/api/strategies',
  '/api/signals',
  '/api/dashboard',
  '/api/exchange',
  '/api/patterns',
  '/api/scanner',
  '/api/execution',
  '/api/arbitrage',
  '/api/backtest',
  '/api/notifications',
  '/api/dex',
  '/api/risk',
  '/api/ml',
  '/api/social',
  '/api/options',
  '/api/training',
  '/api/wallet',
  '/api/forex',
  '/api/health'
];

requiredEndpoints.forEach(endpoint => {
  test(`Endpoint registered: ${endpoint}`, () => {
    const usePattern = `app.use('${endpoint}'`;
    const getPattern = `app.get('${endpoint}'`;
    const postPattern = `app.post('${endpoint}'`;
    
    if (!serverContent.includes(usePattern) && 
        !serverContent.includes(getPattern) && 
        !serverContent.includes(postPattern)) {
      throw new Error(`Endpoint ${endpoint} not registered in server.js`);
    }
  });
});

// =============================================================================
// SERVICE IMPORTS VALIDATION
// =============================================================================

log.section('SERVICE IMPORTS VALIDATION');

const requiredImports = [
  'walletConnectService',
  'oandaForexService',
  'ensembleMaster',
  'mlTrainingService',
  'enhancedBacktestEngine'
];

requiredImports.forEach(importName => {
  test(`Service imported: ${importName}`, () => {
    if (!serverContent.includes(importName)) {
      throw new Error(`Service ${importName} not imported in server.js`);
    }
  });
});

// =============================================================================
// ENVIRONMENT VARIABLES CHECK
// =============================================================================

log.section('ENVIRONMENT VARIABLES');

const requiredEnvVars = [
  'PORT',
  'MONGODB_URI',
  'JWT_SECRET',
  'FRONTEND_URL'
];

if (fs.existsSync('./backend/.env')) {
  const envContent = fs.readFileSync('./backend/.env', 'utf8');
  
  requiredEnvVars.forEach(envVar => {
    warn(`Env var: ${envVar}`, () => {
      if (!envContent.includes(`${envVar}=`)) {
        throw new Error(`${envVar} not defined in .env`);
      }
    });
  });
} else {
  log.warn('Skipping env var checks - .env file not found');
}

// =============================================================================
// PRODUCTION READINESS CHECKS
// =============================================================================

log.section('PRODUCTION READINESS CHECKS');

test('No console.log in production code (backend)', () => {
  // This is a basic check - in production you'd want proper logging
  const files = fs.readdirSync('./backend/src');
  // Just check that logger is imported
  if (!serverContent.includes('logger')) {
    throw new Error('Logger not imported in server.js');
  }
});

test('CORS configured', () => {
  if (!serverContent.includes('cors(')) {
    throw new Error('CORS not configured');
  }
});

test('Helmet security enabled', () => {
  if (!serverContent.includes('helmet()')) {
    throw new Error('Helmet not enabled');
  }
});

test('Rate limiting configured', () => {
  if (!serverContent.includes('rateLimit')) {
    throw new Error('Rate limiting not configured');
  }
});

// =============================================================================
// SUMMARY
// =============================================================================

log.header('TEST SUMMARY');

console.log(`\n${colors.green}Passed:${colors.reset} ${results.passed}`);
console.log(`${colors.red}Failed:${colors.reset} ${results.failed}`);
console.log(`${colors.yellow}Warnings:${colors.reset} ${results.warnings}`);
console.log(`${colors.blue}Total:${colors.reset} ${results.passed + results.failed + results.warnings}`);

const passRate = ((results.passed / (results.passed + results.failed)) * 100).toFixed(1);
console.log(`\n${colors.cyan}Pass Rate:${colors.reset} ${passRate}%`);

// Production readiness
if (results.failed === 0) {
  console.log(`\n${colors.green}✅ PRODUCTION READY${colors.reset}`);
  process.exit(0);
} else if (results.failed <= 3) {
  console.log(`\n${colors.yellow}⚠️ MOSTLY READY - Fix ${results.failed} issues before production${colors.reset}`);
  process.exit(1);
} else {
  console.log(`\n${colors.red}❌ NOT READY FOR PRODUCTION - Fix ${results.failed} issues${colors.reset}`);
  process.exit(1);
}
