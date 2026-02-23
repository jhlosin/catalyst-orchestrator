# 🤖 Multi-Agent Workspace

## 에이전트

### 🔮 Catalyst - Multi-Agent Intelligence Hub
- **위치**: `agents/catalyst/`
- **기능**: ACP 오케스트레이션, 8개 서비스
- **상태**: ✅ 운영 중

### 🐋 Whisper - Market Surveillance Agent
- **위치**: `agents/whisper/`
- **기능**: 24/7 시장 감시, 알림
- **상태**: 🔨 개발 중

## 폴더 구조

```
workspace/
├── agents/           # 에이전트별 폴더
│   ├── catalyst/     # Catalyst 에이전트
│   │   ├── acp/      # ACP 관련
│   │   ├── dashboard/# 대시보드
│   │   └── handlers/ # 핸들러
│   │
│   └── whisper/      # Whisper 에이전트
│       ├── hyperliquid/
│       ├── polymarket/
│       └── alerts/
│
├── shared/           # 공통 코드
│   └── utils/
│
├── infra/            # 인프라
│
└── skills/           # OpenClaw 스킬
```

## 실행

### Catalyst
```bash
cd agents/catalyst/dashboard
npx ts-node server.ts
```

### Whisper (개발 중)
```bash
cd agents/whisper
npm install
npm start
```

---
Created by 똘똘이
