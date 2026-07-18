# Lean 방향 실행 큐 (2026-07-17)

> 결정 = [ADR-032](../decisions/ADR-032-lean-curation-direction.md) · 방향 앵커 = NORTH_STAR §1
> "Lean 개정" · README "Curation philosophy" (#211). 5-페르소나 패널 원문은 세션
> scratchpad(휘발) — 핵심 판정은 ADR-032 에 영구 기록.

## 큐 (사용자 승인 2026-07-17 — 4건 전부 선택)

| # | 항목 | 내용 | 상태 |
|---|---|---|---|
| 1 | 문서 게이트 | NORTH_STAR Major CR + ADR-032 + WORKFLOWS 조건표 + roadmap immediateNext 갱신 | ✅ PR #212 |
| 2 | Session-Start Context Cost | 위저드 confirm + 비대화형 header 동일 문구 표시(`src/context-cost.ts`). 템플릿 = frontmatter 실측(~), 외부 = unmeasured 명시. CI ratchet 2,000 tokens(실측 1,872 + 7%, 양방향 가드) | ✅ v26.103.0 |
| 3 | 트리거 중복 탐지 CI | 번들 스킬 10종 description 쌍별 Jaccard > 0.30 신규 쌍 차단(사유 필수 ALLOWLIST). 실측 현재 최대 0.190 | ✅ v26.103.0 |
| 4 | 자산 축 판정 (재정의 #213) | ~~검증실패 12자산 판정~~ **전제 오류로 소멸** — 12 비-🟢 = 🟡 1st-party 템플릿+ecc-prune(실패 아님), 2026-07-17 dispatch 재실행 결과 catalog-verify·trust-tier-drift **양쪽 green**(계측기 RED 방치 해소). 대체 작업: 카탈로그 61자산을 `pattern-guide`(모델 대체 가능성 높음 — 축소 후보) vs `operational-fact`(유지) 축으로 분류 → 축소 후보 목록 제안. **제거는 데이터(HITO A/B·설치 로그) + 사용자 컨펌 필수** | 대기 |
| 5 | 재발방지 스킬 (신규 1st-party, 사용자 지시 2026-07-17) | 동일 이슈/결함이 하네스 진행 중 반복 발생 시: **단순 실수**(깜박 등) → 기록 또는 룰 강제 등록 경로 / **복잡한 하네스 문제** → 다면 페르소나로 해결책 설계(multi-persona-review 연계). 이 repo 실무 관행(no-false-ship 3회 재발 → rule 신설, 사례표 축적)의 스킬화 — 분류 기준·재발 카운트 방식(실패 서명 + 증거)·에스컬레이션 사다리(기록→룰→구조적 게이트)·룰 등록 템플릿 포함 | ✅ v26.104.0 (`recurrence-prevention`, dev-method 9번째, ADR-033) |
| 6 | 방법론 코어 번들 재편 (사용자 지시 2026-07-17) | 하네스 엔지니어링 **방법론**(목표·스코프·논스코프 정의 / ADR / 결함 보고 / 재발방지 대책)을 **필수 코어**로 묶어 제공. **수단** 스킬(gemini-consult=agy · codex-consult · model-orchestration=model-policy)은 **권장** 계층으로 구분 — 필수 아님, 단 권장 표기 유지. 주의: 외부 CLI(agy/codex) 의존 자산의 pre-check 승격은 First-Run Success 리스크 검토 선행 | ✅ v26.105.0 (계층 재편 전체 — 사용자 확정 2026-07-18, ADR-034. 코어 8종 기본 / 수단 3종 opt-in 권장, ratchet 1,900 재조임) |

## 원칙 (패널 수렴 판정 — 실행 시 준수)

- 번들 6종 **opt-in 유지 확정** (제거·배지 강등 기각 — ADR-032 Alternatives). 재론 시 새 근거
  데이터(HITO A/B, 설치 로그) 필요.
- T2("모델 향상 → 스킬 불필요") = **가설**. 공개 문서에는 관점으로만. 검증 경로 = HITO A/B.
- 축소는 카테고리 일괄 금지 — `pattern-guide`(축소 후보) vs `operational-fact`(유지) 자산 단위.
- wshobson-agents 는 T3 기준(오케스트레이션·cross-CLI) 부합 — 번들 일괄 취급 금지, 개별 판정.
- "멀티에이전트 동시 개발" 광고 금지 — 안전장치(worktree 관례·파일 클레임 hook) 출하가 선행.
- 이행 창 = M2 게시 전(외부 사용자 ~0 = 이행비용 0). M2 재개 결정 시 본 큐 진척을 먼저 확인.

## 후속 (v26.103.0 SOD 리뷰 잔여 — Nit/기록)

- ~~**F6**: `defaultHarnessRoot` `.pathname`~~ **v26.103.0 에서 수정 완료**(fileURLToPath, 리뷰
  2기 수렴으로 릴리즈에 포함) — 잔여는 spaced-path **Docker 시나리오 검증**만(픽스처 테스트는
  추가됨, 실 CLI 경로는 미검증).
- **F5**: unmeasured 를 무조건 "external" 로 표기 — internal 해석 실패(패키징 드리프트) 시
  범주 오표기. 카운터 분리 또는 중립 문구 검토.
- **F9**: context-cost 의 dist 실행 증거 부재 — docker 시나리오에 `grep "session-start context
  cost"` 1줄 또는 npm pack 패키징 테스트 추가.
- **F8**(기록): Jaccard 게이트는 "장황하게 쓰기"로 회피 가능. gemini/codex-consult(최대 쌍)는
  opt-in 이라 예산 반대 압력이 없음. 현재 0.190 vs 0.30 — 실해 없음.
