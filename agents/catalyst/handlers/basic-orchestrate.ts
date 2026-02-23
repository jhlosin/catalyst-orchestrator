/**
 * basic_orchestrate.ts — Bridge to the real ACP handlers
 * Re-exports orchestration via the actual handlers in virtuals-protocol-acp/
 */

import { readFileSync } from 'fs';
import path from 'path';
import { cacheAgentDetails } from './agents';

// Ensure API key is loaded from virtuals-protocol-acp config
try {
  const configPath = path.join(__dirname, 'virtuals-protocol-acp', 'config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (config.LITE_AGENT_API_KEY) {
    process.env.LITE_AGENT_API_KEY = config.LITE_AGENT_API_KEY;
  }
} catch (e) {
  console.warn('[Bridge] Could not load virtuals-protocol-acp/config.json:', (e as Error).message);
}

import { executeJob as acpExecuteJob, validateRequirements } from './catalyst-handlers';

export interface OrchestrationRequest {
  goal: string;
  category: string;
  max_price?: number;
  tokenAddress?: string;
  chain?: string;
  symbol?: string;
  [key: string]: any;
}

export interface OrchestrationResponse {
  summary: string;
  agents_used: string[];
  total_cost: number;
  results: Record<string, any>;
  execution_time_ms: number;
}

/**
 * Main orchestration — delegates to the real ACP handlers
 */
export async function basicOrchestrate(request: OrchestrationRequest): Promise<OrchestrationResponse> {
  const startTime = Date.now();

  // Validate
  const validation = validateRequirements(request);
  const isValid = typeof validation === 'boolean' ? validation : (validation as any).valid;
  if (!isValid) {
    const reason = typeof validation === 'object' ? (validation as any).reason : 'Invalid request';
    throw new Error(`Validation failed: ${reason}`);
  }

  // Execute via real ACP handlers
  const result = await acpExecuteJob(request);
  const executionTime = Date.now() - startTime;

  // Parse deliverable to extract agent info
  const deliverable = typeof result.deliverable === 'string' ? result.deliverable : JSON.stringify(result.deliverable);

  // Extract agent IDs from deliverable summary
  // Only capture successful agents (before "| Total:"), exclude "failed:" section
  const agentIds: string[] = [];
  const agentPattern = /(\d{4,}):/g;
  let match;

  // Split at "| Total:" to exclude failed agents
  const beforeTotal = deliverable.split('| Total:')[0];
  while ((match = agentPattern.exec(beforeTotal)) !== null) {
    agentIds.push(match[1]);
  }

  // Estimate cost from deliverable (look for "Total: $X.XXX")
  let totalCost = 0;
  const costMatch = deliverable.match(/Total: \$(\d+\.\d+)/);
  if (costMatch) {
    totalCost = parseFloat(costMatch[1]);
  }

  return {
    summary: deliverable,
    agents_used: agentIds,
    total_cost: totalCost,
    results: { raw: result.deliverable },
    execution_time_ms: (result as any).execution_time_ms || executionTime,
  };
}

/**
 * ACP WebSocket handler (kept for compatibility)
 */
export function handleAcpWebSocket(ws: any) {
  ws.on('message', async (data: string) => {
    let message: any;
    try {
      message = JSON.parse(data);
      if (message.type === 'service_request') {
        const result = await basicOrchestrate(message.params);
        ws.send(JSON.stringify({
          type: 'service_response',
          job_id: message.job_id,
          status: 'completed',
          result,
          cost: result.total_cost,
          completed_at: new Date().toISOString()
        }));
      }
    } catch (error: any) {
      ws.send(JSON.stringify({
        type: 'service_response',
        job_id: message?.job_id || 'unknown',
        status: 'failed',
        error: error.message
      }));
    }
  });
}
