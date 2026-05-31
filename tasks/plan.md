# Plan — C2: fresh-env 설치 매트릭스 CI

> **출처**: `docs/research/next-steps-2026-05-31.md` (RICE 600, 1위) · North Star Phase 2 (First-Run Success ≥95%)
> **작성**: 2026-05-31 (plan 모드, 읽기 전용 분석 후)
> **상태**: 인간 검토 대기 — 승인 후 Task 1 착수

## 1. 목표 (Goal)

진짜 사용자가 설치하는 방식(`npx -y github:...` / `pnpm dlx`)을 **fresh GitHub 러너**에서 **OS × Node × 패키지매니저** 매트릭스로 실행해, **첫 실행이 수동 개입 0건으로 성공**함을 자동 검증한다. NSM 2차 지표 First-Run Success ≥95% 의 측정·회귀방지 게이트.

## 2. 명시적 가정 (Rule 1 — 검증 대상)

- **A1**: `dist/` 가 gitignore 됨 → `npx github:` / `npm pack` 은 `prepare`(`[ -d dist ] || npm run build`)로 빌드를 트리거하고, 이때 devDependencies(tsup/typescript)가 설치돼야 한다. **이 경로가 Node 20·22 fresh 환경에서 실제로 성공하는지가 핵심 미검증 리스크** → Task 1 이 증명.
- **A2**: 패키지매니저(npm/pnpm) 차원은 주로 **진입점** 차이. 하네스 내부는 `npm`/`npx`/`npm root -g` 하드코딩(external-installer.ts)이며 Node 동봉 npm 에 의존 → pnpm 사용자도 core 설치는 동작해야 한다.
- **A3**: external 자산(plugin/skill, 20+13건)은 네트워크·실 CLI(claude/skills) 의존 → **이미 Docker E2E(mocks)가 커버**. 본 매트릭스는 **core 설치(오프라인, `--track`)** 에 집중(비중복). external 매트릭스는 본 Task 범위 밖.
- **A4**: CI 정책은 태그-온리(v26.70.3). 본 매트릭스는 **릴리스 게이트** 성격 → `on: push.tags [v*] + workflow_dispatch`. 별도 워크플로우(`install-matrix.yml`)로 분리(기존 `ci` 와 독립).

## 3. 범위

| In Scope | Out of Scope (별 사이클) |
|---|---|
| 패키징 진입점(`npm pack` 타르볼 / `pnpm dlx`) fresh 설치 | external 자산 실설치 매트릭스 (Docker E2E 담당) |
| OS {ubuntu, macos} × Node {20, 22} × pm {npm, pnpm} | Windows (engines 미선언, 별 평가) |
| core 설치 결과 단언 (CLAUDE.md/.installed-tracks/.mcp.json) | global scope 매트릭스 (Docker scenario-global 담당) |
| `npx github:` 문서 명령 자체 smoke (1 job) | 설치 성공률 대시보드/집계 자동화 |

## 4. 의존성 그래프

```
A1 검증 (Task 1: 단일 combo 패키징 설치 smoke)
        │  ← 패키징 경로가 깨지면 매트릭스 전체 무의미. 먼저 증명.
        ▼
Task 2 (OS × Node 4-combo fan-out)  ──┐
        │                             │ 병렬 가능 (T2 green 후 T3)
        ▼                             │
Task 3 (pnpm 진입점 차원)  ←──────────┘
        ▼
Task 4 (First-Run Success 단언 강화 + job summary + 멀티 트랙 sweep)
        ▼
Task 5 (트리거 분리 + 문서 현행화: test-policy/ship-checklist)
```

## 5. 수직 슬라이스 (각 Task = 완결 경로, 독립 검증)

### Task 1 — 패키징 설치 smoke (단일 combo, A1 증명)
- **Deliverable**: `.github/workflows/install-matrix.yml` 신규 + 1 job (ubuntu, Node 20, npm).
  - `npm pack` (현 체크아웃 → 타르볼; `files` 화이트리스트 + prepare 빌드 검증) → 임시 프로젝트에 타르볼 `npm i -g` 또는 `npx <tarball>` → `claude-harness install --track tooling --project-dir <tmp2>` → core 파일 단언.
- **AC**: job exit 0 + `.claude/CLAUDE.md`·`.claude/.installed-tracks`·`.mcp.json` 존재 + 설치 중 TTY 프롬프트 0(비대화 `--track`).
- **검증**: ⓛ 로컬 — 동일 명령 시퀀스(`npm pack` → temp install → run)를 로컬에서 green 확인(단 로컬 Node=25, CI=20 차이 명시). ② CI — `workflow_dispatch` 1회 green.
- **🔲 Checkpoint 1**: 패키징 경로가 한 combo에서 증명되기 전엔 fan-out 금지.

