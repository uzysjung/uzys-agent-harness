# PR #814 리뷰 — #812 헬퍼를 파일 단위로 회수 (head d95982e)

## 판정: **FAIL** — 블로커 1건(기준 4 미충족, 가장 흔한 옛 판 장면)

방법: PR 빌드(`npm pack`) · main 8e6d87b(`git archive` 따로 빌드) · npm 게시판 26.125.0 / 26.150.0 / 26.161.0 / 26.170.0 을 이미지 `uzys-rev814-img` 하나에 넣고 컨테이너에서 실설치 공격. 본 매트릭스 28회(`evidence/matrix.txt`) + 손대지 않은 설치본 12회(`evidence/clean-untouched.txt`) + dry-run 1회. 이미지·컨테이너는 끝난 뒤 지움(잔존 0 확인). `npm run ci`(격리 사본, 파이프 없음) exit 0 — 163 files · branches 89.59%(`evidence/ci-pr.log`).

## 기준 1–5

| # | 기준 | 결과 | 근거 |
|---|---|---|---|
| 1 | 고친 헬퍼 → uninstall(바로 · update 뒤) → 백업으로 남고 화면 백업 안내에 나옴 | **충족** — 4판 × B/U(+codex 조합) PR 전부 MINE-PB/MINE-CA/MINE-PB2 = 백업에 존재, `[BACKUPS]` 에 나열. main 은 같은 장면 전부 LOST | `matrix.txt` · `ev/26.161.0/claude-B-pr/un.txt` 15–17·27–34행 |
| 2 | update 가 만든 헬퍼 백업이 uninstall 뒤 남음 | **충족** — U 흐름 PR 전부 `check-absence.sh.backup-*`(u1 시각) 생존. main 은 폴더째 삭제 | `matrix.txt` U-pr 행 hdir 목록 |
| 3 | displaced 설치자 헬퍼 → 바이트 그대로 제자리 | **충족** — 26.170.0 에 자기 `check-absence.sh` 를 미리 둔 장면, DB·DU 둘 다 `cmp` 동일 + "put back" 줄. main 은 NOT-restored(LOST) | `ev/26.170.0/claude-D{B,U}-pr/summary.txt` |
| 4 | 고치지 않은 헬퍼·기록·차단 로그는 치워지고 하네스 것만 있던 경우 폴더가 남지 않음 | **미충족(옛 판)** — 26.150 · 26.161 손대지 않은 설치본: B·U 모두 `.uzys-agent-harness/` 가 **옛 판 템플릿과 바이트 같은 백업 3개**와 함께 남는다. 26.170.0 은 충족(폴더 없음) | `clean-untouched.txt` |
| 5 | 다른 표식 보호 · 하네스 바이트 0 · `--cli` · `--reinstall` 불변 | **충족** — 다른 설치자 표식 82/82 LIVE 또는 기존과 같은 백업(main 과 동일), 하네스 템플릿 바이트 잔존 0(26.170.0 의 `.github/workflows/ci.yml` 1건은 main 도 같음 — 설치 후 설치자 소유 계약). `--cli codex` 2판: PR·main 화면 동일, 디스크 차이는 프로젝트 경로가 박힌 파일뿐(경로 정규화 뒤 동일). `--reinstall` 은 install 경로이고 바뀐 파일(`uninstall.ts`)을 import 하지 않음(코드 확인) | `matrix.txt` CX 행 · 정규화 대조는 리뷰 실행 로그 |

## Findings

