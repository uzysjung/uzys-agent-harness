# 룰·훅 다이어트 사이클 (2026-08-02) — P1 리뷰 반영 개정판

사용자 지시: "룰·훅이 밥값을 하는지 리서치로 판정" → "리포 개발 사본 + 배포 템플릿 **양쪽**
동일 정리, 밥값을 하더라도 최대한 간결하게, ulw". 백로그 #261-2 실행.
독립 리뷰 = `rules-hooks-diet-2026-08-02-review.md` (P0 4·P1 11 — 본 개정판에 전부 반영).

## 근거 (판정 기준 SSOT)

`docs/research/rules-hooks-value-audit-2026-08-02/` — 공식 문서 원문 인용 2편.
기준: ⓐ "지우면 실수하는가" ⓑ 모델 기지식·유도 가능·aspirational 금지 ⓒ 절차→스킬/paths
ⓓ 프로즈는 강제층 아님 ⓔ 훅 = 동적/차단용. 실측: 룰 9종×2 = 1,100줄 · `checkpoint-snapshot.sh`
미배선(실행 0) · 차단 로그 부재.

## AC (완료 기준)

- **AC1 죽은 훅 제거**: `checkpoint-snapshot.sh` 삭제(양 사본) + `ALWAYS_HOOKS` 3종 +
  `session-start.sh` 양 사본 compact-warning 분기 제거 + `.gitignore` 의
  `.claude/compact-warning.flag` 죽은 줄 제거. **신규 게이트**(born-red 선행): ALWAYS_HOOKS 전
  파일이 `templates/settings.json` 에 배선. `test/docker/scenarios/scenario-project.sh:103-108`
  훅 열거가 **이미 FAIL**(spec-drift-check 잔존 단언) — `templates/hooks/*.sh` derive 로 교체 [P1-1].
- **AC2 차단 로그**: `protect-files.sh`·`mcp-pre-exec.sh`(양 사본)·`docker-only-realcli.sh`(dev)가
  차단 시 `.uzys-agent-harness/hook-blocks.log` 에 1줄 append. 차단 계약 불변(exit 2+stderr).
  `set -e` 하에서 로그 실패가 차단을 깨면 안 된다. **변이 3케이스**: ⓐ차단 입력→로그 1줄+exit 2
  ⓑ통과 입력→로그 0줄+exit 0 ⓒ**로그 디렉터리 쓰기 불가여도 exit 2** [P1-8].
  설치 사용자 리포에서 로그가 추적되지 않도록 `src/env-files.ts` gitignore 패턴에
  `.uzys-agent-harness/` 추가(+테스트) [P1-7]. uninstall 이 로그를 함께 지우는 것은 감수(ADR 기재).
- **AC3 gates-taxonomy 삭제**: 양 사본 삭제 + `COMMON_RULES` 제거 + **`.dev-references/
  cherrypicks.lock` 의 `gsd-gates-taxonomy` 행 제거**(vnv-verdict 역방향 게이트가 red 로 무는
  지점 — 전례: manifest.ts:160 주석의 ecc-verification-loop 처리) [P0-2] +
  **`{templates,.claude}/agents/plan-checker.md` 의 참조 2곳×2 제거** [P0-4].
  판정 수단 = 기존 게이트 green 이 아니라 **명시 grep**: `gates-taxonomy` 잔존 0
  (CHANGELOG·docs/archive·docs/decisions·docs/plans·docs/research 이력은 면제).
