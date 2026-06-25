const DEFAULT_BASE_URL = 'http://ml-api:8000';
const DEFAULT_TIMEOUT_MS = 5000;

function getBaseUrl() {
  return (process.env.ML_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function getTimeoutMs() {
  const parsed = Number(process.env.ML_API_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(`${getBaseUrl()}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || payload.detail || `ML API request failed with HTTP ${response.status}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export const mlApiClient = {
  health() {
    return request('/health');
  },

  predictPriceDirection(payload) {
    return request('/v1/infer/price-direction', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  scoreOpportunity(payload) {
    return request('/v1/infer/opportunity-score', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  forecastVolatility(payload) {
    return request('/v1/infer/volatility-forecast', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getModels() {
    return request('/v1/models');
  },

  getPerformance() {
    return request('/v1/performance');
  },

  startTraining(payload = {}) {
    return request('/v1/training/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getTrainingStatus(jobId) {
    return request(`/v1/training/status/${encodeURIComponent(jobId)}`);
  },

  getLatestWeights() {
    return request('/v1/training/weights/latest');
  },

  generateSignal(payload) {
    return request('/v1/training/generate-signal', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export default mlApiClient;
