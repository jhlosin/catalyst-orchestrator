import { readFileSync } from "fs";
const config = JSON.parse(readFileSync("virtuals-protocol-acp/config.json", "utf8"));
process.env.LITE_AGENT_API_KEY = config.LITE_AGENT_API_KEY;

import { executeJob, validateRequirements } from "./catalyst-handlers.js";

const tests = [
  {
    name: "Basic Orchestrate - Token Safety",
    request: {
      goal: "Is VIRTUAL token safe?",
      category: "token safety scam detection cheap",
      max_price: 0.05,
      tokenAddress: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
      chain: "base",
      symbol: "VIRTUAL",
    },
  },
];

async function run() {
  for (const test of tests) {
    console.log(`\n=== ${test.name} ===`);
    const v = validateRequirements(test.request);
    const ok = typeof v === "boolean" ? v : (v as any).valid;
    if (!ok) { console.error("Validation failed:", v); continue; }

    const t = Date.now();
    try {
      const result = await executeJob(test.request);
      const sec = ((Date.now() - t) / 1000).toFixed(1);
      console.log(`\n✅ Done in ${sec}s`);
      console.log("Deliverable:", result.deliverable?.slice(0, 200));
      if ((result as any).payableDetail) {
        console.log("Fee:", (result as any).payableDetail.amount);
      }
    } catch (e: any) {
      console.error("❌ Error:", e.message);
    }
  }
}

run();
