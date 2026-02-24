# Agent-to-Agent Marketplace Architecture

## 1. Overview

**Vision:** AI 에이전트들이 서로의 서비스를 사고파는 최초의 마켓플레이스

**Core Value:**
- 에이전트간 마이크로결제 지원
- 실시간 가성비 비교
- 자동화된 거래 처리
- 신뢰 시스템 (Uptime, 성공률, 응답시간)

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Marketplace Platform                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  API Gateway │  │   Registry   │  │   Billing    │          │
│  │  (Kong/Nginx)│  │   Service    │  │   Service    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐          │
│  │   Orchestrator│  │  Monitoring  │  │   Payment    │          │
│  │   Service     │  │   Service    │  │   Gateway    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Database      │  │    Cache        │  │   Message Queue │
│  (PostgreSQL)   │  │    (Redis)      │  │   (RabbitMQ)    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  External APIs    │
                    │  (Stripe, ...)   │
                    └───────────────────┘
```

---

## 3. Core Components

### 3.1 API Gateway
- **역할:** 모든 요청 라우팅, 인증, 레이트 리밋
- **기능:**
  - API Key 검증
  - Rate limiting (구매자/판매자별)
  - Load balancing
  - Logging/Monitoring

### 3.2 Registry Service
- **역할:** 에이전트 등록, 검색, 메타데이터 관리
- **기능:**
  - 에이전트 등록/업데이트
  - 카테고리/태그 관리
  - 가격 정보 추적
  - 가용성 체크 (health check)

### 3.3 Orchestrator Service
- **역할:** 에이전트간 호출 관리, 에러 핸들링
- **기능:**
  - 요청 라우팅 (최적 에이전트 선택)
  - 재시도/백오프
  - 타임아웃 관리
  - 응답 포맷 표준화

### 3.4 Billing Service
- **역할:** 마이크로결제 처리, 정산
- **기능:**
  - API call당 비용 계산
  - 잔고 관리
  - 정산 일자 기록
  - 영수증 발행

### 3.5 Payment Gateway
- **역할:** 실제 결제 처리
- **옵션:**
  - Stripe (가장 쉬움)
  - 자체 코인 시스템 (나중에)

### 3.6 Monitoring Service
- **역할:** 에이전트 성능 트래킹, 신뢰 점수 계산
- **기능:**
  - 성공률, 응답시간, uptime 기록
  - 신뢰 점수 계산
  - 알림 (Slack, 이메일)

---

## 4. Data Models

### 4.1 Agent (에이전트)
```json
{
  "id": "agent_abc123",
  "name": "Crypto News Summarizer",
  "description": "Summarizes crypto news from multiple sources",
  "owner_id": "user_xyz",
  "category": "crypto",
  "tags": ["news", "summarization"],
  "version": "1.0.0",
  "api_endpoint": "https://api.example.com/agent/abc123",
  "status": "active",
  "created_at": "2026-02-20T00:00:00Z"
}
```

### 4.2 AgentPricing (가격 정보)
```json
{
  "agent_id": "agent_abc123",
  "model": "per_call",
  "price_per_call": 0.02,
  "currency": "USD",
  "tier": "basic",
  "min_calls": 1
}
```

### 4.3 AgentMetrics (성능 지표)
```json
{
  "agent_id": "agent_abc123",
  "success_rate": 0.998,
  "avg_response_time_ms": 150,
  "uptime_24h": 0.999,
  "total_calls": 100000,
  "last_updated": "2026-02-20T20:00:00Z"
}
```

### 4.4 Transaction (거래 기록)
```json
{
  "id": "txn_xyz789",
  "buyer_id": "agent_def456",
  "seller_id": "agent_abc123",
  "amount": 0.02,
  "currency": "USD",
  "status": "completed",
  "created_at": "2026-02-20T20:00:00Z"
}
```

### 4.5 APIKey (인증)
```json
{
  "key_id": "key_ghi012",
  "agent_id": "agent_def456",
  "hashed_key": "sha256...",
  "rate_limit": 1000,
  "expires_at": null,
  "created_at": "2026-02-20T00:00:00Z"
}
```

---

## 5. API Specification (Draft)

### 5.1 Marketplace APIs

#### POST /agents/register
에이전트 등록
```json
// Request
{
  "name": "My Agent",
  "description": "...",
  "category": "crypto",
  "tags": ["news"],
  "api_endpoint": "https://...",
  "pricing": {
    "model": "per_call",
    "price_per_call": 0.02
  }
}

// Response
{
  "agent_id": "agent_abc123",
  "status": "registered"
}
```

#### GET /agents/search
에이전트 검색 (가성비 기반)
```json
// Request
GET /agents/search?category=crypto&sort=price_asc

// Response
{
  "results": [
    {
      "agent_id": "agent_abc123",
      "name": "...",
      "price_per_call": 0.02,
      "success_rate": 0.998,
      "avg_response_time_ms": 150,
      "cost_per_success": 0.02  // 자동 계산
    }
  ]
}
```

#### POST /purchase
구매자가 에이전트 서비스 구매
```json
// Request
{
  "buyer_id": "agent_def456",
  "agent_id": "agent_abc123",
  "plan": "per_call"
}

// Response
{
  "api_key": "sk_live_...",
  "endpoint": "https://api.marketplace.com/agents/agent_abc123",
  "price_per_call": 0.02
}
```

### 5.2 Proxy APIs (구매자가 호출)

#### POST /agents/{agent_id}/invoke
에이전트 호출 (마켓플레이스를 통한)
```json
// Request
{
  "input": { ... },
  "timeout_ms": 5000
}

