---
status: active
---

# 지침 충돌 해소 사이클 (2026-09-13) — #427 · #425 · #428 · #426 · #424

- 시작: 2026-09-13 · 사용자 지시: *"#427 이 리포의 CLAUDE.md 도 바꾸고 고객 제공 CLAUDE.md 도 개선,
  #425 해소 스킬을 고객·이 리포에 추가, #428 추가, #426 · #424 를 #425 기반하에"*
- **고객 = 설치 사용자.** 하네스를 자기 프로젝트에 깐 개발자와, 그 프로젝트에서 매 세션 앵커·룰·스킬을
  읽는 에이전트(Claude Code · Codex · OpenCode · Antigravity). 판정·보고·ASIS→TOBE 전부 이 자리에서 쓴다.
  이 리포의 `.claude/` 는 2차 대상(우리 개발용)이다.
- 기준 문서: `~/.claude/CLAUDE.md` 는 이미 #427 본문과 **동일**하다(2026-09-13 확인). 이 사이클은 그 6원칙을
  **상위 지침**으로 놓고 나머지를 맞춘다.

## 착수 전 실측 (2026-09-13)

| 항목 | 값 | 뜻 |
|---|---|---|
| #427 본문 | 147줄 · 7,538 B | 현행 `templates/CLAUDE.md` §1–§7(6,144 B)보다 **+1,394 B** |
| Codex `AGENTS.md` ratchet 여유 | 538 B | #427 을 그대로 넣으면 ratchet red → **의도적 baseline 갱신**이 필요(ADR-083: 조용한 증가만 막는다) |
| `lane-principle-anchor-parity` | 배포 앵커 3축 | #427 문안은 축1·축3 을 **다른 낱말로** 갖고(`did not author` · `not merely the author's summary`), 축4(적대적 패널)는 **없다** — 사용자가 뺀 것 |
| 비-Claude CLI 의 스킬 복사 | `SKILL.md` **한 파일만** (`src/codex/transform.ts:135` · `opencode/transform.ts:117` · `antigravity/transform.ts:106`) | 번들 스킬 **14종**이 `references/`·`scripts/` 를 갖는데 Codex·OpenCode·Antigravity 설치자에게는 안 간다. #425 초안은 SKILL.md 가 라우터(71줄)이고 본문이 references 4개(≈24 KB)라 **3/4 CLI 에서 빈 껍데기**가 된다 |
| `audit-harness-fit` 현행 게이트 | `tests/audit-harness-fit-skill.test.ts` 7블록 | `references/official-criteria.md` 실재 + 인용 원장 대조가 핵심. 초안에는 그 파일이 없다 → ADR-066(공식 체크리스트 우선)을 **supersede** 해야 한다 |
| `humanize-korean` 배선 | id 유니언 · 카탈로그 entry · `INTERNAL_BUNDLED_SKILL_IDS` · 테스트 2 · 문서 3(TRACKS·COMPATIBILITY·CHANGELOG) · `.claude/` 미러 | id 를 바꾸면 전부 따라간다. 자산 수 62 는 유지 |
| 벤더 신호 (OpenAI GPT-6 Astra 안내, 2026-09-13 200) | *"unclear or conflicting guidance in a skill file may cause the model to pause and block work early"* · *"Do not write tests for reversible, low-impact changes"* · *"broaden or repeat testing only when new changes, failures, or unresolved concerns justify it"* | #425 의 감사 항목 1·2·5 와 #424 를 벤더가 같은 말로 권고한다 → `docs/research/vendor-signals.md` 에 1행 추가 |

## 순서 — PR 5개, 각각 독립 리뷰

