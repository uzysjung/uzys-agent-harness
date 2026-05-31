# Changelog

All notable changes to **uzys-claude-harness**.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> v26.x.x 부터 git tag versioning(CalVer, year-2000)으로 통합. CHANGELOG 도 CalVer 로 표기. v0.8.x 는 이전 npm-기반 추적.

## [v26.72.0] — 2026-05-31 (feat(ci): fresh-env 설치 매트릭스 — First-Run Success 게이트)

C2 (research next-steps RICE 1위, North Star Phase 2 First-Run Success ≥95%). SPEC `docs/specs/v26-72-install-matrix-ci.md`.

- **`install-matrix.yml`** (신규, `ci`와 독립. 태그 + `workflow_dispatch`, concurrency): 실제 배포 진입점을 fresh 러너에서 설치 검증.
  - `pack` — `npm pack` 1회(prepare 빌드 + files 화이트리스트) → 타르볼 artifact (모든 install job 동일 surface).
  - `install-matrix` — **OS{ubuntu,macos} × Node{20,22} × pm{npm 4 + pnpm subset 2} = 6 combo** (`fail-fast:false`). 타르볼 설치 → core 파일 단언(.claude/CLAUDE.md/.installed-tracks/.mcp.json) → `$GITHUB_STEP_SUMMARY` 표.
  - `multi-track` — tooling/executive/data core 설치 (cross-track).
  - `fail-loud` — unknown track → non-zero (게이트가 실패를 잡는지, Rule 12).
  - `npx-github-smoke` — `npx -y github:...#<sha>` 문서 명령(clone+prepare 경로, npm pack 과 별개. AC5).
- 범위: **core 설치** 검증. external 자산 실설치는 Docker E2E(`test/docker/`) 담당 (non-fatal).
- **검증**: Phase 1 단일 combo 실 CI green(dispatch). 로컬+Docker. test-policy/ship-checklist 에 릴리스 게이트 등재.
- 발견: 본 작업의 Docker 실설치가 v26.71.1 (experimental opt-in 누락) 버그를 노출. 또 `npx-github-smoke` 가 **`npx github:` 가 npm 10(Node 20)에서 실패**함을 노출(GitFetcher Arborist 회귀) — 매트릭스 CI 가치 2건 입증.
- **dist 커밋 + prepare 제거** (npx-github 근본 fix): `dist/` git 커밋(.gitignore 해제) + `prepare` 제거 → `npx -y github:uzysjung/uzys-claude-harness` 가 빌드 없이 즉시 실행 → **npm 10 GitFetcher 버그 회피 + 전 npm 버전 작동 + clone 후 즉시 실행**. `test.yml` 에 dist-freshness 가드(build → `git diff --exit-status`, 빌드 결정적 확인). install-matrix `pack` 은 명시 `npm run build`.

## [v26.71.1] — 2026-05-31 (fix: experimental opt-in 누락 — 비대화형 install 경로)

v26.71.0 의 experimental(T3) opt-in 이 `recommendedExternalAssets`(pre-check)에만 적용되고 **실제 설치 경로(`shouldInstallAsset`/`filterApplicableAssets`)엔 누락** → 비대화형 `install --track` 과 interactive 미체크 시 experimental 이 default 설치되던 버그 (PRD v26-71 R6/AC4 위반). **Docker 실설치로 발견** (헤더 "4 selected" ↔ 실제 6 설치 불일치).

- **fix**: `shouldInstallAsset` 가 `TRUST_TIER[id] === "experimental"` 면 condition 매치만으론 미설치. `--with <id>`(forceInclude) 또는 interactive 체크 시에만 설치 — **선택권 유지(강제 차단 아님, AC4)**. 게이트는 명시 분류만 봄(unknown→experimental default 는 DISPLAY 전용).
- **보존 확인**: 4개 experimental(playwright-skill/ADR/railway-skills/next-skills) 은 catalog·wizard(⚠ 배지)·`--with` 에 그대로 — **opt-in 옵션으로 유지** (삭제 0).
- **discoverability 힌트** (Transparent Defaults — 숨김 0건): 비대화형 install Summary 에 `OPT-IN  N experimental available — add with --with <id>: ...` 추가. wizard 는 배지로 이미 노출하므로 skip.
- `experimentalOptInCandidates` 헬퍼 + `matchesCondition` 추출. track-matrix 테스트 9건 의도 갱신(experimental default 제외 반영). 644 → 651 tests. branches 88.57%.

## [v26.71.0] — 2026-05-31 (feat: 검증 Trust Tier + 적극 권장)

North Star 세 기둥 ②(검증 자산 큐레이션 + 선택권). PRD v26-71.

- **Trust Tier** (`external-assets.ts` `TRUST_TIER` 정적 라벨, 37 자산, 2026-05 GitHub star 확인): official / vetted / experimental. T2 기준 **star ≥ 1000** (D2). 미분류는 보수적으로 experimental.
- 분포: T1 official 4 (anthropic-document/data, superpowers, ecc-prune) / T2 vetted 29 / T3 experimental 4 (next-skills 895 · railway 268 · playwright-skill 264 · ADR 179).
- **wizard Step 3**: tier 우선 정렬 (official → vetted → experimental) + 배지 (★ official / ⚠ experimental). experimental 은 pre-check 제외 — opt-in (`recommendedExternalAssets`).
- 라이선스 미표기/비-OSI (vercel-labs, trailofbits) 는 출처 신뢰로 vetted 유지 (사용자 결정).
- README/USAGE 에 Trust tiers 섹션. 639 → 644 tests.

## [v26.70.3] — 2026-05-31 (ci)

- GitHub Actions 를 push/PR 마다 → **릴리스 태그(`v*`) push 시에만** 실행. `concurrency(cancel-in-progress)` 추가. 로컬 `npm run ci` 가 1차 검증 게이트 (test-policy.md / ship-checklist.md 명문화).

## [v26.70.2] — 2026-05-31 (refactor)

- `cleanStaleHookRefs` (update-mode.ts) 단순화 — 객체 mutation 2곳 / non-null assertion / `as` cast 제거 → immutable map·filter 체인 + `keepHookRef` 헬퍼. branch coverage 82.5 → 90.24%.

## [v26.70.1] — 2026-05-31 (fix: 코드리뷰 버그 9건)

- **install log 누락 → uninstall 불가**: claude 미포함 CLI(codex/opencode/antigravity 단독·조합) 설치 시 `.claude/` 미생성으로 install log write 실패. `writeInstallLog` 가 디렉토리 보장하도록 수정.
- **uninstall root CLAUDE.md**: install 원본 sha256 기록 후 비교 — 원본이면 삭제, 사용자 수정 시 보존.
- antigravity global opt-in workflow `renameSlashes` 누락, clack `[disabled]` 옵션 실제 선택 가능, `session-start.sh` JSON injection 견고성, `CLI_BASES`/cli-targets 주석·prune-ecc 카운트·python-resource description 정정.
- 631 → 637 tests. (ADR-020 install log 스키마에 `rootClaudeMd` sha256 추가)

## [v26.70.0] — 2026-05-31 (fix)

- **AGENTS.md 빈 섹션 버그 fix** — `renderAgentsMd` 의 section 추출이 실 CLAUDE.md(Rule 1~12)에서 빈 결과 → CLAUDE.md 전문 embed(`{PROJECT_RULES}`)로 전환. codex/opencode/antigravity 3 CLI 단일 렌더 수렴.

## [v26.69.0] — 2026-05-31 (feat)

- Antigravity workspace rules — `.agents/rules/uzys-harness.md` (CLAUDE.md 전문 embed, context 항상). `~/.gemini/` 미터치.

## [v26.68.0] — 2026-05-23 (refactor)

- install log `method.kind` `"npm-global"` → `"npm"` rename + backward-compat normalize (v26.64~67 시점 log 호환).

## [v26.67.0] — 2026-05-23 (feat)

- **Antigravity Phase C** — global opt-in. `scope=global` + `--with-antigravity-global` 시에만 `~/.gemini/antigravity/{skills,global_workflows}/uzys-*` 복사 (D16 보호).

## [v26.66.0] — 2026-05-21 (feat: Antigravity 지원)

- **Antigravity (Google) 4번째 CliBase** Phase A+B. `.agents/skills/` (codex 공유) + `.agents/workflows/uzys-*` (신규, 파일명 기반 `/uzys-{phase}` dispatch).

## [v26.65.3] — 2026-05-21 (docs)

- USAGE.md 단순화 (883 → 288줄).

## [v26.65.2] — 2026-05-21 (fix)

- branches coverage 88 완전 복구 (ADR-013/014 반영).

## [v26.65.1] — 2026-05-20 (docs)

- README 재구성 (addyosmani 스타일, 트랙별 자산 매트릭스, 6-Gate opt-in 명확화).

## [v26.65.0] — 2026-05-20 (refactor)

- Wizard step indicator SSOT + Prompts API refactor.

## [v26.64.1] — 2026-05-20 (fix)

- branches coverage 86 → 87 부분 복구.

## [v26.64.0] — 2026-05-20 (feat: Project-scope default, ⚠️ BREAKING, ADR-020)

- **모든 install 자산 default = Project. Global 은 명시 opt-in** (interactive scope step 또는 `--scope global`).
- `.claude/.harness-install.json` install log + `claude-harness uninstall` (project 자동 reverse / global 안내) 신규. 6-step wizard.
- BREAKING: `cli=codex` 자동 `withCodexPrompts` 폐기 (`--with-codex-prompts` 명시 필요), npm 자산 default `--save-dev`.

## [v26.63.0] — 2026-05-17~18 (feat: 5-step 통합 UX + polish)

- 5-step 통합 wizard (install header 삭제, `phaseHeader` → `unifiedSection`, `--verbose` flag). Step 3 결과 main buffer 출력 (alt screen exit 후). v26.63.1~4: 라벨 들여쓰기 / Summary marker / spacing / ECC fallback 통합 / jargon 보강.

## [v26.61.0] — 2026-05-17 (feat: Step 3 scroll 해결)

- Install targets wizard scroll 본질 해결: alt screen buffer + recap. v26.62.0~4: 카테고리 3-page paginate, groupMultiselect 복귀(`selectableGroups:false`), 들여쓰기, ASSETS row. (clack `groupMultiselect` 의 `maxItems` 미지원 한계 → page 묶음으로 cover)

## [v26.57.0] — 2026-05-17 (feat/fix: Codex 매핑 + gating + UX)

- v26.57.0 (ADR-018 BREAKING): Codex uzys 매핑 4위치 모두 `withUzysHarness` gating + Templates 설명.
- v26.58.0 (ADR-019 BREAKING): Cherry-pick × Plugin opt-out gating (`withEcc=true` → cherry-pick skip).
- v26.59.0: install 후 path 기반 version 표시 (plugin + npm-global). v26.60.0: UI text 영어 통일. (+ Phase 1 multi-line layout, wizard scroll viewport fix)

## [v26.56.0] — 2026-05-17 (feat: UX cycle — clarity + Codex Prompts uzys coupling, ⚠️ BREAKING)

### BREAKING (ADR-017)
- `withCodexPrompts` 자동 활성화 조건: `cli=codex` → `cli=codex && withUzysHarness` 둘 다 필요
  - 이전 (ADR-012): `cli=codex` 만으로 자동 ON → uzys-harness 없으면 Claude `.claude/commands/uzys/` 누락 + Codex `~/.codex/prompts/uzys-*` 만 깔리는 불일치
  - 신규: 양쪽 슬래시 일관성 보장. `--with-codex-prompts` legacy override 유지

### Added (UX 보강 6 항목, F1~F6)
- F1: 자산 description 보강 — 10+ 자산 (polars/dask/python-*/find-skills/agent-browser/supabase/postgres/react/web-design/next) + 트랙 hint
- F2: Phase 1 Templates 카테고리별 한 줄 설명 + names dim (visual hierarchy)
- F3: Phase 2 result row 간략화 — description 중복 제거, 120 char 안 단일 line
- F4: Step 3 카테고리 헤더 `[N/M ✓ default]` selected count
- F5: Codex Prompts ↔ uzys-harness 묶음 (위 BREAKING)
- F6: `install` subcommand error 에 wizard 진입 안내 추가

### Docs
- SPEC: `docs/specs/v26-56-ux-cycle.md`
- ADR-017: `docs/decisions/ADR-017-codex-prompts-uzys-coupling.md` (supersedes ADR-012 부분)

### Test
- 576 tests pass (3 신규)

## [v26.55.1] — 2026-05-17 (fix: skills cli 1.5.7 multi-agent repeatable, NOT comma)

### Fixed
- `buildSkillArgs` 의 `--agent claude-code,codex` (comma) → `--agent claude-code --agent codex` (repeatable)
- skills cli 1.5.7 부터 comma BREAKING (1.5.5 까지 지원) → "Invalid agents" exit 1
- multi-cli (claude+codex 또는 +opencode) 사용 시 모든 skill 자산 (7개) 100% 실패 복구

## [v26.55.0] — 2026-05-16 (feat: Phase 2 grouped UX + ECC opt-in gating + 자산 설명, ⚠️ BREAKING)

### BREAKING (ADR-016)
- ECC cherry-pick 16+ 항목을 `withEcc=true` 일 때만 install
  - Agents: `code-reviewer`, `security-reviewer`, `silent-failure-hunter`, `build-error-resolver`
  - Skills: `continuous-learning-v2`, `strategic-compact`, `deep-research`, `eval-harness`, `verification-loop`, `agent-introspection-debugging`, `e2e-testing`, `python-patterns`, `python-testing`
  - Commands: `ecc/`
  - 이전: default install 시 모두 포함 / 신규: `--with-ecc` 또는 Step 3 의 `ecc-plugin` 토글 시에만

