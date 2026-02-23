/**
 * agents.ts
 * Agent information cache and management
 */

export interface AgentDetails {
  id: string;
  name: string;
  wallet_address: string;
  description: string;
  job_offerings: Array<{
    name: string;
    price: number;
    price_type: string;
  }>;
  metrics: {
    successful_job_count: number;
    success_rate: number;
    unique_buyer_count: number;
    is_online: boolean;
    mins_from_last_online: number;
    last_active_at: string;
    twitter_handle?: string;
  };
}

// Agent cache (in-memory for now, could be moved to DB)
const agentCache = new Map<string, AgentDetails>();

/**
 * Cache agent details from ACP browse results
 */
export function cacheAgentDetails(agent: any): void {
  const details: AgentDetails = {
    id: agent.id,
    name: agent.name,
    wallet_address: agent.walletAddress,
    description: agent.description || 'No description available',
    job_offerings: (agent.jobOfferings || []).map((job: any) => ({
      name: job.name,
      price: job.price,
      price_type: job.priceType || 'fixed'
    })),
    metrics: {
      successful_job_count: agent.metrics?.successfulJobCount || 0,
      success_rate: agent.metrics?.successRate || 0,
      unique_buyer_count: agent.metrics?.uniqueBuyerCount || 0,
      is_online: agent.metrics?.isOnline || false,
      mins_from_last_online: agent.metrics?.minsFromLastOnlineTime || 999999,
      last_active_at: agent.metrics?.lastActiveAt || '',
      twitter_handle: agent.twitterHandle
    }
  };

  agentCache.set(agent.id, details);
}

/**
 * Get agent details by ID
 */
export function getAgentDetails(agentId: string): AgentDetails | null {
  return agentCache.get(agentId) || null;
}

/**
 * Get all cached agents
 */
export function getAllAgents(): Map<string, AgentDetails> {
  return agentCache;
}

/**
 * Clear agent cache
 */
export function clearAgentCache(): void {
  agentCache.clear();
}
