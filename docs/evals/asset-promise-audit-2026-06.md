# 자산 Promise Audit (A2) — 2026-06

> **목적**: 37개 외부 자산의 harness `description` / install 라벨이 **실제와 정직하게 일치**하는지 audit (North Star "거짓 광고 0건", 세 기둥 ②).
> **방식**: 23개 고유 GitHub repo 의 실 메타데이터(`gh api`: description/archived/stars) sweep + harness 설명·설치 라벨 대조. B2/B1(CLI 인식)·A1(star tier)의 자산-설명 버전.

## 1. GitHub 메타데이터 sweep (실데이터, 2026-06)

| 신호 | 결과 |
|------|------|
| **archived repo** | **0건** (전 23 repo arch=false) — "비활성인데 활성으로 광고" 없음 |
| **404 / 이동** | **0건** (affaan-m/everything-claude-code 208k★ 정상 — 초기 실패는 전송 오류) |
| **star ↔ tier 정합** | A1 drift 0 재확인 (vetted 전부 ≥1000★ / experimental 전부 <1000★: railway 273·playwright 270·next-skills 912·orchestkit 181) |

repo description 표본: shadcn/ui 115k "beautifully-designed components", vercel-labs/agent-browser 35k "Browser automation CLI for AI agents", trailofbits/skills 5.5k "security research, vulnerability detection, audit" — 전부 harness 설명과 일관.

## 2. 발견 — Promise=Implementation 드리프트 (수정)

### F1 (FIX) — npm 자산 scope 거짓 표기 "(npm -g)"

- **vercel-cli / netlify-cli / supabase-cli** 설명이 `(npm -g)`, install 출력(`formatAssetMeta`)도 `npm -g · <pkg>`.
- 그러나 **ADR-020(v26.64)으로 npm 자산 default = `--save-dev`(project-scope)**, `-g` 는 global scope opt-in 시만 (`external-installer.ts:182-183` 확인). → 라벨이 scope 를 거짓 표기 (사용자가 global 설치로 오인).
- **수정**: 설명 `(npm -g)`→`(npm)` ×3 · `formatAssetMeta` npm 라벨 `npm -g · `→`npm · ` · 해당 테스트 단언 동기화(틀린 출력 인코딩 → 정정).

## 3. Soft flag (수정 보류 — 판단 필요)

- **ecc-plugin** 설명 `"60 agents · 230 skills · 75 commands"` — upstream(affaan-m/everything-claude-code)이 진화하면 **특정 카운트가 drift**. 현재 틀렸다는 근거는 없으나(검증 안 함) 하드코딩 카운트는 fragile. 후속: 카운트 제거 또는 "as of install" 표기 검토. (하네스 자체 curation 은 `ecc-prune` 이 담당하므로 영향 제한적.)

## 4. PASS 확인 (대표)

- `architecture-decision-record` → orchestkit(광범위 toolkit)이지만 설명이 이미 **"orchestkit, one of 80+ skills"** 로 정직 (단일 skill 추출 명시). ✓
- `polars-K-Dense`/`dask-K-Dense` → scientific-agent-skills(27k) 의 특정 skill, 설명 정확. ✓
- `railway-skills`/`impeccable`/`trailofbits-skills`/`gsd-orchestrator` 등 — 설명 ↔ repo 실 description 일관. ✓

## 5. Scope / 한계 (정직 표기)

1. **메타데이터 + scope-claim 수준 audit** — 각 자산 SKILL.md/README 의 **전체 기능 내용 1:1 대조는 미수행**(37 deep-read 비용). 즉 "repo 가 광고대로 존재·활성·tier 정합" + "harness 설명의 scope/구조 주장 정확성" 까지 확인. 세부 기능 과대광고는 표본(§4)만.
2. **N=1 판단** — 메인테이너 단독 audit. 사용자 체감 mismatch 는 Phase 3 신호로 보강.
3. ecc-plugin 등 upstream-카운트형 설명은 시간 경과 시 재audit 필요.

## 6. 결론

- **거짓 광고(archived/404/tier drift) 0건** 확인.
- **scope 거짓 표기 1종(npm -g) → 수정**.
- soft flag 1종(ecc 카운트) 후속. 전반적으로 자산 설명 정직성 양호.
