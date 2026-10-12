# PR #789 (#774) 재리뷰 — 두 리뷰가 함께 낸 HIGH 수정 뒤 적대적 검증

- 대상: `iso774m` 트리 `8d2e428`(= 수정 `079142e` + main `fc13c73` 병합) · 대조군: main `fc13c73`(PR-A·PR-B 포함, `git archive` 로 따로 빌드)
- "v26.169 로 이미 update 한 설치본" 단계는 이번엔 **npm 에 게시된 26.169.0 그대로** 썼다(1라운드는 main 빌드로 대신했다)
- 이미지: `uzys-r774c-pr` · `-main` · `-x`(PR + main + 게시된 옛 판 26.83 · 26.89 · 26.95 · 26.100 · 26.140 · 26.150 · 26.153 · 26.160 · 26.169). 다 쓴 뒤 컨테이너·이미지·작업 폴더를 지웠다
- 실행 수: 매트릭스 180회(단계 600) · 26.83~95 묶음 48회 · 표적 장면 159회(+ 무효 12회 — 26.140/26.150 은 게시된 26.169 가 첫 접촉 블록을 만들지 않아 `blockedit` 장면이 성립하지 않는다) · 트랙 훑기 112조합 · 보존 자리(held) 4회 · 현행 판 대조 4회

## 판정: **PASS with notes** (BLOCKER 없음)

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 0 | pass — 백업 없이 사라진 설치자 내용 0건 |
| HIGH | 0 | pass — 1라운드 HIGH 는 고쳐졌다 |
| MEDIUM | 1 | info — 맨 위 제목 줄(`# …`)만 고친 경우 uninstall 화면이 아직 "nothing of yours in it" 이라고 말한다 |
| LOW | 2 | info — v26.169 블록 안 편집 + 남은 설치자 절 조합의 "yours stays" · "kept N" 개수가 현행 템플릿에 있는 이름만 센다 |

성공 기준별:

| # | 기준 | 결과 |
|---|---|---|
| 1 | 옛 `AGENTS.md` 의 하네스 이름 절 안에서 고친 내용이 바로 uninstall 뒤에도 라이브에 남고, 설치자 내용을 걷었을 때는 "nothing of yours" 라고 말하지 않는다 | **절은 충족** — `Session Start` · `Project Rules` 머리말 · `Harness Rules` 안내 · 인라인 룰(`Shell Safety`) · `Protected Files` · CRLF · 여러 절 동시 편집 · opencode · claude+codex · codex+opencode 전부 **LIVE**, 화면은 `yours stays · kept N section(s) you edited (…)`. **제목 줄 하나는 미충족**(MEDIUM-1) |
| 2 | 바이트가 같은 옛 절은 약속대로 걷힌다 | **충족** — 1라운드 수치와 같다(아래 표). 26.83~95 의 빈 Project Context 껍데기도 이제 남지 않는다. 무편집 옛 설치본 84개(4판 × 7트랙 × 3 CLI 조합)가 전부 파일째 지워지고 백업 1개가 남았으며 **"kept … you edited" 오판은 0건** |
| 3 | 매트릭스 전체에서 백업 없이 사라진 설치자 내용 0 | **충족** — LOST 0 / 전 실행 · 전 단계. 한 동작이 `AGENTS.md` 백업을 2개 이상 만든 경우 0 |
| 4 | 병합해 들어온 PR-B 코드(외부 스킬 자리 보존 · `held/` 되살리기)와 나쁘게 얽히지 않았다 | **충족** — 병합은 충돌 없는 자동 병합(`git merge-tree 079142e fc13c73` 결과 트리 = `8d2e428` 트리). 남은 `held/` 사본이 있는 옛 설치본에서 update · uninstall 이 사본을 먼저 되살린 뒤 `AGENTS.md` 를 1라운드와 같은 판정으로 처리했다. 최종 디스크 파일 목록 PR vs main 75쌍: 61쌍 동일 · 14쌍은 `AGENTS.md.backup-*` 1개만 다름 · 그 밖 차이 0 |