### Added
- Phase 2 grouped progress UX — external-installer 가 카테고리 순서로 정렬 + install.ts callback 이 `━━ Frontend ━━` 헤더 출력
- 5 자산 description 보강: impeccable, playwright-skill, ADR, shadcn-ui, ecc-plugin
- `AssetSpec.withEcc` 필드 추가

### Docs
- SPEC: `docs/specs/v26-55-ux-and-ecc-removal.md`
- ADR-016: `docs/decisions/ADR-016-ecc-cherry-pick-gating.md`

### Test
- 573 tests pass (1 신규 — withEcc 미설정 시 python-* / e2e-testing 제외 검증)

## [v26.54.1] — 2026-05-16 (fix: install failures — skills cli 1.5.7 매핑 + ECC marketplace name)

### Fixed
- `impeccable`, `playwright-skill`, `shadcn-ui` — skills cli 1.5.7 부터 `--skill <name>` 명시 필수
- `shadcn-ui`: source `shadcn/ui` 의 실제 skill 이름은 `shadcn` (자산 id 와 다름)
- `ecc-plugin`: pluginId `everything-claude-code@everything-claude-code` → `ecc@ecc`

## [v26.54.0] — 2026-05-16 (feat: all-in-one installer screen — 3-step wizard, ⚠️ BREAKING)

### BREAKING (ADR-015)
- 5-step → **3-step wizard** (tracks → cli → install-targets → confirm)
  - Step 2 (Options) + Step 4 (2-tier asset navigator) → 1 화면 group multiselect 로 흡수
  - VISIBLE_OPTION_DEFS 9 → 2 (`withTauri`, `withUzysHarness`). 나머지 7 옵션은 EXTERNAL_ASSETS 와 1:1 자산 매핑이라 자산 체크로 흡수
- ESC = silent back (cancel 메시지 strikethrough 제거). Step 1 ESC 만 exit

### Added
- `InstallTargetId = option:<key> | asset:<id>` value scheme
- `selectInstallTargets` 단일 groupMultiselect
- `splitInstallTargets()` helper

### Removed
- 4 deprecated prompt 함수: `selectOptionKeys`, `selectExternalAssets`, `selectAssetCategory`, `selectAssetsInCategory`

### Docs
- SPEC: `docs/specs/v26-54-all-in-one-installer.md`
- ADR-015: `docs/decisions/ADR-015-all-in-one-installer.md` (supersedes ADR-010 / ADR-013 / ADR-014 부분)

### Test
- 572 tests pass

## [v26.53.0] — 2026-05-16 (chore: test mock-asset.ts format hotfix)

## [v26.52.0] — 2026-05-16 (feat: Step 4 2-tier category navigator)

### Added
- Step 4 (External Assets) 2-tier — (a) navigator + (b) sub-prompt
- `selectAssetCategory` + `selectAssetsInCategory` prompt 함수

### Note
- v26.54.0 에서 1 화면 통합으로 흡수됨

## [v26.51.0] — 2026-05-16 (chore: CLI flag matrix grouping + --no-codex-prompts hidden bug fix)

### Fixed
- `--no-codex-prompts` (cac negation) hidden bug — `options.noCodexPrompts` 참조 → `options.codexPrompts: false` 참조

## [v26.50.0] — 2026-05-16 (chore: preset change resets Step 4 + coverage 88 영구 복구)

## [v26.49.0] — 2026-05-15 (fix: unknown asset id validation)

## [v26.48.0] — 2026-05-15 (chore: branch coverage 86 → 87 부분 복구)

## [v26.47.0] — 2026-05-15 (feat: Phase C full — External Asset 직접 toggle + UserOverride)

### Added — Phase C 완전판 (Category-based installer)
- `UserOverride { forceInclude, forceExclude }` 모델 (ADR-014)
  - 우선순위: `forceExclude > forceInclude > condition (any-track | has-dev-track | option)`
- Interactive **Step 4 (assets)** 신규 — 32+ External Asset 카테고리별 grouping + `[source]` 라벨 + preset 추천 ✓ 미리 체크
- CLI: `--with <asset-id>` / `--without <asset-id>` repeatable (cac)
- `computeUserOverride(presets, selected)` diff 계산 helper
- SPEC OQ 1-4 모두 해소

### Test
- vitest 547/547 PASS (이전 538 + 신규 9)
- `shouldInstallAsset` userOverride 4 case
- `computeUserOverride` 5 case
- vitest branch threshold 87 → 86 (격리 어려운 분기, 후속 복구 예정)

## [v26.46.0] — 2026-05-15 (feat: Codex default for cli=codex + Wizard back nav, ⚠️ BREAKING)

### BREAKING
- `cli` 에 codex 포함 시 `withCodexPrompts` **default ON** (ADR-012)
  - 이전: `--with-codex-prompts` opt-in
  - opt-out: `--no-codex-prompts` 신규 flag
- Interactive ESC 의미 재정의 (ADR-013):
  - tracks/confirm = 종료 (기존)
  - options/cli = **back to previous step**

### Removed
- `OPTION_DEFS` 에서 `withCodexPrompts` entry (interactive UI 안 보임)

### Test
- 기존 cancellation case 의 selectOptionKeys/selectCli null → back nav 의미로 재정의
- 신규 2 test: 'ESC at options → back to tracks', 'ESC at cli → back to options'

## [v26.45.0] — 2026-05-14 (feat: Step 2 카테고리 grouping + 출처 라벨)

### Added — Phase C MVP (category-installer)
- `src/prompts.ts`: `selectOptionKeys` → `groupMultiselect` (clack/prompts)
- OPTION_DEFS 항목에 `category` + `source` 메타데이터
- CATEGORY_ORDER 따라 Frontend/Backend/Data/Business/Dev Tools/Workflow/ECC Suite 그룹
- 라벨 형식: `<label>  [<source>]`

### Docs
- README.md: 9 → 11 tracks 정정, v26.44.0+ BREAKING 안내, Workflow 카테고리 4 대안 소개

## [v26.44.0] — 2026-05-14 (feat: uzys-harness opt-in + superpowers, ⚠️ BREAKING)

### BREAKING
- `uzys-harness` 자체 6-Gate slash commands (`/uzys:spec ... /uzys:ship`) 가 **dev 트랙 자동 설치 → opt-in** 전환
- 기존 dev 트랙 사용자: 다음 install 시 `--with-uzys-harness` 필요

### Added — Phase B/D/E/F (category-installer)
- `src/preset-recommend.ts`: preset → 추천 외부 자산 id 매핑
- `OptionFlags.withUzysHarness` + `--with-uzys-harness` (track 무관, SPEC R7)
- `obra/superpowers` 신규 자산 (anthropics/claude-plugins-official 공식 marketplace 등록)
- `OptionFlags.withSuperpowers` + `--with-superpowers`

## [v26.43.0] — 2026-05-14 (feat: category-installer Phase A scaffolding)

### Added
- `src/categories.ts` — 7 카테고리 (frontend/backend/data/business/dev-tools/workflow/ecc-suite) + 19 출처 라벨 (SOURCE_LABELS)
- `ExternalAsset` 에 `category` + `source` 필드
- 32 자산 entry 모두 정확한 출처 부여
- SPEC 정정: Business 카테고리의 Anthropic 자산은 `anthropic-document-skills` 1개만 (c-level/business-growth/finance 등 8개는 `alirezarezvani/claude-skills` 출처)

## [v26.42.0] — 2026-05-13 (feat: addy-agent-skills opt-in, ⚠️ BREAKING)

### BREAKING
- `addyosmani/agent-skills` 플러그인이 **dev 트랙 자동 설치 → opt-in** 전환 (GSD 동일 패턴)
- `--with-addy-agent-skills` 또는 interactive 체크박스 필요

### Why
- 외부 plugin 강제 설치 제거
- `/uzys:*` (본 harness 자체) 와 `/spec /plan` (addy 외부 plugin) 의 slash namespace 분리 명확화

## [v26.41.0] — 2026-05-12 (feat: playwright-launch rule)

### Added — UI 트랙 신규 rule
- `templates/rules/playwright-launch.md` — 영속 profile + 자동화 0 패턴
- `UI_RULES` 에 등록 (csr-*/ssr-*/full 자동 적용)
- 절대 금지: chrome-devtools MCP attach, Playwright MCP 일회성 context, OAuth 입력 시 자동화 동시 실행
- 필수: 영속 profile dir + Chrome for Testing 별도 binary + 자동화 layer 0 + dev bypass auth

## [v26.40.0] — 2026-05-12 (feat: project-claude section-fragment 머지)

### Added — Multi-track 설치 시 root CLAUDE.md 자동 생성
- `templates/project-claude/_base.md` (공통 골격) + `fragments/<track>/<section>.md` (트랙×섹션)
- `src/project-claude-merge.ts` 머지 모듈 (single/multi/full 자동)
- `### <Track Display Name>` 소제목으로 multi-track concat
- 'full' 트랙 자동 union (10 dev 트랙)

### Removed
- 11 legacy `templates/project-claude/<track>.md` + `full.md`

## [v0.8.8] — 2026-05-06 (fix: skills CLI agent name 매핑 `claude` → `claude-code`)

### Fixed — 외부 사용자 skill 자산 100% skip (P0 prod-blocker)

skills CLI 1.5.5 valid agent 이름은 `claude-code` 인데 v0.8.7 은 `claude` 그대로 보냄 → `Invalid agents: claude` 로 exit 1. claude track 환경에서 모든 `npx skills add` 호출 실패 (impeccable, playwright-skill, find-skills, architecture-decision-record, react-best-practices, shadcn-ui, web-design-guidelines — 7건 skip).

증거: 2026-05-06 외부 사용자 (DYLD-GoalTrack) `npx -y github:uzysjung/uzys-claude-harness` 실행 → Phase 2 에서 skill 형식 7건 모두 `npx exited 1`. plugin 형식 6건 (addy/railway/product/karpathy/trailofbits/ecc) 은 skills CLI 미사용이라 영향 없음. 직접 reproduce: `npx -y skills add https://github.com/pbakaus/impeccable --skill impeccable --agent claude --yes` → `■ Invalid agents: claude` + valid list 출력.

Fix: `buildSkillArgs` 직전에 `SKILLS_CLI_AGENT_MAP` 추가, `cli.map(c => map[c] ?? c)` 적용.

```diff
# Before (v0.8.7)
npx skills add <pkg> --agent claude --yes
# → Invalid agents: claude → exit 1

# After (v0.8.8)
npx skills add <pkg> --agent claude-code --yes
# → install OK
```

| `spec.cli` | v0.8.7 (broken) | v0.8.8 (fixed) |
|---|---|---|
| `["claude"]` | `--agent claude` | `--agent claude-code` |
| `["claude","codex","opencode"]` | `--agent claude,codex,opencode` | `--agent claude-code,codex,opencode` |

### Internal
- `src/external-installer.ts` `SKILLS_CLI_AGENT_MAP` 추가 (`claude → claude-code`, `codex → codex`, `opencode → opencode`)
- `tests/external-installer.test.ts` 3 invariant 갱신 (`claude-code` expect)

### 검증
- typecheck PASS
- vitest 523/523 PASS
- lint 6 warnings (기존)
- build OK (149.48 KB)

### Known limitation
- skills CLI 가 valid agent name 변경 시 본 매핑도 갱신 필요. 현재 1.5.5 기준 hardcoded. 향후 1.6+ 출시 시 valid list re-verify.

## [v0.8.7] — 2026-05-03 (fix: npx skills --agent 명시 — universal install 차단)

### Fixed — `.factory/`/`.goose/` 디렉토리 자동 생성 (사용자 보고 #3 진짜 fix)

`npx skills add` 의 default 동작이 `--agent *` (universal) 라 `.factory/skills/`, `.goose/skills/` 디렉토리가 사용자 환경에 자동 생성됨. v0.8.0 의 `.gitignore` 패턴 추가는 git noise 만 차단하고 disk 디렉토리 생성은 막지 못했음 (사용자 manual 정리 burden 잔존).

Fix: `buildSkillArgs` 에 `--agent <comma-list>` 동적 명시. `spec.cli` 의 base CLI 만 install.

```diff
# Before
npx skills add <pkg> --skill <name> --yes
# (default --agent * → universal install)

# After
npx skills add <pkg> --skill <name> --agent claude --yes
# (claude only → .factory/.goose 생성 X)
```

### Multi-CLI 매핑

| `spec.cli` | `--agent` 인수 |
|---|---|
| `["claude"]` | `--agent claude` |
| `["claude", "codex"]` | `--agent claude,codex` |
| 3종 | `--agent claude,codex,opencode` |

### Internal
- `src/external-installer.ts` `runExternalInstall` ctx 에 `cli: CliTargets` 추가
- `installOne` ctx 에 cli 전달 → `buildSkillArgs(method, cli)` signature 변경
- `src/installer.ts` 호출부에 `spec.cli` 전달
- `tests/external-installer.test.ts` 신규 invariant 1건 (multi-CLI `--agent` 콤마 검증) + 기존 2건 갱신

### 검증
- `npx skills add ... --agent claude --list` 실측 (단일 + 콤마 양쪽 정상)
- vitest **523 PASS** (이전 522 + 신규 invariant 1건)
- coverage 95.14-88.21-95.62-95.14
- typecheck + lint + build PASS

### Driver
- 사용자 manual: `.factory/`/`.goose/` 디렉토리 매번 삭제 burden
- v0.8.0 fix (`.gitignore` 패턴) 의 한계 — git noise 만 차단, disk 생성 안 막음
- skills CLI `-a, --agent` flag 지원 확인 (`--help` + 실측)

### ADR-007 versioning
- 마지막: v26.39.4 → 본 PR 머지 후 tag v26.39.5 (patch — bug fix)
- year 26 유지

### Reference
- skills CLI: https://github.com/vercel-labs/skills (또는 `npx skills --help`)
- v0.8.0 ignore 패턴 fix: `src/env-files.ts` `addGitignoreNpxSkillsAgents`

## [v0.8.6] — 2026-05-03 (fix: CL-v2 observer hook 중복 제거)

