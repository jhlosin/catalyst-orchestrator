#!/bin/bash
# Polymarket Agent 상태

echo "=== Polymarket Agent ==="
curl -s http://localhost:3001/api/status 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(f\"BTC: \${d['prices']['btc']:,}\")
    print(f\"ETH: \${d['prices']['eth']:,}\")
    print(f\"Balance: \${d['virtualBalance']}\")
    print(f\"Bets: {d['totalBets']} (Active: {d['activeBets']}, Won: {d['wonBets']}, Lost: {d['lostBets']})\")
    print(f\"Win Rate: {d['winRate']}%\")
    print(f\"Net P/L: \${d['netProfit']}\")
    print(f\"Last Update: {d['lastUpdate']}\")
except:
    print('Agent not running')
" || echo "Agent not running"
