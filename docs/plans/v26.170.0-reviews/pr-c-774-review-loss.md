# PR #789 (#774) 적대적 손실 탐색 — 실 게시판 옛 버전 × 컨테이너

- 대상: PR 6456521 (격리 워크트리 `iso774b`) · 대조: main a6be19f (`git archive` 로 따로 빌드)
- 방법: 한 이미지(`uzys-r774b-x`)에 **PR 빌드**(`agent-harness`) · **main 빌드**(`ah-main`) · **npm 게시판 옛 판 7개**(`/opt/old/<v>`, `npm install @uzysjung/agent-harness@<v>` — `npx -y` 와 같은 tarball)를 넣고, 판마다 컨테이너 하나씩 돌렸다.
- 판: 26.100.0 · 26.125.0 · 26.132.0(블록 모델) · 26.140.0 · 26.150.0(꼬리 절) · 26.153.0(꼬리·머리·마커 없음) · 26.160.0(마커)
- CLI 조합: {codex} · {opencode} · {claude,codex} · {claude} 단독(B2) · {codex,opencode}(2차)
- 실행 수: **650회**(1차 196 · 2차 392 · 표적 62. 표적 중 26.140 blockedit 4회는 v26.169 가 블록을 만들지 않는 판이라 장면이 성립하지 않아 무효로 뺐다)

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | pass — 백업 없이 사라진 설치자 내용 0건(650회) |
| HIGH | 1 | warn — 하네스 이름 절 안의 설치자 편집이 라이브에서 빠지는데 화면이 "nothing of yours in it"(당신 것은 없다)이라고 말한다(백업에는 있다) |
| MEDIUM | 1 | info — 26.153~159 설치본을 바로 uninstall 하면 하네스 절 26개가 남는다(main 과 같다, 새 동작 아님) |
| LOW | 1 | info — 26.133~152 설치본은 update 뒤에도 옛 Project Context 배너가 남는다(main 과 같다) |

## 판정: **PASS with notes** — 단, HIGH 1건은 머지 전에 고칠 것을 권한다

성공 기준 "설치자가 쓰거나 고친 내용이 백업 없이 사라지는 일 0" 은 **650회 전부 충족**한다. PR 이 약속한 정리(옛 하네스 절이 라이브에서 빠짐 · 파일당 백업 1개)도 범위 판(≤26.152)에서 실제로 일어난다. 다만 아래 HIGH 는 백업이 있다는 사실과 별개로, **설치자에게 "당신 것은 없다"고 잘못 알려 백업을 지우게 만들 수 있는** 결함이다. main 에서는 같은 파일을 "고쳤으니 남긴다"로 그대로 두던 자리라, **이 PR 이 새로 만든 동작**이다.

## 설치자 표식(손실 0 의 정의)

`AGENTS.md`(옛 판 설치본): 맨 위 자기 절(`## MINE Top Section`, 머리말 바로 뒤) · 가운데 자기 절 2개(Project Rules 안의 옛 앵커 절 사이 · `## Session Start` 바로 앞) · 맨 끝 자기 절 · 옛 앵커 절 1개에 한 줄 추가 · 꼬리 절 1개에 한 줄 추가 · `Protected Files (DO NOT EDIT)` 에 한 줄 추가 · 옛 하네스 절 본문을 그대로 복사한 자기 제목 절(`## MINE Copied Guidance`) · Project Context(`Identity & Purpose`) 채우기. 흐름 C 는 v26.169 update 뒤에 맨 끝 절을 하나 더 쓴다.
그 밖: 자기 룰 · 자기 스킬(`.claude/` · `.agents/`) · 번들 스킬 안 노트 2곳 · 룰 2개 편집 · 번들 스킬 `SKILL.md` 편집 · `.codex/config.toml` 에 자기 서버 · `opencode.json` 에 자기 키 · `settings.json` 에 자기 훅 줄 + 스크립트.
claude 단독(B2): 옛 판은 `AGENTS.md` 를 안 만들므로, **다른 프로젝트의 옛 codex 하네스 `AGENTS.md` 를 바이트 그대로 복사**해 두고(머리 지문까지 일치) 위 표식을 얹었다 — 지문 오인식을 노린 공격.
판정: 표식마다 고유 토큰을 두고, 각 단계 뒤 **라이브 / 백업에만 / 어디에도 없음(LOST)** 으로 분류했다. 절 단위 표식은 절 전문(全文) 포함 여부로 봤다.

## 흐름