### Fixed — CL-v2 observer 중복 fire (사용자 보고 #6)

`ps -ef` + `observations.jsonl` 실측 결과 CL-v2 observe.sh 가 매 도구 호출당 **2-3회 fire** 됨 (DYLD-GoalTrack 환경 같은 `timestamp+tool` 2-3 record 증거).

원인:
- 프로젝트 `.claude/settings.json` PreToolUse/PostToolUse `*` matcher → `<project>/.claude/skills/.../observe.sh`
- ECC plugin (`everything-claude-code@everything-claude-code`) `pre:observe:continuous-learning` + `post:observe:continuous-learning` → `<plugin>/skills/.../observe.sh`
- 둘 다 같은 logic + 같은 destination — 이중 기록

Fix: 프로젝트 settings.json 의 CL-v2 entry 제거. ECC plugin 의 단일 경로만 신뢰.

```diff
# .claude/settings.json + templates/settings.json
- PreToolUse[matcher="*"]: { command: "...observe.sh pre", async: true }
- PostToolUse[matcher="*"]: { command: "...observe.sh post", async: true }
+ (제거 — ECC plugin pre:observe:continuous-learning 이 대체)
```

### Trade-off

| 환경 | CL-v2 동작 |
|------|-----------|
| ECC plugin **enabled** (default) | 1회 fire ✓ |
| ECC plugin **disabled/미설치** | CL-v2 미동작 |

### Migration (기존 v0.8.5 이하 사용자)

- 새 install 또는 `--update` mode 재실행 (`templates/settings.json` 갱신본 적용)
- 또는 manual `.claude/settings.json` jq edit — `docs/USAGE.md` "CL-v2 동작 조건" 섹션 참조

### Internal — baseline 보고서 §5 한계 inflation 주석
- `docs/evals/hito-baseline-2026-04-30.md` §5 #1 — "166 prompts / 16 sessions" 수치는 hito-counter (별 hook) 기반이라 inflation 영향 없음 (본 보고서 신뢰 가능). CL-v2 observations.jsonl 만 v26.39.4 후 재측정 필요.

### 검증
- `ps -ef | grep observe.sh` 매 도구 호출당 1개 PID (이전 3개)
- vitest 522 PASS / coverage 95.12-88.22-95.62-95.12

### ADR-007 versioning
- 마지막: v26.39.3 → 본 PR 머지 후 tag v26.39.4 (patch — bug fix)
- year 26 유지

## [v0.8.5] — 2026-05-03 (fix: gate reset + session cleanup rule)

### Fixed — SPEC 재정의 시 후속 게이트 리셋 누락 (gate bypass 차단)

`/uzys:spec` 가 `define.completed=true` 만 set 하고 후속 5단계 (`plan/build/verify/review/ship`) 는 그대로 두는 정합성 위반 수정.

```diff
# templates/commands/uzys/spec.md + .claude/commands/uzys/spec.md (sync)
- jq '.define.completed = true | .define.timestamp = (now | strftime(...))'
+ jq '.define.completed = true | .define.timestamp = (now | strftime(...))
+    | .plan.completed = false   | .plan.timestamp   = null
+    | .build.completed = false  | .build.timestamp  = null
+    | .verify.completed = false | .verify.timestamp = null
+    | .review.completed = false | .review.timestamp = null
+    | .ship.completed = false   | .ship.timestamp   = null'
```

**원칙**: SPEC 재정의 = 새 cycle 시작 = 후속 모든 게이트 리셋. 이전 cycle 의 ship 완료 상태가 새 cycle 게이트를 통과시키는 bypass 차단. plan/build/... 재진입은 같은 cycle 내 iteration 이라 forward-only set 유지 (A 안).

### Added — git-policy.md "Session Cleanup" 섹션 (사용자 요청)

세션 종료 / `/clear` / `/compact` 직전 강제 절차:
1. `gh pr list --state open` 실행 — open PR 잔존 확인
2. 잔존 시 사용자 명시 합의 후 처리 (자동 머지 금지)
3. ship 보고에서 **local gate ✓ ≠ main 반영** 분리 표기 강제

### Internal
- `.claude/CLAUDE.md` + `templates/CLAUDE.md` Workflow Gates 섹션에 "SPEC 재정의 시 자동 리셋" 명시 한 줄 추가
- `templates/rules/git-policy.md` ↔ `.claude/rules/git-policy.md` sync (Versioning + Drift Period + Session Cleanup 모두)

### 검증
- vitest 522 PASS / coverage 95.12-88.22-95.62-95.12
- spec.md `jq` pipeline syntax 검증

### Driver
- 사용자 직관 검증: "spec 정의를 다시하면 plan/build/...은 게이트 다시 리셋해야하지 않나?" — 정확. 위반 사례 발견.
- 사용자 요청: "세션 종료 직전 `gh pr list --state open` 정리 + gate ✓ ≠ main 반영 분리"

## [v0.8.4] — 2026-05-03 (fix: trailofbits + docs warn)

### Fixed — `--with-tob` 설치 실패 (사용자 보고 #4)

`Plugin "trailofbits-skills" not found in marketplace "trailofbits-skills"` 에러:
- marketplace name = **`trailofbits`** (NOT `trailofbits-skills`) per `trailofbits/skills/.claude-plugin/marketplace.json`
- 단일 `trailofbits-skills` plugin 자체가 marketplace 안에 없음 — 14+ 개별 plugin 존재 (`audit-context-building`, `differential-review`, `constant-time-analysis` 등)

**Fix**: 가장 보편적인 보안 도구 `differential-review` 단일 매핑.

```diff
- pluginId: "trailofbits-skills@trailofbits-skills"
+ pluginId: "differential-review@trailofbits"
```

추가 trail of bits plugin 원하는 사용자: `claude plugin install <name>@trailofbits` (예: `claude plugin install audit-context-building@trailofbits`).

### Docs — pnpm config npm warn 안내 (사용자 보고 #5)

`npx -y github:...` 실행 시 사용자 환경 `.npmrc` 의 pnpm 설정이 다음 warn 발생:
```
npm warn Unknown project config "auto-install-peers". ...
npm warn Unknown project config "strict-peer-dependencies". ...
npm warn Unknown project config "shamefully-hoist". ...
```

`docs/USAGE.md` "설치 시 npm warn" 섹션 추가 — 무시 안전 + `--loglevel=error` 옵션 안내.

### Internal
- `tests/external-assets.test.ts` 신규 invariant — pluginId/marketplace 사실 검증 (marketplace.json 참조)

### 검증
- vitest **522 PASS** (이전 521 + 신규 invariant 1건)
- npm run ci PASS
- 사용자 환경 재현 시 differential-review 정상 install 예상

### Reference
- 사용자 보고: 2026-05-03 DYLD-GoalTrack 환경
- marketplace.json: https://github.com/trailofbits/skills/blob/main/.claude-plugin/marketplace.json

## [v0.8.3] — 2026-04-30 (chore: deps)

### Bumped — P2-04 Step 2 (medium-risk dependencies)

- `cac`: `^6.7.14` → `^7.0.0` (CLI parser)
- `@clack/prompts`: `^0.7.0` → `^1.3.0` (interactive prompts)

### Internal
- 코드 영향 0건 — typecheck + 521 vitest PASS / CLI smoke PASS
- `src/cli.ts` `cac` import + `src/prompts.ts` `@clack/prompts` named imports 모두 새 major API 와 호환

### 검증
- npm run ci PASS (521 vitest / coverage 95.12-88.22-95.62-95.12)
- `node dist/index.js --help`: CLI 정상 작동
- `npm audit --omit=dev`: 0 vulnerabilities (변경 없음)

### Driver
- `docs/research/dependency-bump-2026-04-30.md` Step 2 권고 이행
- cac 7 stable + @clack/prompts 1.x stable release 검증

### Reference
- Phase 2 backlog P2-04: `docs/phase-2-backlog.md`

## [v0.8.2] — 2026-04-30 (chore: deps)

### Bumped — P2-04 Step 1 (low-risk dependencies)

- `@types/node`: `^22.0.0` → `^25.6.0` (type-only, Node 20 CI 영향 없음)
- `@biomejs/biome`: `^1.9.4` → `^2.4.13`
- `biome.json` schema: 1.x → 2.x (`npx @biomejs/biome migrate --write` 자동)

### Internal

- 13 file `lint:fix` 자동 적용 (organize imports + 일부 minor style)
- 코드 동작 변경 없음 — behavior unchanged

### 검증
- vitest **521 tests PASS** (이전과 동일)
- coverage stmt 95.12 / branches 88.22 / funcs 95.62 / lines 95.12 (threshold 충족)
- npm run ci PASS
- `npm audit --omit=dev`: **0 vulnerabilities** (변경 없음)

### Driver
- `docs/research/dependency-bump-2026-04-30.md` Step 1 권고 이행
- biome 1.x EOL + biome 2 안정 release 검증
- @types/node 25 = Node 25 type. 코드는 ES2022 + Node 20 대상이라 호환 OK

### Reference
- Dependency 권고 보고서: `docs/research/dependency-bump-2026-04-30.md`
- Phase 2 backlog: `docs/phase-2-backlog.md` P2-04

## [v0.8.1] — 2026-04-29 (refactor)

### Internal — Track partition SSOT 통일 (reviewer MEDIUM-3 fix)

`src/external-assets.ts`의 인라인 Track 배열을 `EXECUTIVE_STYLE_TRACKS` / `DEV_TRACKS` / `DEV_PLUS_PM_TRACKS` 3 상수로 추출. behavior unchanged refactor.

```ts
// Before — product-skills entry에 9 Track 인라인
condition: { kind: "any-track", tracks: ["csr-supabase", ..., "project-management"] }

// After — SSOT 상수 참조
condition: { kind: "any-track", tracks: [...DEV_PLUS_PM_TRACKS] }
```

추가:
- `EXECUTIVE_STYLE_TRACKS = [executive, project-management, growth-marketing]` — `track-match.ts:hasDevTrack()` 의 negation domain SSOT
- `DEV_TRACKS = [csr-*, ssr-*, data, tooling, full]` (8) — `hasDevTrack()` 의 array 표현
- `DEV_PLUS_PM_TRACKS = [...DEV_TRACKS, project-management]` (9) — `product-skills` 의 도메인
- `tests/external-assets.test.ts` 신규 invariant 3건:
  - `TRACKS = DEV_TRACKS ∪ EXECUTIVE_STYLE_TRACKS` (disjoint + exhaustive)
  - `DEV_PLUS_PM_TRACKS = DEV_TRACKS + project-management`
  - `product-skills.condition.tracks === DEV_PLUS_PM_TRACKS`

### 검증
- vitest **521 tests PASS** (이전 518 + 신규 3 invariant)
- coverage 충족
- typecheck + lint + build 그린

### Driver
- v0.5.0 reviewer MEDIUM-3 — "EXECUTIVE_STYLE_TRACKS 상수, P10 분기" 잔여 항목 해소
- TRACKS 변경 시 `external-assets.ts` 인라인 9-Track 배열 수동 갱신 휴먼 에러 회피

### Reference
- v0.5.0 reviewer 보고 (linked SPEC `docs/specs/new-tracks-pm-growth.md`)

## [v0.8.0] — 2026-04-29 (BREAKING — dual)

### Breaking 1 — CLI alias 제거 (v0.7.0 deprecation 약속 이행)

`--cli both`/`--cli all`은 v0.7.0에서 1 release deprecation warning 후 v0.8.0에서 **invalid reject**:

```bash
# v0.7.x (warning + 작동)
$ npx ... install --cli both
[WARN] --cli both is deprecated. Use --cli claude --cli codex (will be removed in v0.8+)
✓ install proceeds with [claude, codex]

# v0.8.0 (제거됨)
$ npx ... install --cli both
✘ ERROR: Invalid --cli value: both. Must be one of: claude | codex | opencode
        v0.8.0에서 'both' alias 제거됨. --cli claude --cli codex 사용.
```

추가:
- `CliMode` / `CLI_MODES` / `isCliMode` legacy type/guard 완전 삭제 (v0.7.0 `@deprecated` 마크 후 1 release 거침)
- `tests/types.test.ts` `isCliMode` → `isCliBase` 갱신 + alias reject 검증

### Breaking 2 — `.claude/` 조건부 생성 (#2 사용자 보고)

`--cli claude` 미포함 시 `.claude/` 디렉토리 자체 미생성. Codex/OpenCode 단독 사용자 dead weight 제거:

```bash
# v0.7.x (이전 — Codex 단독이어도 .claude/ 생성)
$ npx ... install --track tooling --cli codex --project-dir .
# → .claude/CLAUDE.md + .codex/ + AGENTS.md 모두 생성 (.claude/는 dead)

# v0.8.0 (이후 — Codex 단독이면 .claude/ 미생성)
$ npx ... install --track tooling --cli codex --project-dir .
# → .codex/ + AGENTS.md + .agents/skills/ + .codex/prompts/ 만 생성
# → .claude/ 디렉토리 자체 미생성 (manifest copy + .installed-tracks skip)

# Claude 자산 원하면 명시:
$ npx ... install --track tooling --cli claude --cli codex --project-dir .
# → 기존과 동일 (.claude/ + .codex/ 둘 다)
```

영향:
- baseline manifest copy (rules/agents/hooks/commands/skills) — claude 미포함 시 skip
- `.claude/.installed-tracks` metafile — claude 미포함 시 미생성
- `.mcp.json` — Codex/OpenCode도 사용. claude 무관 항상 생성
- envFiles (`.env.example`, `.gitignore`, `.mcp-allowlist`) — claude 무관

### Added — `.factory/`/`.goose/` `.gitignore` 자동 추가 (#3 사용자 보고)

`npx skills add`가 multi-CLI universal install 동작 — Codex 사용자 환경에서 `.factory/skills/`, `.goose/skills/` 자동 생성됨. v0.8.0에서 `.gitignore`에 자동 추가하여 git noise 회피.

