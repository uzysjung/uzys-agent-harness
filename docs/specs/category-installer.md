# SPEC: Category-based Installer Repositioning

> **Status**: Draft (2026-05-14)
> **Trigger**: 사용자 방향 변경 — uzys-claude-harness 를 "각 전문분야별 대표 스킬/프레임워크 설치 프로그램"으로 포지션. Track 기반(기술 스택 묶음 강제 매핑) → Track 선택 + 카테고리별 **체크 가능한 추천 선택** 흐름.

---

## 1. Objective

설치 도구의 정체성을 **분야별(Category) 대표 스킬 큐레이터**로 명확화한다.

### 흐름

**Step 1 — Preset 선택** (기존 11 트랙 유지)
- 사용자가 `csr-supabase` 등 트랙(=preset) 선택. multiselect.

**Step 2 — Skills 카테고리별 추천 표시** (NEW)
- 선택한 preset 이 자동 매핑하던 자산들이 `[✓] 추천 선택` 상태로 미리 체크
- 사용자가 ✓ 풀어서 제외 가능 / `[ ] opt-in` 켜서 추가 가능
- 각 자산 옆에 **정확한 출처** 표시 (`[anthropics]`, `[vercel-labs]`, `[supabase]`, `[obra]`, ...)

### 결과

- BREAKING 영향 = **uzys-harness 자체 워크플로우 1건만** (이전 dev 트랙 자동 설치 → opt-in)
- 나머지 preset 추천 ✓ 가 자동 체크되므로 ENTER 만 누르면 기존과 동일

## 2. 판단 기준 (불변)

### 완료 조건 (AC)

- **AC1**: 7 카테고리 정의 (`src/categories.ts` 신규). Frontend / Backend / Data / Business / Dev Tools / Workflow / ECC Suite.
- **AC2**: `ExternalAsset` 에 `category`, `source` 필드 추가. 모든 자산이 정확한 출처 (GitHub org/user) 보유.
- **AC3**: Preset → 카테고리/자산 매핑 — 기존 11 트랙 자산 set 과 1:1 동등. AC9 와 함께 검증.
- **AC4**: Interactive CLI Step 1 (preset multiselect) + Step 2 (카테고리 그룹화 multiselect, 추천 ✓ 미리 체크, 출처 라벨).
- **AC5**: CLI flag — `--preset <track>` (기존 `--track` alias), `--with <skill-id>` (단일 자산 추가), `--without <skill-id>` (추천 제거), 기존 `--with-*` 호환.
- **AC6**: `uzys-harness` 자체 워크플로우 = opt-in (BREAKING). `OptionFlags.withUzysHarness` (default false). 어느 preset 도 추천 ✓ 자동 체크 X.
- **AC7**: `superpowers` 신규 자산 추가 (obra/superpowers, anthropics/claude-plugins-official marketplace 등록). Workflow 카테고리 opt-in.
- **AC8**: 출처 라벨 — `[anthropics]` `[vercel-labs]` `[supabase]` `[railwayapp]` `[trailofbits]` `[obra]` `[addyosmani]` `[pbakaus]` `[K-Dense-AI]` `[wshobson]` `[testdino-hq]` `[yonatangross]` `[alirezarezvani]` `[affaan-m]` `[본 프로젝트]`. Generic `[3rd-party]` 라벨 금지.
- **AC9**: 회귀 0 — 기존 preset (예: `--preset csr-supabase`) 추천 ✓ 만으로 설치 시 자산 set diff 0 (단 `uzys-harness` 는 제외 — Phase D BREAKING).
- **AC10**: vitest 회귀 + 신규 카테고리 grouping + preset → 추천 매핑 단위 테스트.
- **AC11**: Migration 안내 — Release notes + README + CLI 첫 실행 시 1줄.

### 판정 절차

1. 각 preset → 추천 자산 set vs 기존 매핑 자산 set diff (자산 누락 0, `uzys-harness` 제외)
2. Interactive flow manual test — 카테고리별 표시 + 출처 라벨 + 추천 ✓ 동작
3. CLI flag matrix — `--preset` / `--with` / `--without` 조합

## 3. 결정 일람

### 3.1 7 카테고리 + 자산 분류 (In Scope)

