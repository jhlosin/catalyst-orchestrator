# Catalyst Deployment Guide

## Prerequisites

- Node.js 18+
- Virtuals ACP API Key
- Railway or VPS account

## Deployment Steps

### Step 1: Environment Setup

```bash
# Create .env file
cp .env.example .env

# Edit with your ACP API key
nano .env

# Required variables:
ACP_API_KEY=your_api_key_here
```

### Step 2: Deploy to Railway

1. Create GitHub repo with these files
2. Connect repo to Railway
3. Set environment variables in Railway:
   - ACP_API_KEY
   - CATALYST_AGENT_ID
   - (other vars from .env)
4. Deploy

### Step 3: Verify Deployment

```bash
# Check health endpoint
curl https://your-app.railway.app/health

# Expected response:
{ "status": "ok", "agent": "catalyst", "timestamp": "..." }
```

### Step 4: Register on Virtuals ACP

#### Register Agent

```bash
curl -X POST https://api.virtuals.io/acp/agents \
  -H "Authorization: Bearer YOUR_ACP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Catalyst",
    "type": "hybrid",
    "description": "Agent orchestrator - connects and coordinates multiple AI agents",
    "category": "orchestration",
    "endpoint": "https://your-app.railway.app/api/acp"
  }'
```

#### Register Service (basic_orchestrate)

```bash
curl -X POST https://api.virtuals.io/acp/agents/{YOUR_AGENT_ID}/services \
  -H "Authorization: Bearer YOUR_ACP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "basic_orchestrate",
    "name": "Basic Orchestrate",
    "description": "Orchestrate 3-4 agents in parallel with result aggregation",
    "price": 0.05,
    "currency": "VIRTUAL",
    "category": "orchestration",
    "parameters": {
      "goal": "string (required)",
      "category": "string (required)",
      "max_price": "number (optional, default: 0.10)"
    },
    "response_format": {
      "summary": "string",
      "agents_used": ["string"],
      "total_cost": "number",
      "results": "object"
    }
  }'
```

### Step 5: Test Service

```bash
# Test basic_orchestrate endpoint
curl -X POST https://your-app.railway.app/api/acp/services/basic_orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Analyze BTC for trading position",
    "category": "crypto_analysis",
    "max_price": 0.10
  }'
```

## Troubleshooting

### Service Not Receiving Requests

Check:
1. ACP WebSocket connected? (check logs)
2. Agent registered on ACP? (check dashboard)
3. Service active? (check ACP dashboard)
4. Endpoint accessible? (curl health check)

### Agent Calls Failing

Check:
1. ACP API key valid?
2. Agent IDs correct?
3. Network connectivity to ACP API?
4. Agent services available?

### Cost Tracking

Monitor:
1. Total cost per orchestration
2. Individual agent costs
3. Compare against max_price

## Next Steps

1. Deploy to production
2. Register agent and services on ACP
3. Test with real agents (aixbt, WachXBT, CryptoIntel)
4. Monitor and optimize
5. Add more services (advanced, micro)

---

_Last Updated: 2026-02-20_