```
# .gitignore (auto-added by claude-harness)
# npx skills add multi-CLI cache (auto-added by claude-harness)
.factory/
.goose/
```

idempotent — 이미 등록된 패턴은 skip. `.gitignore` 부재 시 skip (사용자가 git init 후 install 권장).

### Internal

- `src/cli-targets.ts` `parseCliTargets` — `both`/`all` alias 분기 + warning emit 제거. invalid input 처리 (마이그레이션 힌트 포함)
- `src/types.ts` — `CliMode`/`CLI_MODES`/`isCliMode` 삭제
- `src/installer.ts` `runInstall` — `targets.includes("claude")` false 시 baseline copy + `.claude/` 디렉토리 + `.installed-tracks` skip
- `src/env-files.ts` — `addGitignoreNpxSkillsAgents` 신규 함수
- `BaselineReport.envFiles.gitignoreNpxSkillsAdded: string[]` 필드 추가
- `tests/installer-cli-matrix.test.ts` — `expectedFor()` `claudeBaseline` 필드 + 3 신규 invariant (`[codex]`/`[opencode]`/`[codex,opencode]` `.claude/` 미생성 검증)
- `tests/env-files.test.ts` — `addGitignoreNpxSkillsAgents` 4 case
- `tests/cli-targets.test.ts` — alias case → invalid reject로 갱신
- `tests/install.test.ts` — `it.each` 3 base만 valid + alias reject 2 case 분리

### 검증
- vitest **516 tests PASS** (이전 510 + 신규 6)
- coverage stmt 95.38 / branches 88.26 / funcs 95.62 / lines 95.38 (threshold 90/88/90/90)
- npm run ci PASS

### Migration

| Before (v0.7.x) | After (v0.8.0) |
|-----------------|----------------|
| `--cli both` | `--cli claude --cli codex` |
| `--cli all` | `--cli claude --cli codex --cli opencode` |
| `.claude/` 항상 생성 | `--cli claude` 포함 시만 생성 |
| `.factory/`/`.goose/` git에 추적됨 | `.gitignore`에 자동 추가 |

### Driver
- v0.7.0 deprecation 약속 이행 (1 release 후 alias 제거)
- 사용자 환경 보고 #2/#3 (Codex 단독 dead weight + multi-CLI universal cache)
- 사용자 — "argument 옵션 제거된 상태에서 문제점을 찾자"

### Reference
- SPEC `docs/specs/cli-cleanup-and-baseline.md`
- v0.7.0 SPEC `cli-multi-select.md` §3.4 OQ2 약속 (alias 제거 시점)

## [v0.7.1] — 2026-04-29

### Added — Codex `.codex/prompts/` project-scoped pre-positioning (Path 1)

`--cli codex` 포함 시 installer가 `<projectDir>/.codex/prompts/uzys-{spec,plan,build,test,review,ship}.md` 6 file을 자동 생성. **글로벌 `~/.codex/prompts/` 영향 0**.