#### 🎨 Frontend (UI · Design)
| Asset ID | 출처 |
|---|---|
| shadcn-ui | shadcn/ui |
| web-design-guidelines | vercel-labs |
| react-best-practices | vercel-labs |
| impeccable | pbakaus |

(Phase A 작성 시 'frontend-design' 자산명을 잘못 표기 — 실제 코드의 자산은 `web-design-guidelines`. SPEC 정정.)

#### 🗄️ Backend (API · DB · Deploy)
| Asset ID | 출처 |
|---|---|
| supabase-agent-skills | supabase |
| supabase-cli | supabase (npm) |
| vercel-cli | vercel (npm) |
| netlify-cli | netlify (npm) |
| postgres-best-practices | supabase |
| railway-skills | railwayapp |
| next-skills | vercel-labs |

#### 📊 Data
| Asset ID | 출처 |
|---|---|
| anthropic-data-plugin | anthropics |
| python-patterns | anthropics |
| python-testing | anthropics |
| polars-K-Dense | K-Dense-AI |
| dask-K-Dense | K-Dense-AI |
| python-resource-management | wshobson |
| python-performance-optimization | wshobson |

#### 💼 Business (Documents)
| Asset ID | 출처 |
|---|---|
| anthropic-document-skills | anthropics |
| c-level-skills | alirezarezvani |
| business-growth-skills | alirezarezvani |
| finance-skills | alirezarezvani |
| pm-skills | alirezarezvani |
| marketing-skills | alirezarezvani |
| content-creator | alirezarezvani |
| demand-gen | alirezarezvani |
| research-summarizer | alirezarezvani |

#### 🛡️ Dev Tools (Security · Quality)
| Asset ID | 출처 |
|---|---|
| trail-of-bits (differential-review) | trailofbits |
| karpathy-coder | alirezarezvani |
| product-skills | alirezarezvani |
| playwright-skill | testdino-hq |
| find-skills | vercel-labs |
| agent-browser | npm |
| architecture-decision-record | yonatangross |

#### 🔄 Workflow (Development Cycle) — 모두 opt-in
| Asset ID | 출처 |
|---|---|
| **uzys-harness** | **본 프로젝트 (uzysjung)** |
| addy-agent-skills | addyosmani |
| superpowers | obra (anthropics/claude-plugins-official marketplace 등록) |
| gsd | get-shit-done-cc team |

#### 📦 ECC Suite — 모두 opt-in
| Asset ID | 출처 |
|---|---|
| ecc | affaan-m (everything-claude-code) |
| ecc-prune | 본 프로젝트 (script) |
| ecc-factforcing-off | 본 프로젝트 (flag) |

### 3.2 Preset 추천 ✓ 매핑 (Step 2 초기 상태)

| Preset | 추천 ✓ (Step 2 초기 체크) |
|---|---|
| `csr-supabase` | shadcn-ui, frontend-design, react-best-practices, web-design-guidelines, impeccable, supabase-agent-skills, supabase-cli, vercel-cli, netlify-cli, postgres-best-practices |
| `csr-fastapi` | shadcn-ui, frontend-design, react-best-practices, web-design-guidelines, impeccable, railway-skills, api-contract, database |
| `csr-fastify` | (csr-fastapi 동일) |
| `ssr-htmx` | railway-skills, impeccable (htmx rule) |
| `ssr-nextjs` | shadcn-ui, frontend-design, react-best-practices, web-design-guidelines, impeccable, next-skills, railway-skills |
| `data` | anthropic-data-plugin, python-patterns, python-testing, polars-K-Dense, dask-K-Dense, python-resource-management, python-performance-optimization |
| `executive` | anthropic-document-skills, c-level-skills, business-growth-skills, finance-skills |
| `tooling` | playwright-skill, find-skills, agent-browser, architecture-decision-record, product-skills, karpathy-coder |
| `full` | 위 7개 카테고리의 모든 default ON 자산 (uzys-harness/superpowers/addy/gsd/ECC 제외) |
| `project-management` | anthropic-document-skills, (PM rule들) |
| `growth-marketing` | anthropic-document-skills, (Growth rule들) |

**모든 preset 에서 추천 ✓ 자동 체크 안 되는 자산**: `uzys-harness`, `addy-agent-skills`, `superpowers`, `gsd`, `ecc`, `ecc-prune`, `ecc-factforcing-off`, `trail-of-bits`