`npm run ci`(트리에서 파이프 없이): **exit 0** — 156 파일 · 2340 테스트 · branches 89.4 (하한 86). 실행 뒤 `git status` = `?? node_modules` 뿐.

## 1라운드 표적 장면 다시 돌린 결과 (PR vs main)

B = 옛 판 설치 → 편집 → **바로 uninstall**. A = 옛 판 설치 → 편집 → update ×2 → uninstall.

| 장면 | 판 | PR B (uninstall 뒤) | PR 화면 | main B |
|---|---|---|---|---|
| `## Session Start` 에 한 줄(1라운드 HIGH 재현) | 26.140 | **LIVE**(파일에 그 절 하나만 남음) · 백업 1 | `✓ AGENTS.md — removed the harness sections written by an older version — yours stays · kept 1 section(s) you edited (Session Start) (saved a copy: …)` | LIVE(파일 통째 · `⊘ kept — modified since install`) |
| 같은 장면 | 26.100 · 26.150 · 26.83 · 26.95 | LIVE · 백업 1 | 위와 같음 | LIVE |
| `## Project Rules` 머리말에 한 줄 | 26.100 · 26.140 · 26.150 · 26.83 · 26.95 | LIVE | `… yours stays · kept 1 section(s) you edited (Project Rules) …` | LIVE |
| 인라인 룰 `## Shell Safety` 에 한 줄(hredit) | 26.150 | LIVE | `… kept 1 section(s) you edited (Shell Safety) …` | LIVE |
| `## Harness Rules` 안내에 한 줄 | 26.150 | LIVE | `… kept 1 section(s) you edited (Harness Rules) …` | LIVE |
| 위 셋 동시 | 26.150 | 셋 다 LIVE | `… kept 3 section(s) you edited (Harness Rules · Shell Safety · Session Start) …` | LIVE |
| CRLF 로 바뀐 파일 + Session Start 한 줄 | 26.100 · 26.140 · 26.150 | LIVE | `… kept 1 … (Session Start) …` | LIVE |
| Session Start 줄 하나 **지움** | 26.100 · 26.140 · 26.150 | 그 절이 남음 | `… kept 1 … (Session Start) …` | 남음 |
| **맨 위 제목 줄 이름 바꿈** | 26.100 · 26.140 · 26.150 | **백업에만** | `✓ removed  AGENTS.md (written by an older harness version, nothing of yours in it — saved a copy: …)` ← MEDIUM-1 | LIVE |
| v26.169(게시판) update 뒤 Session Start 한 줄 → 바로 uninstall(E) | 26.100 | LIVE | `… kept 1 … (Session Start) …` | LIVE |
| 같은 장면 | 26.140 · 26.150 | LIVE(파일 통째) | `⊘ AGENTS.md kept — modified since install` | 같음(새 동작 아님) |
| v26.169 블록 **안** 한 줄 → 바로 uninstall | 26.100 | 백업에만 · 파일 삭제 | `✓ removed  AGENTS.md (written by an older harness version — saved a copy: …)` — "nothing of yours" 없음 | LIVE(`kept harness block: changed since install`) |
| 블록 안 한 줄 + Session Start 한 줄 | 26.100 | 블록 줄 백업에만 · Session Start LIVE | `… yours stays · kept 1 … (Session Start) …` ← LOW-1 | 둘 다 LIVE |

LOST 0 / 159회. 화면 줄 원문 = `r2-evidence/targeted-scenarios.txt`, 표본 파일 = `r2-evidence/samples/`.

## 매트릭스 (흐름 A~G · PR · main 대조 · 표식 full)

판 26.100 · 26.140 · 26.150 · 26.153 · 26.160 × {codex} · {claude,codex} · {claude}(B2) × A · B · C · D · E · F · G + Am · Bm · Dm · Fm · Gm = 180회.

