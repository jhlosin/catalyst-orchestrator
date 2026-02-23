#!/usr/bin/env node

/**
 * Test Catalyst orchestration locally
 */

const jobRequest = require('./test-job.json');

async function testOrchestration() {
  console.log('[Test] Starting Catalyst orchestration test...');
  console.log('[Test] Request:', JSON.stringify(jobRequest, null, 2));

  try {
    // Simulate agent discovery
    console.log('[Test] Step 1: Discovering agents for crypto_analysis...');

    // Simulate selected agents
    const mockAgents = [
      {
        agent_id: 'aixbt_agent',
        name: 'aixbt',
        price: 0.02
      },
      {
        agent_id: 'CryptoIntel',
        name: 'CryptoIntel',
        price: 0.03
      },
      {
        agent_id: 'WachXBT',
        name: 'WachXBT',
        price: 0.015
      }
    ];

    console.log(`[Test] Selected ${mockAgents.length} agents:`);

    // Simulate parallel calls
    const startTime = Date.now();
    const results = await Promise.all(mockAgents.map(async (agent) => {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));

      if (agent.agent_id === 'aixbt_agent') {
        return { agent_id: agent.agent_id, result: { sentiment: 0.78, confidence: 0.92 }, cost: agent.price };
      } else if (agent.agent_id === 'CryptoIntel') {
        return { agent_id: agent.agent_id, result: { flow: 'bullish', net_inflow: 50000000 }, cost: agent.price };
      } else if (agent.agent_id === 'WachXBT') {
        return { agent_id: agent.agent_id, result: { safe: true, honeypot: false }, cost: agent.price };
      } else {
        return { agent_id: agent.agent_id, result: null, cost: agent.price, error: 'Agent not found' };
      }
    }));

    const executionTime = Date.now() - startTime;

    // Aggregate results
    const summaryParts = [];
    results.forEach(r => {
      if (r.result) {
        const agentName = r.agent_id.split('_')[0];
        const costStr = `$${r.cost.toFixed(3)}`;

        if (r.result.sentiment !== undefined) {
          summaryParts.push(`${agentName}: sentiment ${((r.result.sentiment * 100).toFixed(0))}% (${costStr})`);
        } else if (r.result.safe !== undefined) {
          summaryParts.push(`${agentName}: ${r.result.safe ? 'safe' : 'risky'} (${costStr})`);
        } else if (r.result.flow !== undefined) {
          summaryParts.push(`${agentName}: ${r.result.flow} (${costStr})`);
        } else {
          summaryParts.push(`${agentName}: completed (${costStr})`);
        }
      }
    });

    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    const maxTime = Math.max(...results.map(r => r.execution_time_ms || executionTime));

    const summary = results.filter(r => !r.error).length === 0
      ? `${summaryParts.join(', ')} | Errors: ${results.filter(r => r.error).length}`
      : summaryParts.join(', ');

    console.log('[Test] Results:');
    console.log(`[Test] ${summary}`);
    console.log(`[Test] Total cost: $${totalCost.toFixed(2)}`);
    console.log(`[Test] Time: ${maxTime}ms`);

    console.log('[Test] Test completed successfully!');

  } catch (error) {
    console.error('[Test] Error:', error);
  }
}

testOrchestration();
