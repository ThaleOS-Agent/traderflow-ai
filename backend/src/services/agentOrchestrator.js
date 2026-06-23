import { logger } from '../utils/logger.js';
import { User } from '../models/User.js';

const MAX_EVENTS = 250;

const DEFAULT_AGENTS = [
  {
    id: 'market_scanner',
    label: 'Market Scanner',
    role: 'market_research',
    service: 'assetScanner',
    domain: 'market',
    stage: 'research',
    description: 'Scans connected venues for liquid cross-asset setups and tradeable momentum.',
    capabilities: ['asset_discovery', 'technical_screening', 'opportunity_detection']
  },
  {
    id: 'market_feed_research',
    label: 'Market Feed Research',
    role: 'market_research',
    service: 'marketFeedService',
    domain: 'market',
    stage: 'research',
    description: 'Normalizes crypto, forex, metals, and oil price feeds for cross-market context.',
    capabilities: ['cross_asset_monitoring', 'price_normalization', 'venue_context']
  },
  {
    id: 'news_research',
    label: 'News Research',
    role: 'news_research',
    service: 'manual_news_review',
    domain: 'news',
    stage: 'research',
    status: 'manual_review',
    description: 'Tracks catalyst and macro-news coverage requirements until a live ingestion source is wired.',
    capabilities: ['headline_triage', 'macro_catalyst_watch', 'manual_briefing']
  },
  {
    id: 'pattern_scanner',
    label: 'Pattern Scanner',
    role: 'pattern_analysis',
    service: 'patternScanner',
    domain: 'analysis',
    stage: 'analysis',
    description: 'Validates chart structures and converts harmonic patterns into executable plans.',
    capabilities: ['harmonic_patterns', 'pattern_validation', 'chart_signal_generation']
  },
  {
    id: 'arbitrage_detector',
    label: 'Arbitrage Detector',
    role: 'cross_exchange_research',
    service: 'arbitrageDetector',
    domain: 'market',
    stage: 'opportunity',
    description: 'Compares venue pricing to surface cross-exchange spreads and arbitrage windows.',
    capabilities: ['price_matrix', 'spread_detection', 'arbitrage_signal_generation']
  },
  {
    id: 'ml_predictor',
    label: 'ML Predictor',
    role: 'machine_learning',
    service: 'mlPredictor',
    domain: 'analysis',
    stage: 'analysis',
    description: 'Scores direction, volatility, and opportunity quality from learned model output.',
    capabilities: ['prediction_scoring', 'model_inference']
  },
  {
    id: 'ensemble_master',
    label: 'Ensemble Master',
    role: 'strategy_ai',
    service: 'ensembleMaster',
    domain: 'decision',
    stage: 'decision',
    description: 'Weights strategy signals into a single recommendation and learning loop.',
    capabilities: ['strategy_weighting', 'signal_generation', 'learning_feedback']
  },
  {
    id: 'advanced_risk_manager',
    label: 'Advanced Risk Manager',
    role: 'risk_management',
    service: 'advancedRiskManager',
    domain: 'risk',
    stage: 'decision',
    description: 'Applies shared pre-trade validation, exposure checks, and emergency constraints.',
    capabilities: ['pre_trade_check', 'portfolio_risk', 'emergency_stop']
  },
  {
    id: 'auto_execution_engine',
    label: 'Auto Execution Engine',
    role: 'canonical_execution',
    service: 'autoExecution',
    domain: 'execution',
    stage: 'execution',
    description: 'Dispatches approved paper or live orders through the canonical execution path.',
    capabilities: ['paper_order_dispatch', 'live_order_dispatch', 'portfolio_update']
  },
  {
    id: 'trading_engine',
    label: 'Trading Engine',
    role: 'strategy_execution',
    service: 'tradingEngine',
    domain: 'execution',
    stage: 'execution',
    description: 'Runs scheduled strategies, monitors positions, and feeds execution telemetry back into the system.',
    capabilities: ['market_data', 'scheduled_signals', 'position_monitoring']
  }
];

export class AgentOrchestrator {
  constructor() {
    this.isInitialized = false;
    this.agents = new Map();
    this.events = [];
    this.sharedContext = {
      market: {},
      news: [],
      opportunities: [],
      patterns: [],
      arbitrage: [],
      ml: [],
      signals: [],
      riskDecisions: [],
      executions: []
    };
    this.stats = {
      ingestedEvents: 0,
      routedOpportunities: 0,
      approvedExecutions: 0,
      rejectedExecutions: 0,
      dispatchedExecutions: 0,
      failedExecutions: 0,
      lastEventAt: null
    };
  }

