# ADR-115: 배포 앵커의 자율 진행 문장을 실패 행동 이름으로 구체화한다

- Status: Accepted
- Date: 2026-11-03
- PR: #945
- Amends: ADR-091 결정 1(앵커는 사용자 문안) — 사용자가 조사 결과의 문장 단위 제안 중 이 한 건을 채택했다(2026-11-03).
- Context: 사용자가 Working Principles 가 "정말 좋은가 · 필요한가"를 조사하라고 했다(근거 = `docs/research/working-principles-2026-11.md`).
  조사가 근거로 받친 판정은 다섯 갈래다.
  ⓐ 권한 · 승인 · 보존 문장은 유지한다. 코드에서 알아낼 수 없는 정책이라 상주 파일의 본래 자리다.
  ⓑ 자율 진행 문장은 구체화한다. 벤더가 최신 모델(Sonnet 5.5 low · medium effort)에서 "끝내기 전에 멈추고 확인을 구하는" 실패를 측정했고, 실패를 이름으로 짚은 구체 문장으로 고쳐졌다.
  ⓒ 검증 정의를 더하는 안은 조건부다. 설치자 환경에서 관측될 때 넣는다.
  ⓓ 리뷰 · 위임 · 범위를 좁히는 안은 반박돼 보류한다.
  ⓔ 나머지 원칙 문장은 근거가 없어 판단을 미룬다.
  §2 다단계 작업 문단을 스킬로 옮기라는 제안은 채택하지 않았다. ADR-110 의 사용자 결정과 비교 실험(차이 5건 모두 이 문단 쪽, 회귀 0)이 일반 권고보다 구체적인 근거다.
- Decision: §2 의 "Resolve routine uncertainty … Involve the user when …" 문단과 §6 첫 문장 "Work autonomously through the authorized outcome, without seeking repeated confirmation for routine progress."를 §2 한곳의 문단으로 합친다:
  ```
  Keep working until the requested outcome is done. Don't pause to confirm a
  routine plan, to ask what you can answer from the project, or after one part of
  a multi-part task. Stop to ask only when you can't continue without the user,
  before a risky step, or when an unresolved choice has material consequences that
  cannot be safely settled within the agreed intent and authority.
  ```
- Alternatives:
  - **그대로 둔다**: 기각. 같은 뜻을 추상적으로 말하는 문장은 그 실패를 막는다는 측정이 없다.
  - **검증 정의도 함께 더한다**: 보류. 근거가 중간이고 조건부다. 설치자 프로젝트에서 검증 없이 완료를 보고하는 일이 관측되면 다시 판정한다.
  - **다단계 작업 문단을 스킬로 옮긴다**: 기각(위 Context).
- Consequences:
  - 4 CLI 설치자가 매 세션 읽는 앵커가 약 +60 B 늘어난다. AGENTS.md 상한 초과 조합(#944)은 그만큼 더 넘는다.
  - "Don't …" 금지형 문장이 들어간다. "금지 목록 대신 방향" 철학과 긴장하지만, 묻는 조건(되돌리기 어려운 단계 전 · 중대한 선택)은 그대로 남는다.
  - 원문의 "reversible progress"(불확실할 때 되돌릴 수 있는 쪽으로 나아간다) 표현은 빠진다. 사용자가 승인한 문안 그대로다.
  - 효과는 설치자 프로젝트에서 관측되지 않았다. 반대로 질문이 너무 줄어 중대한 선택을 혼자 정하는 일이 관측되면 다시 판정한다.
