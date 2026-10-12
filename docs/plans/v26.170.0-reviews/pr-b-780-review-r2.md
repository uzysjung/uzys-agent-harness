# PR #790 (#780) 재리뷰 — 2라운드 (c2b319f, 수정분 = 4db6f97..c2b319f)

## 판정: **PASS with notes** — 1라운드 BLOCKER 닫힘 · MEDIUM 2건 닫힘 · 새 장치에서 막을 것 없음(단 동시 실행 1건은 lead 판단 필요, 아래 MEDIUM-A)

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 0 | pass |
| HIGH | 0 | pass |
| MEDIUM | 2 | warn(비차단) |
| LOW | 2 | info |

## 1. 1라운드 BLOCKER — 닫혔다 (리뷰어 직접 재실행)

탐침은 격리 워크트리에 임시 테스트 파일로 두고 돌린 뒤 뺐다(현재 `git status` = node_modules 만).

| 장면 | 끊긴 직후 디스크 | 다음 실행 뒤 |
|---|---|---|
| **R1 뒤 단계(npm 설치) 도중 SIGINT** — 실제 자식 프로세스, 자산 [frontend-design, openspec], npm 단계에서 멈춘 채 kill | 슬롯의 mine.md · .agents mine.md · 1 MiB+ zbig.bin = 없음. **`held/<ts>/` 에 4개 모두 있음** | install 재실행: 3개 제자리(바이트 동일) · SKILL.md 원본은 `SKILL.md.backup-<보존 시각>` · `held/` 사라짐 · 파일마다 화면 한 줄 |
| R1 같은 장면 **SIGKILL** · **SIGHUP** | 위와 같음 | 위와 같음 |
| R2 FD 성공 뒤 **뒤 자산에서 JS 예외** | 전부 제자리(`settle("all")`) · `held/` 없음 | — |
| P-A · P-A(update) · P-E(0555 로 판정 도중 실패, 1 MiB+ 포함) | PR 테스트로 재확인(아래 CI) — 사본이 `held/` 에 남고 다음 install 이 되돌림 | ✓ |

1라운드에서 사라지던 경로(메모리 사본 · finally 의 spill 삭제)는 코드에서 없어졌다. 사본은 판정 성공 뒤에만 지운다(`settleHeld` · `settleLeftover` 모두 이동/백업 뒤 rm).

## 2. MEDIUM 2건 — 닫혔다

- MEDIUM-1(도구가 덮은 뒤 실패): 실패 자산의 자리는 원본을 제자리로, displaced 없음 — PR 테스트 P-C green · 변이 Me 로 red 확인.
- MEDIUM-2(1 MiB+ 안 고친 파일 백업): `fileShaUtf8` 조각 해시로 기록 sha 대조 — P-F green · 변이 Md 로 red 확인.

## 3. 새 보존 장치 공격 결과

- **오래된 held + 그 뒤 설치자가 같은 파일을 고침**(R3): 새 편집이 제자리에 남고 옛 사본은 `mine.md.backup-<보존 시각>`. 덮지 않는다 ✓
- **uninstall exit-1 멈춤**(R4, `--only` 로 재현): 화면이 원인(`EACCES … rename …`)과 사본 경로를 말하고 `Nothing was removed` + "Fix the cause above, then run the same command again". 기록 · 자산 그대로라 프로젝트는 쓸 수 있는 상태. 권한을 되돌리고 같은 명령 → 제자리로 돌린 뒤 `--only` 정상 완료 ✓
- **`--cli codex` + 남은 held**(R4): 먼저 되돌리고 진행 ✓ · dry-run 은 판정만(PR 테스트) ✓
- uninstall 의 정리는 기록 폴더를 지우는 유일한 자리(`uninstall.ts:633`)보다 앞에 있고, 기록이 없으면 그 전에 return 해 아무것도 안 지운다 ✓

## Findings

[MEDIUM-A] 동시에 도는 두 번째 실행이 살아 있는 실행의 사본을 "남은 것" 으로 정리한다 — 새 손실 경로(좁음)
File: src/held-files.ts `settleLeftoverHolds`(소유 실행을 구분하지 않음) · src/external-installer.ts `settleHeld`(사본 ENOENT 를 "도구가 지웠다" 로 읽음)
Issue: 실행 A 가 사본을 뜬 뒤 **그 자리의 도구를 부르기 전**에 실행 B(install·update·uninstall)가 시작하면, B 는 자리 바이트가 같아 `unchanged` 로 A 의 사본을 지운다. 이어 A 의 도구가 폴더를 지우면 원본이 어디에도 없다. 직접 호출 교차로 재현(R5): SKILL.md · mine.md · zbig.bin · .agents mine.md 4개 전부 `<GONE>`, A 는 "copies kept at held/…" 라고 말하지만 사본은 없다.
실제 두 프로세스(R5b, A 를 npm 단계에서 멈추고 B 를 끝까지 돌림)에서는 **손실이 없었다** — 스킬 도구가 npm 보다 먼저 돌아, B 가 사본을 `put back`/백업으로 옮겼기 때문이다. 창은 "사본 뜨기 ~ 그 슬롯의 도구 호출" 사이, 즉 앞선 스킬 도구 호출 시간(초 단위)이다.
누가 만드나: 같은 프로젝트에서 하네스 변경 명령 두 개를 몇 초 안에 겹쳐 돌린 사람. 하네스는 스스로 겹쳐 띄우지 않고(자동 실행 훅 없음 · 잠금 없음 — 겹친 실행은 기록 쓰기 등 다른 곳도 원래 보장 밖). 메모리 사본이던 1라운드 판에는 이 경로가 없었으므로 기준 (3)을 문자 그대로 읽으면 이 하나는 미충족이다. 차단하지 않는 근거 = 장면이 지원 밖의 겹친 실행에 한정되고 창이 좁음. lead 가 기준 (3)을 엄격히 적용하면 막는 사유가 된다.
Fix(방향만): `held/<ts>/` 에 소유 pid 를 남기고 살아 있는 프로세스의 것은 건너뛴다.