  initialize({ wss, tradingEngine, autoExecution, advancedRiskManager, mlPredictor } = {}) {
    this.wss = wss;
    this.tradingEngine = tradingEngine;
    this.autoExecution = autoExecution;
    this.advancedRiskManager = advancedRiskManager;
    this.mlPredictor = mlPredictor;

    for (const agent of DEFAULT_AGENTS) {
      this.registerAgent(agent);
    }

    this.isInitialized = true;
    this.recordEvent({
      source: 'agent_orchestrator',
      type: 'orchestrator_initialized',
      status: 'online',
      payload: {
        agentCount: this.agents.size,
        canonicalExecutor: 'auto_execution_engine',
        sharedRiskManager: 'advanced_risk_manager'
      }
    });

    logger.info(`Agent Orchestrator initialized with ${this.agents.size} registered agent roles`);
  }

  registerAgent({ id, label = id, role, service, domain = 'system', stage = 'research', description = '', capabilities = [], status = 'online' }) {
    this.agents.set(id, {
      id,
      label,
      role,
      service,
      domain,
      stage,
      description,
      capabilities,
      status,
      lastSeenAt: new Date().toISOString()
    });
  }

  touchAgent(agentId, status = 'online') {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.status = status;
    agent.lastSeenAt = new Date().toISOString();
  }

  agentIdForSource(source) {
    if (this.agents.has(source)) return source;
    if (String(source).startsWith('training.')) return 'ensemble_master';
    if (String(source).includes('news')) return 'news_research';
    if (String(source).includes('feed')) return 'market_feed_research';
    if (String(source).includes('pattern')) return 'pattern_scanner';
    if (String(source).includes('arbitrage')) return 'arbitrage_detector';
    if (String(source).includes('ml')) return 'ml_predictor';
    if (String(source).includes('execution')) return 'auto_execution_engine';
    if (String(source).includes('trading')) return 'trading_engine';
    if (String(source).includes('scanner')) return 'market_scanner';
    return 'market_scanner';
  }

  recordMarketData(marketData, source = 'trading_engine') {
    if (!marketData) return null;
    const symbols = Array.isArray(marketData.pairs)
      ? marketData.pairs
      : [marketData.symbol].filter(Boolean);

    for (const symbol of symbols) {
      this.sharedContext.market[symbol] = {
        ...marketData,
        symbol,
        source,
        lastUpdated: new Date().toISOString()
      };
    }

    return this.recordEvent({
      source,
      type: 'market_data',
      status: 'observed',
      payload: { symbols }
    });
  }

  recordPattern(pattern, source = 'pattern_scanner') {
    if (!pattern) return null;
    this.touchAgent('pattern_scanner');
    this.pushCapped(this.sharedContext.patterns, this.summarizePattern(pattern), 100);
    return this.recordEvent({
      source,
      type: 'pattern_detected',
      status: 'observed',
      payload: this.summarizePattern(pattern)
    });
  }

  async processPattern(pattern, source = 'pattern_scanner') {
    this.recordPattern(pattern, source);
    const opportunity = this.patternToOpportunity(pattern);
    if (!opportunity) {
      return { routed: false, reason: 'Pattern is not executable' };
    }
    return this.processOpportunity(opportunity, source);
  }

  recordArbitrageOpportunity(opportunity, source = 'arbitrage_detector') {
    if (!opportunity) return null;
    this.touchAgent('arbitrage_detector');
    this.pushCapped(this.sharedContext.arbitrage, this.summarizeOpportunity(opportunity), 100);
    return this.recordEvent({
      source,
      type: 'arbitrage_opportunity',
      status: 'observed',
      payload: this.summarizeOpportunity(opportunity)
    });
  }

  async processArbitrageOpportunity(opportunity, source = 'arbitrage_detector') {
    this.recordArbitrageOpportunity(opportunity, source);
    const executable = this.arbitrageToOpportunity(opportunity);
    if (!executable) {
      return { routed: false, reason: 'Arbitrage opportunity is not executable by the canonical executor' };
    }
    return this.processOpportunity(executable, source);
  }

