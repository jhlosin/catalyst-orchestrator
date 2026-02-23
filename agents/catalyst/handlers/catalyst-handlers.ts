// Inlined types (from offeringTypes.ts)
export interface ExecuteJobResult {
  deliverable: string | { type: string; value: unknown };
  payableDetail?: { amount: number; tokenAddress: string };
  execution_time_ms?: number;
  error?: string;
}
export type ValidationResult = boolean | { valid: boolean; reason?: string };



/**
 * Basic Orchestrate Service Handler
 * Orchestrates 3-4 agents in parallel with result aggregation
 */

// ACP API Configuration — must match the real ACP endpoints
const ACP_API_BASE = process.env.ACP_API_URL || "https://claw-api.virtuals.io";
const SEARCH_API_BASE = process.env.SEARCH_URL || "http://acpx.virtuals.io";

/** Read API key lazily so env can be set after module load */
function getApiKey(): string {
  return process.env.LITE_AGENT_API_KEY || "";
}

interface AgentOffering {
  id: number;
  name: string;
  description: string;
  price: number;
  priceType: string;
  requirement: Record<string, any>;
}

interface AgentMetrics {
  successRate: number;
  isOnline: boolean;
  minsFromLastOnline: number;
  totalJobs: number;
}

interface Agent {
  agent_id: string;
  name: string;
  walletAddress: string;
  price: number;
  offering: AgentOffering;
  metrics: AgentMetrics;
}

interface AgentCallResult {
  agent_id: string;
  result?: any;
  cost: number;
  execution_time_ms?: number;
  error?: string;
}

// Simple in-memory cache for agent discovery
interface CacheEntry<T> {
  data: T;
  expiry: number;
}
const agentCache = new Map<string, CacheEntry<Agent[]>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Discover agents via the real ACP search API (acpx.virtuals.io)
 */
async function discoverAgents(category: string, limit: number = 10): Promise<Agent[]> {
  const cacheKey = `${category}:${limit}`;
  const cached = agentCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    console.log(`[Catalyst] Using cached agents for "${category}"`);
    return cached.data;
  }

  const params = new URLSearchParams({
    query: category,
    topK: String(limit),
    searchMode: "hybrid",
    claw: "true",
  });

  const response = await fetch(`${SEARCH_API_BASE}/api/agents/v5/search?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to discover agents: ${response.statusText}`);
  }

  const data: any = await response.json();
  const rawAgents = data.data || [];

  // Flatten: each agent may have multiple offerings — pick cheapest per agent
  const agents: Agent[] = [];
  for (const a of rawAgents) {
    const jobs = a.jobs || [];
    if (jobs.length === 0) continue;

    // Sort by price ascending, pick cheapest
    const cheapest = jobs.sort((x: any, y: any) => (x.price ?? 999) - (y.price ?? 999))[0];

    agents.push({
      agent_id: String(a.id),
      name: a.name,
      walletAddress: a.walletAddress,
      price: cheapest.price ?? 0,
      offering: {
        id: cheapest.id,
        name: cheapest.name,
        description: cheapest.description || "",
        price: cheapest.price ?? 0,
        priceType: cheapest.priceV2?.type || "fixed",
        requirement: cheapest.requirement || {},
      },
      metrics: {
        successRate: a.metrics?.successRate ?? 0,
        isOnline: a.metrics?.isOnline ?? false,
        minsFromLastOnline: a.metrics?.minsFromLastOnlineTime ?? 999999,
        totalJobs: a.metrics?.successfulJobCount ?? 0,
      },
    });
  }

  agentCache.set(cacheKey, { data: agents, expiry: Date.now() + CACHE_TTL_MS });
  return agents;
}

/**
 * Select best agents based on reliability and price
 * Filters: successRate >= 50%, active within 24 hours (1440 mins)
 * Sorts by: successRate DESC, then price ASC
 */
function selectAgents(agents: Agent[], maxPrice: number = 0.1): Agent[] {
  // Filter: only verified agents
  // Note: successRate from API is percentage (0-100), not ratio (0-1)
  const verified = agents.filter(a => {
    const { successRate, minsFromLastOnline } = a.metrics;
    // At least 50% success rate and active within 24 hours
    return successRate >= 50 && minsFromLastOnline < 1440;
  });

  console.log(`[Catalyst] ${verified.length}/${agents.length} agents passed verification`);

  // Sort by success rate DESC, then price ASC
  const sorted = verified.sort((a, b) => {
    if (b.metrics.successRate !== a.metrics.successRate) {
      return b.metrics.successRate - a.metrics.successRate;
    }
    return a.price - b.price;
  });

  const selected: Agent[] = [];
  let totalCost = 0;

  for (const agent of sorted) {
    if (totalCost + agent.price > maxPrice) break;
    if (selected.length >= 4) break;
    selected.push(agent);
    totalCost += agent.price;
  }

  return selected;
}

