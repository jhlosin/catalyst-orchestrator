# Polymarket Agent

OpenClaw 환경 내 독립 실행형 암호화폐 예측 에이전트

## 개요

이 에이전트는 대표님의 감독 하에 자동으로 실행됩니다.

## 기능

- **실시간 가격 추적**: BTC/ETH 가격 30초마다 업데이트
- **예측 시장**: Polymarket 스타일 베팅 시뮬레이션
- **자동 예측 생성**: 1분마다 새 예측 생성

## 명령어

| 명령 | 동작 |
|------|------|
| `./start.sh` | 에이전트 시작 |
| `./status.sh` | 상태 확인 |
| `./stop.sh` | 에이전트 정지 |

## 포트

- **3001**: 대시보드 (http://localhost:3001)

## 파일 구조

```
agents/polymarket/
├── src/
│   └── index.ts      # 메인 에이전트 코드
├── start.sh          # 시작 스크립트
├── status.sh         # 상태 확인
├── stop.sh           # 정지 스크립트
├── package.json
└── README.md
```

## 상태 확인 예시

```
=== Polymarket Agent ===
BTC: $67,426
ETH: $2,013
Balance: $1,000
Bets: 5 (Active: 2, Won: 2, Lost: 1)
Win Rate: 67%
Net P/L: $15.50
```

## 감독자 (대표님) 역할

- "상태 확인해" → `./status.sh` 실행
- "시작해" → `./start.sh` 실행
- "정지해" → `./stop.sh` 실행
- "베팅 결과 알려줘" → 대시보드 확인

에이전트는 알아서 돌아갑니다.