  recordMlOutput(output, source = 'ml_predictor') {
    if (!output) return null;
    this.touchAgent('ml_predictor');
    const payload = {
      symbol: output.symbol || output.opportunity?.symbol,
      model: output.model || output.score?.model || output.prediction?.model,
      direction: output.direction || output.prediction?.direction,
      confidenceScore: Number(output.confidenceScore || output.score?.confidenceScore || output.prediction?.confidenceScore || 0),
      recommendation: output.recommendation || output.score?.recommendation,
      timestamp: output.timestamp || new Date().toISOString()
    };
    this.pushCapped(this.sharedContext.ml, payload, 100);
    return this.recordEvent({
      source,
      type: 'ml_output',
      status: 'observed',
      payload
    });
  }

  async processMlOpportunity({ opportunity, prediction, score } = {}, source = 'ml_predictor', userId = null) {
    this.recordMlOutput({ ...prediction, score, opportunity }, source);
    if (!opportunity) {
      return { routed: false, reason: 'ML output has no executable opportunity' };
    }

    const enrichedOpportunity = {
      ...opportunity,
      confidenceScore: Number(score?.confidenceScore || prediction?.confidenceScore || opportunity.confidenceScore || 0),
      confidence: score?.confidence || opportunity.confidence,
      strategy: opportunity.strategy || 'ml_predictor',
      analysis: opportunity.analysis || `ML ${score?.recommendation || prediction?.direction || 'signal'} output`,
      metadata: {
        ...opportunity.metadata,
        mlPrediction: prediction,
        mlScore: score
      }
    };

    if (userId) {
      return this.processOpportunityForUser(userId, enrichedOpportunity, source);
    }

    return this.processOpportunity(enrichedOpportunity, source);
  }

  recordSignal(signal, source = 'trading_engine') {
    if (!signal) return null;
    this.touchAgent(this.agentIdForSource(source));
    this.pushCapped(this.sharedContext.signals, this.summarizeOpportunity(signal), 100);
    return this.recordEvent({
      source,
      type: 'signal_generated',
      status: 'observed',
      payload: this.summarizeOpportunity(signal)
    });
  }

  async processSignal(signal, source = 'trading_engine') {
    this.recordSignal(signal, source);
    return this.processOpportunity(signal, source);
  }

  async processOpportunity(opportunity, source = 'market_scanner') {
    if (!this.autoExecution) {
      return { routed: false, reason: 'Canonical executor unavailable' };
    }

    const normalizedOpportunity = this.normalizeOpportunity(opportunity, source);
    if (!this.isExecutableOpportunity(normalizedOpportunity)) {
      return { routed: false, reason: 'Opportunity is missing required execution fields' };
    }

    this.touchAgent(this.agentIdForSource(source));
    this.stats.routedOpportunities++;
    this.pushCapped(this.sharedContext.opportunities, this.summarizeOpportunity(normalizedOpportunity), 150);
    this.recordEvent({
      source,
      type: 'opportunity_ingested',
      status: 'queued',
      payload: this.summarizeOpportunity(normalizedOpportunity)
    });

    const users = await User.find({ 'tradingSettings.autoTrading': true });
    const results = [];

    for (const user of users) {
      const result = await this.processOpportunityForUser(user._id.toString(), normalizedOpportunity, source, {
        normalized: true,
        recordOpportunity: false
      });
      results.push(result);
    }

    return {
      routed: true,
      source,
      usersEvaluated: users.length,
      results
    };
  }

  async processOpportunityForUser(userId, opportunity, source = 'manual_execution', options = {}) {
    if (!this.autoExecution) {
      return { userId, approved: false, routed: false, reason: 'Canonical executor unavailable' };
    }

    const normalizedOpportunity = options.normalized
      ? opportunity
      : this.normalizeOpportunity(opportunity, source);

    if (!this.isExecutableOpportunity(normalizedOpportunity)) {
      return { userId, approved: false, routed: false, reason: 'Opportunity is missing required execution fields' };
    }

    this.touchAgent(this.agentIdForSource(source));
    if (options.recordOpportunity !== false) {
      this.stats.routedOpportunities++;
      this.pushCapped(this.sharedContext.opportunities, this.summarizeOpportunity(normalizedOpportunity), 150);
      this.recordEvent({
        source,
        type: 'opportunity_ingested',
        status: 'queued',
        payload: {
          ...this.summarizeOpportunity(normalizedOpportunity),
          userId
        }
      });
    }

    const plan = await this.autoExecution.previewExecutionPlan(userId, normalizedOpportunity);
    if (!plan.executable) {
      const decision = this.recordRiskDecision({
        userId,
        opportunity: normalizedOpportunity,
        approved: false,
        reason: plan.reason,
        source
      });
      return { userId, approved: false, reason: plan.reason, decisionId: decision.id };
    }

    const riskDecision = await this.evaluateRisk(userId, normalizedOpportunity, plan);
    if (!riskDecision.approved) {
      return { userId, ...riskDecision };
    }

    try {
      await this.autoExecution.executeForUser(userId, normalizedOpportunity, riskDecision);
      this.stats.dispatchedExecutions++;
      return { userId, ...riskDecision, dispatched: true };
    } catch (error) {
      this.stats.failedExecutions++;
      this.recordEvent({
        source: 'auto_execution_engine',
        type: 'execution_failed',
        status: 'failed',
        payload: {
          userId,
          symbol: normalizedOpportunity.symbol,
          exchange: normalizedOpportunity.exchange,
          reason: error.message
        }
      });
      return { userId, approved: false, dispatched: false, reason: error.message };
    }
  }

