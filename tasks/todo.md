# Todo — C2: fresh-env 설치 매트릭스 CI

> Plan: [`tasks/plan.md`](plan.md) · 승인 후 위→아래 순. 각 Task 후 Checkpoint 에서 멈춰 검증 보고.

## Task 1 — 패키징 설치 smoke (단일 combo, A1 증명)
- [x] `.github/workflows/install-matrix.yml` 신규 — 1 job (ubuntu / Node 20 / npm)
- [x] step: `npm pack` → 타르볼 임시 설치 → `claude-harness install --track tooling --project-dir <tmp>`
- [x] 단언: exit 0 + `.claude/CLAUDE.md` + `.claude/.installed-tracks` + `.mcp.json` 존재
- [x] 로컬 1차: YAML OK(ruby) + 타르볼 설치/bin 작동(글로벌 오염 0) + Docker 실설치 core 확인 (로컬 Node 25, CI=20)
- [x] CI 1차: `workflow_dispatch` green (단일 combo ubuntu·node20, run 26712623346, 20s)
- [x] 🔲 **Checkpoint 1** — 패키징 경로 증명 (로컬+Docker+실 CI) 통과 → fan-out 승인됨

## Task 2 — OS × Node fan-out
- [x] `strategy.matrix: os{ubuntu,macos} × node{20,22}` (`fail-fast: false`) = npm 4 combo
- [ ] 4/4 combo green 확인 (머지 후 dispatch)

## Task 3 — pnpm 진입점 차원 (A2 검증)
- [x] `corepack enable` + `corepack prepare pnpm@9` + `pnpm add`/`pnpm exec` 진입점
- [x] pm 차원 subset (ubuntu·node20·pnpm + macos·node22·pnpm) — 총 6 combo
- [ ] pnpm combo green (머지 후 dispatch)

## Task 4 — First-Run Success 단언 강화 + 리포팅
- [x] core 파일 단언 (비대화형 = 프롬프트 0) + `set -euo pipefail`
- [x] `$GITHUB_STEP_SUMMARY` combo/track별 PASS 표
- [x] 멀티 트랙 sweep (multi-track job: tooling/executive/data)
- [x] 실패 주입 (fail-loud job: unknown track → non-zero) + npx github: smoke (AC5)

## Task 5 — 트리거 분리 + 문서 현행화
- [x] 트리거 `push.tags[v*] + workflow_dispatch` + concurrency + `name: install-matrix`
- [x] `test-policy.md` / `ship-checklist.md` 에 릴리스 게이트 등재
- [ ] workflow_dispatch green (머지 후) + 문서 diff

## 완료 조건 (사이클)
- [ ] 매트릭스 전 combo green (머지 후 dispatch 검증)
- [x] 문서에 게이트 등재
- [ ] branch + PR (docs/CI only — 무태그, 코드 변경 시 `npm run ci`)
