# Todo — C2: fresh-env 설치 매트릭스 CI

> Plan: [`tasks/plan.md`](plan.md) · 승인 후 위→아래 순. 각 Task 후 Checkpoint 에서 멈춰 검증 보고.

## Task 1 — 패키징 설치 smoke (단일 combo, A1 증명)
- [x] `.github/workflows/install-matrix.yml` 신규 — 1 job (ubuntu / Node 20 / npm)
- [x] step: `npm pack` → 타르볼 임시 설치 → `claude-harness install --track tooling --project-dir <tmp>`
- [x] 단언: exit 0 + `.claude/CLAUDE.md` + `.claude/.installed-tracks` + `.mcp.json` 존재
- [x] 로컬 1차: YAML OK(ruby) + 타르볼 설치/bin 작동(글로벌 오염 0) + Docker 실설치 core 확인 (로컬 Node 25, CI=20)
- [ ] CI 1차: `workflow_dispatch` green (feat push 후 — CP1 승인 대기)
- [ ] 🔲 **Checkpoint 1** — 패키징 경로 증명 보고 후 fan-out 승인

## Task 2 — OS × Node fan-out
- [ ] `strategy.matrix: os{ubuntu,macos} × node{20,22}` (`fail-fast: false`)
- [ ] 4/4 combo green 확인
- [ ] 🔲 **Checkpoint 2** — OS×Node 안정 보고 후 pnpm 차원 승인

## Task 3 — pnpm 진입점 차원 (A2 검증)
- [ ] `corepack enable` + pnpm 진입점(`pnpm dlx`/`pnpm i -g`) 추가
- [ ] pm 차원 subset(또는 8 combo) 결정 + green
- [ ] 로컬 pnpm 10.33 1차 확인

## Task 4 — First-Run Success 단언 강화 + 리포팅
- [ ] exit 0 + 파일 + 프롬프트 0 을 명시 단언으로 인코딩
- [ ] `$GITHUB_STEP_SUMMARY` combo별 PASS/FAIL 표
- [ ] 멀티 트랙 sweep (2~3 track)
- [ ] 실패 주입 테스트 → fail-loud 확인 (Rule 12)

## Task 5 — 트리거 분리 + 문서 현행화
- [ ] 트리거 `push.tags[v*] + workflow_dispatch` + concurrency + `name: install-matrix`
- [ ] `test-policy.md` / `ship-checklist.md` 에 릴리스 게이트 한 줄 등재
- [ ] workflow_dispatch green + 문서 diff

## 완료 조건 (사이클)
- [ ] 매트릭스 전 combo green (수동 개입 0)
- [ ] 문서에 게이트 등재
- [ ] branch + PR (docs/CI only — 무태그, 코드 변경 시 `npm run ci`)