  async evaluateRisk(userId, opportunity, plan) {
    if (!this.advancedRiskManager) {
      return this.recordRiskDecision({
        userId,
        opportunity,
        approved: false,
        reason: 'Advanced risk manager unavailable'
      });
    }

    try {
      this.touchAgent('advanced_risk_manager');
      const check = await this.advancedRiskManager.preTradeCheck(userId, {
        symbol: opportunity.symbol,
        side: opportunity.side,
        quantity: plan.quantity,
        entryPrice: opportunity.entryPrice,
        stopLoss: opportunity.stopLoss,
        takeProfit: opportunity.takeProfit,
        exchange: opportunity.exchange,
        strategy: opportunity.strategy
      });

      return this.recordRiskDecision({
        userId,
        opportunity,
        approved: Boolean(check.approved),
        reason: check.approved ? 'approved' : 'advanced risk check rejected the trade',
        risk: check
      });
    } catch (error) {
      logger.error(`Orchestrator risk decision failed for user ${userId}:`, error.message);
      return this.recordRiskDecision({
        userId,
        opportunity,
        approved: false,
        reason: error.message
      });
    }
  }

  recordRiskDecision({ userId, opportunity, approved, reason, risk = null, source = 'advanced_risk_manager' }) {
    const decision = {
      id: `RISK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      symbol: opportunity.symbol,
      exchange: opportunity.exchange,
      strategy: opportunity.strategy,
      approved,
      reason,
      risk,
      decidedAt: new Date().toISOString()
    };

    if (approved) {
      this.stats.approvedExecutions++;
    } else {
      this.stats.rejectedExecutions++;
    }

    this.pushCapped(this.sharedContext.riskDecisions, decision, 150);
    this.recordEvent({
      source,
      type: 'risk_decision',
      status: approved ? 'approved' : 'rejected',
      payload: {
        id: decision.id,
        userId,
        symbol: decision.symbol,
        exchange: decision.exchange,
        approved,
        reason
      }
    });

    return decision;
  }

  recordExecution(execution, source = 'auto_execution_engine') {
    if (!execution) return null;
    this.touchAgent('auto_execution_engine');
    const payload = {
      userId: execution.userId?.toString?.() || execution.userId,
      tradeId: execution._id?.toString?.() || execution.tradeId,
      symbol: execution.symbol,
      side: execution.side,
      exchange: execution.exchange,
      strategy: execution.strategy,
      isPaperTrade: execution.isPaperTrade,
      status: execution.status
    };
    this.pushCapped(this.sharedContext.executions, payload, 100);
    return this.recordEvent({
      source,
      type: 'execution_dispatched',
      status: 'executed',
      payload
    });
  }

  recordEvent({ source, type, status = 'observed', payload = {} }) {
    const event = {
      id: `AGT_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      source,
      type,
      status,
      payload,
      timestamp: new Date().toISOString()
    };

    this.events.push(event);
    this.events = this.events.slice(-MAX_EVENTS);
    this.stats.ingestedEvents++;
    this.stats.lastEventAt = event.timestamp;
    this.broadcast('agentOrchestratorUpdate', event);
    return event;
  }

  normalizeOpportunity(opportunity, source) {
    return {
      ...opportunity,
      sourceAgent: source,
      exchange: opportunity.exchange || opportunity.provider || opportunity.buyExchange || 'binance',
      side: opportunity.side || opportunity.action || 'buy',
      confidenceScore: Number(opportunity.confidenceScore || opportunity.confidence || 0),
      strategy: opportunity.strategy || opportunity.type || source,
      assetType: opportunity.assetType || 'crypto'
    };
  }

