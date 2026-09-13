---
status: active
---

# 전체 하네스 지침 충돌 감사 (2026-09-13) — #426

`audit-harness-fit` 2판(ADR-084)의 **audit 모드(읽기 전용)** 로 돌렸다. 대상 = 머지된 main
`6e25f4f`(#430 · #434 · #432 · #433 반영 뒤). 판정 자리 = **설치 사용자**. 이 리포 자체의 `.claude/`
는 2차 대상으로 뒤에 따로 적는다(R-xx). 파일은 하나도 고치지 않았다.

## 확인한 경로 · 확인하지 못한 경로

| 표면 | 설치자에게 도달 | 이번 감사가 읽은 것 | 로딩 확인 |
|---|---|---|---|
| 앵커 `CLAUDE-uzys-harness.md` (= 전역 6원칙) | 4/4 CLI | `templates/CLAUDE.md` | Claude Code `@import` · Codex/OpenCode `AGENTS.md` 본문 embed · Antigravity `.agents/rules` — `tests/resident-reach-4cli` 실설치 |
| 룰 6종 | 4/4 | `templates/rules/*.md` 전문 | 같은 게이트. Antigravity 실 CLI 로딩은 컨테이너 신호만(게시 차단 아님) |
| AGENTS 껍데기(Codex · OpenCode · Antigravity) | 3/4 | `templates/*/AGENTS.md.template` 전문 | 위와 같음 |
| 프로젝트 맥락 스캐폴드 + 상시 스킬 안내 | 4/4 | `src/project-claude-merge.ts` 렌더 | `resident-reach-4cli`(안내 도달 + 음성 대조) |
| 에이전트 descriptor 9종 | Claude Code 개발 트랙만 | `templates/agents/*.md` frontmatter + reviewer · code-reviewer 본문 | Claude 문서 기준. 실 CLI 미실행 |
| 스킬 descriptor 28종 | 트랙·opt-in 별 | `templates/skills/*/SKILL.md` frontmatter | 상동 |
| 훅 3종 + 스킬 훅 1종 | Claude Code | `templates/hooks/*.sh` · `templates/settings.json` · `strategic-compact/suggest-compact.sh` | 훅 본문을 읽었다. 실행하지 않았다 |
| 사용자 전역 `~/.claude/CLAUDE.md` | 사용자 본인 | 읽음 — 앵커와 바이트 동일 | — |
| **미확인** | — | 실 CLI 4종의 런타임 로딩(호스트 실 CLI 차단 훅) · 설치자 프로젝트의 자기 지침(우리가 볼 수 없다) · 외부 자산 46종의 본문 | — |

**어휘 탐색의 대조군**: `MUST BE USED` 를 canary 로 `bash scripts/check-absence.sh --canary 'MUST BE USED' -i
'always|must|반드시|항상|즉시|금지' templates/agents templates/codex templates/opencode templates/antigravity templates/rules`
→ exit 1(발견 — canary 가 잡혔으므로 탐지기가 문다). 낱말이 아니라 그 지시가 만드는 행동으로 판정했다
(감사 규율). 아래 F-01 · F-02 · F-05 가 그 결과에서 나왔다.

## 판정 요약

| 등급 | 건수 | 뜻 |
|---|---|---|
| HIGH | 2 | 설치자의 실제 작업이 **막히거나 반복된다** — 이번 사이클(⑤)에서 고친다 |
| MED | 6 | 지침이 갈리거나 거짓 안내다 — 수정안 있음, 사용자 확정 뒤 적용 |
| LOW | 5 | 컨텍스트 점유·문구 — 적용해도 되고 미뤄도 된다 |
| 보류 | 3 | 사용 근거가 없어 지금은 판정 불가 — 시험 제안만 |

같은 원인은 묶었다. **필수 테스트 · 독립 리뷰 게이트 · 보안 · 데이터 보호 · 배포 승인은 어느 항목도
약화하지 않는다** — 문턱을 옮기는 것과 게이트를 없애는 것은 다르다.

---

## Ⓐ 무조건 지시 → 불필요한 질문·반복 검증

### F-01 [HIGH] 코드 리뷰 문턱이 세 층에 세 값으로 적혀 있다 (#424 · #423)

| 층 | 원문 |
|---|---|
| `templates/agents/code-reviewer.md` descriptor | *"Use immediately after writing or modifying code. **MUST BE USED for all code changes.**"* |
| 앵커 §4 (전역 6원칙) | *"Independent review by an agent that did not author the work is required … **before declaring an implementation complete**, and before deployment."* + *"Scale review depth to the change's impact and risk; small, low-risk changes need only a focused review."* |
| `templates/rules/ship-checklist.md`(Delivery) | *"**머지 전**: 변경 위험에 맞는 검증을 실행하고 결과를 확인한다"* · *"완료 판정은 … 검증자가 내린다"* |

**문제 상황**: 가장 넓은 문(descriptor)으로 읽으면 CSS 한 줄 수정에도 리뷰 에이전트가 뜬다. 구현자가
돌린 테스트·브라우저 확인 위에 한 겹이 더 붙고, 씬을 이루는 수정 5건이면 리뷰 5회다. 앵커는
"완료 선언 전"이라 하고 룰은 "머지 전"이라 하는데 descriptor 만 "매 변경"이다. 세 값 중 descriptor
가 가장 세고 가장 근거가 약하다(ECC 원본 문구 그대로).

**확정된 현재 의도** (#424 본문 · #423 본문, 사용자 작성):
1. 구현 중에는 변경 부분의 빠른 검사만 한다.
2. 씬의 수정분을 모아 독립 검토한다.
3. 수정이 끝난 뒤 통합 테스트 · 빌드 · 실제 사용자 흐름을 검증한다.
- 머지 전 독립 검증 = **핵심 사용자 기능 · 되돌리기 어려운 것 · 돈·권한처럼 틀리면 큰 사고**만.
  UX 큰 변경은 페르소나 리뷰(선택). 나머지(테스트 하네스 · 문서 · 리팩터 · 문구 · UI · 리뷰어 처방)는
  리그레션 테스트. 배포 시점은 배포 게이트가 풀 테스트 · E2E · 독립 검증.
- 필수 보안 · 데이터 보호 검사는 유지.

**수정안**
- `code-reviewer.md` descriptor(배포판 · 이 리포 사본 둘 다):
  > Expert code review specialist for quality, security, and maintainability. Use when a user
  > scene's changes are complete and collected for review, or before merging shared work — not
  > after every edit. Skip for reversible, low-impact changes covered by regression tests.
- Delivery 룰 "머지 전" 항목을 아래로 교체:
  > - **검증의 리듬**: 구현 중에는 변경 부분의 빠른 검사만. 사용자 씬의 수정분이 모이면 그때
  >   독립 검토. 수정이 끝난 뒤 통합 테스트 · 빌드 · 실제 사용자 흐름. 작은 수정마다 전체 검증을
  >   반복하지 않고, 재검사는 영향받은 부분만.
  > - **머지 전 독립 검증**은 핵심 사용자 기능 · 되돌리기 어려운 변경 · 돈·권한처럼 틀리면 사고인
  >   것에 건다. 그 밖(테스트 하네스 · 문서 · 리팩터 · 문구 · UI)은 리그레션 테스트로 들어온다.
  >   high risk 는 더 많은 증거를 갖고 들어오고, **실행하지 않은 상태는 통과가 아니다.**
- Testing 룰 첫 항목의 *"whatever independent verification it warrants"* → *"independent verification
  only where the Delivery rule requires it"* (문턱의 SSOT 를 한 곳으로).
- 앵커는 사용자 문안이라 **손대지 않는다**. "before declaring an implementation complete" 는 씬
  완료와 같은 뜻으로 읽힌다.

**보존되는 것**: 배포 전 독립 리뷰 · 완료 판정은 검증자 · 보안 검사 · 실행 안 한 상태는 통과 아님.

### F-02 [MED] AGENTS 껍데기의 "즉시 commit" — 앵커에도 룰에도 없는 무조건 리듬

| 원문 (`templates/codex/AGENTS.md.template` · `opencode/…` 동일) |
|---|
| *"## Git Policy — 코드/문서 변경 시 **즉시 commit**. '나중에 한꺼번에' 금지. `main` 직접 커밋 금지. Conventional Commits …"* |

**문제 상황**: Codex·OpenCode 설치자의 에이전트만 매 수정마다 커밋한다(Claude Code · Antigravity
설치자는 이 줄을 받지 않는다 — 같은 하네스가 CLI 마다 다른 리듬을 준다). 씬 단위로 모아 검토하는
F-01 과 정면으로 어긋난다. "main 직접 커밋 금지 · Conventional Commits" 는 `git-policy` 룰이
같은 파일 §Harness Rules 로 이미 들어온다 — 사본이다.

**수정안**: 두 템플릿에서 `## Git Policy` 절 삭제. 근거 위치는 룰. (Antigravity 템플릿에는 애초에
없다 — 없어도 되는 것의 증거.)

### F-03 [MED] AGENTS 껍데기의 "매 세션 SPEC 재참조" 두 번 + 없는 파일 지목

| 원문 |
|---|
| *"## Session Start — 매 세션 시작 시: 1. `docs/SPEC.md` 및 `docs/specs/*.md` 재참조 (Persistent Anchor) 2. `docs/todo.md` 현재 Phase 확인"* |
| *"## Context Management — SPEC/PRD 매 세션 시작 시 재참조 (Persistent Anchor)"* |

**문제 상황**: 같은 지시가 한 파일에 두 번 있고, 새로 깐 프로젝트에는 `docs/SPEC.md` 도
`docs/todo.md` 도 없다 — 에이전트가 없는 파일을 찾거나 "SPEC 이 없다"고 묻는다. 우리 하네스의
`session-start.sh` 는 **SPEC 이 있을 때만** 안내한다(조건부) — 훅이 이미 옳게 하는 일을 프로즈가
무조건으로 덮어쓴다. `docs/specs/*.md` · Codex `Issue #16732` · `child_agents_md` 는 이 리포의 이력이다.

**수정안**: 두 템플릿에서 `## Session Start` · `## Context Management` 절 삭제. 조건부 안내는 훅에
남는다(Codex 는 `session_start` 훅, OpenCode 는 없음 — OpenCode 설치자는 SPEC 안내를 잃는다. 대신
`opencode.json` `instructions` 가 SPEC 문서를 얹으므로 실손실은 없다).

### F-04 [보류 · 사용자 확정 필요] `task-brief` 가 전 트랙 기본 + 매 프롬프트 넛지 + 상시 안내

| 표면 | 원문 |
|---|---|
| 상시 스킬 안내(설치기 생성) | *"`task-brief` — normalize an incoming work request into the brief shape **before starting** …"* |
| `task-brief-nudge.sh` (UserPromptSubmit, 매 프롬프트) | *"[task-brief] 긴 요청인데 `<objective>` 블록이 없다 — 착수·위임 전에 task-brief 스킬로 브리프 정규화를 고려하라"* |
| 앵커 §4 | *"Routine changes do not require a formal planning document."* |

**문제 상황**: 설치자가 긴 요청을 하나 던질 때마다 에이전트가 브리프를 먼저 써서 보여준다 — 한 라운드가
는다. 스킬 본문 Do-NOT 이 한 줄 질문은 제외하지만 "긴 요청"은 전부 걸린다. **이 리포에서는 사용자가
2026-08-03 에 확정한 방식이다** — 설치자 전원의 기본값으로도 맞는지는 사용자만 정할 수 있다.

**선택지**: ⓐ 그대로(사용자 확정 존중) ⓑ 안내 문장에 "for multi-part requests; skip one-line asks"
를 붙여 스킬 Do-NOT 과 같은 문턱을 명시 ⓒ `task-brief` 를 any-track 기본에서 opt-in 으로.

---

## Ⓑ 지침 충돌 · 바뀐 결정 · 낡은 해석

### F-05 [MED] "DO NOT EDIT lock 파일 — 보고만" 이 의존성 작업을 막는다

| 원문 (AGENTS 껍데기 3종 공통) |
|---|
| *"## Protected Files (DO NOT EDIT) … `*.lock`, `package-lock.json`, `pnpm-lock.yaml`, `poetry.lock`, `Cargo.lock`, `uv.lock` … 보호 영역 이슈 발견 시 **보고만**. 직접 수정 금지."* |

**문제 상황**: 의존성을 추가하면 lock 파일이 바뀐다. 문자 그대로 따르면 에이전트가 `npm install
<pkg>` 를 거부하거나 매번 묻는다. Claude Code 쪽 `protect-files.sh` 는 **손편집(Write/Edit)** 만
막고 패키지 매니저 실행은 막지 않는다 — 훅의 뜻은 "손으로 고치지 마라"인데 프로즈는 "만지지 마라"다.

**수정안**: *"lock 파일은 손으로 고치지 않는다 — 패키지 매니저로 재생성한다. `.env*` · credentials ·
`.git/` 내부 · 전역 설정은 보고만."*

### F-06 [MED] AGENTS 껍데기가 깔리지 않는 에이전트를 광고한다

| 원문 (`codex` · `opencode` 템플릿) |
|---|
| *"## Agents — reviewer(opus) · data-analyst · strategist · code-reviewer(sonnet) · security-reviewer … subagent 호출은 `spawn_agent / wait_agent / close_agent` 툴"* |

**문제 상황**: 에이전트 파일은 **Claude Code 개발 트랙에만** 깔린다(`manifest.ts` `DEV_AGENTS`).
Codex 설치자의 `AGENTS.md` 는 존재하지 않는 `reviewer` 를 `spawn_agent` 하라고 안내한다 — ADR-052 가
CRITICAL 로 기록한 "advertised ≠ real" 형태 그대로다. OpenCode 는 `opencode.json` 에 `code-reviewer`
만 subagent 로 정의돼 있어 표의 5종 중 1종만 실재한다(확인: `templates/opencode/opencode.json.template`).
모델 열(opus · sonnet)은 Claude 모델명이라 Codex/OpenCode 에서 뜻이 없다.

**수정안**: 두 템플릿에서 `## Agents` 절 삭제(OpenCode 는 실재하는 `code-reviewer` 한 줄만 남기거나
`opencode.json` 이 SSOT 이므로 삭제). 에이전트 위임의 원칙은 앵커 §6 에 있다.

### F-07 [MED] `model-orchestration` 이 다른 벤더 CLI 에서 존재하지 않는 모델·노브를 정책 위반으로 만든다

| 원문 (`templates/skills/model-orchestration/SKILL.md`) |
|---|
| *"core implementation … go to **Opus at xhigh** or above; repetitive/simple implementation goes to **Sonnet at high** … **Never delegate below the effort floors.**"* · *"Delegating below a floor is a policy violation, not a tuning choice."* |

**문제 상황**: opt-in 이지만 어느 트랙에서든 고를 수 있고, 고르면 상시 안내가 매 위임마다 이 스킬을
연다. Codex(GPT) · Antigravity(Gemini) 설치자에게 "Opus xhigh" 는 없는 선택지라 에이전트가 정책
위반을 피할 방법이 없다 — 2판 감사 스킬의 verification.md 가 *"Do not prescribe an unverified model
name or CLI flag"* 라고 적는 바로 그 형태다.

**수정안**: 스킬 본문 머리에 한 문단 — *"이 정책은 역할 분리(오케스트레이터 ≠ 구현 ≠ 검증)와
'검증은 낮은 티어에 안 준다'가 본체다. 모델명·effort 는 Claude Code 기준이고, 다른 CLI 에서는 그
벤더의 최상위/중간 티어로 같은 분리를 적용한다."* 카탈로그 descriptor 도 같은 한 줄.

### F-08 [LOW] `reviewer` 에이전트의 숫자 문턱이 앵커 §3 "local style" 과 갈린다

| 원문 (`templates/agents/reviewer.md`) | 앵커 §3 |
|---|---|
| *"함수 길이 ≤ 50줄인가? 파일 길이 ≤ 800줄인가? 중첩 깊이 ≤ 4레벨인가?"* | *"Change what the task and its verification require. Leave unrelated cleanup alone, **match local style**"* |

**문제 상황**: 60줄짜리 함수를 가진 저장소에서 리뷰어가 매번 "50줄 초과"를 낸다 — 차단 소견처럼
읽히고 무관한 리팩터를 유발한다. **수정안**: 숫자 세 줄을 *"이 저장소의 관례에 비해 눈에 띄게
긴가"* 로. 본문의 *"Anthropic Harness Design 연구의 핵심 발견 …"* 한 줄은 이력이라 삭제(Ⓓ).

---

## Ⓒ 증분 가치 없는 원칙·스킬 (현재 모델에 필요 없는 것)

### F-09 [보류] `strategic-compact` — 매 Write/Edit 마다 도는 훅

`templates/settings.json` 이 `PreToolUse Write|Edit` 에 `suggest-compact.sh` 를 async 로 건다. 출력은
*"[StrategicCompact] N tool calls reached — consider /compact"* 뿐이다. Claude Code 의 자동 컴팩션과
1M 컨텍스트 세대에서 **행동을 바꾼다는 관측이 없다**(차단 로그 대상도 아니다). 그러나 "사용 기록이
없다"는 "가치가 없다"가 아니다(감사 규율). **제안**: 훅 배선만 빼고 스킬은 두는 시험을 한 릴리즈
돌리고, 사용자가 `/compact` 를 스스로 부르는지로 판정.

### F-10 [보류] `continuous-learning-v2` — 관측 훅이 배선되지 않은 채 상주

스킬 디렉터리에 `hooks/observe.sh` · `agents/observer-loop.sh` 가 있는데 `templates/settings.json` 은
그것을 걸지 않는다(확인: settings 에 `continuous-learning` 0건). descriptor 235자가 매 세션 상주하며
"observes sessions via hooks" 라고 말하지만 관측은 일어나지 않는다. **제안**: 배선하거나(그러면 매
툴 호출 관측 비용) 스킬을 opt-in 으로 내리거나. 판정에 사용자 의도가 필요하다.

### F-11 [LOW] `spec-scaling` — "SPEC 이 300줄을 넘으면 나눠라"

한 문장짜리 판단이고 현 세대 모델이 스스로 한다. descriptor 195자 상주. **제안**: retire 후보.
대체 커버 = 없음(필요 없다).

---

## Ⓓ 결정 이력·근거가 상주 본문을 점유

### F-12 [MED] AGENTS 껍데기의 메타·이력 — 설치자와 무관한 이 리포의 사정

| 원문 (codex 템플릿; opencode 유사) |
|---|
| *"Generated from: `templates/CLAUDE.md` via `scripts/claude-to-codex.sh` (Phase C) · Codex Version: 0.124.0+ · Linked SPEC: `docs/specs/codex-compat.md`"* |
| *"## Hooks 현황 (Codex 0.124.0 실측 제약) — `pre_tool_use` … Bash 툴 한정 발화 (Issue #16732) … 인터랙티브 세션 hook 로딩 bug (Issue #17532)"* |
| *"## Experience Accumulation — Codex `memories` feature (experimental) …"* · *"`child_agents_md` feature flag는 under development, disabled"* |
| *"이 문서는 자동 생성됨. 수동 편집 시 `scripts/claude-to-codex.sh` 재실행이 덮어쓸 수 있음."* (그 스크립트는 없다 — TS transform 이 한다) |

**문제 상황**: 설치자의 `AGENTS.md` 가 우리 리포의 SPEC 경로 · 이슈 번호 · 실측 날짜 · 존재하지
않는 스크립트 이름을 매 세션 상주시킨다. Codex 는 `AGENTS.md` 합계 32 KiB 에서 읽기를 멈추므로
이 줄들은 설치자 자기 지침의 자리를 먹는다. **수정안**: 껍데기를 프로젝트 맥락 · Project Rules ·
Harness Rules · Protected Files(F-05 문안)만 남기고 나머지 절과 머리말 메타 삭제. 예상 −1.5 KB
(codex 3,408 B 중). 남길 것은 *"Codex 는 합친 크기 32 KiB 에서 읽기를 멈춘다"* 한 줄 — 설치자가
자기 규칙을 더 쓸 때 실제로 필요한 사실이다.

### F-13 [LOW] 스킬 descriptor 7종이 1,000자 근처에서 "왜"를 싣는다

`audit-service-gaps` 1,003 · `clear-korean-communication` 1,012 · `external-model-consult` 1,016 ·
`model-orchestration` 1,026 · `gh-issue-workflow` 987 · `north-star` 974 · `task-brief` 997. 상한
1,024 안이고, ADR-083 이 *"발화 표면은 깎으면 안 불린다"* 고 정했다(#333 에서 트리거 6개 소실 실측).
**판정: 유지.** 기록만 남긴다 — 다음에 줄일 때는 트리거 문구가 아니라 rationale 절만.

---

## Ⓔ 사용 장면 기준 구현 · 비례 검증 · 위임

### F-14 [HIGH] 씬 단위 리듬이 어느 룰에도 없다 — F-01 의 착지점

Delivery 룰은 "머지 전 · 배포" 두 시점만 말하고, Testing 룰은 "how far" 만 말한다. #424 의 3단계
리듬(변경부 빠른 검사 → 씬 모아 독립 검토 → 통합·빌드·실사용 흐름)은 어디에도 없다. F-01 수정안의
Delivery 문안이 이것을 넣는다. 벤더도 같은 말이다(OpenAI GPT-6 Astra 안내: *"broaden or repeat
testing only when new changes, failures, or unresolved concerns justify it"* — `docs/research/vendor-signals.md`).

### F-15 [LOW] `reviewer` 에이전트가 diff 를 입력으로 받는다 — 씬을 입력으로 받아야 모아 검토가 된다

본문 Step 1 이 `git diff --staged · git diff · git log -10` 이다. 씬 단위 검토는 "이 씬의 완료 기준
+ 그 씬을 이루는 변경분"을 받아야 한다(앵커 §4: *"Give the reviewer the original request, constraints,
completion criteria, actual artifacts"*). **수정안**: Step 1 머리에 *"입력 = 사용자 씬과 완료 기준.
diff 는 그 씬의 범위에서 읽는다"* 한 줄.

---

## 이 리포 자체 (2차 대상, `.claude/` · 루트 `CLAUDE.md`)

| ID | 내용 | 판정 |
|---|---|---|
| R-01 | `.claude/agents/code-reviewer.md` — 배포판과 같은 *"MUST BE USED for all code changes"* | F-01 과 같은 수정 |
| R-02 | `.claude/rules/test-policy.md` §시점별 검증 "머지: … 독립 에이전트 리뷰 필수" · `ship-checklist` "Review 게이트" | #423 의 문턱(핵심 사용자 기능 · 되돌리기 어려운 것 · 돈·권한)을 이 리포 룰에도 넣는다. 배포 게이트는 그대로 |
| R-03 | `.claude/CLAUDE.md` *"전례 — v26.138.0 거짓출하 … v26.128.0~131.0 … v26.127.0 … ADR-053"* 문단 · 루트 `CLAUDE.md` 함정 3 의 이탤릭 이력(*"이 줄은 원래 … 거짓이었다 … HIGH 로 잡혔다"*) | 이력. ADR·plan 링크 한 줄로 내린다. 룰의 사례표(change-management 3행)는 재발 계수기라 **유지** |
| R-04 | `.claude/hooks/mcp-pre-exec.sh` — 루트 `CLAUDE.md` 가 사용자 적발(*"항상 실행하는 게 제품 취지에 맞나"*)을 기록하고 A2 백로그가 강등을 예정 | 보류. 사용자 결정 |
| R-05 | 루트 `CLAUDE.md` 의 task-brief · clear-korean-communication 상시 규율 | **유지** — 사용자 확정 2026-08-03 · 2026-08-03. 감사 대상 아님 |

## 확인만 하고 문제 없음으로 판정한 것

- 룰 6종 상호 충돌: **없음.** Testing ↔ Delivery 는 "how far / when" 으로 역할이 갈려 있다.
- 앵커(전역 6원칙) ↔ 룰: 승인 경계(§6 ↔ Git Safety) · 독립 리뷰(§4 ↔ Delivery) 일치.
- 훅 3종: `protect-files`(손편집 차단) · `session-start`(조건부 안내) · `task-brief-nudge`(한 줄) —
  차단 계약 준수, 이력 없음.
- 스킬 descriptor 28종에 "always" 류 무조건 발화 요구: **없음**(상시 3종은 설치기 안내로 이동 완료).

## 적용 순서 제안 (⑤)

1. **F-01 + F-14 + R-01 + R-02** — 리뷰 문턱 통일(#424 · #423). 사용자 문안 그대로.
2. **F-02 · F-03 · F-06 · F-12 · F-05** — AGENTS 껍데기 3종 정리(한 PR, 렌더 게이트 · Codex 크기 게이트 확인).
3. **F-07 · F-08 · F-15** — 스킬·에이전트 본문 한 문단씩.
4. **F-04 · F-09 · F-10 · F-11 · R-03 · R-04** — 사용자 결정.