| 판 | update 뒤 (main → PR) | 바로 uninstall 뒤 (main → PR) |
|---|---|---|
| 26.100 | 55절 · stale 24 → **34절 · stale 2** | 36절 · stale 27 → **15절 · stale 5** |
| 26.140 | 38절 · stale 6 → **34절 · stale 2** | 27절 · stale 18 → **15절 · stale 5** |
| 26.150 | 38절 · stale 5 → **34절 · stale 1** | 38절 · stale 29 → **15절 · stale 5** |
| 26.153 · 26.160 | 변화 없음 | 변화 없음(마지막 `AGENTS.md` 바이트가 제목 줄 밖에서 PR = main) |
| v26.169 게시판으로 update 한 뒤 바로 uninstall(E) | — | 26.100 · 26.140 · 26.150 모두 **15절 · stale 5**, 동작마다 백업 ≤1 |

- 표식(앵커 절 편집 · 꼬리 절 편집 · `Protected Files` 편집 · Context 채우기 · 가운데·위·끝 자기 절 · 옛 절을 베낀 자기 절)은 26.100~150 PR 흐름 전부 **LIVE**. 1라운드와 같다.
- **B2(claude 단독, 다른 프로젝트의 옛 하네스 `AGENTS.md` 를 그대로 복사)**: 5판 × A · B · D · E · F · G(+main) 에서 바이트 동일. C 는 v26.169 뒤 덧붙인 절만큼만 다르고 그 뒤 update ×2 · uninstall 에서 바이트 동일.
- `uninstall --cli codex` 가 단일 CLI 설치본에서 exit 1 인 14회(F 흐름)는 "마지막 CLI 다" 안내로 PR = main — 장면 자체가 성립하지 않는 조합이다.

**26.83 · 26.89 · 26.95**(codex · opencode × A · B · Am · Bm × 표식 full / 무편집 = 48회): 무편집 B 는 `removed AGENTS.md (…, nothing of yours in it — saved a copy: …)` 로 파일째 지워지고 백업 1(main 은 24~26절이 그대로 남음). full B 는 8절(자기 절 · 고친 앵커/꼬리/Protected Files 절)만 남고 stale 0, **빈 `## Project Context` 껍데기 없음**.

**트랙 훑기**(무편집 옛 설치 → PR uninstall): 26.89 · 26.100 · 26.140 · 26.150 × csr-supabase · ssr-nextjs · data · full · executive · tooling+csr-supabase · csr-fastapi × codex · opencode · claude+codex = **84개 전부** 파일 삭제 + "nothing of yours", `kept` 0건(antigravity 단독 28조합은 옛 판이 `AGENTS.md` 를 만들지 않음). 이름 절 지문이 트랙에 따라 빗나가지 않는다.

## update 쪽 선택(고친 이름 절을 현행 판으로 바꾸고 백업 + 화면)에 대한 판단 — **수용**

- 장면: 옛 판 설치본의 `Session Start` · `Project Rules` 머리말 · 인라인 룰 · `Harness Rules` 안내를 설치자가 고친 뒤 update. PR 은 그 절을 현행 판으로 바꾸고 고친 글은 백업 1개에 둔 채 `⊘ AGENTS.md  1 harness section(s) you had edited (Session Start) now hold the current version — your edit is in the copy AGENTS.md.backup-<time>` 를 낸다. 두 번째 update 는 조용하다(백업 1개 유지).
- 원칙 대조: 루트 `CLAUDE.md` §설치자 디스크의 "함께 쓰는 파일은 하네스 몫만 더하고 · 바꾸고 · 뺀다" — 같은 이름 절은 하네스 몫이다. 이 리포가 이미 같은 처리를 한다: **현행 판 설치본**(게시된 26.169 를 새로 깐 것)에서 `Session Start` 를 고치고 update 하면 main · PR 모두 현행 판으로 바꾸고 백업 1개를 남긴다(`r2-evidence/current-format-sessedit.txt`). 26.133~150 은 main 도 이미 같은 결과였다(26.140 Am: 백업에만).
- 사용자 결정 ⓓ 의 "설치자가 고친 절은 남는다" 는 바꿔 쓸 현행 판이 없는 uninstall 에서 그대로 지켜진다. update 에서 고친 절을 남기면 같은 이름 절이 두 벌 생기거나, 하네스 절이 영영 갱신되지 않는다 — 대안이 더 나쁘다.
- 대가: 블록 모델 판(26.83~132)은 main 이 옛 파일을 통째로 두던 자리라 그 편집이 **라이브 → 백업** 으로 바뀐다(표적 7회 · 편집 8개 — 26.83 · 26.95 · 26.100 의 A 흐름. 전부 백업에 있고 화면이 말한다). 수용 가능.