### 3.3 Non-Goals

- 기존 트랙 식별자 제거 — Preset 으로 보존
- 기존 자산의 install method 변경 (plugin/skill/npm-global/npx-run)
- `.claude/rules/*.md` 콘텐츠 변경 (매핑만 재구성)
- Codex/OpenCode transform 로직 변경
- 본 SPEC 신규 외부 plugin 추가 = obra/superpowers 1건만

### 3.4 DO NOT CHANGE

- `templates/CLAUDE.md`, `templates/project-claude/_base.md`
- 11 트랙 식별자 (preset 이름)
- 기존 `ExternalAsset.id` (라벨링/그룹핑만 추가)
- 자산 install method 패턴

### 3.5 Resolved (사용자 결정, 2026-05-14)

- **R1**: `uzys-harness` = opt-in (모든 preset 에서 추천 ✓ X). 사용자 표기대로.
- **R2**: Track = Preset shortcut 으로 유지. Step 1 multiselect.
- **R3**: `superpowers` = obra/superpowers (190k★, anthropics/claude-plugins-official 공식 marketplace 등록).
- **R4**: 전체 사이클 한 세션 진행 (SPEC → ship).
- **R5**: Step 2 = 추천 ✓ 미리 체크 + unchecked 가능 + 추가 opt-in 가능.
- **R6**: 출처 라벨 = 정확한 GitHub org/user. `[3rd-party]` 같은 generic 금지.

## 4. Phase 분해

- **Phase A — Category & Source 메타데이터** : `src/categories.ts` 신규 + `ExternalAsset` 에 `category` `source` 필드 추가. 모든 자산 분류.
- **Phase B — Preset 추천 매핑** : `src/preset-recommend.ts` 신규. 11 preset → 추천 ✓ 자산 set 매핑. 기존 manifest TRACK_RULES + external-assets condition 과 정합성 검증.
- **Phase C — Interactive CLI 변경** : Step 1 (preset) + Step 2 (카테고리 그룹화, 추천 ✓ 미리 체크, 출처 라벨). `@clack/prompts` 활용.
- **Phase D — uzys-harness opt-in 전환** : `OptionFlags.withUzysHarness` (default false). 기존 dev 트랙 강제 매핑 제거. CLI flag `--with uzys-harness` / `--without uzys-harness`. BREAKING.
- **Phase E — superpowers 신규** : `external-assets.ts` entry + `OptionFlags.withSuperpowers`.
- **Phase F — CLI flag 통합** : `--with <id>` / `--without <id>` (recur), 기존 `--with-*` 호환 layer.
- **Phase G — 문서 / Migration** : README, USAGE, CHANGELOG, Release notes migration 안내.
- **Phase H — Review & Ship** : `/uzys:review` → `/uzys:ship` → v26.43.0 tag.

순차 의존: A → B → C → (D, E 병렬) → F → G → H.

## 5. 위험 & 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| BREAKING — uzys-harness opt-in | 기존 사용자 자동 설치되던 워크플로우 누락 | Release notes 명확 + migration 1줄 (`--with uzys-harness`) + CLI 첫 실행 안내 |
| Preset 추천 매핑 누락 | 기존 트랙 사용자 자산 누락 | AC9 — preset 추천 자산 set diff 0 강제 (uzys-harness 제외) |
| 출처 라벨 부정확 | 사용자 혼란 | Phase A 에서 모든 자산 정확한 출처 (`marketplace` / `source` 필드에서 추출) + AC8 매핑 검증 |
| Workflow 카테고리 동시 설치 시 slash 충돌 | `/spec` `/plan` 등 namespace 없는 명령 충돌 | UI 경고 (uzys-harness 는 `/uzys:` namespace 으로 안전, 나머지 3 동시 선택 시 경고) |
| Phase C interactive 복잡도 | clack 다중 select group 구현 | 기존 `@clack/prompts` 패턴 + 1 카테고리씩 prompt (fallback) |

## 6. Self-Audit Hooks

각 Phase 완료 시 5항목 실행. commit body 1줄 기록.

---

## Changelog

- 2026-05-14: 초안. 사용자 결정 6건(R1-R6) + 7 카테고리 + 11 preset 매핑 + 모든 자산 정확한 출처 + obra/superpowers 추가.
