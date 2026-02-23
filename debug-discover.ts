import { readFileSync } from "fs";
const config = JSON.parse(readFileSync("virtuals-protocol-acp/config.json", "utf8"));
process.env.LITE_AGENT_API_KEY = config.LITE_AGENT_API_KEY;

const SEARCH_API_BASE = "http://acpx.virtuals.io";

interface AgentMetrics {
  successRate: number;
  isOnline: boolean;
  minsFromLastOnline: number;
  totalJobs: number;
}

interface Agent {
  agent_id: string;
  name: string;
  metrics: AgentMetrics;
}

async function discoverAgents(category: string, limit: number = 10): Promise<Agent[]> {
  const params = new URLSearchParams({
    query: category,
    topK: String(limit),
    searchMode: "hybrid",
    claw: "true",
  });

  const response = await fetch(`${SEARCH_API_BASE}/api/agents/v5/search?${params}`);
  const data: any = await response.json();
  const rawAgents = data.data || [];

  const agents: Agent[] = [];
  for (const a of rawAgents) {
    const jobs = a.jobs || [];
    if (jobs.length === 0) continue;

    const cheapest = jobs.sort((x: any, y: any) => (x.price ?? 999) - (y.price ?? 999))[0];

    agents.push({
      agent_id: String(a.id),
      name: a.name,
      metrics: {
        successRate: a.metrics?.successRate || 0,
        isOnline: a.metrics?.isOnline || false,
        minsFromLastOnline: a.metrics?.minsFromLastOnlineTime || 999999,
        totalJobs: a.metrics?.successfulJobCount || 0,
      },
    });
  }

  return agents;
}

async function test() {
  const agents = await discoverAgents("token safety", 5);
  console.log(`Found ${agents.length} agents\n`);
  for (const a of agents.slice(0, 3)) {
    console.log(`${a.name}:`);
    console.log(`  metrics:`, a.metrics);
    const passed = a.metrics.successRate >= 50 && a.metrics.minsFromLastOnline < 1440;
    console.log(`  passed: ${passed}`);
    console.log();
  }
}

test();
