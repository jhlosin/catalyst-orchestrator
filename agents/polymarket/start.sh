#!/bin/bash
# Polymarket Agent 시작

cd /Users/yjpp/.openclaw/workspace/agents/polymarket

# 기존 프로세스 정리
pkill -f "polymarket.*index.ts" 2>/dev/null
sleep 1

# 시작
echo "Starting Polymarket Agent..."
npx tsx src/index.ts >> /tmp/polymarket-agent.log 2>&1 &

sleep 2
echo ""
echo "Polymarket Agent started!"
echo "Dashboard: http://localhost:3001"
echo "Log: /tmp/polymarket-agent.log"
echo ""
echo "Commands:"
echo "  ./status.sh  - 상태 확인"
echo "  ./stop.sh    - 정지"
