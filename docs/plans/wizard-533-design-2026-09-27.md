# 묶음 C — 위저드 재구성 설계 (#533 · #523 · Epic #527 L5)

작성 2026-09-27 · 기준 `main` 6bd43f9 (v26.160.1) · 설계만, 코드·git 무수정.
근거는 `파일:줄` 또는 실행 출력. 문서만 읽어서는 확정되지 않는 주장은 §10 "착수 시 실측할 것"으로 뺐다.
독자 = **설치하는 사용자가 겪는 화면**. 구현은 묶음 A(`.claude/` 자리) · B(`.agents/skills` 공유 자리)가
머지된 뒤 시작한다 — A · B 가 바꾸는 것은 엔진 내부이고, 이 문서가 정하는 것은 화면 계약이다.

---

## 0. 한 문단 요약 — 설치자에게 무엇이 달라지는가

이미 깔린 프로젝트에서 `agent-harness` 를 다시 치면 지금은 다섯 항목(Add / Update policy files /
Remove[disabled] / Reinstall / Exit)이 뜨고, 각각이 무엇을 하는지 화면이 말해 주지 않는다(#523 원문).
바뀐 뒤에는 **세 항목 — Update / Uninstall / Exit** 만 뜨고, Update 는 한 흐름이다: 깔린 트랙·CLI 는
체크된 채 잠겨 있고 **더할 것만 고른다** → 자산 페이지에서 기존 것은 `● installed` 로 보이고 더 고를 수
있다 → 확인 화면이 "이번 실행이 플래그로 치면 어느 명령과 같은가"를 한 줄로 말한다. 아무것도 더하지
않았으면 `agent-harness update` 와 바이트 단위로 같은 일을 하고, 트랙·CLI·자산을 더했으면 `install
--track … --cli …` 와 같은 일을 한다. **깔린 CLI 는 화면에서 풀 수 없다**(Epic 정의 2). Reinstall 은
메뉴에서 빠져 `install --reinstall` 플래그가 되고, 기록에는 Claude 가 있는데 `.claude/` 가 없는 깨진
설치를 만나면 메뉴 위에 복구 명령 한 줄이 뜬다. Uninstall 은 이미 있는 세 엔진(전량 · `--cli <name>` ·
`--only <id>`)을 화면 하나에 올린다 — 새 삭제 엔진은 없다. `base` 트랙은 단독으로만 고른다(§5 표).

---

## 1. 근거와 범위

| 출처 | 확정된 것 |
|---|---|
| #523 (사용자 보고) | 메뉴 = Install(초기) / Update(기설치) / Uninstall / Exit · Update 에서 새 트랙을 고르면 그 트랙 기본 스킬·룰이 추가, 기존 트랙만이면 갱신, 이 과정에서 스킬 추가 선택 가능 · base 는 다른 트랙과 멀티 셀렉트 불가 |
| #533 (L5 범위) | 메뉴 Update/Uninstall/Exit · Update ① 트랙(깔린 것 체크·잠금 + 새 트랙) ② CLI(`● installed` 잠금 + 추가만) ③ 자산(기존 `● installed` + 추가) ④ 확인 · Add 와 Update 엔진 통합 · Reinstall → `install --reinstall` + 깨진 설치 한 줄 안내 · Remove 항목 삭제 · base 단독 · 문서 |
| 사용자 결정 2026-09-27 (정정판) | Uninstall 화면 = **전체 · CLI 단위(`uninstall --cli`) · 외부 자산 하나 단위(`uninstall --only <id>`)** 세 가지. 전부 기존 엔진. 근거 = 북극성 §4.2 "사용자가 외워야 하는 어휘 — 인터랙티브 prompt 로 자동 노출" |
| Epic #527 정의 1~8 | CLI 집합은 더해지기만 · 깔린 CLI 는 화면에서 풀 수 없다 · 제거는 uninstall 뿐 · CLI 추가 뒤 `audit-harness-fit` 안내(선택) |
| 북극성 §1 · §4.1 · §6.2 | 필요한 틀만 · Transparent Defaults(설치 중 무엇이 들어가는지 한 줄씩 · 숨김 동작 0) · 기본 필수 → 기능 완성도 순 |

**범위 밖**(별도 이슈): 트랙 단위 회수(새 엔진) · 번들 스킬 하나만 빼기(Epic S5 밖) · `.agents/skills` 생성(B) ·
`.claude/` 링크 자리(A) · `runUpdateMode` 가 트랙/CLI 추가를 직접 받는 진짜 단일 엔진(§9 결정 1 의 대안 ⓑ).

---

## 2. 화면 AS-IS → TO-BE

문구는 그대로 구현 문구다. `◆ ● ○ │` 는 clack 의 렌더. 첫 설치 6단계의 뼈대(트랙 → CLI → 자산 → 스코프 →
확인 → 설치)는 바꾸지 않는다 — 바뀌는 것은 base 규칙 한 줄(§2.1)뿐이다.

### 2.1 첫 설치 — Step 1 만 달라진다

```
AS-IS  Step 1/6 — Select Track(s)
       ◻ base — principles · methodology · tests only (no stack)
       ◻ tooling — Bash + Markdown meta-project
       …                                  (base + tooling 을 함께 고를 수 있다)

TO-BE  Step 1/6 — Select Track(s)
       ◻ base — no stack yet · pick it ALONE (every dev track already contains it)
       ◻ tooling — Bash + Markdown meta-project
       …
       [base 와 다른 트랙을 함께 고르고 Enter]
       ▲ base goes alone — it is already inside every dev track, so combining adds nothing.
         Pick base now and add a stack track later from the Update menu, or pick the stack track now.
       (같은 화면이 다시 뜬다 · 선택은 그대로)
```

플래그 경로도 같은 문장으로 거절한다: `install --track base --track tooling` → exit 1 + 위 두 줄.

### 2.2 기설치 — 메뉴

```
AS-IS  ◆ Existing install detected via .claude/.installed-tracks. Tracks: csr-fastapi.
       │ ● Add a new Track (Current: csr-fastapi)
       │ ○ Update policy files (auto-backup) (Refresh rules / agents / commands / hooks / skills — your edits are backed up)
       │ ○ Remove a Track (unsupported) [disabled] (Manual edit of .claude/ required — not automated)
       │ ○ Reinstall (backs up current .claude/ first) (Use when state is corrupted)
       │ ○ Exit

TO-BE  ◆ Installed here: tracks csr-fastapi · CLI claude · scope project   (record: .uzys-agent-harness/.harness-install.json)
       │ ● Update     — bring installed files to this release; add tracks, CLIs or assets on the way
       │                (nothing is removed here — your edits are backed up as *.backup-<time>)
       │ ○ Uninstall  — remove everything, one CLI, or single assets
       │ ○ Exit
```

기록이 없는 옛 설치본(`source: legacy`)은 첫 줄이 `Installed here (no record): tracks tooling · CLI unknown` 이 되고
잠금은 트랙만 걸린다(§3 D4).

### 2.3 Update 흐름 (5단계 · 스코프는 묻지 않는다)

```
Step 1/5 — Tracks   (● installed = already here, locked · check a new one to add its rules · agents · skills)
  ◼ csr-fastapi — Vite + React + FastAPI   ● installed
  ◻ tooling — Bash + Markdown meta-project
  ◻ data — Python data / DuckDB / PySide6
  ◻ base — no stack yet · pick it ALONE (every dev track already contains it)
  …

Step 2/5 — CLIs     (● installed = locked — remove one with Uninstall · check another to install its files)
  ◼ Claude Code   ● installed
  ◻ Codex (OpenAI)
  ◻ OpenCode (anomalyco)
  ◻ Antigravity (Google)

Step 3/5 — Install items  ·  Page 1/7  ·  Track baseline — Rules & Hooks
  Tracks: csr-fastapi, tooling  ·  CLIs: claude, opencode
  Selected so far: 27 items  ·  This page default ✓ 9/9
  ● installed = 이미 설치됨 · 체크 해제해도 제거되지 않는다 (제거: Uninstall 메뉴 또는 agent-harness uninstall)
  Space toggle · Enter → next · ESC → prev
  (기존 7페이지 그대로 — 새 트랙이 더한 항목은 체크된 채 마커 없이 보인다)

Step 4/5 — Confirm
  Tracks:    csr-fastapi, tooling        (+tooling)
  CLI:       claude · opencode           (+opencode · claude stays — locked)
  Assets:    16 selected                 (+2 new: tooling-… , …)
  SCOPE      Project (from your install record — not changed here)
  RUNS AS    agent-harness install --track csr-fastapi --track tooling --cli claude --cli opencode --scope project
             (adds the new track's files and the new CLI's files · refreshes what is installed · edited files → *.backup-<time>)
  Proceed?  ● Yes / ○ No

Step 5/5 — Running…
```

아무것도 더하지 않은 경우(트랙·CLI·자산 전부 그대로)의 Step 4 만 다르다:

```
Step 4/5 — Confirm
  Tracks:    csr-fastapi                 (no change)
  CLI:       claude                      (no change)
  Assets:    14 selected                 (no change)
  What to update  (space = toggle · your edits are always backed up)      ← #480 체크박스, 전부 체크
  ◼ Skills  ◼ New skills  ◼ Rules · agents · commands  ◼ CLAUDE-uzys-harness.md anchor  ◼ Hooks · settings.json  ◼ Codex / OpenCode / Antigravity + external skills
  RUNS AS    agent-harness update
  Proceed?
```

CLI 를 더한 실행이 끝나면 기존 설치 화면의 마지막 줄(`install-render.ts:331` `Project Context seeded from … · CLI 고유 표현은
audit-harness-fit 으로 맞춘다`)이 그대로 나온다 — Epic 정의 7 의 안내는 이미 엔진에 있다.

### 2.4 Uninstall 화면 (메뉴에서도, `agent-harness uninstall` 에서도 같은 화면)

```
◆ uzys-agent-harness · uninstall     installed: claude, opencode · assets 3
│ ● Remove one CLI        — that CLI's own files go; files shared with a remaining CLI stay; your text stays
│ ○ Remove selected assets — pick from the 3 external assets; templates (.claude/ etc.) stay
│ ○ Remove everything      — assets + templates + the install record. Cannot be undone

[Remove one CLI]
◆ Which CLI?  (the last remaining CLI cannot be removed this way — use "Remove everything")
│ ● Claude Code    — removes .claude/ (all of it, including your own files there) · CLAUDE-uzys-harness.md · the import block in CLAUDE.md
│ ○ OpenCode       — removes .opencode/ · opencode.json · AGENTS.md and .agents/skills/ (no other CLI uses them)

◆ Remove opencode? This is the same as: agent-harness uninstall --cli opencode
│   · .opencode/ · opencode.json           (only OpenCode uses them)
│   · AGENTS.md · .agents/skills/<harness skills>   (OpenCode was the last user — your ## Project Context stays)
│   · kept: .claude/ · CLAUDE.md · .mcp.json · install record (clis: claude)
│   Proceed? ○ Yes / ● No

[Remove selected assets]  = 기존 화면 그대로 (uninstall-interactive.ts:141-170) → `--only <ids>`
[Remove everything]       = 기존 화면 그대로 (uninstall-interactive.ts:126-139) → 플래그 없음
```

깔린 CLI 가 하나면 첫 항목은 `[disabled] (only one CLI here — use "Remove everything")`, 외부 자산이 0 이면 둘째
항목이 `[disabled] (no external assets recorded)`. 둘 다 엔진의 거절(`uninstall.ts:509-516` 마지막 CLI · `:143-155`
빈 `--only`)을 화면에서 먼저 보이는 것이고 엔진 pre-flight 는 그대로 남는다(§3 D8).

### 2.5 깨진 설치 감지 (기록에 Claude 가 있는데 `.claude/` 가 없다)

```
◆ Installed here: tracks tooling · CLI claude · scope project
│ ⚠ .claude/ is missing but the record says Claude Code is installed. Update cannot rebuild it.
│   Repair: agent-harness install --reinstall --track tooling --cli claude --scope project
│ ○ Update [disabled] (.claude/ missing — run the repair command above)
│ ● Uninstall
│ ○ Exit
```

판정은 기록 하나다: `installedClis(log) ∋ claude ∧ !existsSync(.claude/)` — 엔진이 update 를 거절하는 조건
(`installer.ts:317-328`)과 같은 술어를 화면이 먼저 보인다. 복구 명령의 트랙·scope 는 로그에서 채운다
(`update-mode.ts:1532-1538 recordClaudeCommand` 와 같은 조립, 플래그만 `--reinstall` 추가). **디스크 존재는 이
안내를 낼지 말지에만 쓰인다**(ADR-096 D6).

---

## 3. 결정 표

| # | 결정 | 근거 |
|---|---|---|
| D1 | 메뉴 = `update` · `uninstall` · `exit` 세 항목. `RouterAction` 에서 `add` · `remove` · `reinstall` 삭제 | #523 원문 · `router.ts:3,17-52`(5항목) · `interactive.ts:185-188`(remove 는 항상 "not automated" 로 중단 — 고를 수 없는 항목이 화면에 있었다) |
| D2 | 첫 줄은 **기록**을 읊는다: 트랙 · 깔린 CLI 집합(`installedClis`) · scope · 기록 위치 | `state.ts:47-66`(트랙 출처 3종) · `install-log.ts:254-266`(`installedClis` — 옛 로그 유도 포함) · 북극성 Transparent Defaults |
| D3 | Update 흐름 = 트랙 → CLI → 자산 → 확인 → 실행 5단계. **스코프는 묻지 않고 로그의 것**을 확인 화면에 보인다 | 기존 update 가 이미 로그 scope 를 쓴다(`update-mode.ts:283-303 buildUpdateSpec` "scope 는 설치 기록에서 읽는다") — 화면에서 다시 물으면 global 설치본에 project 를 섞는 길이 생긴다 |
| D4 | **잠금 = 화면 + 엔진 둘 다.** 화면은 깔린 트랙·CLI 를 `disabled` + 체크로 그린다. 엔진(`interactive.ts`)은 프롬프트가 무엇을 돌려주든 `spec.tracks = installed ∪ picked` · `spec.cli = installedClis ∪ picked` 로 합친다 | clack `Option.disabled` 는 커서를 건너뛰지만(`@clack/core` `MultiSelectPrompt` — 커서 이동 함수가 disabled 를 스킵) **`a`(toggle all) · `i`(invert) 는 enabled 항목만 남긴다** → 잠긴 항목이 결과에서 빠질 수 있다. 화면만 믿으면 Epic 정의 2 가 키 하나로 깨진다 |
| D5 | 기록이 없는 옛 설치본(`source: legacy`)은 CLI 잠금이 없다(`installedClis(null) = []`). 트랙은 메타파일/휴리스틱으로 잠근다. 첫 줄에 `(no record)` 표기 | `install-log.ts:254-255`("로그가 없으면 빈 배열 — 말할 수 없다") · `state.ts:47-58` |
| D6 | **엔진 선택은 한 함수 `classifyUpdateIntent(log, confirmed) → "refresh" \| "add"`** 가 한다. `refresh` = `buildUpdateSpec` + `mode:"update"`(비대화형 `update` 와 동일 spec, `interactive.test.ts:166` 의 `toEqual(buildUpdateSpec)` 유지). `add` = `mode:"add"` + 합집합 spec(비대화형 `install --track … --cli …` 와 동일). 확인 화면 `RUNS AS` 줄이 그 명령을 그대로 찍는다 | update 엔진은 트랙·CLI 를 **로그에서** 읽어 spec 의 추가분을 무시한다(`update-mode.ts:951-954 installedTracks` · `:1013-1016 installedCliTargets`) — 엔진을 고치지 않고 추가를 받을 길은 install 엔진뿐. 두 엔진의 차이는 §4 표 · 진짜 단일 엔진은 §9 결정 1 |
| D7 | `classifyUpdateIntent` 의 `add` 조건(하나라도): 트랙 합집합 ≠ 로그 `spec.tracks` · CLI 합집합 ≠ `installedClis` · 체크한 외부 자산 중 로그 `assets` 에 없는 것 · 트랙 baseline 해제 집합 ≠ 로그 `baselineExclude` · 번들 스킬 해제 집합 ≠ 로그 `skillExclude`. **애매하면 `add`** | 해제 기록(`baselineExclude` · `skillExclude`)은 install 엔진만 쓴다(`install-log.ts:376-380`) — update 엔진에는 해제를 남길 자리가 없다. `add` 는 기존 파일도 갱신하므로(§4) 틀리는 방향이 안전하다 |
| D8 | Uninstall 화면은 `src/uninstall-interactive.ts` **하나**를 확장한다(모드 `cli` 추가). 위저드 메뉴와 `agent-harness uninstall`(TTY) 이 같은 함수를 부른다. 자산 목록 = `installLog.assets`(`buildRemovableRows`). CLI 목록 = `installedClis(log)`. 확인 문구의 "무엇이 나가나"는 `removableFor(target, remaining)`(`cli-ownership.ts:98`)에서 만든다. 화면은 `{projectDir, cli}` / `{projectDir, only}` / `{projectDir}` 를 만들어 **`uninstallAction` 에 그대로 넘긴다** — 엔진의 pre-flight(없는 id `uninstall.ts:150-155` · 빈 목록 `:143-148` · 마지막 CLI `:509-516` · `--cli`+`--only` 조합 `:491-499`)는 화면 뒤에서 그대로 돈다 | `uninstall-interactive.ts:1-15`("선택만 한다 — 되돌리기는 uninstallAction") · 사용자 결정 2026-09-27 · 화면 하나에 판정 사본이 생기지 않는다 |
| D9 | Reinstall 은 `install --reinstall` 플래그. `MODE_ENTRY_POINT.reinstall = "install --reinstall"`. `--track` 은 여전히 필수. `.claude/` 가 없으면 `backupDir` 이 null 을 내고 첫 설치처럼 돈다 | `installer.ts:81-90`(reinstall 만 위저드 전용) · `fs-ops.ts:111-114`(`backupDir` 부재 시 null) · `tests/update-command.test.ts:199-206`(`wizardOnly = ["reinstall"]` → `[]` 로 바뀐다 — 의도된 변경) |
| D10 | 깨진 설치 = `installedClis(log) ∋ claude ∧ !existsSync(.claude/)`. 메뉴 위 ⚠ 두 줄 + Update 항목 disabled | `installer.ts:317-328`(엔진이 같은 조건으로 update 를 거절) — 거절될 항목을 고르게 두면 "install failed" 로 끝난다 |
| D11 | base 는 **어떤 트랙과도** 함께 고르지 않는다(사용자 확정). 판정은 새 모듈 `src/track-exclusivity.ts` 의 `trackSelectionError(tracks): string \| null` 하나 — 위저드 Step 1(재프롬프트) · `install.ts specFromOptions`(exit 1) 가 같은 함수를 부른다. Update 흐름에서 base 는 유일하게 **잠기지 않는** 설치 트랙이다: 다른 dev 트랙을 체크하면 base 가 선택에서 빠지고(확인 화면 `Tracks: base → csr-fastapi (base is inside csr-fastapi — nothing removed)`), business 트랙을 체크하면 재프롬프트 | §5 표 — dev 트랙 8종과의 합집합은 파일 0개 추가(base ⊂ 모든 dev 트랙) · `track-match.ts:12-18`(#456 base 는 dev 트랙) · 예외(business 트랙)는 §9 결정 2 |
| D12 | Uninstall 화면 문구는 위저드와 같은 **영어**로 통일한다(기존 `uninstall-interactive.ts` 의 한국어 문구 교체) | 메뉴·USAGE·README 가 영어. 한 흐름 안에서 언어가 바뀌는 자리를 없앤다. 되돌리기 쉬운 결정 |
| D13 | `#480` 갱신 묶음 체크박스(`selectUpdateGroups`)는 **refresh 케이스의 확인 화면에만** 나온다(전부 체크, Enter 로 통과). `add` 케이스에는 없다 — install 엔진에 묶음 개념이 없다 | `types.ts:73-83 UPDATE_GROUPS` · `interactive.ts:192-198` · 사용자 결정 2026-09-20(#480) 을 지운 것이 아니라 적용 가능한 자리에만 둔다 |
| D14 | 첫 설치 6단계 · Step 3 페이지 7장 · `● installed` 마커 규약("체크 해제 ≠ 제거")은 그대로 | `prompts.ts:166-190 INSTALL_TARGET_PAGES` · `interactive.ts:168-171` — 바꿀 이유(관측)가 없다 |

---

## 4. Add 와 Update 를 한 흐름으로 합칠 때 — 설치자 디스크에서 무엇이 달라지나

같은 "Update" 메뉴 뒤에서 두 엔진 중 하나가 돈다(D6). 설치자가 알아야 하는 차이만 적는다. 근거 =
`installer.ts:290-460`(install 경로) · `update-mode.ts:341-560`(update 경로).

| | `refresh` (= `agent-harness update`) | `add` (= `install --track … --cli …` on an existing install) |
|---|---|---|
| 언제 | 트랙·CLI·자산·해제가 기록과 **같다** | 하나라도 더했거나 해제가 바뀌었다 |
| `.claude/` 통째 백업 | A(#536) 뒤: **Claude 가 깔린 집합에 있을 때만** `.claude.backup-<ts>` 복사 | **없다**(`installer.ts:477 resolveBackupPath` — add 는 backup 없음) |
| 편집한 룰·훅·에이전트 | 기준선(sha) 대조 → 다르면 `*.backup-<time>` 뒤 최신판 | **같은 기준선·같은 규칙**(`installer.ts:654-672 backupEditedPolicyFile` — "update 와 같은 기준선") |
| 편집한 스킬 파일 | `syncSkills` 가 파일 단위 백업 | **A(#536) 가 넣는 파일 단위 백업에 의존** — 지금 main 의 `copyDir`(`installer.ts:738-745`) 은 기준선을 안 본다. §10 ① |
| 새 트랙의 파일 | 못 받는다(트랙을 로그에서 읽는다) | 받는다(manifest 합집합) — #523 이 원한 것 |
| 새 CLI 의 파일 | 못 받는다 | 받는다(`runCliTransforms` 가 `spec.cli` 합집합을 렌더) · 앵커 씨 뿌리기 + `audit-harness-fit` 안내(`install-render.ts:331`) |
| 은퇴한 룰 회수(orphan prune) · 은퇴/강등 에이전트 안내 · `.mcp-allowlist` 회수 · 개명 스킬 안내 | 한다 | **안 한다** — 다음 `refresh` 실행에서 받는다. 확인 화면 `RUNS AS` 아래 한 줄로 알린다 |
| 새 훅 배선 | 못 한다(`needsReinstall` 로 알림) | **한다**(`settings.json` 을 다시 쓴다 — 백업 뒤) |
| 외부 자산(plugin · npx skills · npm) | 기록된 것만 상류 최신판으로 refresh | 선택된 것 **전부** 다시 설치(멱등 · 네트워크) — 지금의 Add 와 같다 |
| 설치 로그 | 기준선 필드만 다시 찍는다. `spec.tracks` · `clis` 불변 | `spec.tracks` = 합집합(화면이 잠가서 줄어들 수 없다) · `clis` = 이전 ∪ 이번(`install-log.ts:367`) · `spec.cli` = 이번 요청(합집합) |
| `.claude/.installed-tracks` | 불변 | 합집합으로 다시 쓴다(`installer.ts:983-988`) |

**달라지면 안 되는 것**(불변식 — 테스트가 문다):
1. 어느 경로에서도 파일이 **지워지지 않는다**. 체크 해제는 "이번에 안 깐다"이고 제거는 Uninstall 뿐(`interactive.ts:168-171` 규약 유지).
2. `clis` 는 줄어들지 않는다(잠금 + 엔진 합집합, D4). 줄이는 경로는 `uninstall --cli` 하나(ADR-096 D5).
3. `refresh` 의 spec 은 `buildUpdateSpec(projectDir, tracks)` 와 `toEqual` — 위저드가 자체 리터럴을 갖지 않는다.
4. `add` 의 spec 은 같은 인자의 `install` 플래그가 만드는 spec 과 `toEqual`(D6 의 `RUNS AS` 줄이 그 명령).
5. 설치자 본문(루트 `CLAUDE.md` 본문 · `AGENTS.md` 의 `## Project Context`)은 두 경로 모두 A · B 이전과 같이 보존된다 — C 는 그 규칙을 건드리지 않는다.

---

## 5. base 배타의 근거 표 (실측 2026-09-27, `buildManifest` + `recommendedExternalAssets` 를 트랙별로 돌린 출력)

`base` 단독 = `.claude/` 아래 룰 5 · 에이전트 2(reviewer · implementer) · 훅 2 · 스킬 10 + 앵커 + `.uzys-agent-harness/` 스크립트 3 = 24 항목,
추천 외부 자산 10(전부 번들 스킬). 각 트랙 T 에 대해 **T ∪ base 가 T 단독보다 더 까는 것**:

| T | T 단독 (manifest / 추천) | T ∪ base 가 더 까는 것 | base 에 있는데 T 에 없는 것 |
|---|---|---|---|
| tooling | 25 / 11 | **없음** | 없음 |
| csr-supabase | 25 / 15 | **없음** | 없음 |
| csr-fastify · csr-fastapi | 25 / 13 | **없음** | 없음 |
| ssr-htmx | 25 / 11 | **없음** | 없음 |
| ssr-nextjs | 25 / 13 | **없음** | 없음 |
| data | 25 / 12 | **없음** | 없음 |
| full | 28 / 17 | **없음** | 없음 |
| **executive** | 16 / 5 | agents/implementer · rules/test-policy · rules/ship-checklist · 스킬 6(audit-service-gaps · compaction-handoff · multi-persona-review · recurrence-prevention · self-hosted-github-runner · user-centered-explanation) = **9** | 같은 9 |
| **project-management** | 15 / 4 | 같은 9 | 같은 9 |
| **growth-marketing** | 15 / 4 | 같은 9 | 같은 9 |

결론: **dev 트랙 8종과는 base 를 함께 골라 얻는 것이 0** — #533 의 명제가 성립한다(`track-match.ts:17` 의 `hasDevTrack` 에 base 가 들어
있고, base 의 자산은 전부 `all`/`dev` 조건이라 어느 dev 트랙에도 포함된다). **business 트랙 3종과는 9 항목이 더 깔린다** — 명제가 성립하지
않는다. 사용자 확정 규칙(단독 선택)은 그대로 구현하고(D11), business 예외는 §9 결정 2 로 올린다.

---

## 6. 비대화형(플래그) 경로 ↔ 화면 경로 — 같은 결과를 내는가

| 화면 | 같은 결과의 플래그 명령 | 같음의 근거 |
|---|---|---|
| 첫 설치 6단계 | `install --track … --cli … --scope … [--with/--without]` | 변경 없음(기존 파리티) · base 규칙은 양쪽이 `trackSelectionError` 하나를 부른다 |
| Update · 더한 것 없음 | `update` | spec `toEqual(buildUpdateSpec)` · 묶음 체크는 `update --only <g>` 와 같은 `updateOnly` |
| Update · 트랙/CLI/자산 더함 | `install --track <합집합> --cli <합집합> --scope <로그> [--with <새 자산>] [--without …]` | `add` spec 이 `specFromOptions` 결과와 `toEqual`(테스트) · 확인 화면 `RUNS AS` 가 그 문자열을 찍는다 |
| Uninstall · 전체 | `uninstall --yes` | 같은 `uninstallAction({projectDir})` |
| Uninstall · CLI 하나 | `uninstall --cli <name>` | 같은 `uninstallAction({projectDir, cli})` — 마지막 CLI 거절도 엔진 것 |
| Uninstall · 자산 선택 | `uninstall --only <a,b>` | 같은 `uninstallAction({projectDir, only})` — 없는 id · 빈 목록 거절도 엔진 것 |
| 깨진 설치 복구 안내 | `install --reinstall --track <로그> --cli claude --scope <로그>` | 새 플래그. `mode:"reinstall"` = 기존 위저드 Reinstall 과 같은 코드 경로(`installer.ts:477-479` rename 백업 → 첫 설치) |

플래그에만 있고 화면에 없는 것: `--verbose` · `--with-codex-trust` · `--project-dir` · `update --only`(add 케이스) · `uninstall --dry-run` ·
`--keep-templates`. 전부 지금도 그렇다 — 이번에 화면에서 빠지는 기능은 없다.

---

## 7. 문서 변경 (코드와 같은 PR)

| 문서 | 무엇을 |
|---|---|
| `docs/USAGE.md:30` | 메뉴 문단 → Update / Uninstall / Exit 설명 + "Update 가 무엇을 하나" 3줄(더하면 install 과 같다 · 더한 게 없으면 update 와 같다 · 깔린 CLI 는 풀 수 없다) |
| `docs/USAGE.md` §Non-interactive install 표 | `--reinstall` 행: "moves `.claude/` aside as `.claude.backup-<ts>` and rebuilds; use when `.claude/` is damaged or missing" |
| `docs/USAGE.md:172` · `:194` · `:282` | `Update policy files` → `Update` · `wizard's Reinstall` → `install --reinstall` |
| `docs/USAGE.md` §`uninstall` 문단(:216) | 화면 3항목(CLI · 자산 · 전체) · 메뉴에서도 도달 |
| `docs/USAGE.md` 새 절 **"Adding and removing a CLI"** | 더한다 = Update 메뉴 Step 2 또는 `install --cli <new> --track <installed>` · 뺀다 = Uninstall 메뉴 또는 `uninstall --cli` · **공유 파일 표**(`cli-ownership.ts:54-79` 그대로: 파일 · 쓰는 CLI · 언제 나가나) — 지금 `:228-240` 의 불릿을 표로 |
| `docs/TRACKS.md:13` | base 행에 "pick it alone — every dev track already contains it" |
| `README.md:23` 근처 | 기설치 메뉴 한 줄이 있으면 3항목으로(없으면 손대지 않는다) |
| `CHANGELOG.md` | 릴리즈 커밋에서(C 의 PR 이 아니다) |

---

## 8. 완료 기준 — "설치되었을 때 문제 없이 잘 쓰면 충분"(사용자)

**유닛(한 파일 `tests/wizard-update-flow.test.ts` + 기존 파일의 최소 수정)** — 픽스처 프롬프트(`interactive.test.ts:9-26 makePrompts`)로:
1. 메뉴 3항목 · 순서 `update, uninstall, exit` · `remove`/`add`/`reinstall` 값 없음(`router.test.ts:27-35` 교체).
2. **CLI 잠금**: 로그 `clis=[claude]`, `selectCli` 가 `["opencode"]` 만 돌려줘도 spec.cli = `[claude, opencode]`.
3. **트랙 잠금**: 로그 tracks `[tooling]`, `selectTracks` 가 `["data"]` 만 돌려줘도 spec.tracks = `[data, tooling]`.
4. **base 배타**: 첫 설치 `["base","tooling"]` → 재프롬프트(두 번째 호출) · `specFromOptions({track:["base","tooling"]})` → ok=false 같은 문장 · Update 에서 base 설치본 + `csr-fastapi` 체크 → spec.tracks = `[csr-fastapi]`.
5. **엔진 선택**: 더한 것 없음 → `mode:"update"` + `toEqual(buildUpdateSpec)` · CLI 하나 더함 → `mode:"add"` + spec `toEqual(specFromOptions(...))` 의 필드.
6. **Uninstall 3모드**: `cli` → `{projectDir, cli}` · `selected` → `{projectDir, only}` · `all` → `{projectDir}` · CLI 1개면 cli 행 disabled · 자산 0이면 selected 행 disabled.
7. `install --reinstall` → `mode:"reinstall"` · `MODE_ENTRY_POINT` 에 null 없음(`update-command.test.ts:199-206` 갱신).
8. 깨진 설치(`clis ∋ claude`, `.claude/` 없음) → 메뉴 첫 줄에 `install --reinstall --track tooling --cli claude --scope project` · Update disabled.

**컨테이너 시나리오 1개** `test/docker/scenarios/scenario-wizard-add-cli.sh`(pty = `script -qec`, `scenario-update-skills.sh:53-58` 방식):
`install --track tooling --cli claude` → 위저드 Update 에서 opencode 만 체크(키: 메뉴 Enter · Step1 Enter · Step2 ↓↓ Space Enter · Step3 Enter×7 ·
확인 Enter) → ① 로그 `clis = ["claude","opencode"]` · `spec.tracks = ["tooling"]` ② `.opencode/` · `AGENTS.md` 생겼고 `.claude/` 그대로
③ 출력에 `Claude Code   ● installed` 와 `RUNS AS agent-harness install --track tooling --cli claude --cli opencode` ④ 새 릴리즈 자산 모사(`.claude/rules/git-policy.md`
삭제 — `scenario-update-new-assets.sh:10-12` 방식) → `agent-harness update` 가 되살린다(Claude 자산이 계속 갱신 대상) ⑤ 대조군: `uninstall --cli claude` 는
성공(둘 중 하나) 뒤 `uninstall --cli opencode` 는 거절(마지막 CLI). "Claude 는 풀 수 없다"의 키 입력 재현은 pty 에서 취약하므로(disabled 항목은 커서가 건너뛴다) 유닛 2 가 맡고, 컨테이너는 ①·③ 으로 확인한다.

**과도한 테스트 구조를 넣지 않는다** — 문서 표 ↔ `CLI_OWNERSHIP` 파리티 테스트, 화면 문구 스냅샷, 메뉴 hint 문자열 단언은 넣지 않는다(상시 테스트는 안착만).

---

## 9. 사용자 결정이 필요한 것

> **확정 2026-09-27**: 결정 1 ⓐ · 결정 3 ⓐ · 결정 4 ⓐ(세션이 북극성 — 필요한 틀만 · 이전 사용자 결정 #480 — 으로 정했다). **결정 2 는 폐기 — base 배타 규칙을 두지 않는다**(사용자 결정: 트랙은 스킬·룰을 미리 골라 주는 형태라 함께 골라도 해가 없다). D11 · §2.1 의 재프롬프트 · §8-4 · `trackSelectionError` 는 구현하지 않는다. base 항목 라벨과 `docs/TRACKS.md` 에 "dev 트랙에 이미 포함" 한 줄만 둔다. §5 실측 표는 그 한 줄의 근거로 남긴다.

**결정 1 — "Add 와 Update 엔진 통합"의 정도.**
- ⓐ **(추천)** 이번 릴리즈: 한 흐름 · 한 함수(`classifyUpdateIntent`)가 update 엔진/install 엔진 중 하나를 고른다. 화면이 `RUNS AS` 로 어느 플래그 명령과 같은지 말한다(숨김 0). 엔진 파일(A 소유) 무변경. 비용 = `add` 실행 한 번은 orphan prune·은퇴 안내를 건너뛴다(다음 `update` 가 한다) — 화면에 한 줄로 알린다.
- ⓑ 진짜 단일 엔진: `runUpdateMode` 가 트랙·CLI·자산 추가를 인자로 받아 새 것만 install 경로로 깐다. A 소유 파일(`update-mode.ts` · `installer.ts`) 대수술 · 독립 리뷰 문턱 위 · 이번 릴리즈 밖. ⓐ 를 먼저 내고 후속 이슈로.
- 이유: #523 이 원한 것은 **화면의 뜻이 하나**인 것이고, ⓐ 가 그것을 채운다. ⓑ 는 엔진 정합이지 설치자 화면의 변화가 아니다.

**결정 2 — base 배타의 범위.** §5 실측: dev 트랙 8종과는 0 이득(명제 성립), business 트랙 3종과는 9 항목 이득(명제 불성립).
- ⓐ **(추천)** 사용자 확정대로 **전부 배타**. 규칙이 한 문장이고 화면 설명도 한 줄. 잃는 조합(business + 스택 미정 dev 방법론)은 드물고, 필요하면 business 트랙으로 깔고 Update 에서 dev 트랙(예: tooling)을 더하면 같은 9 항목 이상을 받는다.
- ⓑ dev 트랙과만 배타, business 와는 허용. 실측에 충실하지만 설명이 두 줄이 되고(#523 이 지적한 "산만함"의 형태), Update 흐름에서 base 설치본에 business 를 더하는 분기가 하나 늘어난다.
- 구현은 한 함수(`trackSelectionError`)라 어느 쪽이든 한 줄 + 테스트 한 행이다.

**결정 3 — #480 갱신 묶음 체크박스의 자리**(D13). ⓐ **(추천)** refresh 케이스 확인 화면에만(전부 체크) ⓑ 위저드에서 빼고 `update --only` 플래그만. 7일 전 사용자 결정(#480)이 위저드 체크박스를 명시했으므로 ⓐ.

**결정 4(소) — Uninstall 화면 언어**(D12). ⓐ **(추천)** 영어로 통일 ⓑ 기존 한국어 유지(위저드 안에서 언어가 바뀐다).

---

## 10. 착수 시 실측할 것

1. **A 머지 후** `install`(add 모드)의 스킬 디렉터리 복사가 편집 파일을 백업하는지 — `installer.ts` dir 엔트리 경로(#536 ⑥). 안 되면 `add` 케이스의 스킬 편집분이 백업 없이 덮인다 → C 가 아니라 A 의 인계 문서로 되돌린다.
2. **A · B 머지 후** `install --cli opencode`(추가)가 `.agents/skills/<id>` 를 만들고 기록하는지(B) · 같은 실행이 `.claude/skills` 링크 자리를 다루는지(A) — 컨테이너 시나리오 ② 의 전제.
3. clack `multiselect` 에서 `disabled` + `initialValues` 항목이 화면에 **체크된 채** 그려지는지(잠금 표현). 아니면 라벨에 `● installed (locked)` 만 붙이고 D4 의 엔진 합집합이 잠금을 맡는다.
4. pty 키 시퀀스(§8 시나리오) — Step 3 페이지 수가 7 인지(`INSTALL_TARGET_PAGES.length`) 실행 출력으로 확인. 페이지 수를 스크립트에 박지 말고 출력의 `Page n/N` 을 읽어 N 회 Enter.
5. `install --reinstall` 이 `--track` 없이 불렸을 때의 문구(`specFromOptions` 의 기존 거절 그대로인지).
6. `refreshExternalCli` 가 A · B 뒤에도 `installedCliTargets(log)` 를 읽는지 — D6 의 "update 엔진은 CLI 추가를 무시한다" 전제가 여전히 참인지(참이면 ⓐ 유지, 거짓이면 결정 1 재검토).

---

## 11. 소유 경계 (브리프와 같다)

C 소유: `src/interactive.ts` · `src/prompts.ts` · `src/router.ts` · `src/wizard-steps.ts` · `src/cli.ts` · `src/commands/install.ts` · `src/commands/update.ts`(필요 시) ·
`src/uninstall-interactive.ts` · `src/commands/uninstall.ts`(dispatch 배선 · `installer.ts` 의 `MODE_ENTRY_POINT` 한 줄은 A 소유라 인계 문서 맨 위) · 새 `src/track-exclusivity.ts` ·
`tests/`(위저드·라우터·uninstall-interactive·update-command) · `test/docker/scenarios/scenario-wizard-add-cli.sh` · `docs/USAGE.md` · `docs/TRACKS.md` · `README.md`(한 줄).
금지: A(`src/foreign-slot.ts` · `src/update-mode.ts` · `src/installer.ts` · `src/owned-write.ts` · `src/fs-ops.ts` · `src/install-log.ts`) · B(`src/codex/*` · `src/opencode/*` · `src/antigravity/*` · `src/agents-skill-targets.ts`).
