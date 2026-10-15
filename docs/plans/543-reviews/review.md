# #543 `uninstall --track` — 머지 전 적대적 리뷰 (2026-10-15)

- 대상: `origin/feat/543-track-uninstall` @ 2c2b8bb (base main 912e0e7)
- 판정: **BLOCKER 1 · HIGH 2 · MEDIUM 2 · NOTE 6**
- 방법: main · 브랜치를 각각 `npm pack` 해 prefix 설치, 옛 판은 npm 실판(26.125.0 · 26.150.0 · 26.161.0 · 26.163.0)을 설치해 mktemp 프로젝트에서 실행. 실 AI CLI 는 실행하지 않았다(`npx skills` · `claude plugin` 은 `docs/plans/543-design-evidence/mocks/`, HOME 은 임시 폴더). 대조 축 ① = "남는 트랙만으로 브랜치가 처음 설치한 상태"(같은 basename `app/` 로 만들어 바이트 비교) ② = 같은 설치본 복사 두 벌에 main · 브랜치의 기존 명령.
- 근거: `evidence/scenes/*.txt`(장면별 화면 · 디스크 diff · 기록 · 비교), `evidence/scripts/`(재실행 스크립트), `evidence/docker/*.log`


## BLOCKER-1 — 빠질 이름 목록이 지우지 않을 것을 지운다고 말한다 (dry-run · 위저드 확인)

- 재현(현행 판, 플래그만): `install --track tooling --track csr-fastapi --cli claude --without ui-visual-review` → `uninstall --track csr-fastapi --dry-run`
  - 같은 화면 안에서 `○ remove 1 harness file(s) under .claude/` 와 `○ removes: rules ui-components · skills ui-visual-review` 가 함께 나온다. 실행은 `ui-components.md` 하나만 지운다(`scenes/EXCL.txt` NAMES CHECK `said-but-not-removed: ["skills/ui-visual-review"]`).
  - 위저드(실 TTY · pty + pyte 렌더)도 같다: 확인 화면 `· removes: rules ui-components · skills ui-visual-review` → 실행 디스크 diff 는 룰 하나(`scenes/wizard-W2.txt`).
- 실제 npm 판 설치본:
  - 26.163.0 (tooling@claude 뒤 csr-fastapi@codex): 그 판은 `ui-components` 룰을 깐 적이 없는데 `removes: rules ui-components` (`scenes/A3.txt`).
  - 26.161.0 (그 판은 `ui-components` 를 싣지 않았다) + 설치자가 같은 이름 `.claude/rules/ui-components.md` 를 직접 만든 경우: 목록은 지운다고 말하고 실행은 (올바르게) 남긴다 — 목록과 반대로 파일이 살아 있고 실행 화면은 그 파일을 언급하지 않는다(`scenes/A1.txt`).
  - 설치자가 이미 지운 T 전용 룰(`scenes/A7.txt`)도 같은 모양.
- 원인: `src/track-removal.ts` `trackRemovalNames(r)` 가 `r.only`(= `claudeTargets(기록 트랙) − claudeTargets(남는 트랙)`, 현행 manifest)만 본다 — 기록(`policyFiles` · `skillFiles` · `externalFiles`) · `excluded` · 디스크 어느 것도 보지 않는다. dry-run 은 `removeTrackAction` 의 `leftLines(preview)` 에서 이 줄을 내는데, 바로 옆의 엔진 미리보기 결과(`done.removed`)를 쓰지 않는다.
- 왜 블로커인가: 요청 기준 "화면이 하지 않은 일을 말하거나(빠질 것 목록 포함)" 에 그대로 걸리고, 사용자 추가 요구("빠질 룰·에이전트·스킬을 이름으로")가 설치 상태에 따라 틀린 이름을 낸다. 손실은 없다(실행 화면 · 디스크는 맞다). 고치는 비용은 작다.
- 고칠 방향: dry-run 은 엔진 미리보기의 `removed`(+ `backedUp`) 경로에서 이름을 묶는다. 위저드는 디스크를 안 보는 결정(설계 검증 NOTE 8)을 지키되 `only` 를 **기록에 있는 경로**(엔진의 `has` 와 같은 번들 경로 사상)와 교집합해 `excluded` · 옛 판 미설치분을 뺀다. "두 화면이 같은 함수" 요구는 "경로 목록 → 이름 줄" 함수 하나로 유지된다.