| 흐름 | 순서 |
|---|---|
| A | 옛 판 install → 표식 → PR update ×2 → PR uninstall --yes |
| B | 옛 판 install → 표식 → PR uninstall --yes |
| C | 옛 판 install → 표식 → **main update(v26.169 상당)** → 끝에 절 추가 → PR update ×2 → PR uninstall |
| D | 옛 판 install → 표식 → PR `install --track tooling …`(재실행) → PR uninstall |
| E | 옛 판 → 표식 → main update → **바로** PR uninstall(2차) |
| F | 옛 판 → 표식 → `uninstall --cli <첫 CLI>` → update → uninstall(2차, codex+opencode 는 재렌더 경로) |
| G | 옛 판 → 표식 → `install --reinstall` → uninstall(2차) |
| Am·Bm·Dm·Fm·Gm | 같은 흐름을 **main 빌드**로 — 새 동작과 원래 동작을 가르는 대조군 |

2차 변형: 표식 전부(full) · `AGENTS.md` 끝 절 하나만(min) · `AGENTS.md` 무편집(none).

## 결과 — 손실

- **LOST(어디에도 없음) 0건** — 1차 196 · 2차 392 · 표적 62 전 단계(`pr-c-774-loss-evidence/matrix-wave1.txt`, `matrix-wave2-{full,min,none}.txt`, `targeted-scenarios.txt` 의 `LOST=-`).
- **B2(claude 단독)**: 옛 하네스 머리 지문까지 같은 설치자 `AGENTS.md` 가 7판 × A·B·D(+main)에서 **바이트 동일**. C 는 내가 v26.169 update 뒤 덧붙인 절만큼만 다르고 그 뒤 PR update ×2 · uninstall 에서 바이트 동일(`cmp` 확인, `sample-b2-claude/sha.txt`).
- **PR vs main, `AGENTS.md` 밖 파일**: 최종 디스크의 파일 목록 차이는 **`AGENTS.md.backup-*` 1개뿐**(84쌍). `.codex/config.toml` · `CLAUDE.md` · `settings.json` 은 프로젝트 폴더 이름을 맞추면 **52쌍 전부 동일**. → 이 PR 은 `AGENTS.md` 밖의 설치자 디스크를 바꾸지 않는다.
- **백업 개수**: 한 동작이 `AGENTS.md` 백업을 2개 이상 만든 경우 0(`MULTIBK` 0). 같은 초에 두 백업이 겹친 경우 `-2` 접미사로 둘 다 남았다(26.140 C-un 표적 실행 화면 `AGENTS.md.backup-20261012T114346-2`).
- **dry-run**: `uninstall --dry-run` 전후 스냅숏 동일(26.100 · 26.140).

## 결과 — 약속한 정리가 실제로 일어나는가 (before → after, 표식 full, codex)

`stale` = 옛 판 설치 직후 파일의 절 중 **바이트 그대로 라이브에 남은 것**(update 는 현행 렌더와 같은 절 제외).

| 판 | update 뒤 (main → PR) | 바로 uninstall 뒤 (main → PR) |
|---|---|---|
| 26.100 · 26.125 · 26.132 | 55절 · stale 24 · 옛 머리 남음 → **34절 · stale 2** · 머리 없음 | 36절 · stale 27 → **15절 · stale 5** |
| 26.140 | 38절 · stale 6 → **34절 · stale 2** | 27절 · stale 18 → **15절 · stale 5** |
| 26.150 | 38절 · stale 5 → **34절 · stale 1** | 38절 · stale 29 → **15절 · stale 5** |
| 26.153 · 26.160 | 변화 없음(31절 · stale 1) | 변화 없음(31절 · stale 22 — 아래 MEDIUM) |

남는 stale 2~5 는 **설치자가 채운 Project Context 안의 안 채운 형제 칸**(Stack & Commands 등 스캐폴드)이다 — Context 를 채웠으면 통째로 남긴다는 규칙대로다. 무편집(none)이면 uninstall 뒤 파일이 사라지고 백업 1개, 끝 절만 더했으면(min) 제목 + 그 절만 남는다(`matrix-wave2-none.txt` · `-min.txt`).
v26.169 로 이미 update 한 설치본(C · E): 블록 + 옛 파일 전체(55절)가 PR update 한 번에 35절 · stale 2 로, 바로 uninstall(E)이면 15절로 정리된다. 화면 예: `AGENTS.md  removed 19 section(s) written by an older harness version (saved a copy as AGENTS.md.backup-<time>)` (`sample-26.100-codex/flowC-u1.txt`).

### Findings

