# 리뷰 판정 — #770 HIGH-1 · `fix/install-rerun-external-skill-backup` @ c3c2724 (기준 main@ac4de4c)

## 결론: **PASS** (BLOCKER 0)

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW / NOTE | 3 (비차단) |

검증은 구현자 보고를 읽지 않고 직접 다시 돌렸다. 근거 로그는 리뷰어 스크래치패드
`…/abf46550-9588-48b8-8511-b240d392bc2b/scratchpad/`(`ci.log` · `probe-base.log` · `probe-fix.log` · `scen-base.log` · `scen-fix.log` · `c-base.json` · `c-fix1.json`)에 있다.

## 완료 기준 판정 — 실도구 컨테이너(실 `npx skills add --copy`), 리뷰어 자체 프로브

프로브 절차: install(claude+codex, frontend-design) → Claude 사본 SKILL.md 편집 · 두 슬롯에 노트 · `.agents` 슬롯에 앞선 백업(`SKILL.md.backup-20200101T000000`) → **install 재실행**.

| 기준 | 수정 전(ac4de4c src) | 수정 후(c3c2724) |
|---|---|---|
| ① 고친 기록 파일이 백업 하나로 남는다 | 새 백업 **0개** — 편집이 흔적 없이 사라짐 | 새 백업 **1개**(`.claude/…/SKILL.md.backup-…`), 편집 내용을 담음 · 라이브는 상류판 |
| ② 슬롯의 기록 밖 파일이 제자리 | 노트 2개 · 앞선 백업 **모두 LOST** | 셋 다 kept |
| ③ 안 고친 파일은 백업 없이 갱신 | — | `.agents` SKILL.md · LICENSE 등에 새 백업 없음 |

저장소 시나리오 `scenario-update-external-skills.sh`(이 커밋이 ②''' 추가): 수정 전 src → exit 1 `FAIL: install 재실행이 앞선 백업 … 를 지웠다`, 수정 후 → 전 단계 PASS exit 0.
단위 테스트 `install-rerun-external-skill-backup.test.ts`: 수정 후 2/2, 수정 전 src 로 ①번 red(`expected [] to have a length of 1`).

## 판정 항목별

1. **손실 재현·해소** — 위 표. 단위·시나리오·리뷰어 프로브 세 층 모두 수정 전 red → 수정 후 green.
2. **update 경로 불변** — `refreshExternalSkills` 의 변경은 `held` 목록 생성과 `settleHeld` 반복을 `holdSkillSlots` 로 옮긴 것뿐이다(같은 입력 · 같은 반복 · 반환값만 추가). 실도구로 install 재실행 뒤 **update 3회 연속**: 새 백업 0/0/0, 노트·앞선 백업 유지. **은퇴 파일**(기록에 sha 일치로 넣은 `retired.md`, 상류에 없음): install 재실행 · update 둘 다 되살아나지 않음. 기존 `update-external-skill-backup-770.test.ts` 7건 green.
3. **첫 설치 회귀 없음 — 바이트 동일** — 고정 경로 프로젝트에서 수정 전/후 src 로 같은 실행을 하고 전 파일 sha·화면·보고를 대조: **5개 시나리오 모두 바이트 동일**(같은 판 2회 실행도 동일 — 잡음 없음 확인). S1 첫 설치 claude+codex · S2 첫 설치 + 슬롯에 기록 없는 파일 미리 존재 · S3 편집 없는 재실행 · S4 claude 단독 · S5 기존 설치에 frontend-design 을 처음 추가(슬롯에 기록 없는 파일 미리 존재). 기록 없는 자산은 `previousLog` 에 없어 붙잡지 않는다 — 코드상으로도 `holdSkillSlots` 입력이 `previousLog.assets` 의 skill 자산 ∩ 이번 대상뿐이다.
4. **화면은 한 일만 말한다** — 실도구 install 재실행 화면에 External assets 절 아래 `✓ backup …/skills/frontend-design/SKILL.md.backup-<시각>` **1행**, 디스크의 새 백업 1개와 일치. 앞선 백업·되돌린 노트는 말하지 않는다. 편집 없는 재실행(S3)은 화면이 수정 전과 바이트 동일(백업 행 없음). `report.backups` 를 다시 출력하는 소비처 없음(grep: install-render 는 baseline-complete 의 Phase 1 백업과 이 이벤트만 출력) → 중복 출력 없음.
5. **테스트·변이** — 리뷰어가 직접 건 변이 4종, 각각 cmp/`git diff --shortstat` 로 적용 증명 · `tsc --noEmit` exit 0 · 새 테스트 1 red:
   - M1 install hold 대상 비움(`… && false`) → red
   - M2 화면 백업 행 제거 → red
   - M3 보고 `backups` 에 안 실음 → red
   - M4 settle 호출 안 함(`settle.length < 0 ? settle() : []`) → red
   (처음 시도한 M1/M4 형태는 미사용 변수로 tsc exit 2 였어서 증거에서 버리고 위 형태로 다시 쟀다.)
   `npm run ci` 파이프 없이 **exit 0** — 150 files / 2273 tests, branches 89.37.

## 아키텍처
- update 구현 재사용 요구 충족 — `holdSkillSlots` 하나를 두 경로가 호출하고 hold/settle 로직 복제 없음. 기준선 sha 는 install 이 원래 쓰던 `buildAssetEntries`/`mergeToolFiles` 그대로라 노트·백업이 기록에 들어가지 않는다(프로브: 기록 `files` 에 note/backup 없음).
- uninstall 경로 미접촉. 범위 밖 변경 없음.

## NOTE (비차단 · 이번 PR 의 회귀 아님)
- **N1 (LOW) 백업 행이 어느 사본인지 안 보인다** — `shortenPath` 가 끝 3마디만 남겨 `…/skills/frontend-design/SKILL.md.backup-…` 로 나온다. 두 사본을 다 고쳤으면 `.claude`/`.agents` 구분 없이 시각만 다른 두 줄이 된다. Phase 1 백업 행(install-render.ts:1452)과 같은 기존 관례라 이번 PR 에서 바꿀 일은 아니다.
- **N2 은퇴 파일 기록이 남는다** — 상류가 뺀 기록 파일(`retired.md`)은 디스크에서는 사라지지만 기록 `files` 에 그대로 남는다(수정 전도 동일 — `mergeToolFiles` 가 prior 를 유지). 되살리지는 않으므로 손실은 없고, uninstall 이 없는 파일을 지우려 할 뿐이다.
- **N3 기록 없는 슬롯의 설치자 파일** — 기존 설치에 외부 스킬을 *처음* 추가할 때(S5) 슬롯에 미리 있던 기록 없는 파일(`mine.md`)은 도구가 백업 없이 지운다. 수정 전과 바이트 동일한 기존 동작이고 #770 HIGH-1 의 완료 기준 밖이다(재실행이 아니라 첫 접촉). 다룰지는 리드가 정한다.

## 위생
- 사본 안 변이는 전부 되돌렸고 HEAD = c3c2724 · 작업 트리 깨끗(`git status` 빈 출력). 임시 프로브 테스트 파일 삭제.
- node_modules 심링크 삭제. 이미지 `uzys-harness-test:rev-770b` 와 그 빌드가 남긴 dangling 1개(c2f052ccaed6) 삭제. 다른 레인 이미지는 건드리지 않음.

## Verdict
- [x] CRITICAL 이슈 없음
- [x] DO NOT CHANGE 영역 미변경
- [x] 범위 내 (#770 HIGH-1 · install 외부 단계 + 화면 1행 + 보고)