## HIGH-1 — MCP 기본 행을 빼라는 안내 명령이 Codex · OpenCode 에서는 빼지 않는다

- 재현: 4 CLI(`--cli claude --cli codex --cli opencode --cli antigravity --with vercel`)로 tooling+csr-fastapi 설치 → `uninstall --track csr-fastapi` → 화면이 준 drop 명령(`install --track tooling --without railway-mcp-server --without chrome-devtools`)을 그대로 실행.
  - `.mcp.json` 에서만 빠지고 `.codex/config.toml` · `opencode.json` 에는 `railway-mcp-server` · `chrome-devtools` 가 남는다. 기록 `spec.cli` 가 `["claude"]` 로 바뀐다(`clis` 는 넷 그대로). 다음 `update` 가 나머지 둘에서 뺀다. 같은 명령에 `--cli` 넷을 붙이면 한 번에 빠진다(대조, `scenes/mcp-drop-command.txt`).
- 원인: `trackLeftLines` 가 `--cli` 없이 명령을 조립한다. `--cli` 없는 install 은 기본 claude 하나로 렌더한다(설계 검증 NOTE 5 의 "기존 기록의 CLI 를 합치므로 --cli 없이 된다" 는 `clis` 기록에만 맞다). 같은 축으로 A8(`install --track csr-fastapi` 로 되돌리기)도 Codex 사본 `.agents/skills/ui-visual-review` 는 다음 update 까지 안 돌아온다(기존 install 동작 — USAGE 가 "the next update brings every installed CLI" 로 덮는다).
- 고칠 방향: 명령에 기록의 CLI 를 `--cli <c>` 로 모두 붙이거나 문장에 "then run update" 를 적는다. 앞쪽이 `spec.cli` 축소도 피한다.

## HIGH-2 — 루트 `CLAUDE.md` 하네스 블록 맞추기(설계 §9 ①)가 미리보기에 없고, 앵커 없는 옛 설치본에 끊어진 import 를 붙인다

- 재현 R1(26.125.0 실판, claude, 루트 앵커 `CLAUDE-uzys-harness.md` 없음 — 그 판의 앵커는 `.claude/CLAUDE.md`): `uninstall --track csr-fastapi --dry-run` 은 CLAUDE.md 를 언급하지 않는다 → 실행 `✓ CLAUDE.md — harness block refreshed (본문 보존)` → 루트 `CLAUDE.md` 끝에 `uzys-harness:import` 마커 블록과 `@CLAUDE-uzys-harness.md` 가 **새로 붙는다** — 그 파일은 디스크에 없다(다음 update 가 앵커를 만들 때까지 끊어진 import). 설치자 본문은 보존(`scenes/root-claude-md.txt`).
- 재현 R2(현행): 설치자가 루트 `CLAUDE.md` 에서 하네스 블록을 지운 상태 → `--track` 이 블록을 다시 붙인다. update 도 같은 일을 하므로(같은 파일의 대조) 결과는 update 와 정합이지만 **미리보기가 예고하지 않는다**. T1(의도한 장면)도 예고 없음 — 구현자 본인 지적과 같다.
- 원인: `rootImportLines`(`src/commands/uninstall.ts`)가 update 의 가드(앵커가 있을 때만 `upsertRootImport` — `src/update-mode.ts` syncHarnessAnchor)를 거치지 않고 claude 기록 + 파일 존재만 본다. 미리보기 경로는 이름 줄만 낸다.
- 고칠 방향: 기록된 앵커(`templates.rootClaudeMd`)가 디스크에 있고 마커 블록이 이미 있을 때만 블록 안을 갱신한다(새로 붙이지 않는다). 미리보기는 `upsertHarnessImport` 결과를 계산만 해 "would refresh the harness block in CLAUDE.md" 를 낸다.

## MEDIUM

- **M1 재렌더 줄이 바뀐 것 없이도 나온다**(구현자 지적 확인): `full+tooling` 에서 `--track tooling` → 디스크 변화는 기록 · 메타파일뿐인데 `✓ AGENTS.md — re-rendered for Codex · OpenCode · Antigravity` (`scenes/T2b.txt`). `--cli` 에서는 늘 바뀌어 드러나지 않던 줄이다. 바이트가 같으면 줄을 빼는 쪽이 원칙("실제로 한 일만")에 맞다.
- **M2 A4 · A5 단위 테스트 부재**: 실설치로는 기대대로(A4 = 끊어진 링크 남음, 검증 NOTE 3 · A5 = main 전량 uninstall 과 같은 미리보기/실행 수 어긋남, `scenes/A5-control.txt`). 회귀 그물로 단위 테스트 하나씩이 있으면 좋다.