## Findings

[MEDIUM-1] 맨 위 제목 줄(`# …`)만 고친 옛 `AGENTS.md` 를 바로 uninstall 하면 파일을 지우며 "nothing of yours in it" 이라고 말한다
File: `src/agents-md-merge.ts` `stripLegacyAgentsMd`(`recognized: blockFree`) · `src/commands/uninstall.ts` `harnessRemovalLines`
Issue:
- 재현(26.100 · 26.140 · 26.150, codex): 옛 판 설치 → 첫 줄 `# 26.140.0-codex-B-title — Codex Agent Guide` 를 `# MINE-TITLE Payments Service — Codex Agent Guide` 로 바꿈 → PR `uninstall --yes` → 파일 삭제 · 고친 제목은 백업에만 · 화면 `✓ removed  AGENTS.md (written by an older harness version, nothing of yours in it — saved a copy: AGENTS.md.backup-…)`. main 은 파일을 남긴다(제목 라이브). 증거 `r2-evidence/samples/t_26.140.0_codex-B-title/` · `flags-targeted.txt` 의 `FALSE-NOTHING` 3줄.
- 원인: 머리 지문(`legacyPreambleKey`)은 `# ` 줄을 빼고 잰다(제목에 프로젝트 폴더 이름이 들어가서). 그래서 제목을 바꿔도 옛 파일로 인식되고, `stripLegacyAgentsMd` 는 남는 절이 없으면 제목까지 함께 지우면서 `recognized` 는 블록 유무로만 정한다. 머리 블록인용 앞뒤에 설치자가 넣은 다른 `# ` 줄도 같은 길이다.
- 왜 MEDIUM 인가: 성공 기준 (1) 의 문장을 그대로 어긴다. 다만 잃는 것은 제목 한 줄이고 백업에 있다. update(블록 모델 판)도 제목을 현행 렌더로 바꾸며 따로 말하지 않는다(26.133~ 은 main 도 같다).
- Fix(방향만): 제목이 옛 템플릿 모양(`# <폴더 이름> — <CLI> Agent Guide`)이 아니면 `recognized` 를 거짓으로 둬 "nothing of yours" 를 빼거나, 그 경우 파일을 지우지 않고 제목을 남긴다.

[LOW-1] v26.169 블록 안 편집과 남은 설치자 절이 같이 있으면 화면이 "yours stays" 라고만 한다(구현자가 제기한 의문)
File: `src/commands/uninstall.ts` `harnessRemovalLines`(`fileRemoved` 가 아닌 갈래)
Issue: 26.100 → 게시된 v26.169 update → 블록 안에 한 줄 + `Session Start` 한 줄 → PR uninstall: 블록 줄은 백업에만, 화면은 `… yours stays · kept 1 section(s) you edited (Session Start) (saved a copy: …)`. main 은 고친 블록을 `kept harness block: changed since install` 로 라이브에 남겼다. 블록 줄만 있을 때는 "nothing of yours" 를 빼서 바르게 말한다. 블록은 하네스 표식 안이라 하네스 몫이고, 현행 판 마커 블록 편집도 update 때 말 없이 백업으로 간다(26.160 매트릭스, main = PR) — 그래서 LOW. 고친다면 `recognized` 가 거짓일 때 이 갈래에도 "블록 안 글은 사본에 있다" 한 마디를 붙이면 된다.