[CRITICAL] 옛 판(≤26.161) 설치본을 손대지 않고 지워도 `.uzys-agent-harness/` 가 하네스 바이트 백업 3개와 함께 남는다
File: src/commands/uninstall.ts `harnessCandidates`(+`helperSources()`) · `templateNext` · `settleLog`
- 설치자 장면: 26.150/26.161 로 설치하고 아무것도 고치지 않은 사람이 최신판으로 `uninstall` → 화면이 헬퍼 3개마다 "no checksum on record — saved a copy" 를 말하고 `[BACKUPS] … 내용 확인 후 삭제` 에 3개를 올린다. 디스크에는 `.uzys-agent-harness/{check-absence,protect-branch,spec-drift-check}.sh.backup-*` 3개 — **전부 그 옛 판 템플릿과 바이트가 같다**(설치자 몫 0). update 를 먼저 거친 경우(U)도 같다: update 가 만든 noChecksum 백업 3개(main 의 기존 동작)를 이제 폴더가 지워지지 않아 그대로 남긴다.
- 재현: `clean-untouched.txt` — 26.150 B/U · 26.161 B/U 모두 PR `hdir=PRESENT`(3개), main `absent`. 26.161 B 는 main 이 백업 0건인데 PR 은 3건.
- 원인: 옛 판 헬퍼 바이트가 현행 번들과 모두 다르고(26.150 · 26.161 실측) 헬퍼는 `src/legacy-fingerprints.ts` 에 없다(`uzys-agent-harness` 0건 · 대조 `.claude/rules/git-policy.md` 9건). 그래서 `no-sha` + 번들 판과 다름 → backup+remove. ADR-111 결정 1ⓐ(현행 번들 자리 + 지문 일치 = 백업 생략)가 `.claude/` 파일에는 걸리는데 헬퍼에는 안 걸린다 — 사용자가 ADR-111 에서 차선으로 물린 "no checksum — saved a copy 노이즈" 가 이 자리에 그대로 생긴다.
- 단위 테스트가 못 본 이유: `makeLegacyLog()` 가 **현행 번들 바이트** 헬퍼에 기록만 옛 모양으로 바꾼다 — 실제 옛 판 헬퍼는 바이트가 달라 다른 가지를 탄다.
- main 대비: main 은 이 장면에서 폴더를 남기지 않는다(대신 고친 헬퍼를 잃는다). 손실은 아니지만 기준 4 미충족이고, 해당 설치자는 옛 기록을 가진 모든 미갱신·갱신 사용자다.
- Fix(방향): 헬퍼도 ADR-111 지문으로 알아보게 한다 — 생성기(`scripts/gen-legacy-fingerprints.mjs`)의 옛 판 복사 자리 표에 `templates/scripts/` → `.uzys-agent-harness/` 를 더해 옛 바이트 그대로인 헬퍼는 현행 번들 자리라 백업 없이 치워지게(uninstall 의 기존 legacy 가지 재사용). update 의 noChecksum 백업도 같은 지문으로 사라지는지 확인. 회귀 테스트는 옛 판 실제 헬퍼 바이트(태그 또는 지문)로.

[MEDIUM] 기록 폴더 안 설치자 자기 파일은 이제 남지만(main 은 지웠다 — 개선) 화면이 말하지 않는다
- 장면: `.uzys-agent-harness/my-notes.md` 를 둔 설치자 → PR 은 파일과 폴더를 남기고 uninstall 화면에 그 줄이 없다(`ev/*/claude-B-pr/un.txt`). 원칙상 맞는 동작이고 손실 0. "왜 폴더가 남았나" 를 알 길이 없을 뿐 — `.claude/` 의 "left … not on the install record" 줄과 같은 안내를 기록 폴더에도 내는 쪽이 대칭. 선택 개선.

[판정 지점 — 블로커 아님]
- `update-backups.json` 삭제: 설치자 바이트 아님. 백업 실물은 남고 `[BACKUPS]` 가 나열한다. 잃는 것은 noChecksum 표시뿐 → 수용 가능.
- dry-run: "remove 3 harness file(s) under .uzys-agent-harness/ (3 with a copy saved…)" — 실제 실행과 일치, 디스크 무변경(`dryrun-26.161.txt`).

## 음성 대조 (리뷰어 재실행 — 각 변이 적용 증명: `git diff --stat` 1 file changed · tsc exit 0)

| 변이 | 결과(tests/uninstall-helper-scripts.test.ts 7건) |
|---|---|
| ① settleLog 폴더째 rm | 5 red |
| ② `helperSources()` 줄만 제거 | 1 red |
| ②′ externalFiles 헬퍼 필터 복귀 + ② (작성자 판) | 6 red — 첫 시도는 앵커가 두 곳이라 **변이 미적용 → 초록(무효)**, 1750행 지정 후 재실행 |
| ③ `[BACKUPS]` 기록 폴더 skip 복귀 | 3 red |
| ④ `templateNext` 헬퍼 조회 제거 | 1 red |
| 기준(원본) | 7/7 green · 변이 후 `git status` 깨끗 |
작성자 보고(①5 · ②6 · ③3 · ④1)와 일치. 로그 = `evidence/mut/`.

## Positive
- main 대비 손실 제거 실측: main 은 헬퍼 편집(MINE-PB/CA/PB2) · 기록 폴더 자기 파일 · displaced 헬퍼를 main 14회 중 11회(헬퍼·기록 폴더 표식이 있는 실행 전부)에서 잃었고 PR 은 14회 중 0회.
- 변경이 `uninstall.ts` 한 파일에 갇혀 `--cli` · `--reinstall` 동작이 바뀌지 않는다(실측 + import 확인).

## 한계
- linux-arm64 컨테이너 · tooling 트랙 · {claude}·{claude,codex} 만. opencode 조합 · 26.162–26.169 writer 판 개별 미실행(26.170.0 으로 대표).
- 기록 폴더가 밖으로 나가는 링크인 장면 · `uninstall --only` 는 이번 범위 밖(코드 경로만 읽음).
