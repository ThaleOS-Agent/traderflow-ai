import { logger } from '../utils/logger.js';
import { mlApiClient } from '../clients/mlApiClient.js';
import { ensembleMaster } from './ensembleMasterStrategy.js';

/**
 * Thin adapter over the internal FastAPI training service.
 * Keeps route behavior stable while moving training logic out of process.
 */
export class MLTrainingService {
  constructor() {
    this.latestJob = null;
    this.latestStatus = {
      isTraining: false,
      bestPerformance: {
        winRate: 0,
        profitFactor: 0,
        sharpeRatio: 0,
      },
      trainingHistory: [],
      strategyWeights: {},
      service: 'ml-api',
      available: false,
    };
    this.strategyWeights = {
      neuralNetwork: 0.35,
      fibonacci: 0.20,
      volatility: 0.15,
      kelly: 0.12,
      trend: 0.08,
      meanReversion: 0.05,
      breakout: 0.03,
      rlExit: 0.02,
    };
  }

  async startTraining(trainingData = null) {
    try {
      logger.info('Requesting ML training from ml-api...');
      const response = await mlApiClient.startTraining({ trainingData });
      const job = response.job || response.result || response;

      this.latestJob = job;
      if (job?.weights) {
        this.strategyWeights = job.weights;
      }

      const performance = job?.performance || {};
      this.latestStatus = {
        isTraining: job?.status === 'running' || job?.status === 'queued',
        bestPerformance: {
          winRate: performance.winRate || 0,
          profitFactor: performance.profitFactor || 0,
          sharpeRatio: performance.sharpeRatio || 0,
        },
        trainingHistory: job ? [job] : [],
        strategyWeights: this.strategyWeights,
        latestJobId: job?.jobId || null,
        service: 'ml-api',
        available: true,
      };

      return {
        success: true,
        ...response,
        result: job,
      };
    } catch (error) {
      this.latestStatus.available = false;
      logger.error('Training failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  getTrainingStatus() {
    return this.latestStatus;
  }

  getOptimizedWeights() {
    return this.strategyWeights;
  }

  async applyTrainedWeights() {
    try {
      const response = await mlApiClient.getLatestWeights();
      const weights = response.weights || this.strategyWeights;
      this.strategyWeights = weights;

      ensembleMaster.config = {
        neuralNetworkWeight: weights.neuralNetwork,
        fibonacciWeight: weights.fibonacci,
        volatilityWeight: weights.volatility,
        kellyWeight: weights.kelly,
        trendWeight: weights.trend,
        meanReversionWeight: weights.meanReversion,
        breakoutWeight: weights.breakout,
        rlExitWeight: weights.rlExit,
      };

      this.latestStatus.strategyWeights = weights;
      this.latestStatus.available = true;
      logger.info('Applied ml-api trained weights to Ensemble Master Strategy');

      return {
        applied: true,
        weights,
      };
    } catch (error) {
      this.latestStatus.available = false;
      logger.error('Failed to apply trained weights:', error.message);
      return {
        applied: false,
        error: error.message,
      };
    }
  }
}

export const mlTrainingService = new MLTrainingService();