## NOTE

1. **`--with ui-visual-review`(트랙 기본 스킬을 명시 선택)도 빠진다** — 기준 설치(tooling + `--with ui-visual-review`)에는 있다(`scenes/WITHT.txt`). 기록이 내장 스킬의 명시 선택을 남기지 않는 기존 한계(설계 §1.4)이고 화면이 이름으로 말하므로 블로커는 아니다. USAGE 한 줄 감.
2. **AGENTS.md 백업이 화면에 안 나온다**(26.150.0 설치본, `scenes/A1s.txt`) — main 의 `--cli opencode` 도 같다(`scenes/old-version-controls.txt`). 기존 결함.
3. **`saved a copy as AGENTS.md.backup-<time>`** — 실행 화면이 실제 이름 대신 `<time>` 을 찍는다(`scenes/S1-current-4cli.txt`). main `rerenderLines` 그대로(기존).
4. **`--track 3` · `--track ""`** → `ERROR: (s.value ?? "").trim is not a function`(exit 1, 무변경, `scenes/preconditions*.txt`). cac 가 숫자로 바꾼 값 — main 의 `--cli` 도 같은 식(`(options.cli ?? "").trim()`)이라 기존 모양.
5. **위저드 MCP 판정 루트**(`resolveBundleRoot()` vs `harnessRoot`)는 배포본에서 같은 곳(`<pkg>/dist/..`)을 가리킨다 — 실 TTY 확인 화면의 MCP 줄이 dry-run 과 같다(`scenes/wizard-W1.txt`). 구현자 우려는 src 직행(tsx)에서만 갈린다.
6. **옛 판 지문 파일**(26.125.0 `ui-visual-review/SKILL.md`)은 백업 없이 빠진다 — 현행 번들 자리라는 ADR-111 판정 그대로(검증 NOTE 9). 그 자리를 현행 판이 다시 채우지는 않지만 설치자 내용이 아니므로 손실은 아니다.

## 장면 표

