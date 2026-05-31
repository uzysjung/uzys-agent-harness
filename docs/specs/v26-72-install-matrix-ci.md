# SPEC: v26.72.0 — fresh-env 설치 매트릭스 CI (C2)

> **Status**: Draft (2026-05-31)
> **Predecessor**: v26.71.0 (검증 Trust Tier)
> **Trigger**: `docs/research/next-steps-2026-05-31.md` C2 (RICE 600, 1위). North Star Phase 2 — First-Run Success ≥95% 측정·회귀방지 게이트.
> **Plan ref**: `tasks/plan.md` (수직 슬라이스 Task 1~5) · `tasks/todo.md`

---

## 1. Objective

진짜 사용자가 설치하는 방식(`npm pack` 타르볼 = 배포 surface, + `npx -y github:` = 문서 명령)을 **fresh GitHub 러너**의 **OS × Node × 패키지매니저** 매트릭스에서 실행해, **첫 실행이 수동 개입 0건으로 성공**함을 자동 검증한다.

핵심 갭: `dist/` 가 gitignore → 실제 설치는 `prepare`(`[ -d dist ] || npm run build`) 빌드에 의존하나, **현재 `ci` 워크플로우는 이 경로를 안 탄다**(`node dist/index.js` 로컬 빌드만). 본 매트릭스가 **Node 20·22 fresh 환경의 prepare 빌드 + 패키징 surface** 를 처음으로 검증한다.

## 2. 판단 기준 (AC)

산출물은 **워크플로우 run 결과 / exit code / 파일 존재**로 검증 (에이전트 자기주장 불가). NSM 2차 First-Run Success 를 CI 에서는 "전 combo green = 100%, 1개라도 red = first-run 실패 노출"로 인코딩.

- **AC1 (A1 증명 / Task 1)**: 단일 combo(ubuntu·Node20·npm)에서 `npm pack` → 타르볼 임시 설치 → `claude-harness install --track tooling --project-dir <tmp>` → exit 0 + `.claude/CLAUDE.md` + `.claude/.installed-tracks` + `.mcp.json` 존재 + TTY 프롬프트 0(비대화 `--track`).
- **AC2 (OS×Node / Task 2)**: `matrix: os{ubuntu-latest, macos-latest} × node{20, 22}` (`fail-fast: false`) 4/4 green. 어느 combo도 수동 개입 불필요.
- **AC3 (pnpm subset / Task 3)**: `corepack enable` 후 pnpm 진입점(`pnpm dlx <tarball>` 또는 `pnpm i` + bin) 대표 subset(최소 ubuntu·Node20 + macos·Node22) green. 내부 npm shell-out(external 비활성 시 미호출) 무영향 확인.
- **AC4 (First-Run 단언 + 리포팅 / Task 4)**: 각 combo가 exit 0 + 기대 파일 + 프롬프트 0 을 명시 단언. `$GITHUB_STEP_SUMMARY` combo별 PASS/FAIL 표. 멀티 트랙 sweep 2~3종(예: tooling + csr-supabase + data). 실패 주입(없는 track) 시 빨강 확인(Rule 12 fail-loud).
- **AC5 (문서 명령 smoke)**: 1 job 이 `npx -y github:uzysjung/uzys-claude-harness#<ref> install --track tooling --project-dir <tmp>` 실행 → green. 릴리스(태그/main) 대상 한정.
- **AC6 (트리거 분리 + 문서 / Task 5)**: 신규 `.github/workflows/install-matrix.yml`, `name: install-matrix`, `on: push.tags[v*] + workflow_dispatch` + `concurrency`. 기존 `ci`(test.yml) 미수정. `test-policy.md`·`ship-checklist.md` 에 "릴리스 게이트: 태그 후 install-matrix green" 등재.

