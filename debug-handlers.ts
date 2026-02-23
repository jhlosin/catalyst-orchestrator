import { readFileSync } from "fs";
const config = JSON.parse(readFileSync("virtuals-protocol-acp/config.json", "utf8"));
process.env.LITE_AGENT_API_KEY = config.LITE_AGENT_API_KEY;

// Test selectAgents filter logic directly
const testAgents = [
  { name: "CoinChecker", metrics: { successRate: 87.1, isOnline: true, minsFromLastOnline: 0 } },
  { name: "PerpShield", metrics: { successRate: 100, isOnline: true, minsFromLastOnline: 0 } },
  { name: "BadAgent", metrics: { successRate: 30, isOnline: false, minsFromLastOnline: 2000 } },
];

console.log("Testing filter logic:");
for (const a of testAgents) {
  const { successRate, minsFromLastOnline } = a.metrics;
  const passed = successRate >= 50 && minsFromLastOnline < 1440;
  console.log(`  ${a.name}: successRate=${successRate}, mins=${minsFromLastOnline} → ${passed ? "PASS" : "FAIL"}`);
}
