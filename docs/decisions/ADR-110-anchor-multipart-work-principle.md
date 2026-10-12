# ADR-110: 배포 앵커 §2 에 "다중 작업은 성과 → 이어받을 수 있는 단위로" 한 단락 (#755)

- Status: Proposed
- Date: 2026-10-12
- PR: (머지 시 채움)
- Amends: ADR-091 결정 1(앵커는 사용자 문안 축자 — 이번 단락은 사용자가 #755 로 요구를 주고, 외부 모델 토론으로 다듬은 문안을 비교 실험 뒤 채택하기로 사용자가 결정했다)

## Context

사용자가 #755 에 자기 작업 방식을 적었다 — 초기 개발은 서비스 정의서·기획서·설계서, 기능 개선은 작업 지시서에서 출발해, 사용자 플로우와 구현 두 관점으로 이슈·마일스톤을 만들고, 구현 속도·토큰 효율을 고려해 에이전트가 그대로 일하게 한다. 처음엔 스킬로 설계했으나 사용자가 "CLAUDE.md/AGENTS.md 나 룰에 넣어야" 한다고 정했다(2026-10-12). 상주 지시는 매 세션 비용이고 Codex `AGENTS.md` 는 32 KiB 합계 상한이 있어, 관측 없는 지시는 넣지 않는다는 이 리포 기준(NORTH_STAR §1)과 긴장한다.

## Decision

1. 배포 앵커 `templates/CLAUDE.md` §2 끝(§3 앞)에 한 단락(474자, 약 +118 토큰/세션)을 둔다. 4 CLI 앵커가 이 본문을 그대로 임베드한다.
   ```
   For multi-part work, derive user or operational outcomes from the current request and
   applicable plans, designs, or agreed briefs. Divide them into coherent units described
   well enough to start and verify without re-deriving the plan; sequence by dependencies
   and agreed priorities. Where authorized, preserve material decisions and acceptance
   evidence in existing project records, and judge completion by evidenced required results
   and protections rather than closed units.
   ```
2. 절차(이슈 본문 · 마일스톤 · wiki · 브리프 형식 · 레인)는 상주에 넣지 않는다 — `gh-issue-workflow` · `objective-brief` · `model-orchestration` 이 그대로 소유한다. wiki 는 "existing project records" 가 포괄한다.
3. 채택 근거는 사용자 결정 + 비교 실험이다(`docs/research/issue-755-debate-2026-10-12/experiment/`): 현재 앵커 vs 이 문안, 4과업(t1·t2 는 2회), 블라인드 채점 — 차이가 난 5건이 모두 이 문안 쪽, 회귀 0.

## Alternatives

- **새 스킬 `work-cycle`** — 기각(사용자 결정). 문서를 넘기며 "개발 시작하자" 는 순간 어느 스킬 descriptor 도 안정적으로 발화하지 않는다.
- **원안 3문장**(문서에서 꺼낸다 · 사용자 플로우 · 한 변경 · 이름=완료 · 채팅 대신 추적 자리) — ChatGPT(GPT-6 Extra High) 2라운드 토론에서 6건 수정(대화 배제로 읽힘 · 화면 없는 트랙 과잉 일반화 · 이름은 수용 기준 아님 · 순서 경직 · 다중 작업 한정 · 무단 기록 위험). 기록 `docs/research/issue-755-debate-2026-10-12/`.
- **새 룰 파일 / 기존 룰 절** — 같은 뜻에 비용 1.4배, 파일 유형에 묶이지 않는 지시라 `paths:` 이득이 없다(설계서 §3).
- **실험 없이 바로 채택** — 사용자가 실험 후 채택을 골랐다.

## Consequences

- 모든 트랙 · 4 CLI 설치자가 매 세션 약 +118 토큰을 낸다. Codex `AGENTS.md` 크기 증가는 `npm run cost:report` 기준선에 반영했다.
- 실험의 한계: 과업당 1~2회 · 채점자 1 · 계획 단계만 · Opus 5.5 · Claude Code. 구현 품질 효과는 미측정이다.
- **만료 시계**: 두 릴리즈 안에 설치자 프로젝트에서 효과 신호(설계서 §6 — 성과 묶음 · 이어받기 가능한 단위 · 결정 재질문 감소)가 관측되지 않거나, 모델이 이 문장 없이도 같은 분해를 하는 것이 관측되면 `audit-harness-fit` 감사에서 스킬 강등 후보로 올린다.
- 실험에서 두 앵커 모두 승인 없이 설계서 원본에 한 줄을 넣었다 — 이 문안이 막지 못하는 공통 결함으로 남긴다.
