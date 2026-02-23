/**
 * server.ts
 * ACP Webhook server for Catalyst with monitoring dashboard
 */

import express from 'express';
import WebSocket from 'ws';
import { basicOrchestrate, handleAcpWebSocket } from './basic-orchestrate';
import { v4 as uuidv4 } from 'uuid';
import { saveRequestLog, getStats, getRecentLogs, getAgentStats, type RequestLog } from './database';
import { cacheAgentDetails, getAgentDetails, getAllAgents } from './agents';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Generate summary from result
function generateSummary(result: any): string {
  if (!result) return '';
  if (result.summary) return result.summary;
  if (result.agents_used) return `Used ${result.agents_used.length} agents`;
  return 'Completed';
}

// Convert DB log to API format
function toApiLog(dbLog: any): RequestLog {
  const apiLog: RequestLog = {
    id: dbLog.id.toString(),
    timestamp: dbLog.timestamp,
    goal: dbLog.goal,
    category: dbLog.category,
    agents_used: dbLog.agents_used,
    status: dbLog.status,
    cost: dbLog.cost,
    execution_time_ms: dbLog.execution_time_ms,
    result_summary: dbLog.result_summary,
    error: dbLog.error
  };
  return apiLog;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'catalyst', timestamp: new Date() });
});

// API: Get stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = getStats();
    const agents = getAllAgents();
    res.json({
      ...stats,
      agent_count: agents.size
    });
  } catch (error: any) {
    console.error('[Catalyst] Error fetching stats:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// API: Get all agents (from DB - actual call data)
app.get('/api/agents', (req, res) => {
  try {
    // Get agent stats from DB (actual calls)
    const agentStats = getAgentStats();

    // Merge with cached details if available
    const merged = agentStats.map(stat => {
      const cached = getAgentDetails(stat.agent_id);
      return {
        id: stat.agent_id,
        agent_name: stat.agent_name,
        wallet_address: cached?.wallet_address,
        description: cached?.description || '',
        job_offerings: cached?.job_offerings || [],
        metrics: {
          successful_job_count: stat.call_count,
          success_rate: stat.call_count > 0 ? 1.0 : 0,
          unique_buyer_count: 0,
          is_online: cached?.metrics?.is_online || false,
          mins_from_last_online_time: 0,
          last_active_at: stat.last_called_at,
          twitter_handle: cached?.metrics?.twitter_handle
        }
      };
    });

    res.json({
      agents: merged,
      total: merged.length
    });
  } catch (error: any) {
    console.error('[Catalyst] Error fetching agents:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// API: Get logs
app.get('/api/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = getRecentLogs(limit);
    const apiLogs = logs.map(toApiLog);
    res.json({
      logs: apiLogs,
      total: logs.length
    });
  } catch (error: any) {
    console.error('[Catalyst] Error fetching logs:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// ACP Service Endpoints
app.post('/api/acp/services/basic_orchestrate', async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const request = req.body;

    console.log('[Catalyst] Received basic_orchestrate request:', request);

    const result = await basicOrchestrate(request);
    const executionTime = Date.now() - startTime;

    // Save successful log to database
    saveRequestLog({
      timestamp: new Date(),
      goal: request.goal,
      category: request.category,
      agents_used: result.agents_used || [],
      status: 'success',
      cost: result.total_cost,
      execution_time_ms: result.execution_time_ms,
      result_summary: generateSummary(result)
    });

    res.json({
      status: 'success',
      result: result,
      cost: result.total_cost,
      execution_time_ms: result.execution_time_ms
    });
  } catch (error: any) {
    console.error('[Catalyst] Error:', error);
    const executionTime = Date.now() - startTime;

    // Save error log to database
    saveRequestLog({
      timestamp: new Date(),
      goal: req.body?.goal || 'Unknown',
      category: req.body?.category || 'unknown',
      agents_used: [],
      status: 'error',
      cost: 0,
      execution_time_ms: executionTime,
      result_summary: 'Failed',
      error: error.message
    });

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

// Main dashboard page
app.get('/', (req, res) => {
  try {
    const htmlPath = path.join(__dirname, 'public', 'dashboard.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    res.send(html);
  } catch (error) {
    console.error('Failed to read dashboard HTML:', error);
    res.status(500).send('Dashboard not available');
  }
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