| 장면 | 설치 | 결과 | ① 기준 설치와 차이(D1·D2·D3·스캐폴드 외) | update 조용 | 판정 |
|---|---|---|---|---|---|
| S1 현행 4 CLI, 룰 고침, AGENTS.md 설치자 절 | branch | 룰 백업 뒤 제거 · 4 파일 · AGENTS.md 절 빠지고 설치자 절 보존 | AGENTS.md 끝 공백 차이만 | ✓ ✓ | 통과 |
| A1 26.161.0 스캔 기록 직행 | npm | 스킬 1 제거 · 설치자 노트 보존 | 옛 판 잔재(settings 몫 등) | 1차 = 판 올림 | BLOCKER-1(목록) |
| A1u 26.161.0 → update → --track | npm | 룰 백업 · 4 파일 · 노트 보존 | 옛 판 settings 몫 외 없음 | ✓ ✓ | 통과 |
| A1s 26.150.0 옛 스킬 스캔 + 설치 전 노트 | npm | 고친 SKILL.md 백업 · 노트 보존 | 판 올림 | 대조와 같음 | NOTE 2 |
| A2 26.125.0 필드 없음 | npm | 룰 no-checksum 백업 · 스킬(지문) 제거 · 메타 sha 없음 → heal 없음 | 판 올림 | 대조와 같음 | HIGH-2(R1) |
| A3 26.163.0 덮어쓴 기록 | npm | heal 된 tooling 이 남는 트랙으로 보호 · codex 스킬만 제거 | 없음 | 1차 = 판 올림 · 2차 ✓ | BLOCKER-1(목록) |
| A4 현행, 스킬 슬롯 링크 | branch | 본문 제거 · 끊어진 링크 남음(NOTE 3 기대값) | 링크 | ✓ ✓ | 통과 |
| A5 현행, .claude/skills 폴더 링크 | branch | 미리보기 3 / 실행 2 — main 전량도 같음 | — | ✓ ✓ | 통과(악화 없음) |
| A6 antigravity 단독 | branch | .agents/ 2 · 메타 없음 · 기록 갱신 | 없음 | ✓ ✓ | 통과 |
| A7 설치자가 T 룰 지움 | branch | 스킬만 제거 · 기록만 정리 · 실행 화면 침묵 | 없음 | ✓ ✓ | BLOCKER-1(목록) |
| A8 --track 뒤 install --track 되돌리기 | branch | 트랙 · 메타 누적 | codex 사본은 update 까지 없음 | ✓ ✓ | HIGH-1 과 같은 축(기존 동작) |
| T1 tooling+executive → --track tooling | branch | 29+25 파일 · 상시 스킬 · AGENTS.md 안내 빠짐 · 루트 블록 갱신 · 설치자 위/아래 줄 보존 | 없음 | ✓ ✓ | HIGH-2(예고 없음) |
| T2 full+tooling 4 CLI → --track full | branch | 4+2 · cli-development 남음 | 없음 | ✓ ✓ | 통과 |
| T2b full+tooling → --track tooling | branch | 파일 0 · 기록만 | 없음 | ✓ ✓ | M1 |
| DATA 4 CLI, 에이전트 고침 | branch | 백업 뒤 제거 · plugin 남김 줄 | 없음 | ✓ ✓ | 통과 |
| DISP 설치자 동명 파일 3개 | branch | 셋 다 제자리로 | 없음 | ✓ ✓ | 통과 |
| WITH --with gemini-delegate | branch | 옵트인 스킬 두 자리 남음 | 없음 | ✓ ✓ | 통과 |
| WITHT --with ui-visual-review | branch | 그 스킬도 빠짐 | 기준에는 있음 | ✓ ✓ | NOTE 1 |
| EXCL --without ui-visual-review | branch | 룰만 | 없음 | ✓ ✓ | BLOCKER-1 |
| AGB 설치 전 설치자 AGENTS.md(블록 모델) | branch | 블록만 재렌더 · 설치자 줄 보존 | 없음 | ✓ ✓ | 통과 |
| W1 위저드 3 CLI | branch(TTY) | 확인 화면 이름 = 실제 제거 · MCP 줄 = dry-run | — | — | 통과 |
| W2 위저드 --without | branch(TTY) | 확인 화면에 없는 스킬 | — | — | BLOCKER-1 |
| W3 위저드 취소 | branch(TTY) | 무변경 | — | — | 통과 |
| 전제 검사 | branch | 모르는 트랙 · 없는 트랙 · --cli/--only 동반 · 마지막 트랙 · 기록 없음 거절, 무변경 · --yes 동반은 트랙만 · 어휘 밖 문자열 보존 | — | — | 통과(NOTE 4) |

"D1·D2·D3·스캐폴드" = 결정대로 남는 MCP 행(.mcp.json · .codex/config.toml · opencode.json · 몫 기록) · 외부 자산(assets[] · 그 파일) · 루트 CLAUDE.md 의 Active track(s) 줄 · .github/workflows/ci-python.yml · e2e.yml · .env.example(설계 §9 ⑤). .codex/config.toml 은 절대 경로가 들어 있어 늘 다르다.

## 회귀 ② — 기존 명령(main vs 브랜치, 같은 설치본 복사 두 벌)

설치본 5종(현행 4 CLI + 편집 · 26.161.0 · 26.125.0 · 스킬 슬롯 링크 · displaced) × 명령 8종(uninstall --yes · --yes --dry-run · --cli codex · --cli codex --dry-run · --cli claude · --cli claude --dry-run · update · uninstall --only frontend-design): 화면 · 디스크 · 기록이 모두 같다. 다른 것은 update 의 경로 묶인 파일(.codex/config.toml 절대 경로 · update-backups.json)뿐(scenes/regress-*.txt). 옛 판에서 범위 제거 뒤 update 수렴도 --track · main/브랜치 --cli · 대조(아무것도 안 뺌)가 같다 — update#2 1줄 · #3 0(scenes/old-version-churn.txt).

## 구현자가 미심쩍다고 본 곳

| 지점 | 판정 |
|---|---|
| dry-run 이 루트 블록 갱신을 예고하지 않는다 | 사실 — HIGH-2 로 올림(앵커 없는 옛 판에서 끊어진 import 까지) |
| 재렌더 줄이 바이트가 그대로여도 re-rendered | 사실 — M1 |
| 위저드 MCP 판정 루트 resolveBundleRoot() vs harnessRoot | 배포본에선 같은 곳 — NOTE 5 |
| A4 · A5 단위 테스트 없음 | 실설치로 기대 결과 확인 — M2 |

