# Catalyst - Agent Orchestrator

## Overview

Catalyst is an AI agent orchestrator for Virtuals Protocol's ACP (Agent Commerce Protocol). It connects and coordinates multiple AI agents to perform complex tasks in parallel.

## Services

### 1. basic_orchestrate ($0.05)
- Orchestrates 3-4 agents in parallel
- Aggregates results into a summary
- Price: 0.05 VIRTUAL

### 2. advanced_orchestrate ($0.10)
- Orchestrates 5+ agents
- Enhanced error handling
- Price: 0.10 VIRTUAL

### 3. micro_orchestrate ($0.02)
- Orchestrates 2 agents
- Quick tasks
- Price: 0.02 VIRTUAL

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your ACP API key
nano .env
```

## Usage

### Start Orchestrator
```bash
npm start
```

### Development Mode
```bash
npm run dev
```

### Test
```bash
npm test
```

## API

### Orchestration Request

```typescript
{
  "goal": "Analyze BTC for trading position",
  "category": "crypto_analysis",
  "max_price": 0.10
}
```

### Orchestration Response

```typescript
{
  "summary": "aixbt: sentiment 78% ($0.020), WachXBT: safe ($0.015), CryptoIntel: bullish ($0.025)",
  "agents_used": ["aixbt", "WachXBT", "CryptoIntel"],
  "total_cost": 0.06,
  "results": {
    "aixbt": { "sentiment": 0.78, "confidence": 0.92 },
    "WachXBT": { "safe": true, "honeypot": false },
    "CryptoIntel": { "flow": "bullish", "net_inflow": 50000000 }
  },
  "execution_time_ms": 450
}
```

## Deployment

### Railway

1. Connect GitHub repo
2. Set environment variables
3. Deploy

### VPS (PM2)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start "npm start" --name catalyst

# Auto-start on boot
pm2 startup
pm2 save
```

## Virtuals ACP Integration

### Register Agent

```bash
# Via ACP API
POST /agents
{
  "name": "Catalyst",
  "type": "hybrid",
  "description": "Agent orchestrator - connects multiple AI agents",
  "category": "orchestration",
  "endpoint": "https://your-catalyst.com/api/acp"
}
```

### Register Service

```bash
POST /agents/{agent_id}/services
{
  "service_id": "basic_orchestrate",
  "name": "Basic Orchestrate",
  "description": "Orchestrate 3-4 agents in parallel",
  "price": 0.05,
  "currency": "VIRTUAL",
  "category": "orchestration"
}
```

## Architecture

```
┌─────────────────────────────────────┐
│        Catalyst Orchestrator        │
│                                 │
│  ┌──────────────────────────────┐  │
│  │ Agent Discovery & Selection │  │
│  └──────────┬───────────────────┘  │
│             │                      │
│  ┌──────────▼───────────────────┐  │
│  │ Parallel Executor            │  │
│  │ (Promise.all)              │  │
│  └──────────┬───────────────────┘  │
│             │                      │
│  ┌──────────▼───────────────────┐  │
│  │ Result Aggregator           │  │
│  └──────────────────────────────┘  │
└─────────────┬───────────────────────┘
              │
     ┌────────┼────────┐
     │        │        │
┌────▼────┐ ┌─▼───┐ ┌─▼────┐
│ aixbt  │ │WachXBT│ │Crypto │
│        │ │       │ │Intel │
└────────┘ └──────┘ └───────┘
```

## License

MIT

---

_For questions, join the Catalyst community on Discord_
