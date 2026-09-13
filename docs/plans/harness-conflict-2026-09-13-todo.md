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

- [x] **① 자연스러운 한국어 스킬 (#428)** — PR #430 — `humanize-korean` → `natural-korean` 로 **이름을 바꾸고**
  본문을 첨부 SKILL.md 로 교체. 배선·테스트·문서·`.claude/` 미러 동반. 옛 id 를 고른 설치자가 `update`
  때 `notInCatalog` 로 떨어지는지 확인하고 떨어지면 안내 한 줄. 자산 수 62 유지.
- [x] **② 충돌 해소 스킬 (#425)** — PR #432 (전제 #431 = PR #434) — 첨부 zip 을 `templates/skills/audit-harness-fit/` 에 **같은 id 로 통합**
  (SKILL.md + references 4 + README + evals). `official-criteria.md` 와 인용 원장 게이트는 **은퇴**(ADR-084
  가 ADR-066 을 supersede · ADR-064 amend). 테스트는 뜻을 안 읽는 형태로 재작성: 라우팅 링크 실재 ·
  100줄 초과 참조의 TOC · 리포 전용 경로 부재 · 미러 바이트 동일 · 카탈로그 배선. 카탈로그 `description`
  갱신. 설치 후 FILL 안내(`install-render.ts:396`)에 스킬이 깔린 경우에만 "populate" 한 줄.
  **선행 조건**: 비-Claude CLI 3종이 스킬 **디렉터리 전체**를 복사하게 고친다(신규 이슈, 아래 D3).
- [x] **③ 앵커 동일화 — 고객 앵커 = 전역 6원칙 (#427-A, #418 흡수)** — `templates/CLAUDE.md` 를 #427 본문으로
  **바이트 동일** 교체(꼬리 2절 제거). 상시 스킬 안내(`clear-korean-communication` · `task-brief` ·
  `model-orchestration`)는 설치기가 만드는 프로젝트 블록의 `Installed Harness Assets` 절로 옮겨 **실제로 설치된
  것만** 적는다. ASIS→TOBE 형식은 `clear-korean-communication` 스킬이 소유. ADR 1건이 ADR-055 · ADR-068 을
  supersede. parity 게이트 축1·축3 어휘 갱신, 축4 는 `scope: repo`. reachability 게이트 모수 조정.
  이 리포 `.claude/CLAUDE.md`: "테스트는 구현이 아닌 레인이 쓴다"(사용자가 2026-07-26 기각한 축) ·
  "구현은 implementer 에 위임"(#427 §6 은 비용 대비로 위임) 두 문장을 #427 에 맞춘다. 루트 `CLAUDE.md`
  는 사실만 담고 있어 충돌 0(확인).
- [x] **④ 전체 하네스 충돌 감사 (#426)** — 보고서 `docs/plans/harness-conflict-audit-2026-09-13.md` (HIGH 2 · MED 6 · LOW 5 · 보류 3) — ②의 스킬을 **이 리포에** 읽기 전용으로 돌린다. 대상 = 4 CLI
  설치 렌더(임시 디렉터리 4개, `runInstall`) + 이 리포 `.claude/`. 산출물 = `docs/plans/harness-conflict-audit-2026-09-13.md`
  (F-xx 기록: 원문 양쪽 · 상황 · 수정안 · 확인/미확인 경로). 파일 수정 없음.
- [ ] **⑤ 씬 단위 검사 + 감사 결과 적용 (#424 · #427-B, #423 동반)** — ④의 findings 전부 확정됨(보고서
  §사용자 결정). PR 6개(ⓕ 는 사용자 추가 지시), 각각 독립 리뷰:
  - [x] ⓐ **리뷰 문턱 통일** F-01 · F-14 · R-01 · R-02 — ADR-087 — `code-reviewer` descriptor(양쪽) · 고객 `Delivery` 룰
    3단계 리듬 + #423 머지 전 기준 · `Testing` 룰 문턱 SSOT 한 곳 · 이 리포 `test-policy` · `ship-checklist`.
    필수 보안·데이터 보호 검사는 유지.
  - [x] ⓑ **AGENTS 껍데기 3종 정리** F-02 · F-03 · F-05 · F-06 · F-12 — 렌더 게이트 · Codex 크기 게이트(25,320 → 23,283 B, ratchet 22.75 KiB).
  - [x] ⓒ **스킬·에이전트 본문** F-07 · F-08 · F-15 — 한 문단씩.
  - [x] ⓓ **자산 정리(배포판)** F-04 · F-09 · F-10 · F-11 — ADR-088 — `task-brief`→`objective-brief` 개명·문턱·넛지 훅
    제거·상시 안내 제외 · `strategic-compact` · `continuous-learning-v2` 제거 · `spec-scaling` retire ·
    `doc-governance` 한 줄. 카탈로그·lock·문서·`.claude/` 미러 동반. **카탈로그 수는 62 그대로** —
    은퇴 3종은 카탈로그 엔트리가 아니라 manifest 번들이었다(착수 전 "62 → 59" 는 오기). 번들 uzys
    스킬 16 → 15. 상주(tooling) 34개 ~7,890 → 31개 ~7,685 · Codex AGENTS.md 23,283 → 23,304 B.
  - [x] ⓕ **audit-harness-fit 에 씬 묶음 검증 · 개발 속도 관점** (사용자 지시 2026-09-13, PR #441) — 영역 5 확장 +
    verification 참조 "Bundle verification by completed scene". 씬 리듬 문장이 **두 곳**(Delivery 룰 · 이 스킬)에
    있다 — 리듬을 바꿀 때는 둘 다 고친다(리뷰 지적).
  - [x] ⓔ **이 리포 이력 분리** R-03 · R-04 · R-06~R-09 — 루트 `CLAUDE.md` · `.claude/CLAUDE.md` ·
    `.claude/rules/` 7종에서 경위·전례·정정 이력을 ADR·plan·이슈 링크로. 사례표 → "신설 근거: N회 재발
    (링크)" 한 줄, `recurrence-prevention` 룰 템플릿 정합(배포판 + 미러). 죽은 MCP 훅 배선 삭제
    (`.claude/settings.json` 훅 명령 4 → 3). 배포 룰 6종은 **2차 감사 G-02~G-06 이 별도로 처리**했고
    `.claude/rules/doc-governance.md` 는 배포판과 바이트 동일 계약(`doc-governance-baseline-rule`)이라
    무변경. 메모리 색인은 리포 밖이라 비대상. 목적지를 못 찾은 문장 1건은 지우지 않고 남겼다
    (`cli-development` §부정 결론은 도구로 한다 꼬리).
- [ ] **⑥ 출하** — CHANGELOG · `cost:baseline` · 릴리즈 순서(`ship-checklist`).

## 결정 (사용자 확정 2026-09-13)

| # | 결정 | 확정 |
|---|---|---|
| D1 | 고객 앵커 꼬리 2절 | **제거 + 상시 스킬 안내를 프로젝트 블록으로 이동**(A 안). 앵커는 전역 6원칙과 바이트 동일 |
| D2 | 비-Claude CLI 에 스킬 디렉터리 전체 복사 | **한다**. 충돌 해소 스킬 작업 안에서 먼저 처리 |
| D3 | #423 을 ⑤에 합친다 | **합친다** |
| 결과 | 적대적 패널 축 | 사용자 문안에 없으므로 배포 앵커에서 사라진다. 게이트의 그 축은 이 리포 앵커 전용 |
| D4 | `task-brief` 문턱·이름 | **`objective-brief`** 로 개명. 긴 작업·피처·프로젝트 규모 이상에만 — 설치자·이 리포 동일 문턱. **보강(사용자 2026-09-13)**: 원인은 *"모든 요청을 브리프화해 보여준 뒤 진행(확정 2026-08-03) — 한 줄 요청에도 브리프가 앞서 속도를 늦추는 1순위"*. 발화 조건 = **위임 · 설계 · 다단계 작업**에만(한 줄 요청 · 단일 수정은 제외). 스킬 descriptor 와 본문 "When to use" 를 이 세 조건으로 쓴다 |
| D5 | `strategic-compact` | **제거**(스킬·훅). 순정 자동 컴팩션이 있다 |
| D6 | `continuous-learning-v2` | **제거**. `recurrence-prevention` 이 담당 |
| D7 | `spec-scaling` | **retire** + `doc-governance` 한 줄 |
| D8 | 이력 분리 범위 | **매 세션 상주하는 파일 전부**, 사례표 포함(계수는 한 줄 + 링크) |
| D9 | `mcp-pre-exec` | 이미 제거됨(#307) — 죽은 배선·낡은 문장만 정리 |

## 가드레일

- 사용자 문안(#427 본문 · 첨부 SKILL.md · 첨부 zip)은 **축자**로 넣는다. 내 편집을 사용자 것으로 적지 않는다.
- 지시문 크기는 지표가 아니다 — "불필요한 지시문이 있나"로만 판단. 새 상주 지시문은 **행동이 달라진다는 관측**이 있을 때만.
- 부재·미도달 주장은 `check-absence.sh`(canary = 패턴이 **잡는** 문자열) 또는 공백 정규화 + 음성 대조로만.
- 문서·자산 변경의 영향 범위는 고르지 않는다 — **전체** `npm run ci`.
- 새 게이트는 결정론적으로 잡히는 것에만, 글롭/derive 형태로.