[LOW-2] "kept N section(s) you edited" 는 현행 템플릿에 있는 이름만 센다
Issue: `Session Start` · `Project Rules` · `Protected Files` 를 함께 고치면 셋 다 라이브에 남지만 화면은 `kept 2 section(s) you edited (Project Rules · Session Start)`. `Protected Files (DO NOT EDIT)` 는 현행 템플릿에 없는 이름이라 설치자 절로 남는다(거짓말은 아니다 — "yours stays" 에 든다). 참고만.

### 원래 동작으로 확인한 것(이 PR 과 무관)
- 현행 판 설치본의 `Session Start` 편집은 update 때 현행 판으로 바뀌고 백업 1개만 남으며 화면 줄이 없다(main = PR). 이 PR 의 "you had edited" 줄은 옛 판 파일에만 나온다 — 둘을 맞추려면 별도 이슈.
- 26.153 · 26.160 설치본은 update · uninstall 결과가 PR = main(제목 줄 밖 바이트 동일).
- 26.140 · 26.150 을 v26.169 로 update 한 뒤 고치고 바로 uninstall 하면 `⊘ kept — modified since install` 로 파일이 통째 남는다(PR = main, 그 파일은 이미 현행 판 모양이라 옛 파일 걷기 대상이 아니다).

## Positive Observations
- 1라운드 HIGH 장면(26.140 `Session Start` 한 줄)이 이제 그 절 하나만 남기고 나머지 옛 하네스 절은 모두 걷는다(남은 `##` 절 1개 · stale 0) — "남긴다" 와 "정리한다" 를 둘 다 지켰다.
- 이름 절 지문 50개가 트랙 7종 × CLI 3조합 × 4판의 무편집 설치본 84개에서 오판 0건 — 트랙별 렌더 차이에 흔들리지 않는다.
- "nothing of yours" 를 첫 접촉 블록이 있을 때 빼는 판정(`recognized`)이 실제로 문다(26.100 E-blockedit).
- PR-B 의 `held/` 되살리기가 맨 먼저 돌고, 그 뒤 `AGENTS.md` 처리가 1라운드와 같은 판정을 낸다(`r2-evidence/held-interplay.txt` — 빈 자리는 제자리, 찬 자리는 `.backup-20261012T000000`, `held/` 비움).

## Verdict
- [x] CRITICAL 이슈 없음 — 백업 없는 손실 0
- [x] DO NOT CHANGE 영역 미변경 — `AGENTS.md` 밖 설치자 디스크가 main 과 같다(75쌍)
- [x] SPEC/PRD 범위 내
- 판정: **PASS with notes** — MEDIUM-1 은 한 줄짜리 조건이라 머지 전에 고치기를 권하지만 막지는 않는다(잃는 것 없음 · 백업 있음).

## 증거 (`r2-evidence/`)
- `scripts/` — 이미지(`Dockerfile.combined`) · 실행기(`run2.sh` 매트릭스 · `run4.sh` 표적 · `wavet.sh` · `wavem.sh` · `wavestub.sh` · `tracks.sh` · `held.sh` · `cur.sh`) · 표식(`mutate2.mjs` · `mut4.mjs`) · 판정(`check.mjs` · `agg2.mjs`)
- `targeted-scenarios.txt` — 표적 장면마다 단계별 판정 + `AGENTS.md` 화면 줄 · `flags-targeted.txt`(FALSE-NOTHING · PR 백업/main 라이브 목록)
- `matrix-m.txt` · `flags-matrix.txt` — 매트릭스 180회 단계별 · `matrix-stub-26.83-95.txt` · `flags-stub.txt`
- `tracks-untouched.txt` · `held-interplay.txt` · `current-format-sessedit.txt` · `ci.txt`
- `samples/` — 26.140 sessedit · 26.100 rulesintro · 26.150 hredit+hrnote+sessedit · 26.140 title · 26.100 E-blockedit+sessedit · 26.100 A-sessedit 의 편집 직후 파일 · 최종 파일 · 화면
