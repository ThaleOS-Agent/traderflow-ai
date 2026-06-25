import { logger } from '../utils/logger.js';
import { mlApiClient } from '../clients/mlApiClient.js';

/**
 * Thin adapter over the internal FastAPI ML service.
 * Keeps the legacy service contract stable for existing routes and callers.
 */
export class MLPredictor {
  constructor() {
    this.models = [];
    this.performance = {
      predictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      lastTraining: null,
      models: [],
      service: 'ml-api',
      available: false,
    };
  }

  async initialize() {
    logger.info('Initializing ML Prediction Service...');

    try {
      const [health, modelsResponse, performanceResponse] = await Promise.all([
        mlApiClient.health(),
        mlApiClient.getModels(),
        mlApiClient.getPerformance(),
      ]);

      this.models = modelsResponse.models || [];
      this.performance = {
        ...this.performance,
        ...(performanceResponse.performance || {}),
        models: this.models,
        service: 'ml-api',
        available: health.status === 'ok',
      };

      logger.info('ML Prediction Service initialized via ml-api');
    } catch (error) {
      this.performance.available = false;
      logger.error('Failed to initialize ML Prediction Service via ml-api:', error.message);
      throw error;
    }
  }

  async predictPriceDirection(marketData) {
    try {
      const response = await mlApiClient.predictPriceDirection(marketData);
      this.performance.predictions += 1;
      return response.prediction || null;
    } catch (error) {
      logger.error('ML predictPriceDirection error:', error.message);
      return null;
    }
  }

  async scoreOpportunity(opportunity, marketData) {
    try {
      const response = await mlApiClient.scoreOpportunity({ opportunity, marketData });
      return response.score || null;
    } catch (error) {
      logger.error('ML scoreOpportunity error:', error.message);
      return null;
    }
  }

  async forecastVolatility(marketData) {
    try {
      const response = await mlApiClient.forecastVolatility(marketData);
      return response.forecast || null;
    } catch (error) {
      logger.error('ML forecastVolatility error:', error.message);
      return null;
    }
  }

  async getModels() {
    try {
      const response = await mlApiClient.getModels();
      this.models = response.models || [];
      return this.models;
    } catch (error) {
      logger.error('ML getModels error:', error.message);
      return this.models;
    }
  }

  getPerformance() {
    return {
      ...this.performance,
      models: this.models,
    };
  }

  async updateModel(symbol, actualResult, prediction) {
    if (!actualResult || !prediction) {
      return;
    }

    const wasCorrect =
      (prediction.direction === 'bullish' && actualResult.return > 0) ||
      (prediction.direction === 'bearish' && actualResult.return < 0) ||
      (prediction.direction === 'neutral' && Math.abs(actualResult.return) < 0.5);

    if (wasCorrect) {
      this.performance.correctPredictions += 1;
    }

    if (this.performance.predictions > 0) {
      this.performance.accuracy = (
        this.performance.correctPredictions / this.performance.predictions * 100
      ).toFixed(2);
    }
  }
}

export const mlPredictor = new MLPredictor();
