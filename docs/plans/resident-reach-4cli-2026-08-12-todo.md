# 상주 3층을 4 CLI 전부에 — 조사와 판정

- 시작: 2026-08-12 · 이슈 #300 을 흡수·확장
- 원칙(사용자 확정 2026-08-12): **룰은 대원칙** — AI 가 그 아래에서 프로젝트별 규칙을 스스로
  세워갈 수 있게 한다. **훅은 결정론적으로 반드시 강제해야 하는 것만** — AI 작업의 걸림돌이
  되어서는 안 된다. 그리고 **어떤 CLI 로 설치하든 도달해야 한다.**

## Phase 0 — 실측 (완료)

### ⓐ 4 CLI 단독 설치가 실제로 받는 것

프로브: `runInstall`, `--track tooling`, 임시 디렉터리 4개. 탐지 문자열은 배포 룰 본문에서 뽑고
**앵커에는 없음을 별도 단언으로 먼저 확인**(canary 자기검증 통과). 스크립트는 세션 스크래치패드의
`probe-reach.test.ts`.

| 층 | Claude Code | Codex | OpenCode | Antigravity |
|---|---|---|---|---|
| 앵커(대원칙 본문) | ✅ | ✅ | ✅ | ✅ |
| 룰 7종 | 6개 | **0** | **0** | **0** |
| 훅 | 5 | 1 | **0** | **0** |
| 스킬 | 16 | 10 | 10(커맨드 변환) | 10 |
| fill 스캐폴드 6섹션 | ✅ | ✅ | ✅ | ✅ |
| 총 설치 파일 | 80 | 16 | 15 | 14 |

**룰과 훅만 한 CLI 에 편중돼 있다.** 스킬과 스캐폴드는 이미 4/4 다.

### ⓑ 각 CLI 의 룰·훅 수용 능력 (전부 지원 — 공백은 우리 선택이다)

| CLI | 룰 위치 | 훅 배선 | 훅 차단 방식 |
|---|---|---|---|
| Claude Code | `.claude/rules/*.md` | `.claude/settings.json` `hooks` | `exit 2` + stderr |
| Codex | 전용 디렉터리 없음 — `AGENTS.md` 본문이 유일 경로 | `.codex/config.toml` `[[hooks.*]]` | Claude 와 거의 1:1 (ADR-002 실측) |
| OpenCode | `opencode.json` `instructions` 글롭 — **임의 경로 지정 가능** | `.opencode/plugins/*.js` | 훅 함수에서 `throw new Error()` |
| Antigravity | `.agents/rules/*.md` (워크스페이스 룰) | `.agents/hooks.json` | JSON `decision: "deny"` |

