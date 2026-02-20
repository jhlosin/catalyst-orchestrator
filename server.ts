/**
 * server.ts
 * ACP Webhook server for Catalyst
 */

import express from 'express';
import WebSocket from 'ws';
import { basicOrchestrate, handleAcpWebSocket } from './basic-orchestrate';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'catalyst', timestamp: new Date() });
});

// ACP Service Endpoints
app.post('/api/acp/services/basic_orchestrate', async (req, res) => {
  try {
    const request = req.body;

    console.log('[Catalyst] Received basic_orchestrate request:', request);

    const result = await basicOrchestrate(request);

    res.json({
      status: 'success',
      result: result,
      cost: result.total_cost,
      execution_time_ms: result.execution_time_ms
    });
  } catch (error: any) {
    console.error('[Catalyst] Error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

app.post('/api/acp/services/advanced_orchestrate', async (req, res) => {
  // Similar to basic, but with more agents and error handling
  res.json({ status: 'not_implemented', message: 'Coming soon' });
});

app.post('/api/acp/services/micro_orchestrate', async (req, res) => {
  // Similar to basic, but with only 2 agents
  res.json({ status: 'not_implemented', message: 'Coming soon' });
});

// Start HTTP server
app.listen(PORT, () => {
  console.log(`[Catalyst] HTTP server listening on port ${PORT}`);
  console.log(`[Catalyst] Health check: http://localhost:${PORT}/health`);
});

// Start ACP WebSocket connection
const WS_URL = process.env.ACP_WS_URL || 'wss://api.virtuals.io/acp/ws';
const API_KEY = process.env.ACP_API_KEY || '';

function startWebSocket() {
  const ws = new WebSocket(WS_URL, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`
    }
  });

  ws.on('open', () => {
    console.log('[Catalyst] ACP WebSocket connected');

    // Subscribe to service jobs
    ws.send(JSON.stringify({
      type: 'subscribe',
      channels: ['service_jobs']
    }));
  });

  ws.on('message', (data) => {
    console.log('[Catalyst] Received WebSocket message:', data.toString());
  });

  ws.on('error', (error) => {
    console.error('[Catalyst] WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('[Catalyst] WebSocket closed, reconnecting in 5s...');
    setTimeout(startWebSocket, 5000);
  });
}

startWebSocket();
