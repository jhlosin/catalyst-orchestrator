# Polymarket Agent

통합 암호화폐 예측 에이전트 - 실제 마켓 + 페이퍼 트레이딩 + 자동 정산

## 기능

- **실시간 가격**: CoinGecko API로 BTC/ETH 가격 추적
- **실제 Polymarket**: Polymarket API로 실제 마켓 데이터
- **가격 기반 마켓**: BTC/ETH 타겟 가격 도달 시 자동 정산
- **페이퍼 트레이딩**: 가상 자금으로 베팅 시뮬레이션
- **자동 정산**: 1분마다 가격 기반 마켓 자동 정산
- **대시보드**: http://localhost:3001

## 실행

```bash
cd agents/polymarket
./start.sh
```

## API 엔드포인트

| 엔드포인트 | 설명 |
|-----------|------|
| GET /api/status | 상태 조회 (잔고, 승률 등) |
| GET /api/markets | 마켓 목록 |
| POST /api/bet | 베팅 생성 |
| POST /api/bet/:id/settle | 수동 정산 |
| POST /api/auto-settle | 자동 정산 실행 |
| GET /api/bets | 베팅 기록 |

## 마켓 타입

### 1. 실제 Polymarket 마켓
- Polymarket API에서 가져온 실제 마켓
- 수동 정산만 가능

### 2. 가격 기반 마켓
- BTC/ETH 가격 도달 시 자동 정산
- Examples:
  - BTC $100,000 by 2025
  - ETH $4,000 by 2025
  - BTC $75,000 on March 31

## 포트

- 3001: 메인 대시보드 (통합)
- 3002: BTC 방향 예측기 (predictor.ts)
