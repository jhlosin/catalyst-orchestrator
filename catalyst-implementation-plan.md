# Catalyst Implementation Plan

## Goal: Agent-to-Agent Orchestrator on Virtuals ACP

---

## Current Status
- ✅ OpenClaw running
- ✅ Telegram connected
- 🔄 Catalyst 에이전트 생성
- 🔄 Virtuals ACP 연동
- 🔄 첫 서비스 배포

---

## Step 1: Catalyst 에이전트 생성

### 에이전트 정보
- **이름:** Catalyst
- **역할:** 에이전트 오케스트레이터
- **기능:**
  - 에이전트 디스커버리
  - 병렬 호출
  - 결과 종합
  - 비용 최적화

### 생성 명령어
```bash
# 에이전트 생성
openclaw agents create --name catalyst --description "Agent orchestrator for Virtuals ACP"
```

---

## Step 2: Virtuals ACP 연동

### 필요한 것들
1. Virtuals Protocol 계정
2. ACP API 키
3. 에이전트 지갑

### ACP 등록
- **타입:** Hybrid (자체 인프라 + ACP 연결)
- **서비스:** 오케스트레이션 서비스들
- **지갑:** 자동 생성됨

---

## Step 3: 첫 서비스 정의

### 서비스들 (저가 볼륨 전략)

#### 1. micro_orchestrate ($0.02)
- **기능:** 2개 에이전트 병렬 호출 + 결과 종합
- **예시:** 토큰 분석 → 센티먼트 + 온체인
- **타임아웃:** 3초

#### 2. basic_orchestrate ($0.05) ⭐ 첫 배포
- **기능:** 3-4개 에이전트 병렬 호출 + 결과 종합
- **예시:** DeFi 포지션 → 센티먼트 + 스캠 + 온체인
- **타임아웃:** 5초

#### 3. advanced_orchestrate ($0.10)
- **기능:** 5+ 개 에이전트 병렬 호출 + 결과 종합 + 오류 핸들링
- **예시:** 풀 리서치 → 센티먼트 + 스캠 + 온체인 + 홀더 + 플로우
- **타임아웃:** 8초

---

## Step 4: 엔진 구현

### 컴포넌트

#### 1. Agent Discovery
```
ACP API → 에이전트 목록 → 카테고리/태그 필터링
```

#### 2. Parallel Executor
```
요청 → 병렬로 에이전트들 호출 → 응답 수집
```

#### 3. Result Aggregator
```
응답들 → 통합/요약 → 최종 출력
```

#### 4. Cost Optimizer
```
같은 기능의 에이전트들 → 가격 비교 → 최저가 선택
```

### 코드 구조 (초안)
```typescript
interface Agent {
  id: string;
  name: string;
  price: number;
  success_rate: number;
  category: string;
}

interface WorkflowRequest {
  goal: string;
  category: string;
  max_price: number;
}

async function orchestrate(request: WorkflowRequest) {
  // 1. 에이전트 디스커버리
  const agents = await discoverAgents(request.category);

  // 2. 비용 최적화
  const selected = selectAgents(agents, request.max_price);

  // 3. 병렬 호출
  const results = await Promise.all(
    selected.map(agent => callAgent(agent, request.goal))
  );

  // 4. 결과 종합
  return aggregate(results);
}
```

---

## Step 5: 배포

### Seller Runtime
- ACP WebSocket 연결
- 요청 수신 대기
- 오케스트레이션 실행
- 결과 반환 + 결제

### 배포 명령어
```bash
# 셀러 런타임 시작
pm2 start "node seller-runtime.js" --name catalyst-seller
```

---

## Step 6: 네트워킹 + 첫 수익

### 네트워킹 전략
1. 다른 에이전트로부터 서비스 구매
2. 자체 서비스 테스트
3. ACP 점수 상승

### 첫 수익 목표
- **1주일 내:** 첫 basic_orchestrate 판매
- **1개월 내:** 50+ 판매

---

## 로드맵

### Week 1
- [x] OpenClaw 세팅 완료
- [ ] Catalyst 에이전트 생성
- [ ] Virtuals ACP 연동
- [ ] basic_orchestrate 구현

### Week 2
- [ ] micro/advanced 서비스 추가
- [ ] 에이전트 디스커버리 완성
- [ ] 네트워킹 시작

### Week 3
- [ ] 비용 최적화 추가
- [ ] 에러 핸들링 개선
- [ ] 첫 수익 달성

### Week 4+
- [ ] 스케일
- [ ] 더 많은 서비스
- [ ] 지능형 워크플로우

---

## 다음 액션

1. Catalyst 에이전트 생성
2. Virtuals ACP 계정 확인
3. basic_orchestrate 구현 시작

---

_Last Updated: 2026-02-20_
