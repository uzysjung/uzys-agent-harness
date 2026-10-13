# PR #811 (#796 PR-A) 적대적 손실 탐색 — npm 게시판 옛 판 실설치 × 컨테이너

- 대상: PR `7803f76`(격리 워크트리 `iso796r2`) · 대조군 ① main `c7773a0`(`git archive origin/main` 으로 따로 빌드 — PR-0 #809 · #797 #810 포함) · 대조군 ② **npm 게시판 26.170.0**(PR-0 이전 — main 에 이미 든 변경과 PR-A 의 변경을 가르려고 추가)
- 방법: 이미지 하나(`uzys-r796a-x` / `-x2`)에 PR 빌드(`agent-harness`) · main 빌드(`ah-main`) · 26.170.0(`ah-rel`) · 옛 판 5개(`/opt/old/<v>`, `npm install` = `npx -y` 와 같은 tarball)를 넣고 판마다 컨테이너 하나. 이미지·컨테이너는 끝난 뒤 지웠다(잔존 0 확인).
- 판: 26.100.0 · 26.125.0(S0/S1 — 스캔 필드 없음) · 26.132.0(S3) · 26.150.0 · 26.161.0(S4) / CLI 조합: {claude} · {claude,codex}
- 실행 수: **본 매트릭스 100회**(5판 × 2조합 × 흐름 5 × PR/main) + 26.170.0 대조 10회 + 부분 update 직후 uninstall 24회 + opt-in 표적 2회 + 헬퍼 표적 6회 = **142회**

## 흐름 · 표식

| 흐름 | 순서 |
|---|---|
| A | 옛 판 install → 표식 → update ×3 → uninstall --yes |
| S · N · H | 옛 판 → 표식 → `update --only skills` / `--only new-skills` / `--only hooks` → update ×2 → uninstall |
| D | 옛 판 install `--with model-orchestration` → 표식 + 기록된 스킬 폴더 2개(`gh-issue-workflow` · `model-orchestration`) 삭제 + 기록된 하네스 룰(`cli-development.md`) 삭제 → update ×3 → uninstall |
| P1–P4 | 옛 판 → 표식 → `update --only skills\|new-skills\|hooks\|rules` → **바로** uninstall (기록이 부분만 갱신된 상태) |
| *m · *r | 같은 흐름을 main / 26.170.0 으로 |

표식(토큰마다 고유, 단어 단위 grep): 하네스 룰 편집 2(`git-policy` · `test-policy`) · 에이전트 편집(`reviewer.md`) · 훅 편집(`session-start.sh`) · 번들 스킬 `SKILL.md` 편집(`north-star`) · 번들 스킬 안 노트 2(`north-star/my-notes.md` · `compaction-handoff/refs/mine.md`) · 자기 룰 · 자기 스킬 · 자기 에이전트(하네스 밖 이름) · **하네스 이름의 자기 파일**(옛 판이 안 깐 현행 트랙 대상 룰 · 에이전트 · 스킬 폴더 + 그 안 노트, 다른 트랙 룰 `ui-components.md`, opt-in 스킬 이름 `ui-visual-review/SKILL.md`, 은퇴 이름 `rules/database.md`) · 은퇴 룰·에이전트 편집(`code-style.md` · `code-reviewer.md`) · 헬퍼 편집(`.uzys-agent-harness/check-absence.sh`) · `settings.json` 자기 훅 줄 + 스크립트 · codex 조합은 `.agents/skills` 자기 스킬 · 노트 · 편집, `.codex/config.toml` 자기 서버, `AGENTS.md` 자기 절.
판정: 각 단계 뒤 표식마다 **LIVE / 백업에만 / LOST**, 기록 항목 중 **설치자 내용의 sha 를 하네스 것으로 적은 것**, `records` 필드, 단계별 새 백업 수, uninstall 뒤 남은 파일 중 **번들 템플릿과 바이트가 같은 것**.

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | pass — PR-A 가 새로 만든 손실 · 기록 오염 0 |
| HIGH | 2 | warn — **둘 다 main 에 이미 있는 동작**(PR-A 가 만들지도 악화시키지도 않음). HIGH-1 은 게시판 26.170.0 대비 회귀라 다음 릴리즈 전에 닫아야 한다 |
| MEDIUM | 2 | info — 기존 동작(main 같음) |
| LOW | 0 | pass |

## 판정: **PASS with notes**

### PR-A 성공 기준 (설계 §6 PR-A 행) — PR 실행 기준

| 기준 | 결과 | 근거 |
|---|---|---|
| MINE 표식 전부 LIVE 또는 `.backup-*` | **PR-A 로 생긴 위반 0.** LOST 는 헬퍼 편집 1종뿐(26.150 · 26.161 의 20회) — main 20회 · 26.170.0 도 같다 → HIGH-2(기존) | `matrix.txt` 4열 · `matrix-rel.txt` |
| update 뒤 기록에 MINE(설치자 내용) 0 | **PR-A 로 생긴 위반 0.** 26.100 · 26.125 에서 은퇴 claims 가 설치자 내용 3건을 sha 로 적는다 — main · 26.170.0 같음 → MEDIUM-1. 하네스 이름의 자기 스킬 파일이 `displaced` 없이 하네스 sha 로 적힌다 — main 같음, 26.170.0 은 `displaced` → HIGH-1 | `matrix.txt` 6열 · `samples/` record |
| update 가 `records` 를 쓰지 않음 | 충족 — 134회 전부 `records` 없음 | `matrix*.txt` 7열 |
| 은퇴 claims 존재 | 충족 — 26.100(5/5 표본) · 26.125(4/4, 그 판이 깐 것) 첫 update 뒤 `policyFiles` 에 있음. 26.132+ 는 옛 기록에 이미 있다 | `matrix.txt` 8열 |
| update 2회차 백업 0 | 26.132 · 26.150 · 26.161 전부 0. **26.100 · 26.125 의 A · D 는 2회차 13개**(은퇴 claims 회수 — 설계 §1.2 ③ 의 "전" 동작, PR-B 범위, main 도 13) → 3회차 0. S · N · H 는 부분 update 가 claims 를 먼저 적어 첫 full update 에서 회수 → 2회차 0 | `matrix.txt` 9열 |
| uninstall 뒤 하네스 바이트 0 | 충족 — PR 50회 + 부분 12회 전부 0. **main 은 본 매트릭스 50회 전부 2–3개 남긴다**(`data-analyst.md` · `strategist.md` · `ui-components.md`) | `harness-bytes-after-uninstall*.txt` |

## Findings

[HIGH-1] 하네스 이름의 자기 스킬 폴더가 "체크섬 없는 하네스 파일"로 읽힌다 — update 는 덮고 `displaced` 를 안 남겨 uninstall 이 되돌리지 않고, uninstall 은 하네스가 쓴 적 없는 자기 파일을 치운다 (main 의 PR-0 #809 가 만든 회귀 · PR-A 는 동일)
File: src/recorded.ts:223-228 `scanFieldOf`(스킬 폴더 단위 — PR-0) · PR-A 가 주석으로 같은 전제를 다시 적음 recorded.ts:212 "폴더 단위로 읽어도 옛 스캔엔 같은 답"
Issue:
- 장면 ⓐ(update): 26.161 설치본에 설치자가 `.claude/skills/natural-korean/SKILL.md`(그 판 tooling 은 안 깐 이름, 현행은 기본) 를 직접 만들었다. PR · main update 는 그것을 백업하고 하네스 판으로 덮은 뒤 **`displaced` 없이** `skillFiles` 에 하네스 sha 로 적는다 → uninstall 이 하네스 판을 지우고 **설치자 원본을 되돌리지 않는다**(백업에만 남음). 26.132 · 26.150 의 `objective-brief` 도 같다(PR 30회 · main 30회). **26.170.0 은 같은 자리를 `ROOT …/natural-korean/SKILL.md change=displaced` 로 적고 uninstall 뒤 LIVE 로 되돌렸다**(`samples/ev-rel_26.161.0_claude-Ar`).
- 장면 ⓑ(uninstall): 하네스가 한 번도 쓰지 않은 `.claude/skills/ui-visual-review/SKILL.md`(opt-in 이름, 설치자 파일) 를 update 3회 동안은 그대로 두다가 **uninstall 이 "no checksum on record — saved a copy, removed from live" 로 치운다** — 5판 전부, PR 50 · main 50회. 26.170.0 은 5판 전부 LIVE 로 남겼다.
- 화면: update 는 이 파일을 `no checksum on record … may not be your edits` 로 센다 — 통째로 설치자 파일인데 "당신 편집이 아닐 수 있다"고 말한다.
- 원인: PR-0 이 "그 스킬 폴더 항목이 skillFiles 에 하나라도 있나"로 바꿨다. 옛 스캔(26.126–161)은 **깔린** 스킬만 적으므로, 깔리지 않은 이름의 폴더는 "absent" → `no-sha`(하네스 것, 체크섬 없음)가 된다. 주석의 "옛 스캔엔 같은 답"은 깔린 스킬에만 참이다.
- 손실은 아니다(백업 있음). 그러나 CLAUDE.md §설치자 디스크 원칙("기록에 없는 설치자 파일은 하네스 자리면 백업 · `displaced` · 되돌림, 하네스가 쓰지 않으면 건드리지 않는다")과 어긋나고, **게시판 대비 회귀**라 이대로 출하하면 26.170.0 사용자에게 새로 생긴다.
- PR-A 와의 관계: PR-A 의 대상 선정·writer 는 이 판정을 그대로 쓴다. main 과 결과가 같아 PR-A 머지를 막을 사유는 아니다. 다만 §1.2 ⑧ 이 이 판정에 기대므로 고칠 때 ⑧ 을 함께 지켜야 한다.
Fix: 방향만 — "폴더 단위" 읽기를 skillFiles 가 부분일 수 있는 기록(스캔 필드 없던 S0/S1 로그에 #796 이후 update 가 처음 만든 skillFiles)에만 걸고, 옛 스캔이 만든 skillFiles(S2–S4)에서는 "그 폴더 항목 없음 = 하네스가 안 깔았다(none)"로 읽는다. 회귀 테스트: 26.161 모양 기록 + 하네스 이름 자기 스킬 폴더 → update 가 `displaced` · uninstall 이 되돌림 / opt-in 이름 자기 파일 → uninstall 이 건드리지 않음. PR-A 안에서 고칠지 별도 PR 로 할지는 리드 결정(어느 쪽이든 릴리즈 전).

[HIGH-2] 설치자가 고친 CLI 중립 헬퍼(`.uzys-agent-harness/*.sh`)의 편집이 uninstall 때 백업 없이 사라진다 (기존 — 26.170.0 · main · PR 동일)
File: src/commands/uninstall.ts(`.uzys-agent-harness/` 정리) · 헬퍼 백업 자리
Issue: 26.150 · 26.161 설치본에서 `check-absence.sh` 끝에 한 줄을 더하면 — update 는 그 파일을 `.uzys-agent-harness/check-absence.sh.backup-*` 로 백업하고, uninstall 은 폴더를 통째 지워 **그 백업까지 사라진다**. uninstall 의 `[BACKUPS]` 목록에도 안 나온다. update 없이 바로 uninstall 해도(`protect-branch.sh` 편집 — 브랜치 이름을 바꾸는 가장 그럴듯한 편집) 백업 없이 사라지고 화면에 아무 말이 없다(`helper/summary.txt` — PR · main · 26.170.0 각 B · U 6회 전부 LOST). CLAUDE.md "설치자가 고친 파일이면 그 파일 하나만 백업한다 · 폴더 통째 동작은 하지 않는다" 위반. PR-A 와 무관(같은 결과) — 이슈로 따로 올릴 것.
Fix: 방향만 — 헬퍼도 다른 하네스 파일과 같은 judge(remove) 로 회수(기록 sha 와 다르면 그 파일 하나 백업)하고, 백업을 지워지는 폴더 밖에 두거나 그 폴더를 통째 지우지 않는다.

[MEDIUM-1] S0/S1(26.100 · 26.125)의 은퇴 claims 가 설치자 내용을 하네스 sha 로 적고, 다음 full update 가 "orphan prune N removed" 라고만 말하며 치운다 (기존 — main · 26.170.0 동일)
File: src/install-writes.ts:570 `retiredClaims` · src/update-mode.ts `recordHarnessWrites`(claims 이어 적기)
Issue: 첫 update 가 은퇴 경로(디스크에 있는 것)를 **지금 디스크 내용의 sha** 로 적는다 — 설치자가 직접 만든 `rules/database.md`(tooling 이 깐 적 없는 은퇴 이름) · 편집한 `code-style.md` · `code-reviewer.md` 가 하네스 것으로 기록된다. 다음 full update 가 백업 뒤 지우고 화면은 `⊘ .claude/rules orphan prune 4 removed` 뿐("당신 것"·백업 언급 없음, 요약의 BACKUPS 수에는 든다). 손실 0(백업 있음). PR-A 의 차이 하나: **부분 update(`--only skills|new-skills|hooks|rules`)도 claims 를 적는다**(main 은 `--only skills|new-skills` 에서는 안 적었다) → 바로 다음 full update 가 한 번 일찍 회수한다. 결과 디스크·백업은 같다(`pr-vs-main-partial.txt` same). PR-B(§1.2 ③)가 이 자리를 judge(remove) 로 옮길 때 "설치자 내용인가"를 화면에 말하도록 함께 볼 것.

[MEDIUM-2] 번들 스킬 폴더 안 번들 밖 파일 정리(#477)가 "N files deleted" 라고만 말하고, 그 백업을 "no checksum — may not be your edits" 로 센다 (기존 — main 동일)
Issue: `north-star/my-notes.md` 등 설치자 노트는 백업된 뒤 라이브에서 빠진다(손실 0). 화면 줄은 `✓ .claude/skills not in bundle 3 files deleted`, 요약은 그 3개를 "체크섬 없음 — 당신 편집이 아닐 수 있다" 에 넣는다(26.161 u1: 12개 중 7개). 통째로 설치자 파일인데 반대로 말한다. 선택 개선.

## Positive Observations (측정 — PR vs main)

- **다른 트랙 하네스 이름의 자기 파일을 더는 덮지 않는다**: `rules/ui-components.md`(UI 트랙) · `agents/strategist.md`(26.161) — main 은 50/50 회 덮고 "put back on uninstall" 이라 말한 뒤 **되돌리지 않고 하네스 바이트를 남겼다**. PR 은 50/50 회 LIVE(`pr-vs-main.txt`).
- **uninstall 뒤 하네스 바이트 0**: PR 62회(본 50 + 부분 12) 전부 0 · main 은 본 매트릭스 50회 전부와 `--only rules` 직후 uninstall 3회에서 2–3개(옛 판 `data-analyst.md` · `strategist.md` 를 main 은 `displaced` 로 잘못 적어 남겼다).
- **§1.2 ① opt-in 되살림**: 26.170.0 설치 `--with ui-visual-review` → 폴더 삭제 → PR update 가 `was missing — reinstalled` + `--without` 안내로 되살림, 2회차 백업 0. main 은 안 되살린다(`optin/summary.txt`). (옛 5판에는 현행에서도 opt-in 인 번들 스킬이 없어 26.170.0 으로 표적 실행했다.)
- **§1.2 ② 지운 룰 · 스킬**: 26.132 · 26.161 D 에서 기록 유지 + `was missing — reinstalled`. 26.100 은 `added by this release`(§1.2 ⑦ 로 받아들인 문구).
- **§1.2 ⑧**: 26.100 · 26.125 + `--only new-skills` → 다음 update 의 `displaced` 0(옛 하네스 스킬을 첫 접촉으로 안 읽음). main 은 같은 흐름에서 옛 하네스 `data-analyst.md` 를 `displaced` 로 적었다.
- codex 쪽 표식(`.agents/skills` 자기 스킬 · 노트, `.codex/config.toml` 자기 서버, `AGENTS.md` 자기 절) 25/25 PR 실행 LIVE — main 과 같다.

## 한계

- 하네스 바이트 판정은 번들 템플릿 파일과의 sha 일치다 — 렌더 산출물(`.agents/` · `AGENTS.md` 등 변환본)은 이 검사로 못 본다(그 자리는 표식 추적과 PR/main 잔존 목록 대조로만 봤다 — 차이 없음).
- linux-arm64 컨테이너 · tooling 트랙 · CLI 조합 2개만. opencode 조합과 `--cli` 부분 uninstall · `--reinstall` 은 이번 범위 밖.

## 증거 (`loss-evidence/`)

- `matrix.txt`(100회) · `matrix-rel.txt`(26.170.0, 10회) · `matrix-partial.txt`(24회) — 열: LOST · uninstall 뒤 백업에만 있는 표식 · 설치자 내용을 하네스로 적은 기록 · records · 은퇴 claims · 단계별 새 백업
- `pr-vs-main.txt` · `pr-vs-main-partial.txt` — 최종 표식 상태 · 잔존 파일 PR/main 차이
- `harness-bytes-after-uninstall*.txt`
- `samples/` — 26.161 A(PR · main · 26.170.0) · 26.100 A · Am · S · D · 26.132 A(PR · 26.170.0)의 단계별 요약 · 화면 · 기록
- `optin/` · `helper/` — 표적 실행 · `scripts/` — 실행 · 집계 스크립트

### Verdict
- [x] CRITICAL 이슈 없음 (PR-A 가 만든 손실 · 기록 오염 0 — 142회)
- [x] DO NOT CHANGE 영역 미변경 (읽기 전용 · 트리 무변경)
- [x] SPEC/PRD 범위 내 — 단 HIGH-1(PR-0 회귀)은 릴리즈 전에 닫을 것, HIGH-2 는 별도 이슈