  isExecutableOpportunity(opportunity) {
    return Boolean(
      opportunity?.symbol &&
      opportunity?.exchange &&
      ['buy', 'sell'].includes(opportunity.side) &&
      Number(opportunity.entryPrice) > 0 &&
      Number(opportunity.stopLoss) > 0 &&
      Number(opportunity.takeProfit) > 0 &&
      Number(opportunity.confidenceScore) > 0
    );
  }

  patternToOpportunity(pattern) {
    const target = Array.isArray(pattern?.targets) ? pattern.targets[1] || pattern.targets[0] : pattern?.takeProfit;
    if (!pattern?.symbol || !pattern?.entryPrice || !pattern?.stopLoss || !target) return null;
    return {
      symbol: pattern.symbol,
      exchange: pattern.exchange || 'binance',
      assetType: pattern.assetType || 'crypto',
      side: pattern.direction === 'bearish' ? 'sell' : 'buy',
      entryPrice: pattern.entryPrice,
      stopLoss: pattern.stopLoss,
      takeProfit: target,
      confidence: pattern.confidence >= 85 ? 'high' : 'medium',
      confidenceScore: pattern.confidence,
      strategy: `harmonic_${String(pattern.patternType || 'pattern').toLowerCase()}`,
      analysis: `${pattern.patternType || 'Pattern'} ${pattern.direction || ''} detected`,
      metadata: { patternId: pattern.id, timeframe: pattern.timeframe }
    };
  }

  arbitrageToOpportunity(opportunity) {
    if (!opportunity?.symbol || !opportunity?.buyPrice || !opportunity?.sellPrice) return null;
    return {
      symbol: opportunity.symbol,
      exchange: opportunity.buyExchange,
      assetType: 'crypto',
      side: 'buy',
      entryPrice: Number(opportunity.buyPrice),
      stopLoss: Number(opportunity.buyPrice) * 0.995,
      takeProfit: Number(opportunity.sellPrice),
      confidence: opportunity.confidence || 'medium',
      confidenceScore: Number(opportunity.confidenceScore || 0),
      strategy: 'cross_exchange_arbitrage',
      analysis: `Buy on ${opportunity.buyExchange}, sell on ${opportunity.sellExchange}`,
      metadata: { arbitrageId: opportunity.id, sellExchange: opportunity.sellExchange }
    };
  }

  summarizePattern(pattern) {
    return {
      id: pattern.id,
      symbol: pattern.symbol,
      timeframe: pattern.timeframe,
      patternType: pattern.patternType,
      direction: pattern.direction,
      confidence: pattern.confidence,
      status: pattern.status,
      detectedAt: pattern.detectedAt
    };
  }

  summarizeOpportunity(opportunity) {
    return {
      id: opportunity.id,
      symbol: opportunity.symbol,
      exchange: opportunity.exchange || opportunity.buyExchange,
      side: opportunity.side,
      strategy: opportunity.strategy || opportunity.type,
      confidenceScore: opportunity.confidenceScore,
      entryPrice: opportunity.entryPrice || opportunity.buyPrice,
      stopLoss: opportunity.stopLoss,
      takeProfit: opportunity.takeProfit || opportunity.sellPrice,
      sourceAgent: opportunity.sourceAgent,
      detectedAt: opportunity.detectedAt || opportunity.timestamp || new Date().toISOString()
    };
  }

  pushCapped(list, item, max) {
    list.push(item);
    if (list.length > max) {
      list.splice(0, list.length - max);
    }
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      canonicalExecutor: 'auto_execution_engine',
      sharedRiskManager: 'advanced_risk_manager',
      agents: Array.from(this.agents.values()),
      stats: this.stats,
      contextCounts: {
        market: Object.keys(this.sharedContext.market).length,
        news: this.sharedContext.news.length,
        opportunities: this.sharedContext.opportunities.length,
        patterns: this.sharedContext.patterns.length,
        arbitrage: this.sharedContext.arbitrage.length,
        ml: this.sharedContext.ml.length,
        signals: this.sharedContext.signals.length,
        riskDecisions: this.sharedContext.riskDecisions.length,
        executions: this.sharedContext.executions.length
      }
    };
  }

  getEvents(limit = 50) {
    const normalizedLimit = Math.max(1, Math.min(Number(limit) || 50, MAX_EVENTS));
    return this.events.slice(-normalizedLimit).reverse();
  }

  getContext() {
    return this.sharedContext;
  }

  broadcast(event, data) {
    if (!this.wss) return;
    this.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          event,
          data,
          timestamp: Date.now(),
          source: 'agentOrchestrator'
        }));
      }
    });
  }
}

export const agentOrchestrator = new AgentOrchestrator();