## ci · docker

- npm run ci(브랜치, 파이프 없이): **exit 0** · Test Files 168 · Tests 2475 · 커버리지 statements 95.54 / branches 89.7 / functions 95.92 / lines 96.84.
- 음성 대조 1건: settleTrackLog 의 메타파일 쓰기를 빼면(typecheck 통과) tests/uninstall-track.test.ts 2 가 빨간불 — 소스는 되돌렸다.
- docker(레인 전용 태그 rev-543-branch:review, 고정 태그 미사용): scenario-uninstall-track PASS · scenario-uninstall-cli PASS · scenario-uninstall PASS (evidence/docker/*.log). 이미지는 지웠다.

## 실행 환경과 재실행

호스트에서 하네스 CLI(npm pack 한 main · 브랜치 · npm 옛 판)를 돌렸다 — HOME 은 장면마다 임시 폴더, PATH 앞에 mock(npx skills · claude plugin), npm 은 --prefix 설치. 호스트 ~/.claude/plugins/cache/test-marketplace 부재를 확인했고(대조: 같은 경로가 장면 임시 HOME 에는 있다), 실 AI CLI 는 실행하지 않았다.

- evidence/scripts/setup.sh — scratch(REV_SCRATCH)의 packs/main.tgz · packs/branch.tgz 와 npm 옛 판을 prefix 설치
- evidence/scripts/scene.mjs <장면>… — 장면 정의는 scenes-def.mjs, 요약은 python3 summ.py <장면>
- regress.mjs cur4 v161 v125 link disp · wiz-scene.mjs W1 W2 W3(REV_PY = pyte 있는 python) · precond.mjs · precond2.mjs · mcpdrop.mjs · rootmd.mjs · a5ctl.mjs · oldctl.mjs · oldchurn.mjs · s1.mjs

## 한계

- 실 AI CLI(Claude Code · Codex 등)가 끊어진 import · 남은 MCP 행을 실제로 어떻게 읽는지는 보지 않았다(호스트 실행 금지).
- 외부 자산은 mock 이 둔 SKILL.md 하나뿐이다 — 실 npx skills 의 파일 모양은 docker 시나리오 쪽 mock 과 같은 수준.
- 옛 판은 26.125 · 26.150 · 26.161 · 26.163 넷(26.169 는 설치만). 26.64–26.139 옛 앵커 판 중 26.125 만 봤다.
- 밖 링크(ADR-098) · Windows 장면은 돌리지 않았다.


---

## 2차 (2026-10-15, 426be8d · 763e56d, 영향받은 곳만)

- 판정: **BLOCKER 1(새로 드러남) · MEDIUM 1 · NOTE 3** — 1차의 BLOCKER-1 · HIGH-1 · HIGH-2 · M1(실행 줄) · NOTE 4 는 해소를 재현으로 확인했다.
- 증거: `evidence/r2/`(440K). 브랜치를 다시 `npm pack` 해 설치, 1차와 같은 스크립트를 `REV_OUT` 만 바꿔 돌렸다.

### 1. 빠질 이름 목록 (1차 BLOCKER-1) — 해소

| 장면 | 목록 | 실제로 지운 것 |
|---|---|---|
| A1 26.161.0 + 설치자 동명 룰 | skills ui-visual-review | 같음(설치자 룰은 남고 목록에도 없음) |
| A3 26.163.0 덮어쓴 기록 | skills ui-visual-review | 같음 |
| A7 설치자가 룰 지움 | skills ui-visual-review | 같음 |
| EXCL --without ui-visual-review | rules ui-components | 같음 |
| W2 위저드(실 TTY) --without | rules ui-components | 같음 |
| A2 26.125.0 · T1 · T2b · DATA | 엔진 미리보기와 같음 | 같음 |

NAMES CHECK 는 모든 장면에서 `said-but-not-removed: []` · `removed-but-unsaid: []` 다. 예외로 보이는 DISP 의 `rules ui-components` 는 하네스 판을 지우고 설치자 원본을 제자리로 되돌린 경로라 같은 경로에 파일이 남는 것이고, 화면이 `put back` 줄로 함께 말한다.

설치자가 고친 파일은 이름 목록에 다른 이름과 같은 모양으로 나온다(`removes: agents data-analyst`). dry-run 은 위 줄 `remove 1 harness file(s) … (1 with a copy saved beside as *.backup-<time>)` 로 백업을 알리지만, 위저드 확인 화면에는 이름 줄만 있어 백업 예고가 없다(W4, NOTE r2-1). 실행 화면은 `backed up … you edited it — saved as …` 로 말한다.

### 2. MCP 안내 명령 (1차 HIGH-1) — 해소

화면 명령이 `install --track tooling --cli claude --cli codex --cli opencode --cli antigravity --without railway-mcp-server --without chrome-devtools` 로 바뀌었다. 그대로 실행하면 `.mcp.json` · `.codex/config.toml` · `opencode.json` 셋 다에서 두 서버가 빠지고 `vercel`(--with)은 남는다. 기록 `spec.cli` 는 넷 그대로이고, 이어서 update 를 돌려도 디스크 변화가 없다(`r2/mcp-drop-command.txt`). 위저드 확인 화면에도 같은 명령이 나온다(W1 · W2).

### 3. 루트 CLAUDE.md 블록 (1차 HIGH-2)

- R1(26.125.0 실판, 루트 앵커 없음): dry-run 이 CLAUDE.md 를 말하지 않고, 실행해도 바이트가 같다 — 끊어진 import 가 생기지 않는다. **해소**
- R2(현행, 설치자가 블록을 지움): 다시 붙이지 않는다(대조로 돌린 update 는 붙인다 — 이번 가드가 update 보다 보수적이다). **해소**
- T1: 미리보기 `○ would refresh the harness block in CLAUDE.md (본문 보존)`, 실행 `✓ … refreshed (본문 보존)`, 설치자 위·아래 줄 보존, update 두 번 조용. **해소**
- ⓐ 상시 스킬 폴더 하나(user-centered-explanation)에 설치자 노트(T1N): 미리보기와 실행이 모두 refresh 를 말하고 실제로 갱신한다(model-orchestration 만 빠지고 uce 는 폴더가 남아 안내에 남는다 — update 의 폴더 존재 기준과 같아 update 조용). 화면 어긋남 없음.
- **ⓐ' 두 폴더 모두에 노트(T1N2): 어긋난다 → BLOCKER r2-1.**
- ⓑ 깨진 CLAUDE.md:
  - BRK1(시작 마커와 import 줄을 지우고 끝 마커만 남김): 미리보기와 실행 모두 블록을 **새로 붙인다**고 말하고 실제로 붙인다(시작 1 · 끝 2 · import 1). 같은 파일에 update 를 돌린 대조(BRK1U)도 같은 결과라 update 와 정합이다. NOTE r2-2.
  - BRK2(시작 마커만 지움, import 줄 남음): 미리보기와 실행 모두 아무것도 안 한다. 일치.

### BLOCKER r2-1 — 미리보기는 루트 블록을 갱신한다고 말하고 실행은 갱신하지 않는다(상시 스킬 폴더 둘 다에 설치자 파일이 있을 때)

- 재현: `install --track tooling --track executive --cli claude --cli codex` → 설치자가 `.claude/skills/user-centered-explanation/my-notes.md` 와 `.claude/skills/model-orchestration/my-notes.md` 를 둔다 → `uninstall --track tooling --dry-run` 은 `○ would refresh the harness block in CLAUDE.md (본문 보존)` → 실행 화면에는 그 줄이 없고 루트 CLAUDE.md 는 그대로다(두 스킬을 계속 안내). 이어지는 update 두 번은 조용하다(`r2/T1N2.txt`).
- 원인: `trackNotes` 가 미리보기에서는 `d.removed` 에 SKILL.md 가 든 스킬을 "빠진 것" 으로 치고, 실행에서는 회수 뒤 폴더 존재로 판정한다(update 와 같은 기준). 설치자 파일이 남은 폴더는 실행에서 "있음" 이 되어 두 판정이 갈린다. 노트가 한 폴더에만 있으면 다른 스킬 때문에 어차피 갱신되어 드러나지 않는다(T1N).
- 왜 블로커로 두었나: 1차와 같은 기준("화면이 하지 않은 일을 말하거나")에 그대로 걸린다. 다만 범위는 좁고(마지막 dev 트랙을 빼면서 두 상시 스킬 폴더에 모두 설치자 파일이 있을 때), 손실은 없으며, 실행 결과 자체는 update 와 맞다.
- 고칠 방향: 미리보기의 "빠지는 스킬" 을 "이번에 지울 파일을 빼면 폴더에 남는 것이 없는 스킬" 로 센다. 실행과 같은 질문(회수 뒤 폴더가 있는가)을 미리보기 입력으로 묻는 꼴이다.

### 4. 재렌더 줄(M1) · --cli 회귀

- T2b 실행 화면: 디스크 변화가 기록 · 메타파일뿐이고 AGENTS.md 줄이 없다. **해소**
- **MEDIUM r2-1:** 같은 장면의 dry-run 은 여전히 `○ would re-render AGENTS.md for Codex · OpenCode · Antigravity (your sections kept)` 를 말한다. 미리보기 조건은 main 의 `--cli` 와 같다(읽는 CLI 가 남는가)이고 렌더 자체는 실행되므로 거짓이라기보다 과한 예고다. 실행과 맞추려면 미리보기도 렌더 결과를 비교한다.
- --cli 회귀: 1차 행렬(설치본 5종 × 명령 8종)을 다시 돌렸다. `--cli codex` · `--cli claude`(각 dry-run 포함)는 5종 모두 **화면 · 디스크 · 기록이 main 과 같다**. 이 표본에서는 `--cli` 재렌더가 늘 바이트를 바꿔 줄이 그대로 나오므로 화면 차이도 없다(줄이 사라지는 `--cli` 장면은 이 행렬에 없다). `update` 의 절대경로 파일과 `update-backups.json` 차이는 1차와 같다(`r2/regress-*.txt`).

### 5. 그 밖

- NOTE 4 해소: `--track 3` → `ERROR: Invalid --track value: 3` 와 어휘 목록(exit 1, 무변경). 값 없는 `--track` 은 cac 가 먼저 거절한다.
- `npm run ci`(파이프 없이): **exit 0** · Test Files 168 · Tests 2482 · statements 95.57 / branches 89.73 / functions 95.9 / lines 96.87.
- docker(레인 전용 태그 `rev-543-branch:r2`): `scenario-uninstall-track` · `scenario-uninstall-cli` · `scenario-uninstall` 모두 PASS(`r2/docker/*.log`). 이미지는 지웠다.
- 위저드(실 TTY): W1 · W2 · W4 는 확인 화면 이름과 실행 디스크 diff 가 같고, W3(취소)는 무변경이다. 위저드가 commands/uninstall 을 import 하는 순환 import 는 배포본에서 정상 동작한다.

### NOTE (2차)

1. **r2-1 위저드 확인 화면에 백업 예고가 없다** — 설치자가 고친 파일도 이름 줄에 그냥 나오고, 백업 사실은 dry-run 의 수 줄과 실행 화면에만 있다(W4). 손실은 없다.
2. **r2-2 끝 마커만 남은 깨진 CLAUDE.md 에는 새 블록을 붙인다**(BRK1) — 마커가 하나라도 있으면 "블록 있음" 으로 보는 판정(`stripHarnessImport`)이라 그렇다. update 도 같은 일을 하고 미리보기도 예고한다. 결과 파일에 끝 마커가 둘 남는다.
3. **r2-3 DISP 의 이름 목록** — `removes: rules ui-components` 와 `put back … ui-components.md` 가 함께 나온다. 하네스 판을 지우고 설치자 원본을 되돌린 것이라 둘 다 맞는 말이다.

### 2차 장면 표

| 장면 | 확인한 것 | 결과 |
|---|---|---|
| A1 · A3 · A7 · EXCL | 목록 = 실제 | 통과 |
| W1 · W2 · W4 (TTY) | 확인 화면 목록 = 실제 · MCP 명령 --cli | 통과(NOTE r2-1) |
| W3 (TTY) | 취소 무변경 | 통과 |
| DATA · DISP | 고친 파일 백업 · displaced 되돌림 · 목록 | 통과(NOTE r2-3) |
| mcp-drop | 안내 명령으로 세 CLI 모두 빠짐 · spec.cli 유지 | 통과 |
| R1 (26.125) · R2 | 블록을 새로 붙이지 않음 | 통과 |
| T1 · T1N | 미리보기 = 실행 · update 조용 | 통과 |
| T1N2 | 미리보기 refresh · 실행 무변경 | BLOCKER r2-1 |
| BRK1 · BRK1U · BRK2 | 깨진 블록 | update 와 같음(NOTE r2-2) |
| T2b | 실행 재렌더 줄 없음 · 미리보기 줄 남음 | MEDIUM r2-1 |
| A2 (26.125) | 목록 = 실제 · update 수렴은 대조와 같음 | 통과 |
| 회귀 5×8 | --cli · 전량 · --only 가 main 과 같음 | 통과 |
| 전제 검사 | --track 3 거절 문구 | 통과 |

### 2차 한계

- 1차와 같은 실행 환경과 한계를 그대로 안는다(호스트 실행, 임시 HOME 과 mock, 실 AI CLI 미실행).
- `--cli` 재렌더 줄이 사라지는 장면(바이트가 그대로인 `--cli`)은 행렬에 나오지 않아 직접 보지 못했다.
- 1차 장면 중 A4 · A5 · A6 · A8 · T2 · WITH · WITHT · AGB 는 이번 수정과 겹치지 않는다고 보고 다시 돌리지 않았다.


---

## 3차 (2026-10-15, 4a2a3e0 · 6220b7b, BLOCKER r2-1 영향 장면만)

- 판정: **통과(BLOCKER 0)**. 2차의 MEDIUM r2-1(T2b 미리보기의 재렌더 예고)과 NOTE r2-2 · r2-3 은 이번 범위 밖이라 그대로 남는다. NOTE r2-1(위저드 백업 예고)은 해소됐다.
- 증거: `evidence/r3/`(120K). 브랜치를 다시 pack 해 설치하고 이전 스크립트를 그대로 돌렸다.

| 장면 | 미리보기 | 실행 | 루트 CLAUDE.md | 판정 |
|---|---|---|---|---|
| T1N2(상시 스킬 두 폴더 모두에 노트) | 블록 예고 없음 | 줄 없음 | 바이트 그대로, uce · mo 둘 다 안내(두 폴더가 남음) | 일치 · r2-1 해소 |
| T1N(uce 폴더에만 노트) | would refresh | refreshed | mo 만 빠지고 uce 는 남음 | 일치 |
| T1 | would refresh | refreshed | 두 안내 빠짐 · 설치자 위/아래 줄 보존 · 2차와 같은 바이트 | 일치 |
| R1(26.125.0) · R2 | 언급 없음 | 언급 없음 | 바이트 그대로 | 일치 |
| BRK1(끝 마커만) | would refresh | refreshed | 새 블록이 붙음(시작 1 · 끝 2) — update 와 같음 | 일치(NOTE r2-2) |

이어서 돌린 update 두 번은 T1 · T1N · T1N2 · BRK1 모두 조용했다.

- **W4(실 TTY 위저드, 고친 data-analyst):** 확인 화면에 `remove 1 harness file(s) under .claude/ (1 with a copy saved beside as *.backup-<time>)` 이 이름 줄 위에 나온다. 실행 결과는 백업 뒤 제거로 화면과 같다. W1 도 수 줄 · 이름 줄이 실제 제거와 같다.
- **docker 제외 범위:** 컨테이너 안에서 시나리오를 돌린 뒤 같은 프로젝트에서 계산했다(`r3/docker/external-check.log`).
  - `EXTERNAL` 은 외부 자산 폴더 6개다(`.claude/skills/` 와 `.agents/skills/` 각각의 frontend-design · shadcn · vercel-react-best-practices).
  - 비교에서 빠지는 파일은 그 폴더들 아래 파일과 `skills-lock.json` 뿐이다.
  - 하네스 기록 경로 99개(policyFiles · skillFiles · externalFiles)와 겹치는 것은 0개이고, `objective-brief` 같은 하네스 스킬은 비교 대상에 남는다.
  - 레인 전용 태그 `rev-543-branch:r3` 로 `scenario-uninstall-track` 이 PASS 했다(`r3/docker/uninstall-track.log`). 이미지는 둘 다 지웠다.
- `npm run ci`(파이프 없이): **exit 0** · Test Files 168 · Tests 2484 · branches 89.72.
- 한계: 이전 차수와 같다(호스트 실행 · 임시 HOME 과 mock). 겹침 판정은 정렬한 경로 목록의 `comm` 으로 했다.
