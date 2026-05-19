# uzys-claude-harness

> Claude Code agent harness — 6-gate 워크플로우, 11 트랙, 디폴트 project-scope.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-claude-harness?label=version)](https://github.com/uzysjung/uzys-claude-harness/releases)
[![CI](https://github.com/uzysjung/uzys-claude-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-claude-harness/actions)

🇺🇸 [README.md](./README.md)

## 설치

```bash
npx -y github:uzysjung/uzys-claude-harness
```

Interactive wizard 가 6 step (트랙 → CLI → install 항목 → scope → confirm → install) 으로 안내. flag 필요 없음.

```bash
# 설치 후:
claude
> /uzys:spec
> /uzys:auto
```

## Tracks

Step 1 에서 1개 또는 multi 선택.

### Dev
| Track | Stack |
|---|---|
| `csr-supabase` | Vite + React + Supabase |
| `csr-fastify` | Vite + React + Fastify |
| `csr-fastapi` | Vite + React + FastAPI |
| `ssr-nextjs` | Next.js (App Router) |
| `ssr-htmx` | HTMX + server-side |
| `data` | DuckDB + Polars + PySide6 |
| `full` | dev 트랙 전체 union |

### Business
| Track | Use |
|---|---|
| `executive` | 제안서, DD, 발표자료, 재무모델 |
| `project-management` | PM workflow |
| `growth-marketing` | Growth + content marketing |

### Meta
| Track | Use |
|---|---|
| `tooling` | Bash + Markdown meta-project |

## Install 항목

Step 3 에서 카테고리별로 추천 항목이 체크된 상태로 표시. 자유롭게 토글.

| Category | 예시 |
|---|---|
| **Frontend** | shadcn-ui, react-skill, frontend-design |
| **Backend** | supabase, fastapi-skill |
| **Data** | polars, dask, python-data, python-ml |
| **Business** | strategist, pm-skills, c-level-strategy |
| **Dev Tools** | playwright, agent-browser, ADR, find-skills |
| **Workflow** | uzys-harness 6-Gate, addy-agent-skills, superpowers, gsd |
| **ECC** | code-reviewer, security-reviewer, continuous-learning-v2, eval-harness |

선택한 트랙에 따라 추천이 자동 계산. install 전 사용자가 조정.

## Scope (v26.64.0)

Step 4 에서 wizard 가 묻고 사용자가 선택. **Project 가 default** — 글로벌 write 0.

| | Project (default) | Global (opt-in) |
|---|---|---|
| `claude plugin` | `--scope project` (projectPath 격리) | `--scope user` |
| `npx skills` | project node_modules | `-g` (user-level) |
| `npm` | `--save-dev` | `-g` |
| Codex prompts/skills/trust | `.codex/` (project) | `~/.codex/` |
| `~/.claude/skills`, `~/.codex/`, `~/.opencode/`, `npm -g` | **미수정** | 자산별 write |

`~/.claude/plugins/{cache,marketplaces,installed_plugins.json}` 만 claude CLI 자체가 두 모드 모두에서 write — 단 `installed_plugins.json` 의 메타데이터가 `projectPath` 로 격리해서 다른 프로젝트는 영향 받지 않음.

## Workflow (6-Gate)

```
/uzys:spec → /uzys:plan → /uzys:build → /uzys:test → /uzys:review → /uzys:ship
```

각 게이트는 hook 으로 강제. 이전 단계 미완료 시 다음 단계 차단 (exit 2).

## Uninstall

```bash
npx -y github:uzysjung/uzys-claude-harness uninstall
```

`.claude/.harness-install.json` 기반 reverse. Project-scope 자산은 자동 제거, global-scope 자산은 안내만 (D16 — 글로벌 자동 삭제 금지).

Flag: `--dry-run`, `--keep-templates`.

## 심화

- [docs/USAGE.md](./docs/USAGE.md) — 워크플로우 상세, 자산 매트릭스, CI flag, ECC, Codex/OpenCode 통합
- [docs/NORTH_STAR.md](./docs/NORTH_STAR.md) — 디자인 원칙
- [docs/decisions/](./docs/decisions/) — ADR (아키텍처 결정)

## License

MIT.
