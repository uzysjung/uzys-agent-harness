# Docker realcli 검증 — 워크플로 큐레이션 확장 (2026-06-06)

> v26.75.0/.1 (ADR-021 C). 신규 워크플로 3자산의 **실 설치 native 인식**을 격리 컨테이너에서 검증. 호스트 글로벌 write 0(throwaway `node:20-bookworm-slim`). CLAUDE.md "실환경 검증=Docker 격리" 준수.

## 결과 요약 — 3/3 PASS

| 자산 | method | 명령 | 결과 |
|---|---|---|---|
| `openspec` | npm | `npm i --save-dev @fission-ai/openspec` | exit 0, `npx openspec --version` → **1.4.1** ✓ |
| `bmad-method` | npx-run | `npx bmad-method@latest install --directory . --tools claude-code --yes` | exit 0, `.claude`/`_bmad`/`_bmad-output` 생성 ✓ |
| `wshobson-agents` | plugin | `claude plugin marketplace add wshobson/agents` + `claude plugin install full-stack-orchestration@claude-code-workflows` | 둘 다 exit 0, "Successfully installed plugin" ✓ |

## 추가 검증 — 기존 워크플로 4 (2026-06-06, 매트릭스 확대)

신규 3건에 이어 기존 워크플로 자산도 실 claude(2.1.167)/npx 로 검증 → **워크플로 7/8 🟢**. 모든 plugin `pluginId`/marketplace 정확성 확정.

| 자산 | method | 결과 |
|---|---|---|
| `superpowers` | plugin | `marketplace add anthropics/claude-plugins-official` + `install superpowers@claude-plugins-official` → 둘 다 exit 0 ✓ |
| `ecc-plugin` | plugin | `marketplace add affaan-m/everything-claude-code` + `install ecc@ecc` → 둘 다 exit 0 ✓ |
| `addy-agent-skills` | plugin | `marketplace add addyosmani/agent-skills` + `install agent-skills@addy-agent-skills` → 둘 다 exit 0 ✓ |
| `gsd-orchestrator` | npx-run | registry `get-shit-done-cc` 1.42.3 + `npx get-shit-done-cc@latest --help` exit 0 ✓ (EBADENGINE 경고는 비치명) |

> uzys-harness(본 하네스 templates)는 install-matrix CI + install 테스트로 검증(외부 실설치 아님) → 🟡 유지.

## Docker가 잡은 버그 (v26.75.0 → .1)

**BMAD 비대화형 hang**: v26.75.0 의 args `["install","--tools","claude-code","--yes"]` 는 `--yes` 에도 불구하고 **"Installation directory" 프롬프트에서 멈춤**(exit 0 이지만 _bmad 미생성 — 단위테스트로는 못 잡음). Docker 실행이 검출.

- **원인**: `--directory` 누락. BMAD installer 는 설치 경로를 대화형으로 묻고, `--yes` 가 이를 suppress 하지 못함.
- **fix(v26.75.1)**: args 에 `--directory .` 추가(`.` = cwd = `claude-harness install` 실행 프로젝트). combo 검증으로 확정 — `--directory .` 포함 시 exit 0 + 3 디렉토리 생성, `--full` 은 unknown option.
- **회귀 방지**: `tests/external-assets.test.ts` 가 정확한 args 단언.

## wshobson plugin — SSH→HTTPS 주의 (자산 결함 아님)

`claude plugin marketplace add wshobson/agents` 는 기본 **SSH**(`git@github.com:...`) clone 시도 → SSH 키 없는 환경에서 `ERR_STREAM_PREMATURE_CLOSE`. `git config --global url."https://github.com/".insteadOf "git@github.com:"` 로 HTTPS 강제 시 정상 clone+설치. 이는 **모든 plugin 자산(addy/superpowers/ecc/tob) 공통 메커니즘**이며 실 사용자(SSH 키 또는 git credential 보유)에겐 비이슈. claude CLI 2.1.167 기준.

## 한계 (정직)

- 실 슬래시 실행(C tier)은 범위 외 — 본 검증은 **설치 + 인식(discovery)**까지(A/B tier). openspec `openspec init`·bmad 슬래시·wshobson 에이전트의 런타임 동작은 별도.
- 검증은 단일 실행 스냅샷(2026-06-06). 패키지 버전 drift 는 `trust-tier-drift.yml` 월 cron 이 별도 감지.
