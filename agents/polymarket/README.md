# Polymarket Agent

베팅 시뮬레이션 및 분석 에이전트

## 기능

- **Betting Simulator** (port 3001)
  - 가상 자금으로 베팅 테스트
  - 승률, 수익률 추적

- **BTC Predictor** (port 3002)
  - 5분/1시간/1일 방향 예측
  - 정확도 추적

## 실행

```bash
cd agents/polymarket
npm install
npm start
```

## 포트

- 3001: Betting Simulator
- 3002: BTC Predictor

## TODO

- [ ] 실제 Polymarket API 연동
- [ ] Catalyst와 연동하여 분석 기반 베팅
- [ ] 자동 베팅 전략