### 판정 절차
1. 머지 전: 로컬 1 combo green(설치 명령 시퀀스) + YAML valid 까지 보장. **로컬 Node=25 ≠ CI 20/22 명시.**
2. 머지 후: `workflow_dispatch` 1회 실행이 **진짜 게이트** (매트릭스 fan-out·러너·Node 20/22 fresh 는 CI-온리 검증).
3. 미달 combo 는 red → 원인 fix 또는 Non-Goals 이월 CR.

## 3. 결정 일람

### 3.1 In Scope
- 패키징 진입점(`npm pack` 타르볼 = 주, `npx github:` = smoke 1) fresh 설치
- OS{ubuntu,macos} × Node{20,22} × pm{npm, pnpm subset}
- core 설치(오프라인 `--track`) 결과 단언 + 멀티 트랙 sweep
- 신규 워크플로우 분리 + 문서 게이트 등재

### 3.2 Non-Goals
- **external 자산 실설치 매트릭스** — Docker E2E(`test/docker/`, mocks/claude·skills)가 담당 (비중복)
- **global scope 매트릭스** — `test/docker/scenarios/scenario-global.sh` 담당
- **Windows** — `engines` 미선언(`node>=20`), 별 평가
- **설치 성공률 대시보드/집계 자동화** — Phase 2 후속
- **src/ 설치 로직 변경** — 본 SPEC 은 검증 추가. 매트릭스가 버그 노출 시 별 fix CR

### 3.3 DO NOT CHANGE
- `docs/SPEC.md` (Foundation Persistent Anchor, frozen)
- `.github/workflows/test.yml` 의 `ci` job (별 워크플로우로 분리, 기존 미수정)
- 태그-온리 CI 정책 (v26.70.3, test-policy.md)
- `package.json` `prepare`/`files`/`bin`/`engines` (검증 대상이지 수정 대상 아님)

### 3.4 Open Questions
- **OQ1**: `npx github:` smoke(AC5)의 ref 타깃 — PR 브랜치는 GitHub ref 미존재(chicken-egg) → **PR validation 은 npm pack only, npx smoke 는 태그/main 한정**으로 확정. (이미 결정, 기록용.)
- **OQ2**: macos 러너 prepare 빌드 시간이 과도하면(R3) Task 2 후 macos×Node22 등 trim 재평가.
- **OQ3**: First-Run Success "≥95%" 의 분모 — CI 는 combo green률(100% 목표)로 proxy. 실 사용자 분포는 P2-01(C1 fresh-dogfood)에서 별도 측정.

## 4. Phase 분해 (Task 매핑)

- **Phase 1 (AC1)** — 단일 combo 패키징 설치 smoke. **🔲 Checkpoint 1**: 패키징 경로 증명 전 fan-out 금지.
- **Phase 2 (AC2)** — OS×Node 4-combo fan-out. **🔲 Checkpoint 2**: 안정 후 pnpm 추가.
- **Phase 3 (AC3)** — pnpm subset 차원.
- **Phase 4 (AC4, AC5)** — First-Run 단언 강화 + summary + 멀티트랙 + npx smoke + 실패 주입.
- **Phase 5 (AC6)** — 트리거 분리 + 문서 현행화 → review → ship(v26.72.0 태그) → 태그 트리거로 매트릭스 자동 실행 사후 확인.

병렬: Phase 1 → 2 → 3 순차(의존). Phase 4 는 2/3 위에 누적. Phase 5 마지막.

## 5. Self-Audit Hooks

각 Phase 완료 시 CLAUDE.md Self-Audit 5항목 실행 (AC Pass/Fail / DO NOT CHANGE 미변경 / Non-Goals 미침범 / 추적불가 변경 / 열린 결정). Checkpoint 에서 사용자 보고.

---

## Changelog
- 2026-05-31: 초안. 근거 — research C2(RICE 1위) + 사용자 결정 3건(저장=docs/specs repo 컨벤션 / 메커니즘=npm pack+npx smoke / pnpm=subset).
