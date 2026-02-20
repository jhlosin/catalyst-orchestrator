/**
 * basic_orchestrate.ts
 * Basic orchestration service for Catalyst
 * Orchestrates 3-4 agents in parallel with result aggregation
 */

interface Agent {
  agent_id: string;
  name: string;
  services: Service[];
  metrics: {
    success_rate: number;
    avg_response_time_ms: number;
    total_jobs: number;
  };
}

interface Service {
  service_id: string;
  name: string;
  price: number;
}

interface OrchestrationRequest {
  goal: string;
  category: string;
  max_price?: number;
}

interface OrchestrationResponse {
  summary: string;
  agents_used: string[];
  total_cost: number;
  results: Record<string, any>;
  execution_time_ms: number;
}

interface AgentCallResult {
  agent_id: string;
  service_id: string;
  result?: any;
  cost: number;
  execution_time_ms: number;
  error?: string;
}

// ACP API Configuration
const ACP_API_BASE = 'https://api.virtuals.io/acp';
const ACP_API_KEY = process.env.ACP_API_KEY || '';

/**
 * Discover agents for a given category
 */
async function discoverAgents(category: string, limit: number = 10): Promise<Agent[]> {
  const response = await fetch(
    `${ACP_API_BASE}/agents?category=${category}&sort=price_asc&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${ACP_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to discover agents: ${response.statusText}`);
  }

  const data = await response.json();
  return data.agents || [];
}

/**
 * Select best agents based on price and performance
 */
function selectAgents(
  agents: Agent[],
  goal: string,
  maxPrice: number = 0.10
): Agent[] {
  // Filter agents by category and price
  const eligible = agents.filter(agent =>
    agent.services.some(s => s.price <= maxPrice / 3) // Allow 3-4 agents
  );

  // Sort by combined score (price + performance)
  const scored = eligible.map(agent => {
    const avgPrice = agent.services.reduce((sum, s) => sum + s.price, 0) / agent.services.length;
    const score = (agent.metrics.success_rate * 0.6) +
                 ((1 - agent.metrics.avg_response_time_ms / 1000) * 0.4);

    return { agent, score, avgPrice };
  });

  // Return top 3-4 agents
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(s => s.agent);
}

/**
 * Call an agent's service
 */
async function callAgent(
  agent: Agent,
  serviceId: string,
  params: any,
  timeout: number = 5000
): Promise<AgentCallResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(
      `${ACP_API_BASE}/agents/${agent.agent_id}/services/${serviceId}/invoke`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACP_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          buyer_agent_id: 'catalyst',
          params
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Agent call failed: ${response.statusText}`);
    }

    const data = await response.json();
    const executionTime = Date.now() - startTime;

    return {
      agent_id: agent.agent_id,
      service_id: serviceId,
      result: data.result,
      cost: data.cost,
      execution_time_ms: executionTime
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    return {
      agent_id: agent.agent_id,
      service_id: serviceId,
      result: null,
      cost: 0,
      execution_time_ms: executionTime,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Aggregate results from multiple agents
 */
function aggregateResults(results: AgentCallResult[]): OrchestrationResponse {
  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);

  // Build summary from successful results
  const summaryParts = successful.map(r => {
    const agentName = r.agent_id.split('_')[0]; // aixbt, WachXBT, etc.
    const costStr = `$${r.cost.toFixed(3)}`;

    if (r.result?.sentiment !== undefined) {
      return `${agentName}: sentiment ${(r.result.sentiment * 100).toFixed(0)}% (${costStr})`;
    } else if (r.result?.safe !== undefined) {
      return `${agentName}: ${r.result.safe ? 'safe' : 'risky'} (${costStr})`;
    } else if (r.result?.flow !== undefined) {
      return `${agentName}: ${r.result.flow} (${costStr})`;
    } else {
      return `${agentName}: completed (${costStr})`;
    }
  });

  // Build results object
  const resultsObj: Record<string, any> = {};
  successful.forEach(r => {
    resultsObj[r.agent_id] = r.result;
  });

  // Total cost
  const totalCost = successful.reduce((sum, r) => sum + r.cost, 0);

  // Execution time
  const maxExecutionTime = Math.max(...results.map(r => r.execution_time_ms));

  // Summary
  const summary = failed.length > 0
    ? `${summaryParts.join(', ')} | Errors: ${failed.length}`
    : summaryParts.join(', ');

  return {
    summary,
    agents_used: successful.map(r => r.agent_id),
    total_cost: totalCost,
    results: resultsObj,
    execution_time_ms: maxExecutionTime
  };
}

/**
 * Main orchestration function
 */
export async function basicOrchestrate(request: OrchestrationRequest): Promise<OrchestrationResponse> {
  const startTime = Date.now();

  try {
    // 1. Discover agents
    console.log(`[Catalyst] Discovering agents for category: ${request.category}`);
    const agents = await discoverAgents(request.category);

    if (agents.length === 0) {
      throw new Error(`No agents found for category: ${request.category}`);
    }

    console.log(`[Catalyst] Found ${agents.length} agents`);

    // 2. Select best agents
    const maxPrice = request.max_price || 0.10;
    const selectedAgents = selectAgents(agents, request.goal, maxPrice);

    console.log(`[Catalyst] Selected ${selectedAgents.length} agents:`,
      selectedAgents.map(a => a.name));

    // 3. Prepare agent calls
    const agentCalls = selectedAgents.map(agent => {
      // Pick first relevant service
      const service = agent.services[0];
      if (!service) {
        throw new Error(`No services available for agent: ${agent.name}`);
      }

      return callAgent(
        agent,
        service.service_id,
        { goal: request.goal },
        5000 // 5s timeout
      );
    });

    // 4. Execute in parallel
    console.log(`[Catalyst] Executing ${agentCalls.length} agent calls in parallel`);
    const results = await Promise.all(agentCalls);

    // 5. Aggregate results
    console.log(`[Catalyst] Aggregating results`);
    const response = aggregateResults(results);

    console.log(`[Catalyst] Orchestration complete. Total: ${response.total_cost} VIRTUAL, Time: ${response.execution_time_ms}ms`);

    return response;

  } catch (error: any) {
    console.error(`[Catalyst] Orchestration failed:`, error);
    throw error;
  }
}

/**
 * ACP WebSocket handler
 */
export function handleAcpWebSocket(ws: any) {
  ws.on('message', async (data: string) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'service_request') {
        console.log(`[Catalyst] Received service request:`, message.job_id);

        const request: OrchestrationRequest = message.params;

        // Process job
        const result = await basicOrchestrate(request);

        // Send response
        const response = {
          type: 'service_response',
          job_id: message.job_id,
          status: 'completed',
          result: result,
          cost: result.total_cost,
          completed_at: new Date().toISOString()
        };

        ws.send(JSON.stringify(response));
      }
    } catch (error: any) {
      console.error(`[Catalyst] WebSocket error:`, error);

      const errorResponse = {
        type: 'service_response',
        job_id: message.job_id,
        status: 'failed',
        error: error.message
      };

      ws.send(JSON.stringify(errorResponse));
    }
  });
}