/**
 * Build serviceRequirements that match the agent's requirement schema.
 * Merges the original buyer params with goal text as fallback.
 */
function buildRequirements(
  agent: Agent,
  goal: string,
  buyerParams: Record<string, any>
): Record<string, any> {
  const schema = agent.offering.requirement || {};
  const props = schema.properties || {};
  const reqs: Record<string, any> = {};

  // Map known fields from buyerParams
  for (const key of Object.keys(props)) {
    if (buyerParams[key] !== undefined) {
      reqs[key] = buyerParams[key];
    }
  }

  // Normalize token address variants (tokenAddress ↔ token_address)
  const addr = buyerParams.tokenAddress || buyerParams.token_address;
  if (props.tokenAddress && !reqs.tokenAddress && addr) reqs.tokenAddress = addr;
  if (props.token_address && !reqs.token_address && addr) reqs.token_address = addr;

  // token / symbol cross-mapping
  const sym = buyerParams.symbol || buyerParams.token;
  if (props.token && !reqs.token && sym) reqs.token = sym;
  if (props.symbol && !reqs.symbol && sym) reqs.symbol = sym;

  // chain with default
  if (props.chain && !reqs.chain) reqs.chain = buyerParams.chain || "base";

  // query / goal fallback
  if (props.query && !reqs.query) reqs.query = goal;

  // If schema has a "goal" field, pass it
  if (props.goal) {
    reqs.goal = goal;
  }

  // If nothing was mapped, just send goal
  if (Object.keys(reqs).length === 0) {
    reqs.goal = goal;
  }

  return reqs;
}

/**
 * Create an ACP job for an agent and poll until completed or timeout.
 * This uses the real ACP job API (claw-api.virtuals.io).
 */
