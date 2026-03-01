#!/bin/bash
# Polymarket Agent 정지

pkill -f "polymarket.*index.ts" 2>/dev/null
echo "Polymarket Agent stopped"
