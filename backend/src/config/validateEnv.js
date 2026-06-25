export function validateEnv() {
  const required = [
    'JWT_SECRET',
    'MONGODB_URI',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Set them in your .env file or deployment environment.'
    );
  }

  // Warn on insecure JWT secret in production
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.JWT_SECRET &&
    process.env.JWT_SECRET.length < 32
  ) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }

  if (process.env.NODE_ENV === 'production' && process.env.MONGODB_URI) {
    let hostname = '';
    try {
      const normalized = process.env.MONGODB_URI.startsWith('mongodb')
        ? process.env.MONGODB_URI
        : `mongodb://${process.env.MONGODB_URI}`;
      hostname = new URL(normalized).hostname;
    } catch {
      throw new Error('MONGODB_URI must be a valid MongoDB connection string.');
    }

    if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
      throw new Error('Production MONGODB_URI must point to a persistent remote or containerized MongoDB service, not localhost.');
    }
  }
}
