import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { agentOrchestrator } from '../services/agentOrchestrator.js';

const router = express.Router();

router.get('/status', authenticate, (req, res) => {
  res.json({
    success: true,
    status: agentOrchestrator.getStatus()
  });
});

router.get('/events', authenticate, (req, res) => {
  res.json({
    success: true,
    events: agentOrchestrator.getEvents(req.query.limit)
  });
});

router.get('/context', authenticate, (req, res) => {
  res.json({
    success: true,
    context: agentOrchestrator.getContext()
  });
});

export default router;