[HIGH] 옛 판 `AGENTS.md` 의 하네스 이름 절 안에 설치자가 적은 줄이 라이브에서 빠지는데, 화면은 "당신 것은 없다"고 말한다
File: src/agents-md-merge.ts `stripLegacyAgentsMd` · `installerSectionsInHarnessArea` / src/commands/uninstall.ts `harnessRemovalLines`(“nothing of yours in it”) · `removeLegacyAgentsMd`
Issue:
- 장면: 옛 판(26.100 · 26.140 · 26.150, codex) 설치 뒤 설치자가 **하네스 이름 절 안에 한 줄**을 더했다 — `## Session Start` 에 `4. npm ci …` 단계 추가(가장 그럴듯한 편집), `## Project Rules` 머리말에 팀 규칙 한 줄, 26.150 인라인 룰 `## Shell Safety` 에 한 줄. 그 밖은 손대지 않았다.
- 바로 uninstall(B): PR 은 파일을 **지우고** `✓ removed  AGENTS.md (written by an older harness version, nothing of yours in it — saved a copy: AGENTS.md.backup-…)` 라고 말한다. 설치자 줄은 백업에만 있다. main 은 같은 파일을 `⊘ AGENTS.md kept — modified since install`(26.140 · 26.150) / 그대로 둠(26.100)으로 **설치자 줄이 라이브에 남았다**. → 이 PR 이 새로 만든 동작.
- update(A, 26.83~132 블록 모델): main 은 줄을 라이브에 두던 판에서 PR 은 백업으로 옮기고, 화면은 `removed 22 section(s) written by an older harness version` 이라고만 말한다(설치자 줄이 든 절은 그 22에 들지 않는다). 26.133~152 는 main 도 update 때 같은 줄을 백업으로 옮긴다(원래 동작).
- 왜 문제인가: 사용자 결정 ⓓ 의 "설치자가 고친 절은 남는다" 와 어긋나고(이름 절은 지문이 아니라 이름으로 걷혀 고쳐도 걷힌다), ADR-097 결정 9(화면은 실제로 한 일만)에 어긋난다. 무엇보다 "nothing of yours in it" 을 믿은 설치자가 백업을 지우면 그때 실제로 잃는다.
- 재현(컨테이너, 이미지 = PR `test/docker/Dockerfile` + 옛 판 26.140.0):
  ```
  mkdir p && cd p && git init -q
  npx -y @uzysjung/agent-harness@26.140.0 install --track tooling --cli codex
  # ## Session Start 절 끝(빈 줄 앞)에 한 줄:  4. MINE-SESSEDIT: `npm ci` before anything else
  agent-harness uninstall --yes      # PR 빌드
  ls AGENTS.md                        # 없음
  grep MINE-SESSEDIT AGENTS.md.backup-*   # 백업에만 있음
  ```
  증거: `pr-c-774-loss-evidence/f1-sessedit-26.140/`(편집 직후 파일 · PR 화면 `un.txt` · main 화면 `un-main.txt` · 판정 `check-un.json`), `pr-c-774-loss-evidence/f1-rulesintro-26.100/`(Project Rules 머리말 · 블록 모델 판), `targeted-scenarios.txt` 의 `sessedit-*` · `rulesintro-*` · `hredit-*` 줄.
- 범위 밖으로 확인한 것: 설치자가 **자기 제목 절**을 더했거나 **옛 앵커·꼬리 절**을 고친 경우는 전부 라이브에 남는다(1차 전 판 · 전 흐름 `blocks=…:LIVE`). 결함은 "현행 템플릿 이름과 같은 절(`Session Start` · `Project Rules` 머리말 · 하네스 룰 제목) 안의 설치자 줄" 에 한정된다.
Fix(방향만): 둘 중 하나 — ⓐ 옛 파일 걷기에서 이름 절도 지문으로 판정해 지문이 다르면 설치자 절로 남긴다(앵커·꼬리 절과 같은 규칙) ⓑ 최소한 파일을 지우거나 "yours stays" 라고 말하는 줄에서 "nothing of yours in it" 단언을 빼고, 하네스 이름 절 안에서 지문과 다른 줄을 걷었으면 그 사실을 말한다.

[MEDIUM] 26.153~159 설치본(머리 블록인용 없음 · 마커 없음)은 설치자가 절 하나만 더해도 바로 uninstall 뒤 하네스 절 26개가 그대로 남는다
File: src/agents-md-merge.ts `isLegacyHarnessAgentsMd`(머리 지문만으로 판정)
Issue: 26.153 은 제목 바로 다음이 `## Project Context` 라 머리 지문이 없어 옛 파일로 인식되지 않는다 → `#516` 대로 통째 `kept`. min 변형 B: `un[sec=27, stale=26]`, main 도 같다(새 동작 아님 · 손실 아님). update 를 한 번 거치면(A) 정상적으로 정리된다. 설계 §2 #16 은 "마커 없는 옛 파일" 이라 적어 이 판까지 덮는 것처럼 읽히지만 §1.3 · §4.3 은 머리 지문만 말한다 — 범위를 문서로 확정해 두면 된다.

