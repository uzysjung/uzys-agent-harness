# ADR-034: 방법론 코어 / 수단(권장) 계층 분리

- Status: Accepted
- Date: 2026-07-18
- PR: #217
- Context: 사용자 지시(2026-07-17, Lean 큐 ⑥): "내가 만든 스킬 중 하네스 엔지니어링 내용 —
  목표·스코프·논스코프 정하고 ADR, 결함 보고·재발방지 대책 — 은 전반적인 **방법론**이니까 묶어서
  **필수**로 제공하자. 그리고 agy, codex, model-policy 는 **수단**인 것 같아. 하지만 난 **권장**."
  당시 구조는 이 구분을 반영하지 못했다: model-orchestration(수단)이 dev-method 기본 설치에
  섞여 있고, advisors(수단)만 opt-in 이었다. 재편 방식은 2026-07-18 AskUserQuestion 으로 확정
  ("계층 재편 전체" — 표기만/설계문서 먼저 대안 기각).
- Decision:
  1. **방법론 코어 = dev-method 8종** (has-dev-track 기본 설치 유지): multi-persona-review ·
     gap-analysis-e2e · ultracode-service-audit · asis-tobe-decision · compaction-handoff ·
     northstar-roadmap · harness-health-audit · recurrence-prevention. 사용자가 열거한 방법론
     요소와의 대응 — 목표/스코프 = northstar-roadmap, 결함 보고·재발방지 = recurrence-prevention,
     검증·의사결정 = multi-persona-review/asis-tobe-decision, 하네스 자체 감사 =
     harness-health-audit. (ADR 작성 관행은 설치 문서/스캐폴드가 안내 — 별도 스킬 없음.)
  2. **수단(권장) 계층 = model-orchestration + gemini-consult + codex-consult** (전부 opt-in
     internal, 4-CLI 번들 렌더 유지). model-orchestration 은 기본 설치에서 **제외**(BREAKING) —
     `--with model-orchestration` 또는 wizard 개별 체크로 설치. "권장" 은 배지가 아니라
     description 의 "(opt-in — recommended)" 표기 + README "recommended means" 섹션으로 전달.
  3. **Context Cost ratchet 2,200 → 1,900 재조임** — 코어 8종 실측 ~1,809 tokens. 기본 설치
     상주 비용 −287 tokens (Lean/ADR-032 정합: 수단을 코어에서 빼면 예산도 낮춘다).
  4. **가드**: INTERNAL_BUNDLED = 코어 8 + 수단 3 정확 일치 테스트, 수단 3종 opt-in +
     description opt-in 표기 의무 테스트. 외부 CLI 의존(agy/codex) pre-check 승격은 하지 않음
     (First-Run Success 리스크 — 기존 결정 유지).
- Alternatives:
  - **표기만 도입(설치 무변경)**: 기각 — 사용자 발언("수단, 필수 아님")과 설치 구조가 계속
    모순. 기본 설치가 곧 "필수" 의 실체다.
  - **설계 문서 선행**: 기각 — 변경 표면이 derive 로 좁아(조건 1곳 + 목록 1곳) 문서만 따로
    받을 이유가 없음. 본 ADR 이 그 문서를 겸한다.
  - **model-orchestration 을 코어에 유지**: 기각 — 모델/effort 정책은 특정 작업 방식(위임
    오케스트레이션)을 전제하는 수단이지, 모든 dev 트랙 사용자의 방법론이 아니다 (사용자 분류).
- Consequences:
  - BREAKING: 신규/재설치에서 model-orchestration 이 기본 포함되지 않는다. 기존 설치본 파일은
    유지 (installer 는 prune 하지 않음). CalVer 정책상 Minor bump (v26.105.0).
  - 기본 설치 Session-Start Context Cost −287 tokens (2,096 → 1,809).
  - wizard: 방법론 번들 row 는 "8종" 으로 derive, model-orchestration 은 workflow 페이지 개별
    opt-in row 로 렌더 (도달 경로 유지 — wizard-page-parity 커버).
  - Lean 큐 ⑥ 종결. ④ 자산 축 판정의 분류(pattern-guide vs operational-fact)는 별건으로 잔여.