### Task 2 — OS × Node 매트릭스 fan-out
- **Deliverable**: Task 1 job 을 `strategy.matrix: os{ubuntu,macos} × node{20,22}` (4 combo, `fail-fast: false`).
- **AC**: 4/4 combo green. 어느 조합도 수동 개입 불필요.
- **검증**: `workflow_dispatch` 실행 → 4 job 모두 green. 실패 시 어느 조합인지 job 명에 노출.
- **🔲 Checkpoint 2**: OS×Node 안정 후에야 pnpm 복잡도 추가.

### Task 3 — pnpm 진입점 차원 (A2 검증)
- **Deliverable**: pm 차원 추가 — pnpm 은 `corepack enable` 로 활성화 후 `pnpm dlx <tarball>` 또는 `pnpm i -g` → run. 매트릭스 {os}×{node}×{npm,pnpm} (8 combo) 또는 대표 subset(최소 ubuntu·node20·pnpm + macos·node22·pnpm).
- **AC**: pnpm 진입점에서도 core 설치 green. 내부 npm shell-out(external 비활성 시 미호출) 영향 없음 확인.
- **검증**: pnpm combo green. (로컬에 pnpm 10.33 존재 → 로컬 1차 확인 가능.)
- **결정 포인트**: 전체 8 combo vs subset — 비용 대비. 권장: subset(러너 시간 절약, A2 핵심만 커버).

### Task 4 — First-Run Success 단언 강화 + 리포팅
- **Deliverable**: 각 combo 가 "First-Run Success" 를 명시 인코딩 — exit 0 + 기대 파일 + 프롬프트 0. `$GITHUB_STEP_SUMMARY` 에 combo별 PASS/FAIL 표. 멀티 트랙 sweep(예: tooling + csr-supabase + data 중 2~3개)로 트랙 분기 회귀 방지.
- **AC**: 임의 combo 가 수동 개입을 요구하면 빨강. summary 표가 combo별 결과를 보여줌.
- **검증**: 의도적 실패 주입(예: 존재하지 않는 track) 시 빨강 확인 → 단언이 실제로 fail-loud 한지(Rule 12).

### Task 5 — 트리거 분리 + 문서 현행화
- **Deliverable**: `install-matrix.yml` 트리거 = `push.tags[v*] + workflow_dispatch` (태그-온리 정책 정합) + `concurrency`. `name: install-matrix` 로 `ci` 와 구분. `test-policy.md`·`ship-checklist.md` 에 "릴리스 게이트: 태그 후 install-matrix green 확인" 한 줄 추가.
- **AC**: 태그 push 시 자동 실행 / PR 엔 미실행(정책 유지). 문서에 게이트 등재.
- **검증**: workflow_dispatch green + 다음 태그 시 자동 트리거(사후 확인). 문서 diff.

## 6. 로컬 검증 vs CI-온리 (Rule 12 — 정직)

- **로컬에서 검증 가능**: 설치 명령 시퀀스(`npm pack` → temp install → `claude-harness install --track`)의 동작·파일 단언, YAML 문법(`actionlint`/`act` 있으면). **단 로컬 Node=25 ≠ CI 20/22** → Node 버전별 차이는 CI 만이 진짜 증명.
- **CI-온리**: 매트릭스 fan-out 자체, ubuntu/macos 러너, Node 20/22 fresh, corepack pnpm. → **머지 후 `workflow_dispatch` 실행이 진짜 게이트.** 머지 전엔 "로컬 1 combo green + YAML valid" 까지만 보장 가능함을 보고.

## 7. 리스크

- **R1 (A1)**: `npx github:` 의 prepare 빌드가 특정 Node 에서 devDep 미설치/tsup 실패로 깨질 수 있음 → 바로 그걸 잡는 게 본 CI 목적. Task 1 이 첫 신호.
- **R2**: 러너 시간/비용 — 8 combo × 멀티트랙 = 분량 증가. 태그-온리라 빈도 낮아 수용 가능. Task 3 subset 으로 완화.
- **R3**: macos 러너의 prepare 빌드 속도(분 단위). `fail-fast:false` + 캐시로 완화.

## 8. 컨벤션 충돌 표면화 (Rule 7 / Rule 11)

- 본 계획은 `/agent-skills:plan` 스킬 지시대로 **`tasks/plan.md` + `tasks/todo.md`** 에 저장.
- 단 본 repo 의 6-Gate 활성 경로는 **`docs/plan.md` + `docs/todo.md`** (`gate-check.sh`/`spec-drift-check.sh`). `tasks/` 는 게이트가 보지 않음.
- **의도된 분리**: `tasks/todo.md` 의 체크박스 작업목록을 게이트-활성 `docs/todo.md` 에 넣으면 unchecked 항목이 **ship gate 를 차단**한다(spec-drift-check). 작업용 체크리스트는 `tasks/` 에 격리하고, `docs/todo.md` 는 비체크박스 백로그 유지가 양쪽 정합.
- **대안**: 풀 6-Gate 강제를 원하면 `/uzys:spec` 으로 C2 SPEC 정식화 후 `/uzys:plan` 이 `docs/todo.md` 재생성. → 사용자 결정.
