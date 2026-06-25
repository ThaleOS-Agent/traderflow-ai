import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

mongoose.set('bufferCommands', false);

export const connectDB = async () => {
  try {
    // ── Connection pool monitoring ──────────────────────────────────────────
    // Register listeners on mongoose.connection *before* connect() so that
    // the initial 'connected' event (emitted during connect()) is not missed.
    const db = mongoose.connection;

    db.on('connected', () =>
      logger.info('MongoDB: connection established')
    );

    db.on('disconnected', () =>
      logger.warn('MongoDB: connection lost — attempting to reconnect')
    );

    db.on('reconnected', () =>
      logger.info('MongoDB: reconnected successfully')
    );

    db.on('error', (err) =>
      logger.error('MongoDB: connection error', { error: err.message })
    );

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Increase pool size to handle high-concurrency exchange API workloads.
      // Default is 10; 100 allows many simultaneous queries without exhaustion.
      maxPoolSize: 100,
      minPoolSize: 10,

      // Disable Mongoose's operation buffering so queries fail immediately
      // when the connection is not yet ready, rather than silently queuing
      // and hitting the 10-second buffer timeout.
      bufferCommands: false,

      // How long the driver waits to find an available server before throwing.
      // 30 s gives enough headroom for transient network hiccups in SEA region.
      serverSelectionTimeoutMS: 30000,

      // How long a send/receive on an individual socket may take.
      // 45 s covers slow aggregation queries without hanging indefinitely.
      socketTimeoutMS: 45000,

      // How long to wait when establishing a new connection to a MongoDB node.
      connectTimeoutMS: 30000,

      // Keep idle connections alive so the pool stays warm between bursts.
      heartbeatFrequencyMS: 10000,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`, {
      poolSize: 100,
      bufferCommands: false,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    // Mongoose 7+ emits these pool events on the underlying MongoClient.
    const client = db.getClient();
    if (client) {
      client.on('connectionPoolCreated', ({ address }) =>
        logger.debug('MongoDB pool: created', { address })
      );

      client.on('connectionCreated', ({ connectionId, address }) =>
        logger.debug('MongoDB pool: connection opened', { connectionId, address })
      );

      client.on('connectionClosed', ({ connectionId, address, reason }) =>
        logger.debug('MongoDB pool: connection closed', { connectionId, address, reason })
      );

      client.on('connectionCheckOutStarted', ({ connectionId, address }) =>
        logger.debug('MongoDB pool: checkout started', { connectionId, address })
      );

      client.on('connectionCheckOutFailed', ({ address, reason }) =>
        logger.warn('MongoDB pool: checkout FAILED — pool may be exhausted', { address, reason })
      );

      client.on('connectionCheckedOut', ({ connectionId, address }) =>
        logger.debug('MongoDB pool: checked out', { connectionId, address })
      );

      client.on('connectionCheckedIn', ({ connectionId, address }) =>
        logger.debug('MongoDB pool: checked in', { connectionId, address })
      );

      client.on('connectionPoolCleared', ({ address }) =>
        logger.warn('MongoDB pool: cleared', { address })
      );
    }

    return conn;
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error;
  }
};