async function callAgent(
  agent: Agent,
  goal: string,
  timeout: number = 30000,
  retries: number = 1,
  buyerParams: Record<string, any> = {}
): Promise<AgentCallResult> {
  const startTime = Date.now();
  const headers = {
    "x-api-key": getApiKey(),
    "Content-Type": "application/json",
  };

  const serviceRequirements = addCatalystBranding(buildRequirements(agent, goal, buyerParams));
  console.log(`[Catalyst] ${agent.name} requirements:`, JSON.stringify(serviceRequirements));

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // 1. Create the job via ACP API
      const createRes = await fetch(`${ACP_API_BASE}/acp/jobs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          providerWalletAddress: agent.walletAddress,
          jobOfferingName: agent.offering.name,
          serviceRequirements,
        }),
      });

      if (!createRes.ok) {
        const errBody = await createRes.text();
        throw new Error(`Job create failed (${createRes.status}): ${errBody}`);
      }

      const createData: any = await createRes.json();
      const jobId = createData.data?.jobId ?? createData.jobId;
      if (!jobId) throw new Error("No jobId returned");

      console.log(`[Catalyst] Created job ${jobId} for ${agent.name} (${agent.offering.name})`);

      // 2. Poll for completion
      const pollInterval = 3000;
      const deadline = startTime + timeout;

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, pollInterval));

        const statusRes = await fetch(`${ACP_API_BASE}/acp/jobs/${jobId}`, { headers });
        if (!statusRes.ok) continue;

        const statusData: any = await statusRes.json();
        const job = statusData.data;
        const phase = String(job?.phase || "").toUpperCase();

        if (phase === "COMPLETED") {
          const executionTime = Date.now() - startTime;
          return {
            agent_id: agent.agent_id,
            result: job.deliverable,
            cost: agent.offering.price,
            execution_time_ms: executionTime,
          };
        }

        if (phase === "REJECTED" || phase === "EXPIRED") {
          throw new Error(`Job ${jobId} ended with phase: ${phase}`);
        }
      }

      throw new Error(`Job ${jobId} timed out after ${timeout}ms`);
    } catch (error: any) {
      if (attempt < retries) {
        console.log(`[Catalyst] Retrying ${agent.name} (attempt ${attempt + 2}): ${error.message}`);
        continue;
      }

      const executionTime = Date.now() - startTime;
      return {
        agent_id: agent.agent_id,
        result: null,
        cost: 0,
        execution_time_ms: executionTime,
        error: error.message || "Unknown error",
      };
    }
  }

  return { agent_id: agent.agent_id, cost: 0, error: "Exhausted retries" };
}

/**
 * Summarize a single agent result dynamically (no hardcoded keys)
 */
function summarizeResult(r: AgentCallResult): string {
  const agentName = r.agent_id.split("_")[0];
  const costStr = `$${r.cost.toFixed(3)}`;

  if (!r.result) return `${agentName}: completed (${costStr})`;

  if (typeof r.result === "string") {
    const truncated = r.result.length > 100 ? r.result.slice(0, 100) + "…" : r.result;
    return `${agentName}: ${truncated} (${costStr})`;
  }

  if (typeof r.result === "object") {
    // Pick up to 3 key-value pairs for a concise summary
    const entries = Object.entries(r.result).slice(0, 3);
    const parts = entries.map(([k, v]) => {
      if (typeof v === "number") return `${k}: ${v}`;
      if (typeof v === "boolean") return `${k}: ${v}`;
      if (typeof v === "string") return `${k}: ${v.length > 40 ? v.slice(0, 40) + "…" : v}`;
      return `${k}: [${typeof v}]`;
    });
    return `${agentName}: ${parts.join(", ")} (${costStr})`;
  }

  return `${agentName}: completed (${costStr})`;
}

/**
 * Aggregate results from multiple agents
 */
function aggregateResults(results: AgentCallResult[]): string {
  const successful = results.filter((r) => !r.error);
  const failed = results.filter((r) => !!r.error);

  const summaryParts = successful.map(summarizeResult);
  const totalCost = successful.reduce((sum, r) => sum + r.cost, 0);

  let summary =
    successful.length === 0
      ? "No successful agent calls"
      : `${summaryParts.join(" | ")} | Total: $${totalCost.toFixed(3)}`;

  if (failed.length > 0) {
    summary += ` | ${failed.length} failed: ${failed.map((f) => f.agent_id.split("_")[0]).join(", ")}`;
  }

  return summary;
}

/**
 * Execute job - Main orchestration function
 */
export async function executeJob(request: any): Promise<ExecuteJobResult> {
  const startTime = Date.now();

  try {
    const { goal, category, max_price = 0.1 } = request;

    console.log(`[Catalyst] Orchestrating: ${goal}`);

    // 1. Discover agents
    const agents = await discoverAgents(category);

    if (agents.length === 0) {
      return {
        deliverable: `No agents found for category: ${category}`,
        error: "No agents available",
      };
    }

    console.log(`[Catalyst] Found ${agents.length} agents`);

    // 2. Select best agents
    const selectedAgents = selectAgents(agents, max_price);

    console.log(`[Catalyst] Selected ${selectedAgents.length} agents`);

    // 3. Execute in parallel with allSettled (no single failure kills the batch)
    console.log(`[Catalyst] Executing ${selectedAgents.length} agent calls in parallel`);
    const settled = await Promise.allSettled(
      selectedAgents.map((agent) => callAgent(agent, goal, 60000, 1, request))
    );

    // 4. Unwrap results
    const results: AgentCallResult[] = settled.map((s, i) =>
      s.status === "fulfilled"
        ? s.value
        : {
            agent_id: selectedAgents[i].agent_id,
            cost: 0,
            error: (s.reason as Error)?.message || "Unknown",
          }
    );

    // 5. Aggregate results
    const summary = aggregateResults(results);
    const executionTime = Date.now() - startTime;
    const totalSpent = results.reduce((s, r) => s + r.cost, 0);

    // Dynamic pricing: fee = max(sub-agent costs * 1.5, $0.03) for 50% markup
    // Ensures Catalyst always makes profit
    const jobFee = Math.max(0.03, totalSpent * 1.5);

    console.log(`[Catalyst] Complete. Time: ${executionTime}ms`);
    console.log(`[Catalyst] Summary: ${summary}`);
    console.log(
      `[Catalyst] Margin: fee=$${jobFee.toFixed(3)} - spent=$${totalSpent.toFixed(4)} = $${(jobFee - totalSpent).toFixed(4)}`
    );

    return {
      deliverable: summary,
      execution_time_ms: executionTime,
      payableDetail: {
        amount: jobFee,
        tokenAddress: "USDC",
      },
    };
  } catch (error: any) {
    console.error(`[Catalyst] Error:`, error);

    return {
      deliverable: `Orchestration failed: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Validate incoming job requests
 */
export function validateRequirements(request: any): ValidationResult {
  const { goal, category, max_price } = request;

  if (!goal || typeof goal !== "string") {
    return {
      valid: false,
      reason: '"goal" is required and must be a string',
    };
  }

  if (!category || typeof category !== "string") {
    return {
      valid: false,
      reason: '"category" is required and must be a string',
    };
  }

  if (max_price !== undefined && typeof max_price !== "number") {
    return {
      valid: false,
      reason: '"max_price" must be a number if provided',
    };
  }

  return {
    valid: true,
  };
}

/**
 * Add Catalyst branding to service requirements
 */
function addCatalystBranding(requirements: Record<string, any>): Record<string, any> {
  return {
    ...requirements,
    _source: "Catalyst - Multi-Agent Intelligence Hub",
    _referral: "https://app.virtuals.io/agents/5776",
    _referral_agent: "Catalyst",
  };
}
