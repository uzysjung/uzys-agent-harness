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

## Phase 2a — 룰 배선 (완료, PR 1)

- [x] `.uzys-agent-harness/` 검사 도구 2종을 CLI 무관 설치로 — 룰이 가리키는 도구가 룰보다 먼저
      도달해야 한다(안 그러면 룰 확산이 거짓 안내를 함께 확산시킨다)
- [x] `playwright-launch` → `ui-visual-review` 스킬 흡수. 금지문 소실은
      `tests/browser-prohibitions-owner.test.ts` 가 막는다(음성 대조 4/4 red)
- [x] `cli-development` 의 훅 차단 계약을 4 CLI 전부로 — 그 한 줄이 3 CLI 에서 거짓이었다
- [x] 룰 6종 → Antigravity `.agents/rules/` · OpenCode `.opencode/rules/` · Codex `AGENTS.md` embed
- [x] `opencode.json` `instructions` 글롭이 실재하는 디렉터리를 가리킨다 (#300 본체)
- [x] 도달 회귀 게이트 `tests/resident-reach-4cli.test.ts` (14 tests, 음성 대조 5/5 red)
- [x] ADR-071 신설 · ADR-070 Superseded · NORTH_STAR 수치 + cost baseline 동기화
- [x] `npm run ci` exit 0 — 95 files · 1,362 tests

**실측 변화**: 룰 도달 codex/opencode/antigravity **0/5 → 5/5**. Claude Code 설치자 상주
~4,944 → **~4,968 tok**(+24, 전부 훅 계약 네 벌 명시).

## Phase 2b — 훅 배선 (다음 PR)

- [ ] Codex 죽은 배선 수정 — `config.toml` 이 `uncommitted-check.sh` 를 선언하는데 transform 이
      깔지 않는다(`HOOK_NAMES` 하드코딩 1개)
- [ ] 남긴 훅 4종을 4 CLI 네이티브 배선으로: Codex `[[hooks.*]]` · OpenCode
      `.opencode/plugins/*.js`(훅에서 `throw`) · Antigravity `.agents/hooks.json`(`decision: "deny"`)
- [ ] 훅 도달 회귀 게이트

## 이월

- **도구 안내 3곳을 층 3 으로** — `git-policy` §Enforcement · `ship-checklist` 의
  `spec-drift-check.sh` 줄 · `doc-governance` 의 검사기 문단. 원칙이 아니라 설치 사실이라 층이
  다르지만, 지금은 도구가 4/4 도달하므로 **거짓은 아니다**. 옮길 자리 설계가 별건.
- **Antigravity glob 활성** — 문서가 모드의 존재만 말하고 frontmatter 문법을 공개하지 않아
  `paths:` 를 벗겨 상시 룰로 보냈다. 문법이 확인되면 `cli-development` 를 다시 조인다.
- **실 CLI 가 그 자리를 실제로 읽는가** — 배선·도달은 실설치로 증명했지만 실 CLI 인식은 미검증
  (호스트 실행 차단 → Docker 격리 필요).
