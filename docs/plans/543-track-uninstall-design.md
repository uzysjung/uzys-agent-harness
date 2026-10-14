# #543 — 트랙 단위 uninstall 설계 (`uninstall --track <name>`)

- 상태: 설계 초안 — 독립 설계 검증 대기 (구현 전)
- 이슈: #543 (원요청 #523 — 설치자 본인)
- 날짜: 2026-10-15
- 원칙 SSOT: 루트 `CLAUDE.md` §설치자 디스크는 한 원칙으로 다룬다 · ADR-096 · ADR-097 · ADR-111 · `src/displaced.ts`
- 근거 폴더: `docs/plans/543-design-evidence/` (실험 스크립트 · 화면 · 스냅샷 · 기록 사본 · 술어 계산)

## 0. 설치자에게 무엇이 달라지는가

지금 트랙을 하나 잘못 골랐으면 길은 둘뿐이다 — 전량 `uninstall` 뒤 재설치, 또는 그 트랙의 룰·스킬을 손으로 지우기(기록은 그대로라 다음 `update` 가 되살린다). 이 설계가 들어가면 `agent-harness uninstall --track csr-fastapi` 한 번(위저드는 Uninstall → **Remove one track**)으로 **그 트랙에만 속한 룰·에이전트·스킬**이 네 CLI 자리에서 함께 빠지고, 남는 트랙이 같이 쓰는 것(공통 룰 · 방법론 스킬 · 훅 · 앵커)은 그대로 남는다. 설치자가 고친 파일은 `<file>.backup-<ts>` 로 남긴 뒤 빠지고, 기록(`spec.tracks` · `.claude/.installed-tracks`)에서도 그 트랙이 빠져 다음 `update` 가 되살리지 않는다. 화면은 전량 · `--cli` uninstall 과 같은 줄로 **실제로 한 일만** 말한다.

## 1. 가설 판정

### 1.1 가설과 실험

**가설**: 설치 기록에서 트랙 T 를 빼고 기존 `update` 정합 경로를 돌리는 것만으로 T 전용 자산이 치워지고 나머지가 지켜지는가.

**방법**: 이 워크트리에서 빌드한 `dist/index.js` 를 mktemp 프로젝트에서 실행했다(실 AI CLI 는 실행하지 않는다 — `npx skills` · `claude plugin` 은 `543-design-evidence/mocks/` 가 대신하고 HOME 도 임시 폴더다). 스크립트 = `543-design-evidence/run-experiment.sh`, 장면 셋:

| 장면 | 설치 | 빼는 트랙 | 보려는 것 |
|---|---|---|---|
| S1 | `--track tooling --track csr-fastapi --cli claude --cli codex --cli antigravity --with vercel`, `.claude/rules/ui-components.md` 를 설치자가 고침 | csr-fastapi | csr 전용 룰(`ui-components`) · 스킬(`ui-visual-review`) · MCP 기본 행(railway · chrome-devtools) · `--with vercel` · 외부 skill 자산 3종 · AGENTS.md 인라인 룰 · 백업 |
| S2 | `--track tooling --track csr-fastapi --cli claude --cli antigravity` | tooling | tooling 전용 룰(`cli-development`)과 Antigravity 사본 |
| S3 | `--track tooling --track data --cli claude` | data | data 전용 에이전트(`data-analyst`) · plugin 자산 |

각 장면은 ⓐ 기록의 `spec.tracks` 에서만 T 를 빼고 `list` → ⓑ `spec.tracks` + `.claude/.installed-tracks` 본문 + 그 sha 를 함께 바꾸고 `update` → `update` 한 번 더(조용한가) 순으로 쳤다. 파일 목록·sha 스냅샷(`snap-*.txt`), 화면(`screen-*.txt`), 기록 사본(`log-*.json`), 결과 요약(`state-*.txt` · `probe-after-update.txt`)이 `out/<장면>/` 에 있다.

### 1.2 결과 — 자산 종류별

"기록에서 T 를 빼고 update" 뒤의 디스크(ⓑ). 근거 열의 파일은 `543-design-evidence/out/<장면>/` 상대.

| 자산 종류 | 예 | 기대(T 전용이면 치움) | 관측 | 근거 |
|---|---|---|---|---|
| `.claude/rules/<T 전용>` | S1 `ui-components.md`(고친 파일) · S2 `cli-development.md` | 백업 뒤 치움 | **남음**, 백업 없음 | S1·S2 `probe-after-update.txt` `STILL THERE`, `diff-A-C.txt` 에 그 경로 없음 |
| `.claude/agents/<T 전용>` | S3 `data-analyst.md` | 치움 | **남음** — 화면만 "지워도 된다" | S3 `screen-2-update.txt` `⊘ agents data-analyst · … 지워도 된다` |
| `.claude/skills/<T 전용>` | S1 `ui-visual-review/` | 치움 | **남음** (갱신 대상으로 계속 돈다) | S1 `probe-after-update.txt`, `state-C.txt` skillFiles=42 (A 와 같음) |
| `.agents/rules/<T 전용>` (Antigravity) | S1 `ui-components.md` · S2 `cli-development.md` | 치움 | **남음** — `kept: its Claude Code copy is in the install record` | S1·S2 `screen-2-update.txt` ⊘ 줄 |
| `.agents/skills/<T 전용>` (Codex·Antigravity) | S1 `ui-visual-review/` | 치움 | **남음** | S1 `probe-after-update.txt` |
| 훅 · 공통 룰 · 방법론 스킬 · 앵커 · 헬퍼 | `git-policy.md` · `objective-brief` · `session-start.sh` | 남음 | 남음 | S1·S2 `probe-after-update.txt` `STILL THERE`(의도) |
| `.mcp.json` T 기본 행 | S1 `railway-mcp-server` · `chrome-devtools` | (결정 필요 — §4 D1) | **남음** | S1 `state-C.txt` `mcp.json: chrome-devtools,context7,railway-mcp-server,vercel` |
| `--with` 로 더한 MCP | S1 `vercel` | 남음(명시 선택) | 남음 | 같은 줄 |
| 외부 자산(`assets[]`) — T 기본 skill·plugin | S1 `frontend-design` 등 3종 · S3 `anthropic-data-plugin` | (결정 필요 — §4 D2) | **남음**, update 가 계속 갱신 | S1 `state-C.txt` assets=… · `screen-2-update.txt` `external skills 3 refreshed` |
| `AGENTS.md` 인라인 룰 절 | S1 `## UI Components` | 빠짐 | **빠짐** ✓ | S1 `diff-AGENTS-B-C.txt`(절 6줄 삭제) |
| 루트 `CLAUDE.md` `> Active track(s):` | S1 `Tooling, CSR FastAPI` | 갱신 | **그대로** | `root-claude-md-track-line.txt` 세 장면 모두 |
| `.claude/.installed-tracks` | — | T 빠짐 | 손으로 바꾼 값 유지(update 는 다시 쓰지 않음) | `state-C.txt` `installed-tracks:` |
| 설치 기록 `spec.tracks` 만 뺀 경우(ⓐ) | — | T 빠짐 | **T 가 되살아남** — `list` 가 두 트랙을 말한다 | 세 장면 `edit-1a.txt` (`tooling` 으로 썼는데 `tracks: csr-fastapi, tooling`) |
| 두 번째 update | — | 조용 | 조용(디스크 diff 0) | `diff-C-D.txt` 빈 파일(세 장면) |