[LOW] 26.133~152(기록 있는 절 모델) 설치본은 update 뒤에도 옛 Project Context 배너가 남는다
Issue: 무편집 26.140 update 뒤 `## Project Context` 배너가 옛 문구(`… harness anchor — .claude/CLAUDE.md (Claude Code) …`)로 남는다(`replaceUnfilledContext` 는 기록 없는 옛 파일에만 켜진다, N4). main 도 같다. 손실 아님 · 상주 문구가 옛 앵커를 가리키는 정도.

### 원래 동작으로 확인한 것(이 PR 과 무관 — main 대조군과 바이트 단위로 같다)

- 26.153 · 26.160 설치본에서 하네스 절 안의 설치자 편집 · 앵커 마커 블록 안에 끼워 넣은 설치자 절은 update/uninstall 때 백업으로 옮겨진다(PR = main).
- 고친 하네스 룰 · 번들 스킬 `SKILL.md` · 번들 스킬 폴더 안 설치자 노트는 update/uninstall 때 백업으로 옮겨진다(ADR-097 · #477 그대로, PR = main).
- v26.169 update 뒤 설치자가 `agents` 블록 **안**에 적은 줄은 PR update/uninstall 이 블록을 걷으며 백업으로 옮긴다(블록 밖 설치자 절은 라이브에 남는다 — `blockedit-*` 8회).

### Positive Observations

- 머리 지문 오인식 공격(claude 단독 프로젝트에 옛 하네스 `AGENTS.md` 를 바이트 그대로 복사)이 **모든 흐름에서 바이트 동일**로 막혔다 — B2 경계가 update · uninstall · install 재실행 모두에서 지켜진다.
- 옛 하네스 절 본문을 그대로 복사한 **자기 제목 절**은 지문(제목 포함)에 걸리지 않고 남는다 — 지문 키가 제목까지 포함한다는 설계가 실제로 문다.
- v26.169 로 이미 update 한 집단(N2)이 PR update 한 번 · 바로 uninstall 양쪽에서 정리되고, `rootFiles displaced` 로 새지 않는다(PR update 뒤 기록: `externalFiles` 에 `AGENTS.md` · `rootFiles` displaced 없음 · `portions` 의 `agents` 몫 비움 — `sample-26.100-codex/record-agents-md.txt`).
- `--cli codex`(opencode 남음) 재렌더 · `--reinstall` · install 재실행 모두 같은 판정을 탄다(F · G · D 흐름).

### Verdict
- [x] CRITICAL 이슈 없음 — 백업 없는 손실 0 / 650회
- [x] DO NOT CHANGE 영역 미변경 — `AGENTS.md` 밖 설치자 디스크가 main 과 동일(파일 목록 84쌍 · 공유 파일 내용 52쌍)
- [x] SPEC/PRD 범위 내 — 단 HIGH 는 사용자 결정 ⓓ 의 "고친 절은 남는다" 와 이름 절에서 어긋난다
- 판정: **PASS with notes** (HIGH 1건 머지 전 수정 권장)

## 증거 (`pr-c-774-loss-evidence/`)

- `scripts/` — 이미지(`Dockerfile.combined`) · 실행기(`run.sh` 1차 · `run2.sh`/`wave2.sh` 2차 · `run3.sh`/`wave3.sh`/`wave4.sh` 표적) · 표식(`mutate.mjs` · `mutate2.mjs` · `mut3.mjs`) · 판정(`check.mjs` · `agg.mjs`)
- `matrix-wave1.txt` · `matrix-wave2-{full,min,none}.txt` — 실행마다 한 줄(단계별 절 수 · 백업 수 · stale · LOST · 백업에만 있는 토큰 · B2)
- `targeted-scenarios.txt` — 표적 장면(CRLF · Context 안 자기 절 · Project Rules 머리말 · Session Start · 인라인 룰 · 블록 안 편집 · dry-run)
- `f1-sessedit-26.140/` · `f1-rulesintro-26.100/` — HIGH 재현
- `sample-26.100-codex/` — 블록 모델 판 B 흐름 전후(PR · main) · C 흐름 화면
- `sample-b2-claude/` — claude 단독 바이트 동일 sha

정리: 컨테이너 · 이미지(`uzys-r774b-pr` · `-main` · `-x`) 삭제, 작업 폴더(`rev774/work`) 삭제 — 인용 증거만 남김.