// Response
{
  "output": { ... },
  "cost": 0.02,
  "metrics": {
    "response_time_ms": 150,
    "seller_id": "agent_abc123"
  }
}
```

---

## 6. Workflows

### 6.1 에이전트 등록
```
1. 판매자 에이전트 → POST /agents/register
2. Registry Service → 등록 + 메타데이터 저장
3. Monitoring Service → health check 시작
4. 성공 → 등록 완료
```

### 6.2 에이전트 검색 및 구매
```
1. 구매자 에이전트 → GET /agents/search?category=crypto
2. Registry Service → 가격/성능 기반 정렬
3. 구매자 에이전트 → POST /purchase (가장 싼 것 선택)
4. Billing Service → API Key 발급
5. 성공 → API Key 반환
```

### 6.3 에이전트 호출
```
1. 구매자 에이전트 → POST /agents/{agent_id}/invoke
2. API Gateway → 인증 + 레이트 리밋 체크
3. Orchestrator → 판매자 에이전트로 요청 전달
4. 판매자 에이전트 → 응답
5. Orchestrator → 성공 시 응답, 실패 시 에러
6. Billing Service → 비용 청구
7. Monitoring Service → 지표 업데이트
```

---

## 7. Security & Auth

### 7.1 API Key Authentication
- 각 에이전트는 API Key 발급
- Hashed된 키 저장 (SHA-256)
- Rate limiting per key

### 7.2 Authorization
- 구매자: 구매한 에이전트만 호출 가능
- 판매자: 본인 에이전트만 업데이트 가능

### 7.3 Data Privacy
- 입력/출력 데이터 로그 저장 제한 (개인정보 보호)
- 선택적 암호화

### 7.4 Fraud Prevention
- 급격한 사용량 증가 감지
- 의심스러운 패턴 차단

---

## 8. Trust & Reputation System

### 8.1 Metrics
- **Success Rate:** 성공 / 총 요청
- **Avg Response Time:** 평균 응답시간
- **Uptime:** 가용성 (24h, 7d, 30d)
- **Total Calls:** 누적 호출 수

### 8.2 Trust Score
```python
trust_score = (
  success_rate * 0.5 +
  (1 - avg_response_time / 1000) * 0.2 +
  uptime_24h * 0.3
)
```

### 8.3 Rankings
- 기본 정렬: `cost_per_success` (가성비)
- 옵션: `trust_score_desc`, `price_asc`, `response_time_asc`

---

## 9. Pricing Model

### 9.1 Marketplace Revenue
- **Transaction Fee:** 각 거래의 10%
- **Premium Exposure:** 상위 노출 $X/월
- **Data Access:** 트렌드 데이터 판매

### 9.2 Seller Revenue
- API call당 수익 (price_per_call)
- 마켓플레이스 수수료 10% 차감 후 지급

### 9.3 Buyer Cost
- API call당 비용
- 최소 충전금: $10
- 월 한도: 사용자 설정

---

## 10. Technology Stack (Recommendation)

### Backend
- **Language:** TypeScript/Node.js
- **Framework:** Express.js / Fastify
- **API Gateway:** Kong / nginx

### Database
- **Primary:** PostgreSQL (구조화된 데이터)
- **Cache:** Redis (가격, 메타데이터 캐싱)
- **Time-Series:** TimescaleDB (메트릭) - 선택

### Message Queue
- **RabbitMQ** / **Kafka** (비동기 작업)

### Monitoring
- **Prometheus** + **Grafana**
- **Sentry** (에러 트래킹)

### Payment
- **Stripe** (마이크로결제)

### Hosting
- **Vercel** / **AWS** / **Railway**

---

## 11. Scaling Strategy

### Phase 1: MVP (1-3 months)
- 1-2 개의 서비스 (Registry, Orchestrator)
- PostgreSQL + Redis
- 수천 call/일

### Phase 2: Growth (3-6 months)
- 마이크로서비스 분리
- RabbitMQ 추가
- 수만 call/일

### Phase 3: Scale (6-12 months)
- 쿠버네티스로 확장
- TimescaleDB로 메트릭 최적화
- 수백만 call/일

---

## 12. MVP Scope

### 첫 번째 버전에 포함:
- ✅ 에이전트 등록/검색
- ✅ 가성비 기반 정렬
- ✅ API 호출 및 결제
- ✅ 기본 모니터링

### 첫 번째 버전에서 제외:
- ❌ 프리미엄 노출
- ❌ 복잡한 에러 핸들링
- ❌ 데이터 판매

---

## 13. Next Steps

1. **API 스펙 상세화** - OpenAPI/Swagger 작성
2. **데이터베이스 스키마 디자인** - PostgreSQL migration
3. **Prototype 개발** - Registry + Billing service
4. **테스트 에이전트 5개 모으기** - 크립토 카테고리
5. **베타 런칭** - 소규모 사용자

---

## 14. Roadmap

### Month 1: Foundation
- API 스펙 완성
- 데이터베이스 구축
- Registry service 개발

### Month 2: Core Features
- Orchestrator service
- Billing service
- 기본 모니터링

### Month 3: Beta
- 테스트 에이전트 10개
- 20-30 테스트 사용자
- 버그 수정

### Month 4: Public Launch
- Product Hunt 런칭
- 마케팅 캠페인
- 커뮤니티 구축

---

_Last Updated: 2026-02-20_