현재 Codex CLI는 project-scoped prompts 미지원 ([openai/codex#9848](https://github.com/openai/codex/issues/9848) feature request open). **upstream 지원 시 자동 작동 — free upgrade 패턴**.

기존 v0.7.0 `--with-codex-prompts` 글로벌 opt-in (Path 2)은 그대로 유지 — 즉시 효과 원하는 사용자용.

### Improved — v0.7.0 reviewer followup

- `CliMode` / `isCliMode` `@deprecated` JSDoc 마크 (v0.8.0 제거 예정 명시)
- `SORT_ORDER` 중복 해소 — `src/cli-targets.ts`에 `CLI_BASE_SORT_ORDER` SSOT export → `prompts.ts`/`installer-cli-matrix.test.ts` 재사용
- `parseCliTargets` comma-separated 입력 (예: `--cli claude,codex`) 시 에러 메시지에 "Tip: --cli A --cli B 형식으로" 힌트 추가

### Internal

- `src/codex/transform.ts` step 5 추가 — `.codex/prompts/uzys-*.md` 6 file 변환 복사. `renderCodexPrompt` (v0.7.0) 재사용
- `CodexTransformReport.promptFiles: string[]` 필드
- install renderer Phase 3에 `.codex/prompts/uzys-*` row 추가
- `tests/codex/transform.test.ts` promptFiles 검증
- `tests/cli-targets.test.ts` comma hint 검증

### 검증
- vitest **509 tests PASS** (이전 508 → 509 = +1 cli-targets case)
- coverage stmt 95.36 / branches 88.18 / funcs 95.62 / lines 95.36 (threshold 90/88/90/90)
- npm run ci PASS

### Driver
사용자 — "글로벌은 안 건드리기로 했잖아". v0.7.0 글로벌 opt-in (D16 합의된 패턴) 유지하되, project-scoped pre-positioning 추가로 미래 upstream 지원 시 글로벌 영향 0 path 제공.

### Reference
- SPEC `docs/specs/codex-project-prompts.md`
- upstream [openai/codex#9848](https://github.com/openai/codex/issues/9848)

## [v0.7.0] — 2026-04-28 (BREAKING)

### Breaking — CLI multi-select

`--cli` 단일 enum (5 mode: claude/codex/opencode/both/all) → **repeatable** (3 base × 7 combination).

#### 마이그레이션

```bash
# Before (v0.6.x)
npx ... install --cli codex
npx ... install --cli both    # claude + codex
npx ... install --cli all     # claude + codex + opencode

# After (v0.7.0+)
npx ... install --cli codex                                 # 단일 (변경 없음)
npx ... install --cli claude --cli codex                    # = (legacy) both
npx ... install --cli claude --cli codex --cli opencode     # = (legacy) all

# 신규 조합 (이전 미지원)
npx ... install --cli claude --cli opencode    # Codex 제외
npx ... install --cli codex --cli opencode     # Claude 제외
```

기존 `--cli both`/`--cli all`은 **1 release deprecation alias**로 유지. 사용 시 stderr deprecation warning emit. **v0.8+에서 제거 예정**.

```
$ npx ... install --cli both
[WARN] --cli both is deprecated. Use --cli claude --cli codex (will be removed in v0.8+)
```

### Added — Codex slash 통일 (Major CR)

`--with-codex-prompts` opt-in 시 `~/.codex/prompts/uzys-{spec,plan,build,test,review,ship}.md` 6 file 글로벌 복사. Codex CLI에서 `/uzys-spec` 등 Claude Code 컨벤션 slash 작동 ([공식 docs](https://developers.openai.com/codex/cli/slash-commands)).

```bash
npx ... install --track tooling --cli codex --with-codex-prompts
# → ~/.codex/prompts/uzys-*.md 6 file 생성
# → Codex 재시작 → /uzys-spec, /uzys-plan, ... slash 자동 등록
```

D16 보호 — opt-in 강제. 기존 `.agents/skills/uzys-*/SKILL.md` (`$uzys-spec` mention 형식)도 병존.

### Internal

- `src/types.ts` `CliBase` (`"claude" | "codex" | "opencode"`) + `CliTargets` (sorted readonly array)
- `InstallSpec.cli`: `CliMode` (single string) → `CliTargets` (array)
- `OptionFlags.withCodexPrompts: boolean` (default false)
- `src/cli-targets.ts` (신규) — `parseCliTargets()` repeatable + alias 변환 + invalid reject + warning 수집
- `src/codex/prompts.ts` (신규) — `renderCodexPrompt()` markdown 변환 + slash rename
- `src/codex/opt-in.ts` `runCodexOptIn` 분기 — `withCodexPrompts=true` 시 6 file 글로벌 복사
- `CodexOptInReport.promptsInstalled` 필드 추가
- `src/prompts.ts` `selectCli` `select` → `multiselect` (3 base 체크박스, default `["claude"]`, required: true)
- 매트릭스 11×5=55 → **11×7=77** + invariant 8 = 신규 조합 (claude+opencode, codex+opencode) 검증 추가

### 검증
- vitest **506 tests PASS** (이전 451 → 506 = +55)
- coverage stmt 96.18% / branches 88.48% / funcs 95.62% / lines 96.18% — threshold 90/88/90/90 충족
- npm run ci PASS
- 5축 reviewer (별도 진행)

### Driver
- 사용자 질문 (2026-04-28) — "왜 CLI 선택이 multi-select 아닌가?"
- 사용자 보고 (2026-04-27 AutoBlogEngine) — Codex `/uzys-*` slash 미인식 (`.agents/skills/`는 `$<name>` mention만)
- 두 issue를 단일 BREAKING release로 묶음 (사용자 마이그레이션 1회)

### Reference
- SPEC `docs/specs/cli-multi-select.md` (Accepted, Major CR)
- Plan `docs/plans/cli-multi-select-plan.md`
- Dogfood `docs/dogfood/v0.7.0-2026-04-28.md`

## [v0.6.6] — 2026-04-28

### Fixed — prune-ecc.sh 상대경로 dest 변환 버그

사용자 보고:
```
⊘ ecc-prune    bash exited 1: ERROR: --dest는 현재 프로젝트 디렉토리 하위만 허용
   입력: .claude/local-plugins/ecc (절대: .claude/local-plugins/ecc)
   현재 pwd: /Users/.../AutoBlogEngine
```

원인: `scripts/prune-ecc.sh` L51-56 절대경로 변환 로직 결함.
- default `DEST=".claude/local-plugins/ecc"` (상대)
- `dirname "$DEST"` = `.claude/local-plugins` — install 시점에는 **미존재** 디렉토리
- `cd "$(dirname...)"` 실패 → `DEST_PARENT=""` → else 분기에서 `DEST_ABS="$DEST"` (상대 그대로)
- L68 pwd 검증: `case "$DEST_ABS" in "$(pwd)"|"$(pwd)/"*)` 절대 vs 상대 mismatch → ERROR

Fix: dirname 디렉토리 미존재 + DEST가 상대경로면 `pwd` prefix 적용.
```bash
elif [[ "$DEST" = /* ]]; then
  DEST_ABS="$DEST"   # 이미 절대
else
  DEST_ABS="$(pwd)/$DEST"   # 상대 → pwd 기준 절대
fi
```

검증:
- shellcheck PASS (기존 info 경고 2건은 pre-existing, 본 fix와 무관)
- smoke test (tmp dir에서 `--apply --force` 실행) → dest validation 통과 + 최종 메시지 도달

#### Driver
사용자 실측 install (2026-04-28 AutoBlogEngine, v0.6.5 환경) — ecc-prune skip. 첫 install부터 dirname 디렉토리 미존재 시나리오에서 발생하는 100% 재현 버그.

## [v0.6.5] — 2026-04-28

### Fixed — vercel-react-best-practices skill name + ecc-prune script 누락

#### A. react-best-practices skill name (skills.sh registry 기준)

사용자 보고 — `npx exited 1`. skills.sh 사이트(https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices) 확인 결과 registry name은 **`vercel-react-best-practices`** (vercel- prefix 있음). GitHub 디렉토리 이름(`react-best-practices`)과 다름.

- skills.sh registry 명명 규칙: 같은 repo 내에서도 prefix 일관 X
  - `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-native-skills`, `vercel-cli-with-tokens`, `vercel-react-view-transitions`, `vercel-deploy` (prefix 있음)
  - `web-design-guidelines`, `deploy-to-vercel` (prefix 없음)
- catalog `--skill react-best-practices` → `vercel-react-best-practices`로 수정
- web-design-guidelines는 prefix 없으므로 그대로 정확

#### B. ecc-prune script not found

사용자 보고 — `script not found: /Users/.../node_modules/@uzysjung/claude-harness/scripts/prune-ecc.sh`.

- 원인: `package.json` `files` field가 npm package 포함 항목 한정 — `["dist", "templates", "README.md", "LICENSE"]`. `scripts/` 미포함
- Fix: `files`에 `"scripts/prune-ecc.sh"` 명시 추가 (해당 파일 1개만)

#### Driver
사용자 실측 install 보고 (2026-04-28, AutoBlogEngine 환경) — Codex 설치 후 2건 외부 자산 실패. skills.sh URL 직접 명시 + prune script not found 에러 메시지 직접 캡처.

#### 검증
- vitest 451 tests PASS (변경 없음)
- npm run ci PASS

## [v0.6.4] — 2026-04-27

### Fixed — Codex skills 출력 경로 (사용자 보고: `/uzys-spec` slash 동작 안 함)

사용자 실측 보고 — Codex CLI에서 `/uzys-spec` 등 slash command 인식 못 함.

#### 원인
- 우리 `runCodexTransform`이 skills를 **`<projectDir>/.codex-skills/uzys-<phase>/SKILL.md`** 에 작성
- Codex 공식 표준 ([developers.openai.com/codex/skills](https://developers.openai.com/codex/skills)): repo-level scope는 **`.agents/skills/`** (자동 인식)
- `.codex-skills/`는 비표준 — Codex가 인식 안 함 → slash 등록 실패

#### Fix
- `src/codex/transform.ts`: skill 출력 경로 `.codex-skills/uzys-<phase>` → **`.agents/skills/uzys-<phase>`**
- `src/codex/opt-in.ts`: `~/.codex/skills/` 복사 source `.codex-skills/` → `.agents/skills/`
- `src/commands/install.ts`: install report row 경로 표시 갱신
- tests/codex/opt-in.test.ts (9 case) + tests/install.test.ts + tests/installer-cli-matrix.test.ts 갱신

#### 영향 (기존 사용자)

v0.2.0~v0.6.3으로 Codex 설치한 프로젝트는 `.codex-skills/` 디렉토리를 보유. v0.6.4로 재설치 시 `.agents/skills/uzys-*`가 새로 생성. 기존 `.codex-skills/`는 dead — 수동 삭제 권장:

```bash
# v0.6.4 재설치 후
rm -rf .codex-skills
npx -y github:uzysjung/uzys-claude-harness#main install --track <track> --cli codex
# → .agents/skills/uzys-{spec,plan,build,test,review,ship}/SKILL.md 생성됨
# → Codex 재시작 시 /uzys-spec ... slash 자동 등록
```

#### 검증
- vitest 451 tests PASS
- coverage 96.2/88.71/95.38/96.2 (threshold 90/88/90/90)
- npm run ci PASS

#### Driver
사용자 실측 보고 (2026-04-27, AutoBlogEngine 환경) — Codex `/uzys-spec` slash 동작 안 함. `gh api` + 공식 docs로 표준 위치 확인 후 fix.

#### 후속 (별도 트래킹)
- **#2 .claude/ dead weight (Codex 단독 설치 시)** — design 결정. v0.7+ 별도 SPEC에서 옵션 검토 (CLI=codex 단독 시 .claude/ 미생성)
- **#3 .factory/, .goose/ 자동 생성** — `npx skills add`의 multi-CLI universal install 동작. 외부 도구 control. v0.7+ 별도 분석

## [v0.6.3] — 2026-04-27

### Fixed — railway-plugin / vercel-labs source URL (사용자 install 실패 보고)

사용자 실측 install 시 2건 외부 자산 실패. 외부 검증 후 fix.

#### railway-plugin entry 제거
- `repos/railwayapp/railway-plugin` 자체 **404 Not Found** — repo 존재 안 함.
- 공식 docs ([railway claude-code-plugin](https://docs.railway.com/ai/claude-code-plugin))는 `railwayapp/railway-skills` marketplace + `railway@railway-skills` plugin만 명시. 별도 `railway-plugin` 없음.
- catalog의 `railway-plugin` entry는 환각/오타. 즉시 제거. `railway-skills` entry로 단일화.

#### vercel-labs/agent-skills source URL 수정
- 사용자 보고: `npx exited 1`
- 공식 형식 (사용자 확인): `npx skills add https://github.com/vercel-labs/agent-skills --skill <name>`
- catalog는 short form `vercel-labs/agent-skills` 사용 — full HTTPS URL 필요
- 영향 entries:
  - `react-best-practices` — source `https://github.com/vercel-labs/agent-skills`
  - `web-design-guidelines` — 동일

#### 다른 자산 일괄 검증 (모두 PASS)
- K-Dense-AI/scientific-agent-skills, wshobson/agents, addyosmani/agent-skills, anthropics/skills, anthropics/knowledge-work-plugins, supabase/agent-skills, vercel-labs/skills, vercel-labs/next-skills, pbakaus/impeccable, testdino-hq/playwright-skill, yonatangross/orchestkit, alirezarezvani/claude-skills (10 entries v0.5.0 검증 완료), trailofbits/skills, affaan-m/everything-claude-code, shadcn-ui/ui — repo 모두 존재.

#### Internal
- tests/installer-track-matrix.test.ts — railway-plugin 검증 행 제거 + railway-skills로 대체
- tests/external-assets.test.ts — 동일
- docs/REFERENCE.md — railway-plugin 행 삭제, react/web-design source URL full HTTPS로 갱신, 공식 railway docs URL 인용

#### 검증
- vitest 451 tests PASS
- coverage threshold 충족
- npm run ci PASS

#### Driver
사용자 실측 보고 (2026-04-27) + Railway 공식 docs URL 명시 + vercel-labs install 형식 명시.

## [v0.6.2] — 2026-04-26

### Improved — Phase 1 names 전체 표시 (압축 제거)

사용자 피드백 — `+ N more` 압축 표기 제거. 카테고리별 모든 names 풀어서 출력.

이전 (v0.6.1):
```
✓ rules    change-management, cli-development, code-style + 5 more (8)
```

v0.6.2:
```
✓ rules    change-management, cli-development, code-style, error-handling, gates-taxonomy, git-policy, ship-checklist, test-policy (8)
```

`formatNamesWithCount` 함수 단순화 — head 3개 + "+ N more" 로직 제거. terminal 너비 초과 시 자연 wrap.

## [v0.6.1] — 2026-04-26

### Improved — Install output verbosity (Phase 1 + Phase 2)

`install` 명령 출력에서 **무엇이 설치됐는지** 명시적 노출. 이전 한 줄 묶음(`rules + hooks + commands + agents — N files`)에서 카테고리별 분리 + names 일부 표시.

#### Phase 1 (Templates) — 카테고리별 row + names
이전:
```
✓ rules + hooks + commands + agents    24 files
✓ skeleton + project-claude/...        8 dirs
```
v0.6.1:
```
✓ rules         change-management, cli-development, code-style + 5 more (8)
✓ agents        reviewer, data-analyst, strategist + 5 more (8)
✓ hooks         session-start, protect-files, gate-check + 5 more (8)
✓ commands      8 entries (uzys + ecc)
✓ skills        continuous-learning-v2, strategic-compact, north-star + 5 more (8)
```

#### Phase 2 (External Assets) — method + description prefix
이전:
```
✓ karpathy-coder    karpathy-coder@claude-code-skills
```
v0.6.1:
```
✓ karpathy-coder    plugin · karpathy-coder@claude-code-skills — (4 Python tool + reviewer agent + /karpathy-check + pre-commit hook)
```

formatAssetMeta가 method kind prefix(`plugin · / skill · / npm -g · / npx · / bash ·`) + asset.description 추가 (id 중복 제거).

#### Internal
- `BaselineReport.categories` (optional) — `{ rules, agents, hooks, commands, skills }` names + count.
- `accumulateCategory` helper — manifest entry `target` prefix로 분류 (basename 추출).
- `formatNamesWithCount` helper — 첫 3개 names + "+ N more (total)" 압축 표기.
- backwards compat: `categories` undefined 시 v0.6.0 출력 형식 fallback (test fakeReport 영향 없음).

#### 검증
- vitest 451 tests PASS (테스트 1개 fixture 갱신 — `npm install -g vercel` → `npm -g · vercel` prefix 변경 반영).
- coverage threshold 충족.
- 실측 install 출력 — 5 카테고리 row + 7 external assets description 모두 표시.

## [v0.6.0] — 2026-04-26

### Added — karpathy-coder hook auto-wire (opt-in)

v0.5.0에서 plugin install까지만 제공된 `karpathy-coder`의 **pre-commit hook 자동 등록 (A 경로)** 구현. 사용자 명시 opt-in 후에만 `.claude/settings.json` PreToolUse Write|Edit matcher에 hook entry 등록.

#### 신규 옵션
- **`--with-karpathy-hook`** CLI flag + 인터랙티브 prompt entry — `OptionFlags.withKarpathyHook` (default false, opt-in 강제).
- 활성화 조건 (AND): flag 명시 + `karpathy-coder` plugin install 성공.

#### 신규 자산
- `templates/hooks/karpathy-gate.sh` — alirezarezvani/claude-skills@f567c61 cherry-pick + Claude Code PreToolUse 컨텍스트 adapt. stdin tool_input JSON에서 `file_path` 추출 (jq 우선, grep 폴백) → Python 3 + plugin scripts 가용 시 `complexity_checker.py` warn. 비차단 (`exit 0` 항상).
- `src/settings-merge.ts` (62줄) — `addPreToolUseHook` idempotent helper. 기존 hook 보존 + 다른 matcher entries 보존.

#### Internal
- `src/installer.ts` `wireKarpathyHook` — opt-in 강제 + plugin install 성공 후에만 활성화. settings.json JSON.parse try/catch (HIGH-2 fix) — `add` mode에서 사용자 손상 settings.json 시 graceful degradation (`reason="settings-parse-error"`).
- `KarpathyHookReport` interface — wired/reason/settingsUpdated/hookScriptCopied 4 필드.
- `KARPATHY_ASSET_ID` const — external-assets와 SSOT 통일 (MEDIUM-3 fix).

#### Documentation
- `docs/USAGE.md` "karpathy-coder Enforcement (4 Level)" 섹션 — L1~L4 + 활성화 절차 + Python 3 부재 시 동작 + v0.6.0 PreToolUse 한계 명시 + upstream incremental adoption 권장 (Week 1 L1 → Week 4+ L3).
- `docs/decisions/ADR-005-v0.5.0-f9-mock-dogfood.md` (v0.5.0 ADR-005 정신 유지) + `docs/decisions/ADR-006-karpathy-hook-pretooluse-vs-posttooluse.md` (HIGH-1 후속, v0.7+ 재평가 트리거 명시).
- `docs/research/karpathy-hook-autowire-2026-04-26.md` — deep-research 14 sources. upstream `enforcement-patterns.md` 권장 검증 → 4-gate Modified Go (5 조건 충족).

#### 검증
- vitest **451 tests PASS** (이전 437 + 신규 14: settings-merge 5 + install-karpathy-hook 5 + fixture 4).
- coverage stmt 96.89% / branch 88.53% / funcs 96.09% / lines 96.89% — threshold 90/88/90/90 충족.
- npm run ci PASS (typecheck + lint + test:coverage + build).
- shellcheck `templates/hooks/karpathy-gate.sh` PASS / smoke test exit 0 + reminder 출력.
- alirezarezvani/claude-skills marketplace 등록 + cherry-pick commit pin (`f567c61def3fb86046d7242b4bf27fceb63ad8b4`) `cherrypicks.lock`에 기록.

#### Reviewer 결과 (5축)
- **CRITICAL: 0** — Ship 가능.
- HIGH 2 / MEDIUM 4 / LOW 2:
  - HIGH-2 (settings.json parse 무방어) — 본 PR fix.
  - MEDIUM-3 (asset ID hardcode) — 본 PR fix (`KARPATHY_ASSET_ID` const).
  - MEDIUM-4 (file_path 추출 fragile) — 본 PR fix (jq 우선 + grep 폴백).
  - HIGH-1 (PreToolUse vs PostToolUse 의미) — ADR-006 채택 + USAGE.md 한계 명시 + v0.7+ 재평가.
  - MEDIUM-1, MEDIUM-2, LOW-1~3 — 후속 PR.

#### Driver
v0.5.0 SPEC §3.4 OQ1 (karpathy hook 자동 와이어링 결정) → 사용자 결정 (2026-04-26): A 경로 채택 + opt-in 강제. deep-research로 외부 검증 (4-gate 4/4 정합) 후 진행.

#### Reference
- SPEC `docs/specs/karpathy-hook-autowire.md` (Accepted)
- Plan `docs/plans/karpathy-hook-autowire-plan.md`
- Dogfood `docs/dogfood/karpathy-hook-2026-04-26.md`
- ADR-006 `docs/decisions/ADR-006-karpathy-hook-pretooluse-vs-posttooluse.md`

## [v0.5.0] — 2026-04-26

### Added — 신규 Track 2개 + karpathy-coder

11 Track으로 확장. Persona 커버리지 확대 + dev Track 공통 enforcement 도구 시드.

#### 신규 Track 2개
- **`project-management`** (Persona: PM / Scrum Master / Jira/Confluence 관리자) — executive-style baseline
  - 외부 자산: `pm-skills` (6 — senior PM, scrum master, Jira/Confluence/Atlassian admin, template creator), `product-skills` (15 — RICE, PRD, agile PO, UX research, SaaS scaffolder ...)
- **`growth-marketing`** (Persona: Growth/Marketing Lead / Content Strategist) — executive-style baseline
  - 외부 자산: `marketing-skills` (44 — content/SEO/CRO/channels/growth/intelligence/sales/twitter), `business-growth-skills` (재사용), `content-creator`, `demand-gen`, `research-summarizer`

#### 신규 외부 자산 1건 (모든 dev Track 공통)
- **`karpathy-coder`** — CLAUDE.md P1-P4 선언적 원칙의 enforcement layer
  - 4 Python tool (stdlib only): `complexity_checker.py`, `diff_surgeon.py`, `assumption_linter.py`, `goal_verifier.py`
  - sub-agent: `karpathy-reviewer`
  - slash command: `/karpathy-check`
  - pre-commit hook: `karpathy-gate.sh` (사용자 와이어링 책임 — 자동 활성화 미지원, OQ1 v0.6+)

#### 외부 자산 변경 (1건)
- `business-growth-skills` condition 확장 — `[executive, full]` → `[executive, full, growth-marketing]`. 기존 executive/full 회귀 0 (unit test 검증).

#### Internal
- `shouldInstallAsset` `has-dev-track` 분기를 `track-match.hasDevTrack`과 SSOT 통일. 이전 `t !== "executive"` 단순 매칭은 신규 PM/Growth Track을 dev로 잘못 분류했음.
- `tests/installer-9-track.test.ts` → `installer-11-track.test.ts` rename + 11 케이스.
- 매트릭스 9×5=45 → 11×5=55 + invariant 6 = **61 PASS**.
- 신규 Track 매핑 + OQ2 합집합 회귀 + karpathy-coder PM/Growth 제외 검증 9 unit tests 추가.

#### 검증
- vitest **437 tests PASS** (이전 413 + 신규 24).
- coverage: stmt 96.91% / branch 88.59% / funcs 96.03% / lines 96.91% — threshold 90/88/90/90 모두 PASS.
- alirezarezvani/claude-skills marketplace에 신규 7 plugin id 등록 확인 (`gh api` 검증).
- 라이브 dogfood — D16 보호 + 사용자 승인 필요로 본 릴리스에서는 보류 (OQ4 v0.6+).

#### Driver
사용자 결정 (`docs/dev/session-2026-04-25-tracks-handoff.md` §1) — Persona 확장 (PM/Growth Marketing) + karpathy-coder 검증 도구 통합 (4-gate 4/4 Pass).

#### Reference
- SPEC `docs/specs/new-tracks-pm-growth.md` (Accepted)
- Plan `docs/plans/new-tracks-pm-growth-plan.md`
- Dogfood `docs/dogfood/cli-dogfood-2026-04-26-v0.5.0.md`

## [v0.4.0] — 2026-04-25

### Fixed — CLI Rewrite Completeness (bash setup-harness.sh 등가성 100% 복원)

v0.2.0 CLI rewrite 시 누락된 외부 자산 32건 + Router 분기 + 환경 파일 + Codex opt-in 모두 구현. NORTH_STAR Phase 1 (어휘 완전성) 목표 달성.

**Driver**: 사용자 실측 누락 발견 + Reviewer 전수 조사 (CRITICAL 4 / HIGH 9 / MEDIUM 5 / LOW 3).

#### CRITICAL fix (4건)
- **`--with-ecc` 옵션 실제 호출** — 이전 dead. `claude plugin install everything-claude-code@everything-claude-code`
- **`--with-prune` 옵션** — `bash scripts/prune-ecc.sh` 실제 실행
- **`--with-tob` 옵션** — `claude plugin install trailofbits-skills@trailofbits-skills`
- **외부 자산 32건 일괄 복원** — bash setup-harness.sh@911c246~1 L791~1067 매트릭스 등가
  - data Track: polars/dask/python-resource/python-perf/anthropic-data
  - dev: agent-skills/playwright/find-skills/agent-browser/ADR
  - csr-supabase: Vercel/Netlify/Supabase CLI + supabase-skills + postgres
  - csr-fastapi/fastify/ssr-*: Railway plugin + skills
  - csr-*/ssr-nextjs: react-best-practices/shadcn/web-design/next-skills
  - executive: anthropic-document-skills/c-level/finance
  - GSD orchestrator (--with-gsd)

#### HIGH fix (9건)
- **Router add/update/reinstall 분기** — InstallMode 도입 + 액션별 다른 path
- **Auto-backup** — update: copy backup (cp -R, 원본 보존) / reinstall: rename backup
- **Update mode orphan prune + stale hook cleanup** — bash 497-573 (113 LOC) 등가
- **Codex `~/.codex/skills/` opt-in** — `--with-codex-skills` 명시 동의 후 6 SKILL.md 복사
- **Codex `~/.codex/config.toml` trust entry** — `--with-codex-trust` 명시 동의 후 `[projects."<dir>"]` 등록 (registerTrustEntry dead code 활성)
- **`.env.example` 자동 생성** — csr-supabase/full Track에서 Supabase 토큰 가이드
- **`.gitignore .env` 추가** — secret 보호
- **`.mcp-allowlist` 자동 생성** — D35 opt-in security gate 활성

### Added — Verification Strategy 강화
- **9 Track × 5 CLI mode 매트릭스** = 45 시나리오 E2E install 자동 검증
- **fresh `npx -y github:...` first-run 시뮬레이션** — `prepare` hook으로 dist 자동 빌드 (PR #28에서 추가)
- **dead option spy 테스트** — 옵션 enable 시 부작용 발화 횟수 assertion
- **track-matrix unit test** — 9 Track × external asset id 정확 매핑 검증

### CLI 옵션 (신규)
```
--with-codex-skills      Codex global opt-in: ~/.codex/skills/uzys-* 복사
--with-codex-trust       Codex global opt-in: ~/.codex/config.toml trust entry
```

### Test/Coverage
- 198 → **413 tests** (+215 누적)
- Coverage stmt 97.02%, branch 89.81%, lines 97.02%
- Build 109.51 → 142.08 KB (+32.57 KB external/update-mode/codex-opt-in/env-files)

### DO NOT CHANGE 준수
- `templates/codex/` + `src/codex/transform.ts` 미수정 (opt-in.ts 추가만)
- `templates/opencode/` + `src/opencode/` 미수정
- `~/.claude/`, `~/.codex/`, `~/.opencode/` 글로벌 — 명시 opt-in 후만 수정 (D16)

### NORTH_STAR Phase 1 (어휘 완전성) 목표 달성
- Promise = Implementation 100% (광고 자산 = 실제 동작)
- Cross-CLI Parity 100% (Claude/Codex/OpenCode 동등 작동)
- First-Run Success: 단독 시뮬레이션 100% (Phase 2에서 다중 환경 검증)

### Reference
- SPEC: `docs/specs/cli-rewrite-completeness.md`
- Ship report: `docs/evals/cli-completeness-2026-04-25.md`
- Reviewer 전수 조사: 본 세션 conversation
- Bash source: setup-harness.sh@911c246~1 (v0.2.0 cutover 직전)

## [v0.3.0] — 2026-04-25

### Added — OpenCode CLI 호환 (2차)

OpenCode CLI ([anomalyco/opencode](https://opencode.ai)) 풀 하네스 복제. Claude SSOT, OpenCode는 transform + plugin으로 파생. Codex 1차(v0.2.0 / v26.37.0)와 독립 SPEC.

- **Phase A**: Plugin lifecycle 정밀 리서치 + 호환 매트릭스 + ADR-004 v1 (Proposed) (PR #24)
- **Phase B**: `templates/opencode/` 스캐폴드 — AGENTS.md.template + opencode.json.template + 6 commands stub + plugin stub. **OQ2 Closed** = `/uzys-spec` (hyphen) 채택. Clarification CR — `commands/`/`plugins/` plural 정정
- **Phase C**: TS 모듈 `src/opencode/` 4종 — transform / agents-md / opencode-json / commands. 198 → 218 tests
- **Phase D**: TS CLI `--cli` 확장 — `["claude","codex","opencode","both","all"]`. 인터랙티브 모드 OpenCode 분기 자동 반영. 218 → 226 tests
- **Phase E1**: Plugin 본문 작성 — `templates/opencode/.opencode/plugins/uzys-harness.ts` (110줄, self-contained). 3 hook 매핑 (`tool.execute.before` / `tool.execute.after` / `messageCreated`). `src/opencode/plugin-helpers.ts` 테스트 미러. 226 → 248 tests
- **Phase E3**: ADR-004 Status: Proposed → Accepted (사용자 승인)
- **Phase F**: Dogfood 2 Track (tooling + csr-fastapi) 무인 설치 100% (`docs/evals/opencode-install-2026-04-25.md`)
- **Phase G**: README en/ko OpenCode 섹션 + USAGE.md 시나리오 + stale `setup-harness.sh` 26곳 일괄 청소

### Changed — README/USAGE stale 청소 (v0.2.0 누락분 일괄 처리)

`scripts/setup-harness.sh` 폐기 후 누락된 26곳 텍스트 정리:
- `README.md` 9곳 → `claude-harness install` 또는 generic "the installer"
- `README.ko.md` 10곳 동일
- `docs/USAGE.md` 7곳 동일
- `claude-to-codex.sh` 2곳 → `src/codex/transform.ts`

### Hook 매핑 (3종)

| Claude hook | OpenCode plugin hook | 동작 |
|-------------|----------------------|------|
| `PreToolUse` (gate-check) | `tool.execute.before` | 게이트 위반 시 throw |
| `PostToolUse` (spec-drift) | `tool.execute.after` | spec 편집 시 로그 |
| `UserPromptSubmit` (HITO) | `messageCreated` filter user | HITO 카운터 |

Codex 1차의 shell wrapper 우회와 달리 OpenCode plugin은 **직접 1:1 매핑**.

### CLI 옵션

```
--cli=claude    Claude only (default)
--cli=codex     Claude + Codex
--cli=opencode  Claude + OpenCode (NEW)
--cli=both      Claude + Codex (Codex 1차 호환 유지)
--cli=all       Claude + Codex + OpenCode (NEW)
```

### Test/Coverage

- 198 → 248 tests (+50, regression 0 — Codex 14 + Claude 184 모두 유지)
- Coverage stmt 97.0%, branch 91.73% (≥90% threshold)
- Build 102.55 → 109.01 KB (+6.46 KB OpenCode 모듈)

### DO NOT CHANGE 준수

- `templates/codex/` + `src/codex/` 미수정 (Codex 1차 산출물 보호)
- `~/.claude/`, `~/.codex/`, `~/.opencode/` 글로벌 미터치 (D16)
- `docs/SPEC.md` Phase 1 Finalization 영역 미변경

## [v0.2.0] — 2026-04-25

### Changed (CLI rewrite — bash → TypeScript, cutover)

`scripts/setup-harness.sh` (1453 LOC), `scripts/test-harness.sh`, `scripts/claude-to-codex.sh` 폐기. install.sh는 npx wrapper(28 LOC)로 축소. 새 진입점은 모두 Node 기반(`@uzysjung/claude-harness` package, bin: `claude-harness`).

- **Phase A**: TypeScript 프로젝트 골격 + cac CLI + Vitest 90%+ 커버리지 (PR #12)
- **Phase B**: `@clack/prompts` 인터랙티브 + 5-action 라우터 + state 감지 (PR #13)
- **Phase C**: 실 install 파이프라인 — 매니페스트 데이터 표 + .mcp.json 병합 + 백업/롤백 (PR #14)
- **Phase D**: TS Codex 호환 통합 — `claude-to-codex.sh` 247 LOC를 TS 5 모듈로 포팅, OQ4 Closed (PR #15)
- **Phase E**: 9 Track 통합 테스트 + 매니페스트 5종 보강 (PR #16)
- **Phase F**: bash 4종 cutover + GH Releases 분배 + CI workflow vitest 전환 (PR #17)
- **Phase G (이번)**: CLI 디자인 명시성 (`src/design.ts` ANSI helper) + 9 Track 라이브 dogfood 9/9 PASS + ADR-003 Accepted (PR #18)

새 진입점 (모든 `bash <(curl ...)` / `bash scripts/*` 대체):
```bash
# 권장 (curl 진입 그대로 — 내부에서 npx 호출)
bash <(curl -fsSL https://raw.githubusercontent.com/uzysjung/uzys-claude-harness/main/install.sh)

# CI / 자동화
npx -y github:uzysjung/uzys-claude-harness install --track tooling --project-dir .
```

해소된 사용자 보고 문제:
- 인터랙티브 prompt 입력 대기 시각화 (clack ↑↓ 화살표 + Space 토글)
- `/dev/tty: Device not configured` stderr 노이즈 0건
- 1453 LOC 단일 파일 → 모듈화 (≤ 300 LOC each, 13 src 모듈)
- shellcheck SC2015 등 누적 경고 → TypeScript strict + biome
- 분배 환경 차이 (BSD vs GNU sed) → Node.js 단일 의존성



## [v26.37.0] — 2026-04-25

### Added
- **Codex CLI 호환 풀 하네스 복제 (1차)** — `--cli={claude,codex,both}` 플래그 + 인터랙티브 prompt
  - `scripts/claude-to-codex.sh` — Claude Code SSOT를 Codex 자산으로 변환 (5-단)
  - `templates/codex/` — AGENTS.md.template, config.toml.template, hooks 스캐폴드, 6 skills
  - `--cli=codex` 시 `setup-harness.sh`가 변환 호출 + 2단 opt-in (글로벌 skills / trust entry)
  - 인터랙티브 라우터 2c 단계: CLI 선택 (`①Claude ②Codex ③Both`)
  - test-harness T23 (10 assertion) — CLI 플래그 / E2E 무인 설치 / slash rename / hook env rename / README 섹션
- **Codex 호환 SPEC + ADR + 호환 매트릭스 + dogfood 리포트**:
  - `docs/specs/codex-compat.md` — Sprint Contract + AC1~AC6
  - `docs/decisions/ADR-002-codex-hook-gap.md` v2 (Accepted) — Hook 갭 소멸, 포맷 변환 규약
  - `docs/research/codex-compat-matrix-2026-04-24.md` — Codex 0.124.0 실측 + Hook 이벤트 맵
  - `docs/evals/codex-install-2026-04-25.md` — 2 Track (tooling + csr-fastapi) 실측 dogfood
- **README.md / README.ko.md "Codex CLI 지원" 섹션** — 설치 / 자산 구조 / 슬래시 rename / 2가지 opt-in / 알려진 제약 (Issue #16732, #17532) / 참고 링크

### Notes
- Hook event PascalCase ↔ snake_case 변환은 mechanical. stdin JSON 필드 호환으로 Claude Code hook 스크립트 본체 재사용
- ApplyPatch(파일 쓰기) hook 미발화 (#16732) → `sandbox_mode=workspace-write` + `approval_policy=on-request` 네이티브 보호로 이관
- 글로벌 `~/.codex/` 수정은 명시 opt-in 후에만 (D16 정신 + ADR-002 v2 D4)
- Claude-only 기본 경로 regression 0 — `--cli=claude` (기본) 흐름 변화 없음

### SPEC AC 충족
- AC1 `--cli=codex` 무인 설치 / AC2 ≥2 Track / AC3 6 skill slash / AC4 MCP 2+ 서버 / AC5 Hook 포맷 변환 / AC6 Claude regression 0 — **모두 Pass**

## [v26.36.0] — 2026-04-23

### Added
- **ADR-001 — Phase 2 진입 조건 확정**: `docs/decisions/ADR-001-phase2-entry-criteria.md` 생성. OQ1-3 결정:
  - HITO baseline 종료 기준: 7일 AND 세션 ≥ 10 AND feature ≥ 3 (AND)
  - 외부 사용자 첫 설치: 이월 허용 — Phase 2 백로그 P2-01 등재
  - dogfood interactive 시나리오: 3개(Install/Update/Add) 확정
- **requirements-trace Part 6 신설** — v26.18.0~v26.35.0 (drift period, 18개 커밋) 사후 4-gate 감사. 전부 4/4 Pass (Trend·Persona·Capability·Lean), revert/Non-Goals 재분류 대상 없음.
- **Track fresh install 검증 9/9 PASS** — `docs/evals/track-install-2026-04-23.md`. tooling/executive/full (Phase B) + csr-supabase/csr-fastify/csr-fastapi/ssr-htmx/ssr-nextjs/data (본 세션). 성공률 100% → NSM 2차 지표 ≥ 95% 충족.

### Changed
- `docs/requirements-trace.md` 중복 "Part 3" 헤딩을 Part 6으로 교정 (기존 Part 3 Decisions와 충돌 해소)
- `docs/todo.md` E1 판정 4/7 → **6/7 Pass + 1 Pending** (AC4 #1/#5 추가 Pass, 남은 Pending은 AC3 HITO 경과 대기)

### Notes
- **v26.38.0 태그 유보**: SPEC `docs/SPEC.md` §2 완료 조건 AC1-AC5 중 AC3 (HITO 7일 baseline) 미충족. Phase D 경과 후 별도 릴리즈.
- 본 릴리즈는 Phase E readiness 이정표 중간 태그.

## [v26.35.0] — 2026-04-22

### Added
- **인터랙티브 라우터 — 설치 상태 자동 감지 + Install/Update/Add 분기**:
  - `detect_install_state()` — `.claude/.installed-tracks` 메타파일 또는 legacy `rules/*.md` 시그니처로 기존 Track 자동 추정
  - `prompt_action_router()` — 5-메뉴 (1. 새 Track 추가 / 2. 정책 파일 업데이트 / 3. Track 제거(미지원) / 4. 재설치 / 5. 종료)
  - 신규 설치는 기존 `prompt_interactive_setup` 흐름, 기존 설치는 라우터 메뉴 표시
- **`.claude/.installed-tracks` 메타파일 신규** — install / add-track 시 자동 기록 (정렬 + 중복 제거 union). 다음 설치 시 100% 정확한 Track 감지
- **README.md / README.ko.md "Step 2 — Install (interactive — recommended)" 격상** — 인터랙티브 진입점이 메인, 플래그 모드는 "CI / automation" 부록 위치
- **T22 — Interactive Router + State Detection 자산 검증** (test-harness): 10개 assertion (라우터 함수 / 5-메뉴 / Track 제거 미지원 명시 / .installed-tracks 메타파일 / legacy 추정 / 분기 / 비대화형 regression / 기록 로직 / README 격상)

### Changed
- 사용자 entry point가 사실상 한 줄로 통일: `bash <(curl -fsSL .../install.sh)` — 신규/업데이트/추가가 자동 분기
- 플래그 모드 (`--track X`, `--update`, `--add-track`) 그대로 작동 — CI/automation 호환

### 미지원 (의식적 제외)
- **Track 제거 (Remove)** — 메뉴엔 표시되지만 "v26.35.0 미지원, 수동 .claude/ 정리". 어떤 파일이 어느 Track 소유인지 100% 매핑 불가하여 데이터 손실 위험. 향후 별도 기능으로 검토.

### Stats
- test-harness assertion: 167 → 177 (PASS, FAIL 0)

## [v26.34.0] — 2026-04-22

### Added
- **`gh-issue-workflow` skill 신규** — GitHub Issue를 사용자↔AI agent 비동기 backlog + 의사결정 채널로 정형화. dyld-vantage 프로젝트의 실제 운용 패턴(`#52~#55`) 일반화. opt-in (`docs/SPEC.md`에 `issue_tracking: enabled` 명시 시 활성).
- **`ISSUE.template.md` 5섹션 강제**: 배경 / **전제 (Given)** / 방향성 (OPEN | YYYY-MM-DD 확정) / 적용 대상 / AC (When → Then) / 후속 작업. BDD 매핑.
- **3-축 label 체계** + 자동 토글 가이드:
  - type: `bug` / `feature` / `refactor` / `docs` / `infra`
  - 상태: `decision-pending` / `ready` / `in-progress` / `blocked`
  - 우선순위 (선택): `P0` / `P1` / `P2`
- **GitHub Projects (V2) 연계** (opt-in): `docs/SPEC.md`에 `github_project: <URL>` 명시 시 자동 add + status field 갱신
- `/uzys:spec` D' 블록 + `/uzys:plan` Process 1.5 + `/uzys:build` Process 4-5 + `/uzys:ship` Issue Closure — 4단계 모두 통합
- **T21 — gh-issue-workflow 자산 검증** (test-harness): 10개 assertion (skill/template/BDD/방향성/opt-in/4단계 통합/setup-harness 등록/anti-pattern/3-축 label/Projects 연계)

### Stats
- test-harness assertion: 157 → 167 (PASS, FAIL 0)

## [v26.33.0] — 2026-04-20

### Added
- **Interactive 설치 모드** — `--track` 생략하고 TTY 있으면 자동 대화식 진입. 플래그 9개로 증가한 설치 옵션을 사용자가 기억/조합할 필요 없이 질문에 답만 하면 진행.
  - Track 선택 (번호 or 이름, 다중 가능) → Tauri/GSD/ECC/prune/ToB 옵션 → 요약 → 확인 게이트
  - `prompt_interactive_setup()` 함수 (순수 bash `read`, gum 등 외부 의존성 0)
  - TTY 재부착(fd 3 패턴) 덕분에 `curl|bash` 경로에서도 동작: `bash <(curl -fsSL .../install.sh)`
  - CI/비-TTY 환경 + `--track` 없음 → 명시적 `ERROR: --track required in non-interactive mode` + exit 1
- **README.md / README.ko.md 인터랙티브 모드 안내 추가** (Step 2 섹션)
- **T20 — Interactive Mode 자산 검증** (test-harness): 6개 assertion — 함수 정의/TTY 검사/9 Track 노출/비대화형 에러/동적 exit 검증/4개 옵션 포함

### Changed
- T5 expected `HOOKS=7` → `8` (hito-counter.sh 추가로 auto-registered hook +1)

### Stats
- test-harness assertion: 151 → 157 (PASS, FAIL 0)

## [v26.32.0] — 2026-04-20

### Changed
- **`tauri.md` Rule을 `--with-tauri` 플래그 opt-in으로 분리** — 기존 csr-*/full track에 자동 설치되던 tauri 규칙이 "PRD에 desktop 요구 있을 때만 적용"이라는 조건부 특성인데 모든 CSR 프로젝트에 무조건 포함되어 context noise였음. 이제 명시적 `--with-tauri` 플래그에서만 포함. 기본 설치 시 Rule 1개 감소로 LLM context 최소화.
- P10 재평가 완료 — Rule 17 / Hook 7 / 자체 skill 3 전수 검토. tauri 외 모든 scaffold는 현역 사용 확인, 추가 slim-down 불필요 (v26.14.0 cleanup 이후 lean 상태 유지).

### Added
- **`templates/hooks/hito-counter.sh` 신규** — `UserPromptSubmit` hook으로 사용자 prompt 제출 시 `.claude/evals/hito-<date>.log`에 타임스탬프 append (프롬프트 내용은 프라이버시상 기록 안 함). Phase 2 HITO(Human-In-The-Loop Occurrences) NSM baseline 자동 수집 인프라.
- `templates/settings.json`에 `UserPromptSubmit` hook 섹션 등록 (async, timeout 2s)
- **T13 확장**: `--with-tauri` 시 tauri.md 설치 / 미지정 시 미설치 assertion 추가

### Stats
- test-harness assertion: 149 → 151 (PASS, FAIL 0)

## [v26.31.0] — 2026-04-20

### Added
- **`docs/NORTH_STAR.md` 본 repo 자기 적용 (dogfooding)**:
  - Statement: "필수적인 skill/plugin/CLAUDE.md/Agent.md 번들만으로 구체적 디렉션 없이도 고수준 서비스를 한 번에 만드는 하네스"
  - NSM: **HITO — Human-In-The-Loop Occurrences per Feature ≤ 3**
  - 4-gate 실제 적용 이력 (v26.26.0~v26.30.0 Pass/Fail 사례) 기록
- `README.md` / `README.ko.md`에 **Built-in custom skills** 섹션 신규 — north-star / ui-visual-review / spec-scaling 표 + PLAN template + ADR Status 흐름 요약
- `docs/REFERENCE.md` 섹션 6 "자체 작성 자산" 전면 확장 — skills 표화(3개 + 버전/Track), Templates 섹션, Commands 결합 상세, eval-harness 확장 명시

### Fixed (중요)
- **신규 north-star + ui-visual-review skill이 setup-harness.sh에서 복사 안 되던 문제** — `safe_copy_dir` 라인 누락으로 사용자 프로젝트에 전달 실패. v26.28.0/v26.29.0 설치분은 재설치(또는 `--update`) 필요.
  - north-star: 전 track 설치
  - ui-visual-review: UI track(csr-*/ssr-*/full) 한정 설치
- **test-harness T17.8, T18.7 신규 assertion** — setup-harness.sh에 safe_copy_dir 등록 정적 검증으로 재발 방지

### Stats
- test-harness assertion: 147 → 149 (PASS, FAIL 0)

## [v26.30.1] — 2026-04-20

### Security
- `docs/dev/*` (bootstrap-dev.sh / PRD.md / REQUIREMENTS.md) 에 남아있던 개인 private 리포 이름(`uzysjung/std-dev-boilerplate`, `uzysjung/dyld-vantage`) 제거 — generic placeholder(`<YOUR_BOILERPLATE_REPO>`, `<YOUR_REFERENCE_REPO>`)로 치환. public harness repo에서 개인 private 프로젝트 메타데이터 노출 차단. AgentShield 스캔 + `/ecc:security-scan` 요청에 의해 발견.

## [v26.30.0] — 2026-04-20

### Added — GoalTrack 이식
- **`templates/docs/PLAN.template.md` 신규** — Sprint Contract / Phase Overview / **Milestone × Dependency Graph (직렬/병렬/강한 의존 표기 규약)** / Critical Path / Per-Milestone AC / Risk & Mitigation / Open Questions / Changelog 8섹션. GoalTrack `docs/plan.md` 패턴 일반화.
- **`templates/rules/change-management.md` ADR 섹션 확장**:
  - Status 흐름 `Proposed → Accepted → (Superseded | Deprecated)` 정형화
  - ADR 템플릿에 `PR: #N`, `Supersedes: ADR-M` 필드 추가
  - "채택 프로세스" (PR 초안 → 검토 → 머지 시 Accepted) 4단계
  - "어떤 결정이 ADR 대상인가" 대상/비대상 목록

### Added — Vantage 이식
- **`templates/skills/spec-scaling/SKILL.md` 확장** — SPEC 기능별 분리와 별개로 **PRD 영역별 분리(`docs/PRD/` 계층화)** 패턴 신규. 마스터 PRD.md 구조 예시 + "SPEC vs PRD 분리 가이드" 표 추가. Vantage `.claude/PRD/` 구조 일반화.
- **`templates/skills/eval-harness/SKILL.md` 확장** — `.md` (설계) + `.log` (실행 결과) **쌍 의무화** + `.md` 3섹션(**Capability / Regression / Test**) 필수 명시 + `.log` append 포맷 예시. Vantage `.claude/evals/*.{md,log}` 구조 일반화.

### Added — 검증
- **T19 — External 이식 패턴** (test-harness): 8개 assertion (PLAN template + 의존성/Critical Path, ADR Status 흐름 + 채택 프로세스, spec-scaling PRD 계층화 + 가이드, eval-harness .md+.log 쌍 + 3섹션)

### Stats
- test-harness assertion: 139 → 147 (PASS, FAIL 0)

## [v26.29.0] — 2026-04-20

### Added
- **`ui-visual-review` skill 신규** (`templates/skills/ui-visual-review/SKILL.md`):
  - 5단계 프로세스 — 화면 리스트업(`docs/visual-pages.json`) → 캡처(chrome-devtools MCP / Playwright) → diff(L1 해시 → L2 pixelmatch → L3 LLM 시각 비교) → 에이전트 1차 판정(REGRESSION/CHANGED/PASS) → 사용자 승인 게이트
  - 출력: `docs/screenshots/<phase>/*.png` + `docs/visual-review-<phase>.md`
  - GoalTrack의 수동 스크린샷 검토 패턴(mvp-/v3-/v4- prefix)을 자동화
- `/uzys:test`에 UI Track(csr-*/ssr-*/full) 한정 ui-visual-review 호출 권유 섹션 추가
- `/uzys:review` Process step 5 — `docs/visual-review-<phase>.md` 존재 시 review 입력으로 흡수. **REGRESSION 1건이라도 있으면 Review Gate 차단** (CRITICAL과 동급)
- **T18 — UI Visual Review Skill 자산 검증** (test-harness): 6개 assertion (SKILL.md/frontmatter/핵심 키워드/UI Track 한정/test·review 결합/출력 경로 규약)

### Stats
- test-harness assertion: 132 → 139 (PASS, FAIL 0)

## [v26.28.0] — 2026-04-20

### Added
- **`north-star` skill 신규** (`templates/skills/north-star/`):
  - `SKILL.md` — 4-gate decision heuristic(Trend/Persona/Capability/Lean) + NSM 정의 + Will/Won't/Trade-offs 작성 가이드. CLAUDE.md의 P1/P2/Decision Making을 프로젝트 단위로 인스턴스화.
  - `NORTH_STAR.template.md` — 7-섹션 템플릿(Statement / NSM / Will-Won't / Phase Roadmap / Decision Heuristics / Versioning / Changelog). GoalTrack의 NORTH_STAR.md를 도메인 비종속으로 일반화.
- `/uzys:spec`에 D 블록 추가 — 6개월 이상 / 복수 Phase / 우선순위 결정 빈번 시 NORTH_STAR.md 작성 권장 (선택, 1회성 작업은 skip)
- `/uzys:plan` Process step 4에 north-star 4-gate 체크 — Complex 복잡도 + NORTH_STAR.md 존재 시 task가 4-gate 통과해야 진입. 1개 fail 시 사용자 보고 후 결정 대기. 자동 hook 없음 — 의식적 결정 강제 X.
- **T17 — North Star Skill 자산 검증** (test-harness): SKILL.md/template 존재, frontmatter, 4-gate 키워드, 7-섹션 구조, /uzys:spec & /uzys:plan 결합. 7개 assertion.

### Stats
- test-harness assertion: 125 → 132 (PASS, FAIL 0)

## [v26.27.0] — 2026-04-20

### Added
- **T15 — Install UX Regression**: v26.26.0 fix(`</dev/null` 격리, `exec </dev/tty`, `run_quiet` 헬퍼)의 회귀를 막는 6개 assertion. stdin pipe 상태에서 `--help` 즉시 exit 검증 포함
- **T16 — install.sh file:// end-to-end**: `UZYS_HARNESS_REPO=file://...`로 `curl|bash` 경로를 로컬 git repo로 재현. install.sh 자체가 처음으로 E2E 테스트됨 (clone → setup-harness → asset 생성 → 임시 클론 정리). 6개 assertion
- **T5 9-track 확장**: 기존 7 tracks → `csr-fastify`, `ssr-nextjs` 추가하여 9 tracks 전수 병렬 검증

### Fixed
- `install.sh` / `scripts/setup-harness.sh`의 TTY 재부착이 background/CI 환경에서 `set -e` + `Device not configured` 에러로 즉사하던 문제 — fd 3에 먼저 시도하는 `if exec 3</dev/tty 2>/dev/null; then exec <&3 3<&-; fi` 패턴으로 안전하게 우회

### Stats
- test-harness assertion: 111 → 125 (PASS, FAIL 0)

## [v26.26.0] — 2026-04-20

### Fixed
- `curl|bash` 설치 중 "설치 항목이 1,3,5처럼 중간에 씹혀 안 보이는" 현상 — MCP/plugin installer의 stdout/stderr 출력이 진행 표시 줄을 덮어쓰는 문제. 모든 설치 호출(`npx skills add`, `claude plugin install`, `claude plugin marketplace add`, `npm install -g`)에 `</dev/null >/dev/null 2>&1` 일관 적용 (27건)
- `curl|bash` 설치 중 "안내 없이 멈춰서 엔터 쳐야 넘어가는" 현상 — interactive 프롬프트(y/n)가 stdin pipe에 가로막혀 보이지 않는 문제. `</dev/null` stdin 닫기로 EOF 즉시 전달 + `install.sh`와 `scripts/setup-harness.sh` 헤더에 `exec </dev/tty` 이중 안전망 추가

### Added
- `run_quiet <label> <cmd...>` 설치 래퍼 헬퍼 (`scripts/setup-harness.sh`) — stdin/stdout/stderr 격리 + 실패 시 로그 tail 5줄 stderr 노출. 추후 설치 블록 공통화 시 사용
- `install.sh`에 사전 의존성 체크 (`git`, `bash`) — 중간 실패 방지
- `UZYS_HARNESS_REPO` 환경변수로 install.sh의 리포 URL 오버라이드 가능 (fork/mirror 지원)

## [v26.25.0] — 2026-04-19

### Added
- `csr-supabase` Track 설치 시 `.env.example` 자동 생성 (Supabase Management API Token, Project Ref, DB Password, Public URL/Key, AI API key 주석 포함)
- `.gitignore`에 `.env` 자동 추가 (시크릿 커밋 사고 방지)

## [v26.24.0] — 2026-04-19

### Added
- `csr-supabase` Track 설치 시 Supabase CLI(`npm install -g supabase`) 자동 설치 — OAuth login 1회로 프로젝트 관리
- `templates/project-claude/csr-supabase.md`에 "Supabase 인증 설정 (1회)" 섹션 — CLI login(OAuth) + MCP(`SUPABASE_ACCESS_TOKEN` env) 두 경로 분리 안내

## [v26.23.0] — 2026-04-19

### Fixed
- `--add-track` 시 ECC/ToB/GSD 프롬프트가 다시 떠서 사용자가 엔터로 skip해야 했던 문제 — ADD_MODE 시 default skip, 명시 플래그(`--with-ecc`/`--with-tob`/`--gsd`)로만 진행
- GSD 프롬프트가 `curl|bash` 환경에서 진입 못 했던 문제 — `[ -e /dev/tty ]` 검사 + `read … < /dev/tty` 추가 (ECC/ToB와 일관성)

### Documentation
- README.md / README.ko.md에 "Interactive prompts — what asks, when, how to skip" 섹션 신규: 4개 프롬프트(Track/GSD/ToB/ECC+prune) × 환경(local/`curl\|bash`/CI) 매트릭스, `--add-track`/`--update` SKIP 동작 명시

## [v26.22.0] — 2026-04-19

### Changed
- `csr-supabase` Track에서 Railway 자동 설치 제거 (Supabase가 자체 backend, redundant)
  - `track-mcp-map.tsv`: `railway-mcp-server` 패턴에서 `csr-supabase` 제외
  - `setup-harness.sh`: `railway-plugin` / `railway-skills` 조건 → `csr-fastify\|csr-fastapi\|ssr-htmx\|ssr-nextjs\|full`
- `csr-supabase`에 Vercel CLI + Netlify CLI 자동 설치 추가 (Supabase backend + JAMstack frontend hosting)
- `templates/project-claude/csr-supabase.md`: Plugins 섹션 정정

## [v26.21.0] — 2026-04-19

### Added
- README.md / README.ko.md 양쪽에 OSS 표준 readme 섹션:
  - **30-second start** — install + claude + `/uzys:spec` + `/uzys:auto` 한 블록
  - **Why this?** — "Use it when… / Skip it when…" 5-row 비교 표
  - **Example workflow** — csr-fastapi로 노트 앱 만드는 실전 시나리오 (Pre-SPEC 질의 → /uzys:auto → hook 배경)
  - **FAQ** — Linux/WSL, 글로벌 보호, --update, 9 Track, ECC opt-in, contributing, Cursor/Codex 호환, override 8문항
- GitHub Actions CI badge

## [v26.20.0] — 2026-04-18

### Added
- `--with-ecc` / `--with-prune` / `--with-tob` 플래그: ECC/ToB 프롬프트 비대화형 자동 진행 (CI/automation용). `--with-prune`은 `--with-ecc` 자동 활성
- `curl | bash` 환경에서도 `/dev/tty`로 ECC/ToB 프롬프트 인터랙티브 동작 (이전엔 stdin이 pipe라 skip)

### Changed
- ECC/ToB 블록 read에 `< /dev/tty 2>/dev/null` 패턴 적용
- `--help` 출력 cat heredoc로 정리 (가독성)

## [v26.19.0] — 2026-04-18

### Changed
- 디렉토리 구조 OSS 표준 준수 (root 13 → 8 파일):
  - `setup-harness.sh`, `prune-ecc.sh`, `sync-cherrypicks.sh`, `test-harness.sh` → `scripts/`
  - `Reference.md` → `docs/REFERENCE.md`
  - `USAGE.md` → `docs/USAGE.md`
  - `Docs/` → `docs/` (case rename)
- `install.sh` root 유지 (curl 진입점, 사용자 호환 유지)
- 모든 path 참조 일괄 업데이트 (README/CONTRIBUTING/CHANGELOG/CI workflow/scripts 내부)
- `setup-harness.sh`/`test-harness.sh` ROOT 변수 변경: scripts/ 안에서 실행 시 부모를 repo root로 인식

### BREAKING (수동 설치만)
- 수동 명령은 이제 `bash scripts/setup-harness.sh ...` 형태 (이전 `bash setup-harness.sh`)
- `curl | bash` 한 줄 설치는 그대로 작동 — install.sh가 새 경로 호출

## [v26.18.0] — 2026-04-18

### Added
- README.md (영어 first) + README.ko.md (한국어) 분리
- CONTRIBUTING.md, CHANGELOG.md, .github/workflows/test.yml (CI)
- Catch phrase + badges + Track별 설치 단계 (Step 1-3) + 시나리오별 명령

### Changed
- 리포 이름: `uzysClaudeUniversalEnv` → `uzys-claude-harness`
- 디렉토리 cleanup: 124MB backup 삭제, 5 .DS_Store 삭제, 잡파일 정리

## [v26.17.0] — 2026-04-18

### Added
- `docs/REFERENCE.md` — single catalog of all installed assets (Plugins / Skills / MCP / Agents / Cherry-pick / own) with trust tier (✅ official / 🟢 vetted third-party / 🟡 community), per-track applicability, exact install commands
- `README.md` link to docs/REFERENCE.md prominent at top of References section

### Security
- AgentShield CRITICAL 1 + HIGH 2 false positives resolved (`--no-verify` text in git-policy → "hook 검증 우회 플래그", "Goal-backward" in plan-checker → "Outcome-driven")
- `.claude/settings.local.json` untracked + added to `.gitignore`
- `git filter-repo` history rewrite: removed 6 commits referencing `settings.local.json`, anonymized `uzysjung@gmail.com` → `uzysjung@users.noreply.github.com` across all 67 tags + main
- `git config --local user.email` set to noreply (auto-applied to future commits)

## [v26.16.1] — 2026-04-18

### Changed
- `/uzys:plan` skill: added Plan Depth section with 3-tier guidance (Trivial → skip / Standard → milestones / Complex → detailed). Reflects Anthropic best practices "*if you can describe the diff in one sentence, skip the plan*". Stops forcing fine-grained decomposition on Opus-class models.

## [v26.16.0] — 2026-04-18

### Added
- **data Track 5 external skills**: polars + dask (K-Dense), python-resource-management + python-performance-optimization (wshobson), Anthropic data plugin (visualization)
- **CLAUDE.md Project Direction section** — codifies ECC.tools dependency, continuous-learning + Ralph loop autonomy, lean-by-design principles

### Decisions (skipped)
- pandas-pro skill: conflicts with our `polars 우선` policy
- awesome-llm-apps/data-analyst agent: our self-authored data-analyst is deeper (DuckDB+Trino+sklearn+PyTorch+XGBoost+MLflow+PySide6)
- K-Dense seaborn: covered by Anthropic data plugin

## [v26.15.0] — 2026-04-18

### Added
- `scripts/setup-harness.sh` end-of-flow ECC plugin prompt (interactive only, all tracks):
  - Q1: install ECC project-scoped? [y/N]
  - Q2: prune unused items? [y/N]
- `prune-ecc.sh --copy-only` flag (copy without prune)
- prune-ecc.sh now shows DELETED + KEPT file lists (categorized by skills/agents/commands)

## [v26.14.1] — 2026-04-18

### Removed
- `codebase-map.sh` hook (Claude can use Glob/Grep directly — was redundant)
- `change-management.md` Session Protocol section (duplicated CLAUDE.md Context Management)

### Changed
- `/uzys:spec` skill: added Pre-SPEC required questions block — Test Environment Parity (Prod DB, test strategy, external deps) + Critical E2E flows + Design Context (DESIGN.md/.impeccable.md for UI tracks)

## [v26.14.0] — 2026-04-18

### Added
- `setup-harness.sh --update` flag with two cleanup mechanisms:
  - **Orphan prune**: removes files in `.claude/{rules,agents,commands/uzys,hooks}` not present in templates (auto-cleans deprecated stuff in old installs)
  - **Stale hook ref cleanup**: removes `settings.json` hook entries pointing to non-existent files

### Changed
- Rule slim-down 21 → 17 files (~1,800 → 903 lines, -50%)
  - Deleted: `ecc-security-common`, `model-routing`, `seo`, `ecc-performance-common`
  - Compressed: `code-style`, `error-handling`, `git-policy`, `design-workflow`, `gates-taxonomy`, `cli-development`
  - Rationale: only enforce non-obvious project-specific invariants; linter/config files own everything else
- Hook auto-registration 9 → 6 (removed `uncommitted-check.sh`; demoted `spec-drift-check`/`checkpoint-snapshot`/`codebase-map` to on-demand utilities)

## [v26.12.0] — 2026-04-17

### Added
- `templates/track-mcp-map.tsv` — externalized Track→MCP mapping. New MCPs need only a single TSV row, no `scripts/setup-harness.sh` edit
- `docs/research/repo-deep-research-2026-04-17.md` — 5-axis self-research across reviewer agents

### Changed
- `scripts/setup-harness.sh` `.mcp.json` assembly switched from inline case statements to TSV-driven loop with `jq --arg`/`--argjson`

## [v26.11.0] — 2026-04-17

### Added
- Multi-Track install — `--track tooling --track csr-fastapi` (union)
- `--add-track` flag — add a track to an existing install (preserves `.mcp.json`/`.claude/*`)
- Helper functions: `any_track`, `has_dev_track`, `all_executive`

## [v26.10.0] — 2026-04-16

### Changed (BREAKING for old installs)
- ECC plugin replaced by **Track-based cherry-picks** (`.dev-references/cherrypicks.lock`). Existing global ECC users should run `claude plugin uninstall everything-claude-code@everything-claude-code` after migration
- `scripts/prune-ecc.sh` (new) for project-local ECC copy + selective prune (89 user-defined KEEP items)

## Earlier history

Tags v26.0.0 through v26.9.x: foundational work — 6-gate workflow, 11 principles, initial Track set, security hardening, reviewer subagent (SOD), agent-skills integration. See `git log` for details.

[Unreleased]: https://github.com/uzysjung/uzys-claude-harness/compare/v26.35.0...HEAD
[v26.35.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.35.0
[v26.34.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.34.0
[v26.33.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.33.0
[v26.32.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.32.0
[v26.31.1]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.31.1
[v26.31.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.31.0
[v26.30.1]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.30.1
[v26.30.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.30.0
[v26.29.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.29.0
[v26.28.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.28.0
[v26.27.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.27.0
[v26.26.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.26.0
[v26.25.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.25.0
[v26.24.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.24.0
[v26.23.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.23.0
[v26.22.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.22.0
[v26.21.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.21.0
[v26.20.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.20.0
[v26.19.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.19.0
[v26.18.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.18.0
[v26.17.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.17.0
[v26.16.1]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.16.1
[v26.16.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.16.0
[v26.15.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.15.0
[v26.14.1]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.14.1
[v26.14.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.14.0
[v26.12.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.12.0
[v26.11.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.11.0
[v26.10.0]: https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.10.0