- **AC4 룰 8종×2 감량**: 절 단위 삭제 + 압축. **예산 = 아래 표가 SSOT, 총 1,100 → ≤595줄**
  [P0-3: 550 폐기]. 줄 수는 보조 지표 — **`npm run cost:report` 토큰 before→after 를 보고에
  기재**(ratchet·figures 게이트가 재는 단위는 토큰) [P1-4].
  **byte-동일 잠금 2종**(doc-governance·benchmark-parity)은 양 사본 동시 동일 편집 [P1-3].
  **templates/** 에 ADR 번호·이 리포 좌표 기입 금지**(distribution-hygiene 게이트 + SPEC DO NOT
  CHANGE) — "지우는 절"은 사본별 표를 따른다 [P1-10].
- **AC5 내용 계약 게이트 갱신 — 약화 금지**: 감량으로 깨지는 게이트는 앵커를 새 본문에 맞춰
  갱신하되 검사 자체를 지우지 않는다. 대상은 열거가 아니라 술어로: **"룰 파일 또는 배포물을
  경로로 읽는 게이트 전체"** [P1-11]. 최소 확인 목록: doc-governance-baseline-rule ·
  benchmark-parity-rule · session-cleanup-gate(앵커: cli-development 의 `realpath -m`·
  `find -newermt`·`빈 결과는 부재의 증거가 아니다`·파이프 `$?`·stderr / git-policy 의
  `백그라운드`·`서브에이전트`·`ppid=1`·`다른 프로젝트의 프로세스`) · evidence-templates ·
  spec-drift-backlog-exemption · **protect-branch-surface**(templates git-policy 의
  `.uzys-agent-harness/protect-branch.sh` 포인터 줄 유지) [P1-2] · vnv-verdict ·
  templates-distribution-hygiene · context-cost-ratchet. 갱신 게이트마다 변이 red 확인.
- **AC6 수치 SSOT 동기화 — P3 완료 후 실행** [P1-5]: CLAUDE.md(루트)·docs/NORTH_STAR.md·
  docs/REFERENCE.md(§cherrypicks 20→19 + gates-taxonomy 행) · **docs/USAGE.md 훅 표의
  checkpoint-snapshot 행** [P1-6] · **docs/SPEC.md**(stale Non-Goals "룰 33개…H 사이클" 줄
  현행화 + Change Log 기재 — 본 사이클이 그 H 사이클 실행분) [P1-9] ·
  `npm run cost:baseline` 재생성 → ratchet·north-star-cost-figures green.
- **AC7 ADR-061**: 적용 범위를 **두 갈래로** 기술 [P0-1]: ⓐ `policyFiles` 기준선 보유 설치본 —
  update 의 `pruneOrphans` 가 checkpoint-snapshot.sh·gates-taxonomy.md 를 **회수**(사용자
  편집분은 백업 후 삭제, update-mode.ts:528-553) ⓑ 레거시 로그/로그 부재 — 잔존(무해, 미배선).
  근거 테스트(update-mode.test.ts:718·735) 실행 증거 첨부. Consequences: uninstall 의
  차단 로그 소멸, 내용 계약 게이트 앵커 갱신 목록.
- **AC8 전체 검증**: `npm run ci` exit 0 + 훅 stdin-mock 셸 테스트. 독립 검증 레인(P5)이
  AC1~7 재실행 + 변이 표본 + ADR 단언 grep 재확인.

## 사본별 감량 예산 (표가 SSOT — 상한이지 목표 미달 사유 아님)

| 룰 | dev | templates | dev 에서 지우는 절 | templates 에서 지우는 절 |
|---|---|---|---|---|
| gates-taxonomy | 21→0 | 21→0 | 전체 | 전체 |
| test-policy | 83→45 | 75→35 | TDD·AAA·Naming·Framework·Troubleshooting | 동일 방향(사본 구조 확인 후) |
| git-policy | 110→55 | 75→40 | Cleanup 절차 상세→요점·보고 예·Drift 서사→ADR-007 포인터(dev 만) | Cleanup 상세→요점·보고 예 압축. **Versioning 절 없음 — ADR 번호 기입 금지** |
| doc-governance | 80→45 | 80→45 | baseline 절차→요점 6줄 (byte-동일 유지) | 좌동(동시 편집) |
| change-management | 59→40 | 59→40 | ADR Status 서사 압축(템플릿 블록 유지) | 좌동 |
| cli-development | 59→40 | 55→30 | set·Testing 일반론, BSD/GNU 사고 행 위주 | 좌동 + session-cleanup-gate 앵커 유지 |
| ship-checklist | 48→40 | 25→20 | Post-Ship·Railway 압축·aspirational 판정 | 압축 |
| playwright-launch | 24→20 | 24→20 | 미세 압축 | 좌동 |
| benchmark-parity | 101→40 | 101→40 | 서사·Dogfood 상세→요점 (byte-동일 유지) | 좌동(동시 편집) |
| **합계** | **585→≤325** | **515→≤270** | 총 **≤595** | |

사고 이력 문장·계약 스키마를 지워 예산을 맞추는 것 금지(감량 ≠ 기억상실).

## 레인 (배타 소유 · git 상태 변경 금지 · 변이 복구는 외과적)

| 레인 | 소유 | 순서 |
|---|---|---|
| P2 테스트 | tests/hook-wiring-parity.test.ts·tests/hook-block-log.test.ts 신설 | 선행, born-red 증거 |
| P3-A 훅·배선 | templates/hooks/* · .claude/hooks/* · src/manifest.ts · src/env-files.ts · templates/settings.json · .gitignore · test/docker/scenarios/scenario-project.sh · tests/{manifest,installer*,install,context-cost,hook-context-schema,env-files 관련} | P2 후, P3-B 와 병렬 |
| P3-B 룰 감량 | templates/rules/* · .claude/rules/* · {templates,.claude}/agents/plan-checker.md · .dev-references/cherrypicks.lock · AC5 게이트 테스트들 | P2 후, P3-A 와 병렬 |
| P4 문서·수치 | CLAUDE.md · docs/{NORTH_STAR,REFERENCE,USAGE,SPEC}.md · context-cost-baseline.json | **P3 완료 후** |
| P5 독립 검증 | (읽기 전용+재실행) | P4 후 |
| 오케스트레이터 | 계획·ADR-061·커밋·PR | 전 구간 |

## Non-Goals

benchmark-parity 스킬화(이관 리포 소관— 제안만) · permissions deny 재설계(백로그 A2) ·
훅 신설 · 릴리즈(v26.141.0 통합, 머지 후 별도 승인) · `.claude/settings.json`(사용자 소유) 수정.

## 진행

- [x] 리서치 — docs/research/rules-hooks-value-audit-2026-08-02/
- [x] PR #267 머지 + cleanup (main `5d0bfdc`) + base CI green
- [x] P1 계획 리뷰 → 본 개정판 반영 (P0 4·P1 11)
- [x] P2 born-red 게이트 (신설 2게이트 6 failed 로 태어남 — 오케스트레이터 직접 재확인)
- [x] P3-A / P3-B 구현 (훅 4→3+차단로그 / 룰 1,100→535줄, byte-잠금 2종 유지)
- [x] P4 수치 동기화 (상주 24개/6,552 → 23개/5,719tok · 문서 6종 · npm run ci exit 0)
- [x] P5 독립 검증 (fresh opus@xhigh — AC 8/8 PASS · CRITICAL/HIGH 0 · 변이 2/2 red · 권고 4건 반영)
- [x] ADR-061(Accepted) + 커밋 `9d1b61f` + **PR #268 — 머지는 사용자 승인 대기**
