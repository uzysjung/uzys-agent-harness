# Plan — [Project Name]

> 6개월+ 프로젝트 또는 복수 Phase가 있는 경우 사용. 1-2주 단순 작업은 todo.md만으로 충분.
> Phase 단위 실행 계획 템플릿.

---

## 0. Sprint Contract

- **목표 (이번 sprint에서 달성할 outcome)**: [한 문장]
- **포함 (scope)**: [3-5개 bullet]
- **제외 (out of scope)**: [3-5개 bullet — Non-Goals]
- **완료 기준 (Definition of Done)**: [측정 가능한 조건]
- **제약 조건**: [기간, 리소스, 의존성]

---

## 1. Phase Overview

전체 프로젝트를 Phase로 나눈 큰 그림. 본 sprint가 어느 Phase에 속하는지 명시.

| Phase | 이름 | 목표 | 진입 조건 | 완료 조건 |
|-------|------|------|----------|----------|
| P1 | [이름] | [한 문장] | (시작) | [측정 가능 기준] |
| P2 | [이름] | [한 문장] | P1 완료 | [기준] |
| P3 | [이름] | [한 문장] | P2 완료 + [추가 조건] | [기준] |

---

## 2. Milestone × Dependency Graph

각 Phase 내부를 Milestone으로 분해 + 의존성 표기.

### 표기 규약
- `M1 → M2`: M1 완료 후 M2 시작 (직렬)
- `M1 ∥ M2`: 동시 진행 가능 (병렬)
- `M1 ⇒ M2`: M1의 산출물이 M2의 입력 (강한 의존)
- `M1 → {M2, M3} → M4`: M1 후 M2/M3 병렬 → 둘 다 끝나면 M4

### 예시 — Phase 1 분해

```
M1 (foundation) ⇒ {M2 (auth), M3 (data layer)} → M4 (UI integration) → M5 (E2E)
                                                  ↘
                                                   M6 (CLI) ∥ M5
```

| Milestone | 산출물 | 의존성 | 예상 기간 | Status |
|-----------|--------|--------|---------|--------|
| M1 | [foundation 산출물] | (없음) | 3d | ⬜ |
| M2 | [auth 산출물] | M1 | 5d | ⬜ |
| M3 | [data layer] | M1 | 4d | ⬜ |
| M4 | [UI integration] | M2, M3 | 3d | ⬜ |
| M5 | [E2E suite] | M4 | 2d | ⬜ |
| M6 | [CLI] | M4 | 2d | ⬜ |

### 임계 경로 (Critical Path)
가장 긴 직렬 체인 — 일정 risk가 가장 큰 경로.
> M1 → M2 → M4 → M5 = 13일

병렬 경로 (M3, M6) 단축은 임계 경로 단축 안 됨. M2/M4 단축이 우선.

---

## 3. Per-Milestone Detail

각 Milestone의 task breakdown은 `docs/todo.md`에 위임.
본 문서에는 outcome + AC만.

### M1 — [이름]
- **Outcome**: [완료 시 무엇이 가능한가]
- **AC** (Acceptance Criteria):
  - [ ] [측정 가능 조건 1]
  - [ ] [측정 가능 조건 2]
- **References**: [SPEC §, ADR, 외부 문서]

(M2~Mn 동일 구조)

---

## 4. Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|----------|--------|----------|------|
| [예: 외부 API rate limit] | M | H | mock + cache layer | [name] |
| [예: 마이그레이션 실패] | L | H | savepoint + rollback 스크립트 | [name] |

---

## 5. Open Questions

해결되지 않은 의사결정. SPEC/NORTH_STAR 갱신 필요할 수도.

- [ ] [질문 1] — 결정자: [name], 마감: [date]
- [ ] [질문 2]

---

## 6. Changelog

- YYYY-MM-DD: 초안
- (이후 갱신 기록)
