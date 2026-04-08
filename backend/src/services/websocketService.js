import { logger } from '../utils/logger.js';
import jwt from 'jsonwebtoken';

export function setupWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    logger.info('New WebSocket connection');
    
    ws.isAlive = true;
    
    // Send welcome message
    ws.send(JSON.stringify({
      event: 'connected',
      data: { message: 'Connected to TradeFlow AI WebSocket' },
      timestamp: Date.now()
    }));

    // Handle messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        await handleMessage(ws, data);
      } catch (error) {
        logger.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          event: 'error',
          data: { message: 'Invalid message format' },
          timestamp: Date.now()
        }));
      }
    });

    // Handle pong (keepalive)
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle close
    ws.on('close', () => {
      logger.info('WebSocket connection closed');
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });
  });

  // Keepalive ping
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });
}

async function handleMessage(ws, data) {
  const { event, payload, token } = data;
  
  switch (event) {
    case 'subscribe':
      handleSubscribe(ws, payload);
      break;
      
    case 'unsubscribe':
      handleUnsubscribe(ws, payload);
      break;
      
    case 'auth':
      handleAuth(ws, token);
      break;
      
    case 'ping':
      ws.send(JSON.stringify({ event: 'pong', timestamp: Date.now() }));
      break;
      
    default:
      ws.send(JSON.stringify({
        event: 'error',
        data: { message: `Unknown event: ${event}` },
        timestamp: Date.now()
      }));
  }
}

function handleSubscribe(ws, payload) {
  const { channels } = payload || {};
  
  if (channels && Array.isArray(channels)) {
    ws.subscriptions = channels;
    ws.send(JSON.stringify({
      event: 'subscribed',
      data: { channels },
      timestamp: Date.now()
    }));
  }
}

function handleUnsubscribe(ws, payload) {
  const { channels } = payload || {};
  
  if (channels && Array.isArray(channels)) {
    ws.subscriptions = (ws.subscriptions || []).filter(c => !channels.includes(c));
    ws.send(JSON.stringify({
      event: 'unsubscribed',
      data: { channels },
      timestamp: Date.now()
    }));
  }
}

function handleAuth(ws, token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tradeflow-secret');
    ws.userId = decoded.userId;
    ws.isAuthenticated = true;
    
    ws.send(JSON.stringify({
      event: 'authenticated',
      data: { userId: decoded.userId },
      timestamp: Date.now()
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      event: 'error',
      data: { message: 'Authentication failed' },
      timestamp: Date.now()
    }));
  }
}
