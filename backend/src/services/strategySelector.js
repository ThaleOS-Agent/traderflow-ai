import { getAllStrategies, getStrategy, getStrategyCodes } from './strategies/index.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function inferMarketProfile(marketData = {}) {
  const prices = Array.isArray(marketData.prices) ? marketData.prices : [];
  const volumes = Array.isArray(marketData.volumes) ? marketData.volumes : [];
  const currentPrice = Number(marketData.currentPrice || prices[prices.length - 1] || 0);
  const basePrice = Number(prices[Math.max(0, prices.length - 25)] || currentPrice || 1) || 1;
  const changePct = ((currentPrice - basePrice) / basePrice) * 100;

  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const previous = prices[i - 1] || 1;
    returns.push(((prices[i] - previous) / previous) * 100);
  }

  const volatility = returns.length
    ? Math.sqrt(returns.slice(-20).reduce((sum, value) => sum + (value ** 2), 0) / Math.min(20, returns.length))
    : 0;

  const avgVolume = volumes.length
    ? volumes.slice(-20).reduce((sum, value) => sum + value, 0) / Math.min(20, volumes.length)
    : 0;
  const volumeRatio = avgVolume > 0 ? (volumes[volumes.length - 1] || 0) / avgVolume : 1;

  let trend = 'sideways';
  if (changePct > 2.5) trend = 'bullish';
  else if (changePct < -2.5) trend = 'bearish';

  let volatilityBand = 'normal';
  if (volatility >= 3) volatilityBand = 'high';
  else if (volatility <= 1) volatilityBand = 'low';

  return {
    assetType: marketData.assetType || 'crypto',
    currentPrice,
    changePct,
    trend,
    volatility,
    volatilityBand,
    volumeRatio
  };
}

function strategyFitBonus(strategyMeta, profile, signal) {
  let bonus = 0;
  const type = String(strategyMeta.type || '');

  if (type.includes('momentum') || type.includes('trend')) {
    if (profile.trend !== 'sideways') bonus += 8;
    if (profile.volatilityBand !== 'low') bonus += 4;
  }

  if (type.includes('mean_reversion') || type.includes('reversal')) {
    if (profile.trend === 'sideways') bonus += 8;
    if (profile.volatilityBand === 'high') bonus += 5;
  }

  if (type.includes('breakout') || type.includes('volatility')) {
    if (profile.volatilityBand !== 'low') bonus += 9;
    if (profile.volumeRatio > 1.1) bonus += 4;
  }

  if (type.includes('ai_ml')) {
    bonus += 6;
  }

  const rr = Math.abs((signal.takeProfit - signal.entryPrice) / Math.max(0.000001, signal.entryPrice - signal.stopLoss || signal.stopLoss - signal.entryPrice));
  if (Number.isFinite(rr) && rr >= 1.5) bonus += 6;
  if (strategyMeta.supportedAssets?.includes(profile.assetType)) bonus += 6;

  return bonus;
}

export function scoreStrategyCandidate({ strategyMeta, signal, profile, preferredStrategy = 'all' }) {
  const rrRisk = Math.abs(signal.entryPrice - signal.stopLoss);
  const rrReward = Math.abs(signal.takeProfit - signal.entryPrice);
  const riskReward = rrRisk > 0 ? rrReward / rrRisk : 0;
  const base = Number(signal.confidenceScore || 0);
  const fitBonus = strategyFitBonus(strategyMeta, profile, signal);
  const preferenceBonus = preferredStrategy !== 'all' && preferredStrategy === signal.strategy ? 5 : 0;
  const compositeScore = clamp(base + fitBonus + preferenceBonus + Math.min(10, riskReward * 4), 0, 100);

  return {
    code: signal.strategy,
    name: strategyMeta.name,
    type: strategyMeta.type,
    supportedAssets: strategyMeta.supportedAssets,
    confidenceScore: base,
    compositeScore,
    riskReward: Number(riskReward.toFixed(2)),
    fitBonus,
    preferenceBonus,
    signal
  };
}

export async function rankStrategySignals(marketData, options = {}) {
  const profile = inferMarketProfile(marketData);
  const preferredStrategy = options.preferredStrategy || 'all';
  const strategyCodes = options.strategyCodes || getStrategyCodes();
  const strategyMetaMap = new Map(getAllStrategies().map((item) => [item.code, item]));
  const ranked = [];

  for (const code of strategyCodes) {
    const strategyMeta = strategyMetaMap.get(code);
    if (!strategyMeta) continue;
    if (!strategyMeta.supportedAssets.includes(profile.assetType)) continue;

    try {
      const strategy = getStrategy(code);
      const signal = await strategy.generateSignal(marketData);
      if (!signal) continue;
      ranked.push(scoreStrategyCandidate({ strategyMeta, signal, profile, preferredStrategy }));
    } catch (error) {
      continue;
    }
  }

  ranked.sort((a, b) => b.compositeScore - a.compositeScore || b.confidenceScore - a.confidenceScore);
  return {
    profile,
    ranked
  };
}

export function buildRecommendationPayload({ ranked, profile }) {
  const top = ranked[0] || null;
  if (!top) {
    return {
      selectedStrategy: null,
      alternatives: [],
      marketProfile: profile,
      recommendation: 'No strategy met the current execution threshold.'
    };
  }

  const alternatives = ranked.slice(1, 4).map((item) => ({
    strategy: item.code,
    name: item.name,
    score: item.compositeScore,
    confidenceScore: item.confidenceScore,
    riskReward: item.riskReward
  }));

  const recommendation = `${top.name} is the best fit for this order because market regime is ${profile.trend} with ${profile.volatilityBand} volatility and the setup scored ${top.compositeScore}/100.`;

  return {
    selectedStrategy: top.code,
    selectedName: top.name,
    selectedScore: top.compositeScore,
    alternatives,
    marketProfile: profile,
    recommendation
  };
}
