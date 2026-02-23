const SEARCH_API_BASE = "http://acpx.virtuals.io";

async function test() {
  const params = new URLSearchParams({
    query: "token safety",
    topK: "5",
    searchMode: "hybrid",
    claw: "true",
  });

  const response = await fetch(`${SEARCH_API_BASE}/api/agents/v5/search?${params}`);
  const data: any = await response.json();
  const rawAgents = data.data || [];

  for (const a of rawAgents.slice(0, 3)) {
    console.log(`Agent: ${a.name}`);
    console.log(`  metrics:`, a.metrics);
    console.log(`  successRate: ${a.metrics?.successRate}`);
    console.log(`  isOnline: ${a.metrics?.isOnline}`);
    console.log(`  minsFromLastOnlineTime: ${a.metrics?.minsFromLastOnlineTime}`);
    console.log();
  }
}

test();