**판정: 부분 가능.** update 재사용으로 되는 것은 `AGENTS.md` 재렌더(룰 인라인) 하나다. 룰 · 에이전트 · 스킬의 `.claude/` · `.agents/` 사본은 어느 것도 빠지지 않고, 기록에서 트랙만 빼면 읽는 쪽이 되살린다. 새 삭제 **엔진**은 필요 없다 — uninstall 이 이미 가진 파일 단위 회수 엔진(`removeHarnessFiles`)에 **범위 술어 하나**를 넘기면 된다(§2.3). 실험이 보인 빠진 것 = 그 술어와 기록 두 자리(`spec.tracks` · 메타파일+sha)의 동시 갱신이다.

### 1.3 왜 그런가 — 코드 위치

1. **기록을 읽는 순간 트랙이 되살아난다.** `readInstallLog` 가 `healRecordedTracks` 를 거친다(`src/install-log.ts:711`). `.claude/.installed-tracks` 의 내용이 `policyFiles[".installed-tracks"].sha256` 과 같을 때 그 파일의 트랙을 `spec.tracks` 에 합친다(`src/track-heal.ts:59-84`). 그래서 `spec.tracks` 에서만 T 를 빼면 ⓐ 처럼 바로 돌아온다. 트랙 제거는 **기록과 메타파일(+ 그 sha)을 한 쓰기에서** 바꿔야 한다.
2. **update 는 "기록 트랙의 대상" 만 쓴다 — 대상 밖 기록 파일은 건드리지 않는다.** 파일 자산 대상 = `trackOnlyFileAssets(installedTracks)`(`src/update-mode.ts:1286`, 정의 1704), 스킬 대상 = `recordedSkillIds`(1309 · 1954: 기록 `skillFiles` ∪ `.agents/skills` 기록 ∪ 이번 릴리즈 트랙 기본). T 를 빼면 T 전용 룰은 대상에서 빠져 **갱신되지 않을 뿐** 지워지지 않고, 스킬은 기록에 있는 한 계속 대상이다(그래서 `ui-visual-review` 가 갱신까지 받는다).
3. **은퇴 회수는 템플릿 부재 기준이다.** `pruneOrphans` 는 `templates/<dir>/` 에 없는 파일만 본다(`src/update-mode.ts:2424` `existsSync(join(source, file))`). T 전용 룰은 템플릿에 있으므로 orphan 이 아니다. 강등 에이전트는 설계상 안내만 한다(`demotedAgentFiles` 1239 · ADR-090 — S3 화면).
4. **트랙 밖 회수(#677)는 Antigravity 룰 한 자리뿐이고 claude 사본이 있으면 남긴다.** `reclaimOutOfTrack` 은 `externalFiles` 의 `.agents/rules/<r>.md` 만 보고(`src/out-of-track.ts:79-81`), `policyFiles` 에 `rules/<r>.md` 가 있으면 `kept`(89-93) — S1·S2 의 ⊘ 줄. `.claude/` 사본이 안 빠지는 한 이 보호가 Antigravity 사본도 남긴다.
5. **MCP 기본 행은 기록이 곧 선택이다.** `selectedMcpServers` 가 `.mcp.json` 몫 기록(`portions`)의 키를 선택으로 본다(`src/mcp-merge.ts:204-206 · 217`, ADR-101 · #709). 기록은 "트랙 기본으로 들어왔다" 와 "`--with` 로 골랐다" 를 구분하지 않으므로(S1 `log-A.json` `portions`: railway · chrome-devtools · vercel 이 같은 모양), 트랙을 빼도 렌더에 남는다.
6. **`AGENTS.md` 는 트랙을 따라간다.** update 의 렌더 입력 `recordedRenderInputs` 가 `resolveRules(installedTracks)` 를 쓴다(`src/update-mode.ts:1929`) — S1 에서 `## UI Components` 절이 빠졌다. 단 `installedTracks` 는 **디스크의 기록**을 읽는다(1842-1845) — 기록을 쓴 뒤에만 새 트랙으로 렌더된다.
7. **루트 `CLAUDE.md` 의 `> Active track(s):` 는 스캐폴드 생성 시 한 번 쓴다.** `mergeProjectClaude`(`src/project-claude-merge.ts:339`)만 쓰고 `upsertHarnessImport` 는 마커 블록 안만 바꾼다(355-370).

### 1.4 "T 전용" 을 어느 술어로 세는가 — 실측

기록의 하네스 파일 후보(uninstall 의 `harnessCandidates` 와 같은 세 필드, `src/commands/uninstall.ts:1776-1792`)를 두 술어로 갈랐다(`543-design-evidence/track-diff.ts`, 출력 = `out/<장면>/track-diff-predicate.txt`):

| 술어 | S1 (csr-fastapi 제거) 의 T 전용 | 비고 |
|---|---|---|
| ⓐ `recordedTrackTargets(log)` (`src/recorded.ts:106-121`) | `.agents/rules/ui-components.md` · `.claude/rules/ui-components.md` — **스킬 0** | 번들 스킬을 전부 대상으로 본다(`selectedInternalSkills: INTERNAL_BUNDLED_SKILL_IDS`, 109) — 설계상 "옵션 선택이 기록에 없어서" 다. 트랙 전용 스킬을 가를 수 없다 |
| ⓑ `buildManifest(buildAssetSpec({tracks}))` (`src/manifest.ts:64-76 · 370`) | 위 둘 + `.claude/skills/ui-visual-review/SKILL.md` + `.agents/skills/ui-visual-review/SKILL.md` | install 이 까는 것과 같은 트랙 게이팅(`isAssetSelected` 로 `ui-visual-review` 의 `any-track` 조건을 건다) |

S2(`cli-development` 룰 둘) · S3(`data-analyst.md`)은 두 술어가 같다. **T 전용 집합은 ⓑ 로 센다** — `track-heal.ts:43` 의 `claudeTargets(tracks)` 가 이미 같은 계산(파일 자산 + 스킬 **디렉터리**)을 메모해 두고 있어 그것을 쓴다(디렉터리 아래 파일 판정은 `recordedTrackTargets` 와 같은 "번들 템플릿에 있는 파일" 규칙, 117-118).

## 2. 설계

### 2.1 명령 표면

- CLI: `agent-harness uninstall --track <name>` (`[--dry-run] [--project-dir <path>]`). 한 번에 **트랙 하나** — `--cli` 와 같은 모양(§4 D4). `--only` · `--cli` 와 함께 쓰면 거절(`--cli` 가 `--only` 를 거절하는 것과 같은 줄, `src/commands/uninstall.ts:868-879`).
- 등록: `registerUninstallCommand` 에 `.option("--track <name>", "[Scope] Remove one track only (…TRACKS). Files other recorded tracks also install stay")` 한 줄(2732-2756). `UninstallOptions.track?: string`(132-155). `shouldRunInteractive`(2767) 와 `lacksRemovalIntent`(2808) 에 `track` 을 더한다 — 플래그가 있으면 화면을 건너뛰고, 비TTY 의 "의사 표현" 으로 센다.
- 위저드: `uninstall-interactive.ts` 의 첫 화면에 넷째 모드 **Remove one track** (`UninstallMode` 에 `"track"`, `buildUninstallModeChoices(clis, assetCount, tracks)` — 기록 트랙이 둘 이상일 때만 enabled, 하나면 hint `only one track here — use "Remove everything"`). 고르면 `pickTrack` 이 `TRACK_LABELS`(`src/prompts.ts:113`) 로 행을 보이고, 확인 화면에 "This is the same as: `agent-harness uninstall --track <t>`" + 나가는 것(아래 §2.6 미리보기와 같은 집계) + 남는 트랙을 적는다. 결과 `{ projectDir, track }` → 기존 `runUninstallScreen` → `uninstallAction` (2821-2835, 바꿀 것 없음). 메뉴 라우터 hint(`src/router.ts:106` `"remove everything, one CLI, or single assets"`)에 `one track` 을 더한다.
- USAGE: §`uninstall` 의 선택지 목록 · 플래그 표에 한 줄씩, §"Adding and removing a CLI" 옆에 "Adding and removing a track" 짧은 절(위저드 Update 로 더하고 — 이미 설명돼 있다(`docs/USAGE.md:36`) — `uninstall --track` 으로 뺀다).

### 2.2 판정 규칙

- **T 전용** = 기록의 하네스 파일 후보 중 `(기록 트랙의 manifest 대상) ∧ ¬(남는 트랙의 manifest 대상)`. 술어 = `claudeTargets(tracks)`(`src/track-heal.ts:43`) + 디렉터리 대상은 번들 템플릿 파일 여부(`src/recorded.ts:117-118` 규칙) — **ⓑ**(§1.4). 외부 CLI 자리는 번들 경로로 바꿔 같은 술어에 넣는다: `.agents/skills/<id>/…` → `bundlePath`(`src/recorded.ts:83`), `.agents/rules/<r>.md` → `.claude/rules/<r>.md`(`out-of-track.ts:28` 와 같은 정규식). 기록에 없는 파일은 후보가 아니므로 닿지 않는다(설치자 파일 · ADR-097 결정 1).
- **옛 판 지문 파일(ⓑ′ `legacyFileCandidates`)** 은 현행 manifest 대상이 아니라 술어가 거짓 → 트랙 제거는 그것을 건드리지 않는다(은퇴 자산 정리는 전량 uninstall 의 몫 — ADR-111 결정 5 와 같은 선).
- **`excluded`** 는 바꾸지 않는다. T 를 빼면 그 룰은 manifest 에 없으니 빼기 기록이 필요 없고, 나중에 `install --track T` 로 돌아온다. 남는 트랙의 자산 중 설치자가 뺀 것(`excluded`)은 지금처럼 건드리지 않는다(후보가 아니다 · ADR-099 R3).
- **`--with` 항목**(외부 자산 · 선택 MCP 행): 트랙에 속하지 않은 명시 선택이라 **남긴다**. T 의 **기본** 외부 자산(`assets[]` 의 skill · plugin)과 T 기본 MCP 행은 §4 D1 · D2 — 추천은 남기고 화면이 빼는 명령을 댄다.
- **마지막 트랙**: 거절 — "전량 제거는 `agent-harness uninstall`" (`--cli` 의 마지막 CLI 규칙 894-900 과 같은 문장 · 전량 삭제 경로를 둘 두지 않는다).
- **없는 트랙 지정**: 어휘에 없는 이름(`!isTrack`)과 기록에 없는 트랙을 따로 거절한다 — `Invalid --track value` / `<t> is not installed in this project (recorded: …)`. 판정은 **읽은 기록**(heal 뒤)으로 한다 — 옛 판이 잘라 둔 트랙도 메타파일이 보증하면 기록 트랙이다.
- **`base`**: 다른 dev 트랙이 남으면 T 전용 집합이 빈다(base ⊂ 모든 dev 트랙, `src/prompts.ts:114-116`). 거절하지 않고 기록만 갱신하며 화면이 "nothing only base installs — record updated" 라고 말한다. `full` 을 빼는 것도 같은 술어로 자연히 처리된다.
- **CLI 집합은 바꾸지 않는다.** `spec.clis` · `templates.*` · `portions`(함께 쓰는 파일의 몫)은 그대로다. 함께 쓰는 파일에서 걷는 몫은 없다 — T 가 가져오는 훅은 없고(`ALWAYS_HOOKS` 는 `applies: all`, `src/manifest.ts:344·507`) MCP 는 D1 이다.

### 2.3 재사용 경로와 추가분

| 할 일 | 재사용 | 추가분(예상 줄) |
|---|---|---|
| T 전용 파일 회수(판정 · 백업 · 링크 · 밖 실체 · displaced 되돌리기 · 빈 폴더) | `removeHarnessFiles(log, projectDir, scope, io)`(`src/commands/uninstall.ts:1693-1769`) — `--cli` 가 쓰는 그 함수에 `RemovalScope`(1607-1620) 하나를 넘긴다: `{ has: onlyT, shared: [], skeleton: [], folders: [], importBlock: false, anchor: false }` | `planTrackRemoval(target, log, projectDir): { scope, remaining }` ≈ 35 — 술어 조립. `claudeTargets`(`track-heal.ts:43`, export 됨) + 번들 파일 존재 확인 ≈ 10 (`recorded.ts` 의 디렉터리 규칙을 작은 함수로 뽑아 둘이 같이 쓰게) |
| 전제 검사(충돌 플래그 · 어휘 · 기록 · 마지막) | `resolveCliTarget`(866-902) 의 모양 | `resolveTrackTarget` ≈ 35 |
| dry-run 미리보기 | `removeHarnessFiles(..., write: false)` + `harnessRemovalLines`(2190) + `assetsLeftLines`(2397) — `removeCliDryRunLines`(982-1003) 모양 | `removeTrackDryRunLines` ≈ 25 · 머리글 `removeTrackHeader` ≈ 12 |
| `AGENTS.md` 를 남는 트랙으로 다시 렌더 | `rerenderAgentsMd`(1049) + `withRerender`(1064) + `rerenderLines`(1087) — `--cli` C-3 와 같은 함수 | `recordedRenderInputs(projectDir, log, tracks = installedTracks(projectDir))` 에 선택 인자 하나(`src/update-mode.ts:1913`) ≈ 3 — 재렌더가 **쓰기 전 기록**의 트랙이 아니라 남는 트랙을 받게. 조건: `AGENTS.md` 를 읽는 CLI 가 깔려 있고 파일이 기록에 있을 때(`agentsMdRerenderSet` 1017 의 조건을 target 없이 쓰는 판 ≈ 8) |
| 기록 갱신 | `settleCliLog`(1110-1156) 의 모양 — 다른 점: `policyFiles` · `skillFiles` 는 필드째가 아니라 **`forgotten` 경로만** 뺀다 | `settleTrackLog` ≈ 45 — `spec.tracks` 제거 · 네 필드에서 `done.forgotten` 제거 · `rootFiles` = `withoutRestored(done.displaced)` · `.installed-tracks` 새 내용 쓰기와 그 sha(`installedTracksText`, `src/installer.ts:1313`; `hashContent`) |
| 실행 묶기 | `removeCliAction`(1158-1209) 의 순서 | `removeTrackAction` ≈ 50 · `uninstallAction` 분기 3줄(268-274 옆) |
| 남는 외부 자산 · MCP 기본 행 안내(D1 · D2 추천안) | `assetsLeftLines` 의 문장 모양 · `trackDefaultMcpAssetIds`(`src/cli-transforms.ts:201`) | `trackLeftLines` ≈ 25 |
| CLI 표면 | `registerUninstallCommand` · `shouldRunInteractive` · `lacksRemovalIntent` | ≈ 8 |
| 위저드 | `uninstall-interactive.ts` — `buildUninstallModeChoices` · `pickCli`(329-351) 모양 | `pickTrack` + 모드 한 항목 + `selectTrack` 프롬프트 ≈ 70 |
| 루트 `CLAUDE.md` `> Active track(s):` (D3 추천안) | `dropHarnessQuoteBlocks`(`project-claude-merge.ts:231`)가 하네스 인용 블록을 알아본다 | 한 줄 바꾸기 ≈ 15 |

**예상 src 순증 ≈ 330줄**(uninstall.ts ≈ 230 · uninstall-interactive.ts ≈ 70 · update-mode.ts ≈ 5 · recorded.ts/track-heal.ts ≈ 10 · project-claude-merge.ts ≈ 15). 삭제 엔진 · 판정 함수 · 기록 접근자는 새로 만들지 않는다. `install-render.ts` 는 건드리지 않는다(uninstall 화면은 `commands/uninstall.ts` 가 직접 낸다).

구현자가 피할 함정 둘:
- `removeHarnessFiles` 는 **실행 시작 때의 기록**으로 판정한다(`recorded(log, …)` 1885). 기록을 먼저 바꾸면 T 전용 룰이 `isRecordedTrackTarget` 밖으로 떨어져 옛 스캔 로그(`records` 없음)에서 `none` 으로 읽힌다(`src/recorded.ts:186-187 · 203`) — 지우지 않는 쪽으로 틀리지만, 그러면 아무것도 안 빠진다. 순서는 §2.4.
- 스킬 디렉터리 안 파일 중 **번들 밖 파일**(설치자 노트)은 후보가 아니다(기록에 없다). `removeHarnessFiles` 가 지운 파일의 부모만 비었을 때 걷으므로(`pruneEmptyDirsUpward` 1759) 노트가 있으면 폴더가 남는다 — 전량 uninstall 과 같은 동작이고 `leftFolderLines` 가 말한다.

### 2.4 실행 순서 · 기록 갱신 · 중간 실패

```
0 전제 검사(resolveTrackTarget)            — 아무것도 안 바꾸고 거절
1 removeHarnessFiles(log, scope=onlyT)     — T 전용 파일: remove / backup+remove / forget · displaced 되돌림 · 빈 폴더
2 rerenderAgentsMd(남는 트랙)               — AGENTS.md 를 읽는 CLI 가 남아 있고 파일이 기록에 있을 때
3 .claude/.installed-tracks ← 남는 트랙     — claude 가 깔린 기록일 때(없으면 파일도 없다, track-heal.ts:64)
4 writeInstallLog(settleTrackLog(...) + withRerender)
```

- **한 번의 기록 쓰기**(4)다 — `--cli` 와 같다. 3 과 4 는 붙어 있다: 메타파일만 바뀌고 기록이 안 바뀌면 sha 가 어긋나 heal 이 트랙을 더하지 않고(`track-heal.ts:79`), 기록은 여전히 T 를 말한다 — 즉 "파일은 빠졌고 기록은 T 를 아직 든 상태". 다음 실행(같은 명령)이 1 에서 없는 파일을 `forgotten` 으로 정리하고(1866-1869) 3·4 를 다시 한다. 되돌릴 수 없는 손실은 없다(백업은 1 에서 이미 남았다).
- 1 뒤 2 가 실패해도 기록이 안 바뀌었으면 같은 명령 재실행으로 이어진다. 4 가 실패하면 `--cli` 와 같은 줄(`install log 갱신 실패 … 기록이 실제와 다르다`, 1195-1204)로 exit 1.
- 2 를 4 앞에 두는 이유: 재렌더 결과(`externalFiles` sha · 블록 `portions`)를 같은 쓰기에 싣는다(`withRerender`). 안 실으면 다음 update 가 방금 쓴 `AGENTS.md` 를 "설치자가 고쳤다" 로 읽는다(#550 형태 — `src/commands/uninstall.ts:1063` 주석).
- 1 이 떠난 자리의 displaced 되돌리기와 `rootFiles` 정리는 `removeHarnessFiles` 안의 `restoreDisplaced` + `withoutRestored` 그대로(`src/displaced.ts:75 · 109`).

### 2.5 확인 · `--yes` · 비TTY — 기존 uninstall 과 같다

- `--track` 은 "뺄 대상을 이미 말한" 플래그다: TTY 에서도 화면 없이 바로 실행(`shouldRunInteractive` 가 `--cli` 를 다루는 것과 같다, 2772-2773). `--dry-run` 과 함께 쓰면 미리보기만.
- 플래그 없이 TTY → 화면 → 모드 선택 → 트랙 선택 → 확인(`initialValue: false`). 취소 · 미선택은 exit 0 무변경.
- 비TTY 에서 `--track` 은 의사 표현이라 돈다(CI 스크립트용). 비TTY · 플래그 없음은 지금처럼 거절(2787-2796).
- `--yes` 는 전량 전용이고 `--track` 에는 필요 없다(`--cli` 와 같다).

### 2.6 화면 줄 예시

`uninstall --track csr-fastapi --dry-run` (S1 설치본):

```
uzys-agent-harness · uninstall --track csr-fastapi

  tracks:    csr-fastapi, tooling
  removing:  csr-fastapi
  remaining: tooling

[DRY RUN] 트랙 제거 미리보기 (실제 변경 없음):

  ○ remove 2 harness file(s) under .claude/ (1 with a copy saved beside as *.backup-<time>)
  ○ remove 2 harness file(s) under .agents/
  ○ re-render AGENTS.md for Codex · Antigravity (your sections kept)
  ○ leave  .claude/skills/frontend-design · .agents/skills/frontend-design (asset frontend-design) — remove with: agent-harness uninstall --only frontend-design
  ○ leave  .mcp.json servers chrome-devtools · railway-mcp-server — defaults of csr-fastapi, kept because your install record has them; drop: agent-harness install --track tooling --without chrome-devtools --without railway-mcp-server
  ○ install log updated (tracks: tooling)
```

실행:

```
  ✓ removed  .claude/ 2 harness file(s) · .agents/ 2
  ✓ backed up  .claude/rules/ui-components.md — you edited it — saved as .claude/rules/ui-components.md.backup-20261015T083012, removed from live
  ✓ AGENTS.md — re-rendered for Codex · Antigravity (your sections kept)
  ⊘ left  .claude/skills/frontend-design · .agents/skills/frontend-design (asset frontend-design) — remove with: agent-harness uninstall --only frontend-design
  ⊘ left  .mcp.json servers chrome-devtools · railway-mcp-server — defaults of csr-fastapi, kept because your install record has them; drop: …
  ✓ install log updated (tracks: tooling)

✓ csr-fastapi removed (remaining: tooling)
```

줄의 원천: 회수·백업 = `harnessRemovalLines`(판정 `judge` 의 `line`, `src/judge.ts:191-203`) · 재렌더 = `rerenderLines` · 남는 자산 = `assetsLeftLines` 모양 · MCP 줄 = `writeMcpShared` 의 "not a default on … — kept because your install record has it; drop it" 문장(`src/install-writes.ts:901`)과 같은 어휘. 숫자는 `removeHarnessFiles` 결과에서 센다(ADR-097 결정 9). 스킬 두 자리(`.claude/skills/ui-visual-review/*` · `.agents/skills/ui-visual-review/*`)는 파일 수로 집계된다 — 실제 S1 번들은 SKILL.md 외 파일이 더 있어 숫자는 커진다(예시는 모양만).

## 3. 테스트 계획

### 3.1 단위 테스트(새 파일 `tests/uninstall-track.test.ts`) — 변경 없이는 실패하는 장면

`runInstall({ runExternal: null })` 로 깔고 `uninstallAction({ track })` 을 부른다(`tests/uninstall-cli-scope.test.ts:1-60` 의 모양).

1. **T 전용만 빠진다**: tooling+csr-fastapi · claude+codex+antigravity → `--track csr-fastapi` → `.claude/rules/ui-components.md` · `.claude/skills/ui-visual-review/` · `.agents/rules/ui-components.md` · `.agents/skills/ui-visual-review/` 없음; `git-policy.md` · `cli-development.md` · `objective-brief/` · 훅 · 앵커 · `.agents/skills/objective-brief` 있음. 기록: `spec.tracks = ["tooling"]`, 네 필드에 빠진 경로 없음, `clis` 그대로. **지금 코드로는 `--track` 옵션이 없어 실패한다**(변이 증명 = 옵션 추가 전 실행).
2. **heal 이 되살리지 않는다**: 1 뒤 `readInstallLog(projectDir).spec.tracks` 가 `["tooling"]`; `.claude/.installed-tracks` 본문 `tooling\n` 이고 `policyFiles[".installed-tracks"].sha256 === hashContent("tooling\n")`. **음성 대조**: 메타파일 갱신 줄을 빼면 `readInstallLog` 가 `csr-fastapi` 를 되살린다 — 실험 ⓐ(`edit-1a.txt`) 가 그 장면이다.
3. **고친 파일은 백업 뒤 빠진다**: `ui-components.md` 를 고친 뒤 `--track csr-fastapi` → `ui-components.md.backup-*` 하나, 라이브 없음, 화면 `you edited it — saved as …, removed from live`(`LINES.editedRemoved`).
4. **displaced 되돌림**: 설치 전에 설치자 `.claude/rules/ui-components.md` 를 둔 뒤 설치(백업 + `displaced` 기록) → `--track csr-fastapi` → 원본이 제자리로, `rootFiles` 에서 그 displaced 항목 제거(`tests/uninstall-displaced-legacy.test.ts` 의 장면 모양).
5. **전제 검사**: 마지막 트랙 거절(exit 1 · 아무것도 안 바뀜) · `--track nope` 거절 · 기록에 없는 트랙 거절(`installed:` 열거) · `--track` + `--only` / `--cli` 거절 · `base` 를 빼면(남는 dev 트랙 있음) 파일 0 · 기록만 갱신 · exit 0.
6. **dry-run 동일성**: `--dry-run` 이 디스크·기록을 바꾸지 않고, 미리보기의 "remove N under .claude/" 수가 실행 결과 `removed` 수와 같다.
7. **AGENTS.md**: codex 가 깔린 설치본에서 설치자가 `## Project Context` 를 채운 뒤 `--track csr-fastapi` → `## UI Components` 절 없음 · 설치자 문단 그대로 · 기록 `externalFiles["AGENTS.md"].sha256` 이 디스크와 같고 → 이어서 `runUpdateMode` 가 백업 0 · `AGENTS.md` 바이트 변화 0(C-T3 "이어서 update 해도 조용" 대조).
8. **외부 자산 · MCP(D1 · D2 추천안)**: `assets[]` 의 `frontend-design` 이 남고 화면이 `--only frontend-design` 을 댄다; `.mcp.json` 의 `railway-mcp-server` 가 남고 화면이 drop 명령을 댄다. 결정이 바뀌면 이 두 단언만 바뀐다.
9. **위저드**(`tests/uninstall-interactive.test.ts` 에 추가): `buildUninstallModeChoices(clis, 0, ["tooling","csr-fastapi"])` 에 `track` 모드 enabled, 트랙 하나면 disabled; 주입 프롬프트로 `selectMode → "track"` · `selectTrack → "csr-fastapi"` · `confirm → true` 면 결과 `{ track: "csr-fastapi" }`; 취소면 무변경.
10. **옛 스캔 로그(records 없음)**: `tests/uninstall-legacy-scan.test.ts` 의 픽스처 모양으로 `policyFiles` 에 설치자 파일(`rules/ui-components.md` 와 같은 이름 · 다른 내용)이 섞인 기록 → `--track csr-fastapi` → 그 파일은 `recorded()` 필터에 걸려 `none` → 남는다(ADR-097 결정 1 "지우지 않는 쪽").

### 3.2 Docker 시나리오 — `test/docker/scenarios/scenario-uninstall-track.sh`

`scenario-uninstall-cli.sh`(1-50) 를 본보기로: `install --track tooling --track csr-fastapi --cli claude --cli codex` → `AGENTS.md` Project Context 채움 → `update` → `uninstall --track csr-fastapi --dry-run` → 실행 → 단언 ① csr 전용 룰·스킬 두 자리에서 없음 ② 공통 룰 · 방법론 스킬 · 훅 · 앵커 · `.codex/` 그대로 ③ `AGENTS.md` 에 `## UI Components` 없음 · 설치자 문단 있음 ④ 기록 `tracks: tooling` · `list` 도 같은 말(heal 대조) ⑤ `update` 한 번 더 → 백업 0 · 디스크 diff 0 ⑥ 대조군: 마지막 트랙 `--track tooling` 거절. `docker-scenarios.yml` 의 목록에 추가(게시를 막지 않는 신호, ADR-079).

### 3.3 적대적 리뷰 장면 후보 — 옛 npm 판 실설치(ADR-094 문턱 위 · `feedback_installer_disk_adversarial_review`)

| # | 옛 판 | 장면 | 봐야 할 것 |
|---|---|---|---|
| A1 | 26.161.0 (디스크 스캔 기록 · `records` 없음) | tooling+csr-fastapi claude+antigravity 설치 → 현행 `uninstall --track csr-fastapi` | 스캔 기록의 설치자 동명 파일이 남는가(`recorded()` 필터) · `.agents/rules/ui-components.md` 가 빠지는가 · 메타파일 sha 가 옛 기록에 있어 heal 과 맞물리는가 |
| A2 | 26.125.0 (파일 필드 없음) | 같은 설치 → `--track` | 후보가 `recordedTrackSpots`(1789) 에서 오고 `no-sha` → `templateNext` 로 바이트 비교 — 바이트 같으면 지우고 다르면 백업. 지문(ADR-111)이 끼는가 |
| A3 | ≤26.163.0 (마지막 install 트랙으로 덮은 기록) | `install --track tooling --cli claude` → `install --track csr-fastapi --cli codex` (기록 `[csr-fastapi]`, 메타 `tooling\ncsr-fastapi`) → 현행 `--track csr-fastapi` | heal 이 되살린 tooling 이 "남는 트랙" 으로 쓰여 tooling 자산이 보호되는가 · 쓰는 기록이 누적 트랙을 담는가 |
| A4 | 현행 | `.claude/skills/<id>` → `.agents/skills/<id>` 링크(#524) 상태에서 T 전용 스킬 제거 | 링크 자리 · 본문 둘 다 빠지고 끊어진 링크가 남지 않는가(`removeRecordedFile` 1908-1911 포인터 먼저) |
| A5 | 현행 | `.claude/skills` 폴더째 링크(#769 리뷰 HIGH-3 알려진 결함) | 이 설계가 더 나빠지지 않는가(같은 결과면 통과) |
| A6 | 현행 | antigravity 단독(클로드 없음 — 메타파일 없음) `--track` | 3 단계가 안전하게 건너뛰는가 · `.agents/rules/<T>` 만 빠지는가 |
| A7 | 현행 | T 전용 룰을 설치자가 지운 뒤 `--track` | `forgotten` 만, 화면 침묵(실재하는 것만 말한다) |
| A8 | 현행 | `--track` 뒤 `install --track T` 로 되돌리기 | T 자산이 다시 깔리고 기록 트랙 · 메타파일이 누적되는가(`record-tracks-accumulate` 대조) |

## 4. 결정 필요

| # | 질문 | 추천 | 대안 | 되돌리기 비용 |
|---|---|---|---|---|
| D1 | T 의 **기본 MCP 행**(`railway-mcp-server` · `chrome-devtools`)을 `.mcp.json` · Codex · OpenCode 에서 걷는가 | **남기고 화면이 drop 명령을 댄다.** 기록이 기본 행과 `--with` 선택을 구분하지 않는다(§1.3 ⑤ · ADR-101) — 걷으려면 몫 기록에 출처 필드를 더하는 구조 변경이고, 원격 MCP 는 설치자가 로그인까지 한 상태라 지우면 되돌리기가 비싸다 | 트랙 표의 기본 행이면서 `assets[]` 에 `--with` 기록이 없는 서버는 걷는다(기록 모양 변경 없이 추론 — 옛 판 `--with` 는 `assets[]` 에 안 남아 오탐) | 추천안은 되돌릴 수 있다(설치자가 명령 한 줄). 대안은 **설치자 디스크 삭제 범위 확대 → 사용자 결정** |
| D2 | T 의 **기본 외부 자산**(`frontend-design` 등 skill · `anthropic-data-plugin`)을 함께 빼는가 | **남기고 `--only <id>` 를 댄다**(`assetsLeftLines` 와 같은 줄). 자산은 CLI 소속도 트랙 소속도 아니라는 현행 규율(`settleCliLog` 1102 주석)과 같다 | T 의 조건(`any-track` 에 T 만 남고 남는 트랙이 없음)을 만족하는 `assets[]` 항목을 같은 실행에서 `--only` 와 같은 엔진으로 뺀다 | 추천안 되돌릴 수 있음. 대안은 플러그인 · npm 제거까지 번지는 **삭제 범위 확대 → 사용자 결정** |
| D3 | 루트 `CLAUDE.md` 의 `> Active track(s): …` 줄을 남는 트랙으로 바꾸는가 | **바꾼다** — 하네스가 쓴 인용 블록이라 식별된다(`TRACK_NOTE_MARK`, `project-claude-merge.ts:222`); 안 바꾸면 "Tooling, CSR FastAPI" 가 영구히 남는다(실험 세 장면) | 두고 범위 밖 관찰로 넘긴다(install 추가 때도 안 바뀌는 기존 결함) | 낮다 — 한 줄 텍스트 |
| D4 | `--track` 반복(`--track a --track b`) 허용 | **하나씩**(`--cli` 와 대칭 · 마지막 트랙 규칙이 단순) | 반복 허용 — 남는 집합으로 한 번에 계산(술어는 그대로) | 낮다 — 나중에 열 수 있다 |
| D5 | 트랙 제거를 **ADR-094 문턱 위**로 다루는가 | 예 — 설치자 디스크 삭제 경로. 머지 전 독립 리뷰 + 옛 npm 판 실설치 적대적 리뷰(§3.3) | — | — |

사용자 결정으로 표시한 것: D1 · D2 의 **대안**을 고를 때만(삭제 범위가 넓어진다). 추천안대로면 설계 검증 레인이 판정한다.

## 5. Non-Goals

- 외부 자산 · MCP 기본 행의 자동 제거(D1 · D2 추천안 기준 — 결정이 바뀌면 범위에 든다).
- 위저드 메뉴 문구 전면 개편(#523 의 나머지 요구) — 넷째 모드 한 항목과 라우터 hint 한 마디만.
- `--cli` · `--only` 엔진 변경 · 전량 uninstall 변경. `removeHarnessFiles` 의 내부는 손대지 않는다(범위 술어만 넘긴다).
- update 의 트랙 밖 회수(`reclaimOutOfTrack`)를 `.claude/` 로 넓히는 것 — "갱신" 이 설치자 디렉터리를 비우는 동작이 되는 것은 별도 결정이다(ADR-111 결정 5 와 같은 선). 트랙 제거는 **uninstall** 의 일이다.
- `update --only` 묶음 추가 · `.installed-tracks` 를 update 가 다시 쓰게 하는 것.
- 옛 판 지문 파일(은퇴 스킬 · 옛 커맨드) 정리 — 전량 uninstall 의 몫.

## 6. 가정

- 실 AI CLI 를 실행하지 않는 실험으로 충분하다 — 가설의 대상은 우리 CLI 의 파일 처리이고, 외부 도구(`npx skills` · `claude plugin`)는 mock 으로 같은 자리에 같은 모양의 파일을 둔다(Docker 시나리오의 mock 과 같은 방식). 실 도구 경로는 Docker 시나리오(§3.2)가 본다.
- 트랙 제거는 **uninstall 명령의 네 번째 범위**다(전량 · `--cli` · `--only` · `--track`). update 에 "빼기" 를 넣지 않는다(update 는 더하고 갱신만 한다 — `docs/USAGE.md:36` 의 계약).
- "T 전용" 의 뜻은 **현행 manifest 기준**이다(설계 시점의 배선). 트랙↔자산 배선이 바뀌면 같은 명령의 결과도 바뀌고, 그것이 옳다(배선 SSOT 는 `src/manifest.ts` 하나).
- 기록이 없는 프로젝트(클론 등)는 `list` · `update` · `uninstall` 과 같은 거절(`detectInstallState`, 252-258)을 받는다 — 새 판정이 없다.
- 트랙 제거 뒤 같은 트랙을 `install --track T` 로 다시 더하면 돌아온다(기록은 누적 더하기, `installer.ts:670`).

## 7. 범위 밖 관찰

- 루트 `CLAUDE.md` 의 `> Active track(s):` 는 **트랙을 더할 때도** 안 바뀐다(한 번만 쓴다, `project-claude-merge.ts:339`) — D3 를 추천안대로 하면 "더하기" 쪽도 같은 함수로 고칠 수 있다(이슈로).
- update 의 `demotedAgents` 안내(`src/update-mode.ts:1239`)와 `reclaimOutOfTrack` 의 `kept` 줄(`out-of-track.ts:89`)은 트랙 제거가 들어오면 "지워도 된다 · install --track 으로 기록하라" 대신 `uninstall --track <t>` 를 가리키는 편이 설치자에게 맞는 명령이다(문구만 — 이슈로).
- `recordedTrackTargets` 가 번들 스킬을 전부 대상으로 보는 것(`src/recorded.ts:107-110`)은 uninstall · update 의 소유 판정에는 안전한 쪽이지만, "이 트랙이 가져오는 것" 을 묻는 자리(여기 · `splitTrackFilled`)에서는 `claudeTargets` 를 써야 한다 — 두 술어가 있다는 사실을 주석 한 줄로 서로 가리키면 다음 사람이 헷갈리지 않는다.
- #769 리뷰 HIGH-3(`.claude/skills` 폴더째 링크)는 트랙 제거에서도 같은 모양으로 남는다(A5).

## 8. 근거 색인 (`docs/plans/543-design-evidence/`)

| 파일 | 내용 |
|---|---|
| `run-experiment.sh` | 실험 전부(장면 S1·S2·S3, mktemp, mock PATH, 스냅샷 · diff) — 재실행 가능 |
| `edit-log.mjs` | "기록에서 T 빼기" 를 흉내내는 두 모드(`spec-only` · `spec+meta`) |
| `track-diff.ts` | T 전용 집합을 두 술어(ⓐ `recordedTrackTargets` · ⓑ `buildManifest`)로 계산 — §1.4 |
| `mocks/npx` · `mocks/claude` | 실 도구 대체(네트워크 · 호스트 ~/ 쓰기 없음) |
| `out/<S>/screen-0-install.txt` | 설치 화면 |
| `out/<S>/edit-1a.txt` · `screen-1a-list-after-spec-only.txt` | `spec.tracks` 만 뺀 뒤 `list` — heal 이 되살린 증거(§1.3 ①) |
| `out/<S>/edit-1b.txt` · `screen-1b-list.txt` | 메타파일+sha 까지 바꾼 뒤 `list` |
| `out/<S>/track-diff-predicate.txt` | §1.4 표의 원자료 |
| `out/<S>/screen-2-update.txt` · `screen-3-update-again.txt` | update 화면 두 번(§1.2 의 ⊘ 줄 · 조용함) |
| `out/<S>/snap-A-after-install.txt` · `snap-C-after-update.txt` · `diff-A-C.txt` · `diff-C-D.txt` | 파일 목록·sha 스냅샷과 diff(`.git/` · `node_modules/` 제외) |
| `out/<S>/probe-after-update.txt` | T 전용 · 공통 경로의 잔존 여부 |
| `out/<S>/state-A.txt` · `state-C.txt` | 기록 요약(트랙 · 자산 · 필드 수) · `.mcp.json` 서버 · 메타파일 |
| `out/<S>/log-A.json` · `log-C-after-update.json` | 설치 기록 사본(설치 직후 · update 뒤) |
| `out/S1/diff-AGENTS-B-C.txt` | update 가 `AGENTS.md` 에서 뺀 `## UI Components` 절 |
| `out/<S>/root-claude-md-track-line.txt` | 루트 `CLAUDE.md` 의 `> Active track(s):` 줄(갱신 안 됨) |

실험 환경: macOS(darwin 27), Node 로 `dist/index.js` 직접 실행, 빌드 = 이 워크트리 `npm run build`(2026-10-15, main 912e0e7 기준). 호스트 `~/` 에는 쓰지 않았다(`HOME` 임시 폴더).