[MEDIUM-B] `held/` 가 `.gitignore` 에 없다 — 끊긴 실행 뒤 커밋하면 사본이 커밋된다
File: src/env-files.ts `HARNESS_RUNTIME_IGNORES`(백업 `*.backup-…` 은 무시하지만 `held/` 는 없음)
Issue: ADR-100 으로 `.uzys-agent-harness/` 는 커밋 대상이다. 끊긴 실행 뒤 다음 실행 전에 `git add -A` 하면 슬롯 파일 사본이 커밋된다. 설치자가 슬롯 안 파일을 일부러 무시해 두었다면 그 무시를 우회한다. 클론한 팀원의 첫 install 은 남의 사본을 자기 슬롯에 put-back·백업한다. 손실은 아니다. #657 이 백업을 무시하기로 한 이유("팀원의 `git add -A` 가 백업을 커밋한다")와 같은 축이다(구현자 의문 ① — **중요하다 쪽**으로 판정).
Fix(방향만): 런타임 무시 줄에 `.uzys-agent-harness/held/` 추가.

[LOW-1] 끊긴 첫 추가 → 재실행 뒤에는 원본이 백업에 머물고 상류 파일이 주인 없이 남는다
R1 뒤 전량 uninstall: `remove frontend-design — 0 file(s) on record` · `left .claude/ — … skills/frontend-design/SKILL.md · mine.md · zbig.bin … delete by hand any that are not yours`. 설치자의 SKILL.md 원본은 `.backup-<ts>` 그대로, 상류 SKILL.md 는 제자리에 남는다(재실행 시점에 이미 있던 파일이라 자산 몫이 되지 않음). **손실은 없다** — 끊기지 않은 경로처럼 저절로 제자리로 돌아오지 않을 뿐이다.

[LOW-2] 예외 경로의 `settle("all")` 실패는 삼켜져 화면에 보존 자리가 안 나온다 — 다음 실행이 "held by an earlier run" 으로 말하므로 손실·혼동 없음. 참고만.

## 구현자 의문 판정
- held 가 .gitignore 밖 → MEDIUM-B(중요하다).
- 루트 전체 자산(jakubkrehel-skills)이 실패하면 같은 루트의 성공한 형제 자산 자리에서도 설치자 파일을 되돌린다: 형제의 상류 파일 하나가 설치자 원본으로 바뀌지만 그 파일은 형제 몫으로 기록되지 않는다(`mergeToolFiles` — 호출 전부터 있던 파일은 changed 로만 잡힘) → 나중에 지워지지도 않는다. 손실 없음, 수용.
- 백업 뒤 사본 삭제 실패 시 다음 실행이 백업을 하나 더 만듦: 잡음뿐, 수용.
- P-E 테스트 root skip: 릴리즈 CI(GitHub 러너)는 비 root 라 거기서 돈다. 이 호스트에서도 돌았다. 수용.

## 실행 증거
- `npm run ci`(파이프 없이 exit 를 파일에 기록) → **exit=0**, 154 files · 2309 tests · branches 89.27(전 PR 테스트 파일 포함, 새 `external-skill-hold-durable.test.ts` 10건 포함).
- 변이(전부 `tsc --noEmit` exit 0 확인 뒤 적용, `git checkout` 으로 원복):
  - Ma 예외 경로 `settle("all")` 제거 → P-A red
  - Mc uninstall 의 kept 멈춤 무력화 → "되돌리지 못하면 멈춘다" red
  - Md 큰 파일 sha 대조 무력화 → P-F red
  - Mb+Me 묶음(첫머리 정리 `.slice(0,0)` · 실패 자산 목록 `.slice(0,0)`) → P-E · install 정리 · 실제 SIGINT · P-C 4건 red
  - (처음 시도한 Mb·Me 단독판은 TS6133 이라 증거에서 뺐다)
- 남은 프로세스 없음 · 워크트리 clean(c2b319f).

## 확인하지 않은 것
- docker 실도구 재실행은 하지 않았다(선택). 실 `npx skills add --copy` 가 `.uzys-agent-harness/held/` 를 건드리지 않는다는 것은 코드상 추론이다 — 도구는 스킬 루트만 쓴다(1라운드 실측).
- 실제 터미널 Ctrl-C 대신 자식 프로세스 SIGINT/SIGKILL/SIGHUP.

## Verdict 체크
- [x] CRITICAL 없음
- [x] DO NOT CHANGE 미변경
- [x] 1라운드 BLOCKER: 모든 끊김 장면에서 사본 생존 + 다음 실행 정리
- [x] MEDIUM 2건 수정
- [~] 새 장치의 새 손실 경로 없음 — 겹친 동시 실행 1건(MEDIUM-A) 예외
