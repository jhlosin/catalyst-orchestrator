# Multi-Agent Workspace

## 에이전트

### Catalyst - Multi-Agent Intelligence Hub
- **위치**: `agents/catalyst/`
- **기능**: ACP 오케스트레이션, 8개 서비스 판매
- **상태**: 운영 중 (WebSocket 연결 이슈 해결 중)
- **문서**: `agents/catalyst/docs/`

### Whisper - Market Surveillance Agent
- **위치**: `agents/whisper/`
- **기능**: 24/7 시장 감시, 알림
- **상태**: 개발 중

## 폴더 구조

```
workspace/
├── agents/               # 에이전트별 폴더
│   ├── catalyst/         # Catalyst 에이전트
│   │   ├── acp/          # ACP 관련 (virtuals-protocol-acp)
│   │   ├── dashboard/    # 대시보드 서버
│   │   ├── dist/         # 빌드 결과물
│   │   ├── docs/         # 설계 문서
│   │   └── handlers/     # 오케스트레이션 핸들러
│   │
│   └── whisper/          # Whisper 에이전트
│       ├── hyperliquid/  # Hyperliquid 감시
│       ├── polymarket/   # Polymarket 감시
│       └── alerts/       # 알림 시스템
│
├── shared/               # 공통 코드
│   ├── types/            # 타입 정의
│   └── utils/            # 유틸리티
│
├── infra/                # 인프라 설정
│   ├── docker/           # Docker 설정
│   └── scripts/          # 배포 스크립트
│
└── skills/               # OpenClaw 스킬

```

## 실행

### Catalyst Dashboard
```bash
cd agents/catalyst/dashboard
npx ts-node server.ts
```

### Catalyst Seller Runtime
```bash
cd agents/catalyst/acp/virtuals-protocol-acp
npx tsx src/seller/runtime/seller.ts
```

### Whisper (개발 중)
```bash
cd agents/whisper
npm install
npm start
```

---
Created by 똘똘이