출처: [OpenCode Plugins](https://opencode.ai/docs/plugins/) · [Antigravity Hooks](https://antigravity.google/docs/hooks) ·
[Antigravity Rules](https://antigravity.google/docs/rules-workflows) · ADR-002(Codex 훅 실측).

### ⓒ 조사 중 나온 결함 2건

1. **Codex 설치본이 존재하지 않는 훅을 가리킨다.** `.codex/config.toml` 이 `[[hooks.post_tool_use]]`
   로 `.codex/hooks/uncommitted-check.sh` 를 선언하는데, transform 은 `HOOK_NAMES = ["session-start"]`
   하드코딩이라 그 파일을 **깔지 않는다**(실물은 `templates/codex/hooks/` 에 방치). 프로브로 확인:
   선언 2건 중 1건 파일 부재.
2. **OpenCode 훅이 사라진 경위** — `templates/opencode/.opencode/plugins/uzys-harness.ts`(훅 3종)는
   커밋 `033aff1` "remove the uzys 6-Gate workflow entirely (#189)" 에서 함께 삭제됐다. 플러그인
   본문이 6-Gate 단계 의존성을 강제하던 것이라 내용은 수명이 다한 게 맞지만, **훅 배선 자체가
   같이 사라졌고 아무도 대체하지 않았다.**

## Phase 1 — 판정 (사용자 결정 대기)

판정 기준 세 가지: **대원칙인가**(모든 프로젝트·모든 CLI 에 참) · **결정론적인가**(판단 없이
매번 같은 답) · **걸림돌인가**.

### 룰 7종

| 룰 | 성격 | 판정 |
|---|---|---|
| `test-policy` | 전부 대원칙 | **대원칙 → 4 CLI** |
| `change-management` | 전부 대원칙 | **대원칙 → 4 CLI** |
| `git-policy` | 대원칙 + 도구 안내 1문단(`protect-branch.sh`) | 대원칙 → 4 CLI · **도구 안내는 층 3 으로** |
| `ship-checklist`(Delivery) | 대원칙 + 도구 안내 1줄(`spec-drift-check.sh`) | 동일 |
| `doc-governance` | 대원칙 3줄 + 도구 안내 1문단 | 동일 |
| `cli-development`(Shell Safety) | 셸 대원칙 + **Claude 전용 훅 계약 1줄** | 대원칙 → 4 CLI(`paths:` 조건부 유지) · **훅 계약 줄은 CLI 별로 달라 그대로 내보내면 3 CLI 에서 거짓** |
| `playwright-launch` | 트랙 전용 · 매우 구체적 · 본문이 스스로 "절차는 `ui-visual-review` 스킬이 SSOT" 라고 적음 | **대원칙 아님** — 층 3 또는 스킬로 |

**판정 중 드러난 것**: 룰 안에 성격이 다른 두 가지가 섞여 있다 — 대원칙과, **"이 하네스가 설치해
둔 도구가 있다"는 설치 사실**(3곳). 후자는 본문이 스스로 *"스스로는 존재를 알 수 없으므로 여기
적는다"* 고 자백한다. 그건 원칙이 아니라 **그 프로젝트의 사실**이라 층 3(프로젝트 컨텍스트)에
속한다.

### 훅 4종

| 훅 | 하는 일 | 결정론적 | 걸림돌 | 판정 |
|---|---|---|---|---|
| `protect-files` | `.env*`·lock·인증서 Write/Edit **차단** | ✅ 경로 매칭 | 낮음 | **남긴다 → 4 CLI 배선** |
| `mcp-pre-exec` | MCP allowlist + 위험 패턴(`rm -rf`·`curl\|sh`) **차단** | ✅ | allowlist 켠 경우만 | **남긴다** (allowlist 는 opt-in 유지) |
| `session-start` | SPEC 안내 + 고아 프로세스 감지 (차단 없음) | ✅ | 없음(출력만) | **남긴다 → 4 CLI**. 강제가 아니라 컨텍스트 주입 |
| `task-brief-nudge` | 긴 프롬프트에 넛지 1줄 (차단 없음) | ✅ | 없음 | **사용자 결정** — 유일하게 "없어도 되는" 후보 |

## Phase 1 결정 (사용자, 2026-08-12)

1. **각 CLI 네이티브 룰 자리에** 배선한다 (앵커 흡수 아님 — AI 가 프로젝트별 룰을 추가할 자리가
   남아야 한다).
2. `task-brief-nudge` 훅은 **남기고 4 CLI 배선**한다.
3. `playwright-launch` 는 **스킬로 흡수**한다.

## Phase 2a — 룰 배선 (완료, PR #304)

- [x] `.uzys-agent-harness/` 검사 도구 2종을 CLI 무관 설치로 — 룰이 가리키는 도구가 룰보다 먼저
      도달해야 한다(안 그러면 룰 확산이 거짓 안내를 함께 확산시킨다)
- [x] `playwright-launch` → `ui-visual-review` 스킬 흡수. 금지문 소실은
      `tests/browser-prohibitions-owner.test.ts` 가 막는다(음성 대조 4/4 red)
- [x] `cli-development` 의 훅 차단 계약을 4 CLI 전부로 — 그 한 줄이 3 CLI 에서 거짓이었다
- [x] 룰 6종 → Antigravity `.agents/rules/` · **Codex·OpenCode 는 공유 `AGENTS.md` embed**
- [x] `opencode.json` `instructions` 가 없는 경로를 가리키지 않는다 (#300 본체)
- [x] 도달 회귀 게이트 `tests/resident-reach-4cli.test.ts` — 단독 4 + 조합 3 + update 4
- [x] **독립 리뷰 반영** (CRITICAL 2 · HIGH 3 · MEDIUM/LOW 일부). 아래 §리뷰 결과
- [x] ADR-071 신설 · ADR-070 Superseded · NORTH_STAR 수치 + cost baseline 동기화
- [x] `npm run ci` exit 0 — 96 files · 1,381 tests

**실측 변화**: 룰 도달 codex/opencode/antigravity **0/6 → 6/6**. Claude Code 설치자 상주
~4,944 → **~4,968 tok**(+24, 전부 훅 계약 네 벌 명시).

## 리뷰 결과 (독립 검증, 2026-08-12)

리뷰 전문 = 세션 스크래치패드 `review-reach-4cli.md`. 잡힌 것 중 **내 게이트가 못 본 것**만:

| 등급 | 지적 | 처리 |
|---|---|---|
| CRITICAL | `codex+opencode` 조합에서 Codex 룰 0종 — 같은 `AGENTS.md` 를 덮어썼다 | 두 렌더러가 같은 본문을 넣도록 통일. 조합 설치 3종을 게이트에 추가 |
| CRITICAL | `update` 가 룰을 지우고 · 기존 설치자는 새 룰을 영영 못 받고 · 비 Claude 단독은 update 자체가 throw | 셋 다 수정. update 경로 4종을 게이트에 추가 |
| HIGH | 금지문 게이트 4개 중 **3개가 장식**(needle 이 흔한 토큰) | needle 을 고유 문장으로 + "문서 전체에서 1회" 자기검증. 음성 대조 4/4 red |
| HIGH | 도달 게이트가 **위치를 안 본다** — CLI 가 읽지 않는 자리로 내보내도 green | CLI 별 목적지 판정 추가. 변이 red 확인 |
| MEDIUM | Codex 32 KiB 는 **합계** 예산인데 한 파일만 쟀다 | 비증가 ratchet 으로 재정의 + 실측 68% 명시 |
| LOW | `stripClaudeFrontmatter`·h1→h2 에 게이트 0 | `tests/rules-port.test.ts` 신설 |

**리뷰가 "문제 없음"으로 확인한 것**: 하한 완화(5→3, 8→7)는 `main` 대조로 정당 · 금지문 본문
손실 0 · 룰 4/4(단독) · 도구 4/4 · `.claude/` 미생성 계약 유지 · 수치 정합.

### 2차 (재검증) — CRITICAL 0, 신규 HIGH 1

리뷰 전문 = `review-reach-4cli-r2.md`. CRITICAL 2건은 **변이로 닫힘 확인**(조합 7종 전부 6/6,
update 4경로 전부 유지). 대신 내 수정이 회귀를 하나 만들었다:

| 등급 | 지적 | 처리 |
|---|---|---|
| HIGH | update pre-flight 를 푼 대가 — 비 Claude 단독 설치가 update 경로에 처음 도달하며 **Claude 전용 루트 파일 2개**를 만들었다 | 앵커 동기화를 `.claude/` 존재로 게이팅. 증거를 로그가 아니라 디렉터리로 둔 이유 = 레거시 설치본의 앵커 이행이 죽는다 |
| MEDIUM | `createInRefresh` **불변식이 무보호** — 조건을 true 로 고정해도 전 스위트 green | 안 깐 CLI 에 룰 디렉터리가 생기지 않는지 무는 테스트 추가 |
| MEDIUM | `.claude/` 만 지운 프로젝트에서 update 가 **반쪽 `.claude/`** 를 만든다 | claude 설치인데 `.claude/` 가 없으면 다시 막는다(재설치로 보낸다) |

셋 다 음성 대조로 red 확인. `npm run ci` exit 0 — 96 files · **1,383 tests**.

**리뷰가 남긴 최대 위험**: OpenCode 가 `AGENTS.md` 를 자동으로 읽는다는 전제에 이번 변경 **전량이
걸려 있다**(글롭을 지웠으므로). 공식 문서 + 이 저장소 호환 실측이 일치하지만 실 CLI 확인은 미검증
— Docker 격리 검증 1건이 가장 값어치 크다.

## Phase 2b — 훅 배선 (다음 PR)

### 조사 (2026-08-12) — 이벤트 모델이 CLI 마다 다르다

훅은 룰과 달리 **파일을 옮기는 것으로 끝나지 않는다.** 차단 계약과 이벤트 이름이 다 다르다.

| | Claude Code | Codex | OpenCode | Antigravity |
|---|---|---|---|---|
| 배선 | `.claude/settings.json` | `.codex/config.toml` `[[hooks.*]]` | `.opencode/plugins/*.js` | `.agents/hooks.json` |
| 입력 | stdin JSON | stdin JSON (거의 1:1, ADR-002) | 훅 함수 인자 `(input, output)` | stdin JSON — `toolCall.name` · `toolCall.args` |
| 차단 | `exit 2` + stderr | `exit 2` + stderr | `throw new Error()` | stdout JSON `{"decision":"deny","reason":…}` (**exit code 무관**) |
| 도구 이름 | `Write`·`Edit`·`Bash` | Claude 와 유사 | `write`·`edit`·`bash` | `write_to_file`·`run_command` |

**그래서 bash 스크립트를 그대로 복사할 수 있는 것은 Codex 뿐이다.** OpenCode 는 JS 플러그인이
스크립트를 실행하고 종료 코드를 `throw` 로 옮기는 어댑터가 필요하고, Antigravity 는 `exit 2` 를
`{"decision":"deny"}` 로 옮기는 어댑터가 필요하다.

**이벤트 자체가 없는 조합이 있다.** Antigravity 의 훅 이벤트는 PreToolUse · PostToolUse ·
PreInvocation · PostInvocation · Stop 다섯이다 — **SessionStart 도 UserPromptSubmit 도 없다.**
즉 `session-start` 와 `task-brief-nudge` 는 Antigravity 에 **대응 이벤트가 없다**(PreInvocation 은
매 모델 호출마다 발화해 세션 1회 안내로 쓸 수 없다). 사용자 결정은 "task-brief-nudge 를 4 CLI
배선"이었는데 이 조합은 **CLI 능력 밖**이므로, 추정으로 배선하지 않고 미지원으로 보고한다.

정리하면 4/4 가 되는 것은 **차단하는 훅 2종**(`protect-files` · `mcp-pre-exec`)이고, 이것이 마침
사용자 기준의 "결정론적으로 반드시 강제할 것"과 일치한다. 컨텍스트 주입 훅 2종은 도달 상한이
CLI 능력에 걸린다.

### 할 일

- [ ] Codex 죽은 배선 수정 — `config.toml` 이 `uncommitted-check.sh` 를 선언하는데 transform 이
      깔지 않는다(`HOOK_NAMES` 하드코딩 1개). 지금 나가고 있는 결함
- [ ] 차단 훅 2종을 Codex · OpenCode · Antigravity 에 배선(어댑터 포함)
- [ ] 주입 훅 2종은 가능한 CLI 까지만 배선하고 **미지원을 사유와 함께 명시**
- [ ] 훅 도달 회귀 게이트 — 배선이 가리키는 스크립트가 **실재하는지**까지 (죽은 배선 재발 차단)

## 이월

- **도구 안내 3곳을 층 3 으로** — `git-policy` §Enforcement · `ship-checklist` 의
  `spec-drift-check.sh` 줄 · `doc-governance` 의 검사기 문단. 원칙이 아니라 설치 사실이라 층이
  다르지만, 지금은 도구가 4/4 도달하므로 **거짓은 아니다**. 옮길 자리 설계가 별건.
- **Antigravity glob 활성** — 문서가 모드의 존재만 말하고 frontmatter 문법을 공개하지 않아
  `paths:` 를 벗겨 상시 룰로 보냈다. 문법이 확인되면 `cli-development` 를 다시 조인다.
- **실 CLI 가 그 자리를 실제로 읽는가** — 배선·도달은 실설치로 증명했지만 실 CLI 인식은 미검증
  (호스트 실행 차단 → Docker 격리 필요).