- [ ] **① 자연스러운 한국어 스킬 (#428)** — `humanize-korean` → `natural-korean` 로 **이름을 바꾸고**
  본문을 첨부 SKILL.md 로 교체. 배선·테스트·문서·`.claude/` 미러 동반. 옛 id 를 고른 설치자가 `update`
  때 `notInCatalog` 로 떨어지는지 확인하고 떨어지면 안내 한 줄. 자산 수 62 유지.
- [ ] **② 충돌 해소 스킬 (#425)** — 첨부 zip 을 `templates/skills/audit-harness-fit/` 에 **같은 id 로 통합**
  (SKILL.md + references 4 + README + evals). `official-criteria.md` 와 인용 원장 게이트는 **은퇴**(ADR-084
  가 ADR-066 을 supersede · ADR-064 amend). 테스트는 뜻을 안 읽는 형태로 재작성: 라우팅 링크 실재 ·
  100줄 초과 참조의 TOC · 리포 전용 경로 부재 · 미러 바이트 동일 · 카탈로그 배선. 카탈로그 `description`
  갱신. 설치 후 FILL 안내(`install-render.ts:396`)에 스킬이 깔린 경우에만 "populate" 한 줄.
  **선행 조건**: 비-Claude CLI 3종이 스킬 **디렉터리 전체**를 복사하게 고친다(신규 이슈, 아래 D3).
- [ ] **③ 앵커 동일화 — 고객 앵커 = 전역 6원칙 (#427-A, #418 흡수)** — `templates/CLAUDE.md` 를 #427 본문으로
  **바이트 동일** 교체(꼬리 2절 제거). 상시 스킬 안내(`clear-korean-communication` · `task-brief` ·
  `model-orchestration`)는 설치기가 만드는 프로젝트 블록의 `Installed Harness Assets` 절로 옮겨 **실제로 설치된
  것만** 적는다. ASIS→TOBE 형식은 `clear-korean-communication` 스킬이 소유. ADR 1건이 ADR-055 · ADR-068 을
  supersede. parity 게이트 축1·축3 어휘 갱신, 축4 는 `scope: repo`. reachability 게이트 모수 조정.
  이 리포 `.claude/CLAUDE.md`: "테스트는 구현이 아닌 레인이 쓴다"(사용자가 2026-07-26 기각한 축) ·
  "구현은 implementer 에 위임"(#427 §6 은 비용 대비로 위임) 두 문장을 #427 에 맞춘다. 루트 `CLAUDE.md`
  는 사실만 담고 있어 충돌 0(확인).
- [ ] **④ 전체 하네스 충돌 감사 (#426)** — ②의 스킬을 **이 리포에** 읽기 전용으로 돌린다. 대상 = 4 CLI
  설치 렌더(임시 디렉터리 4개, `runInstall`) + 이 리포 `.claude/`. 산출물 = `docs/plans/harness-conflict-audit-2026-09-13.md`
  (F-xx 기록: 원문 양쪽 · 상황 · 수정안 · 확인/미확인 경로). 파일 수정 없음.
- [ ] **⑤ 씬 단위 검사 + 감사 결과 적용 (#424 · #427-B, #423 동반)** — ④의 findings 중 사용자가 확정한 것을
  적용. 확정된 것 하나는 이미 있다: `code-reviewer` 에이전트 descriptor 의 *"MUST BE USED for all code
  changes"* (양쪽 사본) → 씬 완료 시점으로. 고객 `Delivery` 룰에 3단계 리듬(변경부 빠른 검사 → 씬 수정분
  모아 독립 검토 → 통합·빌드·실사용 흐름)과 #423 의 머지 전 독립검증 기준(핵심 사용자 기능 · 되돌리기
  어려운 것 · 돈·권한)을 넣는다. 필수 보안·데이터 보호 검사는 유지.
- [ ] **⑥ 출하** — CHANGELOG · `cost:baseline` · 릴리즈 순서(`ship-checklist`).

## 결정 (사용자 확정 2026-09-13)

| # | 결정 | 확정 |
|---|---|---|
| D1 | 고객 앵커 꼬리 2절 | **제거 + 상시 스킬 안내를 프로젝트 블록으로 이동**(A 안). 앵커는 전역 6원칙과 바이트 동일 |
| D2 | 비-Claude CLI 에 스킬 디렉터리 전체 복사 | **한다**. 충돌 해소 스킬 작업 안에서 먼저 처리 |
| D3 | #423 을 ⑤에 합친다 | **합친다** |
| 결과 | 적대적 패널 축 | 사용자 문안에 없으므로 배포 앵커에서 사라진다. 게이트의 그 축은 이 리포 앵커 전용 |

## 가드레일

- 사용자 문안(#427 본문 · 첨부 SKILL.md · 첨부 zip)은 **축자**로 넣는다. 내 편집을 사용자 것으로 적지 않는다.
- 지시문 크기는 지표가 아니다 — "불필요한 지시문이 있나"로만 판단. 새 상주 지시문은 **행동이 달라진다는 관측**이 있을 때만.
- 부재·미도달 주장은 `check-absence.sh`(canary = 패턴이 **잡는** 문자열) 또는 공백 정규화 + 음성 대조로만.
- 문서·자산 변경의 영향 범위는 고르지 않는다 — **전체** `npm run ci`.
- 새 게이트는 결정론적으로 잡히는 것에만, 글롭/derive 형태로.
