# Plan — Code Quality Cycle (v26.78.1 hotfix → 카탈로그 SSOT → 보안 pinning)

> **작성**: 2026-06-11 · **기준 커밋**: `e0742b4` (v26.78.0)
> **출처**: code-review-and-quality 5축 리뷰 (2026-06-11, code-reviewer 에이전트 + 직접 검증)
> **목표 anchor**: [`docs/NORTH_STAR.md`](../NORTH_STAR.md) — Promise=Implementation 100% · Transparent Defaults · 보안 wedge(ADR-021)
> **할 일**: [`code-quality-cycle-todo.md`](code-quality-cycle-todo.md)
>
> ⚠️ 본 문서의 `file:line` 은 `e0742b4` 시점 캡처. 구현 시 반드시 해당 파일을 Read 후 재확인.

---

## 배경 (왜 이 사이클인가)

v26.78.0 전체 리뷰 결과, **데이터 레이어(자산 매트릭스·tier·테스트)는 견고하나, 렌더/UI 레이어가 데이터 레이어 대비 drift** 하는 결함 클래스가 지배적. 같은 silent-drop 버그가 3곳에서 반복 발생 (gen-compatibility v26.78.0 fix → wizard pages 미발견 출하). 주석 경고로는 못 막는다는 것이 증명됨 → **구조적으로 drift 를 불가능하게** 만드는 것이 본 사이클의 핵심.

**출하된 거짓 광고 (Critical, 최우선)**: v26.78.0 의 `understanding` 카테고리가 wizard 페이지 하드코딩에서 누락 — 신규 자산 3종(claude-video/understand-anything/agentmemory)이 **wizard 에서 선택 불가** (`--with-*` 플래그만 작동), `agent-browser` 는 **화면에 안 보인 채 설치됨** (Transparent Defaults 위반).

---

## 표준 제약 (모든 Phase 공통 — DO NOT VIOLATE)

1. **실 CLI 설치 검증은 Docker 격리 컨테이너에서만** — `.claude/hooks/docker-only-realcli.sh` 가 호스트 실행을 차단. 호스트 글로벌(`~/.claude/` 등, npm -g) write 금지.
2. **버전 컨벤션**: Major = year−2000 (2026 = v26.x). Patch = bug fix only, 그 외 = Minor.
3. **1차 게이트 = 로컬 `npm run ci`** (typecheck + lint + test:coverage + build). `npm test` 만으로는 coverage gate(branches 88) 누락. GitHub Actions 는 `v*` 태그 push 시에만.
4. **git**: feature branch + PR 의무. 머지는 사용자 명시 동의. `--force`/`reset --hard` 금지. 태그 후 `gh run watch <id> --exit-status` 단발 확인 (wait loop 금지).
5. **Surgical changes** — 각 Phase 의 명시 범위 밖 코드 미수정.

---

## Phase H — v26.78.1 hotfix (P0, patch) ← 최우선

**범위**: 출하된 버그 3건(C1/R1/R2)만. 리팩터링 없음 (patch = bug fix only).

### H-1. C1: wizard `understanding` 카테고리 누락 (Critical)

- **위치**: `src/prompts.ts:248-255` — `pages` 배열이 7개 카테고리만 하드코딩 (`frontend, backend, dev-tools, data` / `business` / `workflow, ecc-suite`). `src/categories.ts` 의 8번째 `understanding` 누락.
- **Fix**: `understanding` 을 페이지에 추가. 배치는 Page 1 (Dev domain) 권장 — 단, **페이지당 옵션 수 ≤ ~30 제한** (코드 주석 v26.62.2 참조) 확인 후 초과 시 Page 3 또는 별도 배치. label 도 갱신.
- **구조 가드 (동일 클래스 재발 영구 차단)**: 모듈 init 시 exhaustiveness 검증 — `pages` 의 cats 합집합 ≠ `CATEGORIES` 전체면 **throw**. (값싼 pre-flight, 누락 시 즉시 fail-loud)
- **테스트**: `prompts.ts` 는 coverage 제외지만 **import 는 가능** — 모든 `Category` 가 정확히 한 페이지에 등장함을 단언하는 단위 테스트 추가 (`tests/` 에 wizard-parity 테스트).

### H-2. R1: `--with-karpathy-hook` 실패 무음 (Rule 12 위반)

- **위치**: `src/installer.ts:484-541` 이 `KarpathyHookReport`(실패 사유 포함) 생성하나, `src/commands/install.ts` 렌더러가 `report.karpathyHook` 을 전혀 읽지 않음 → 실패해도 "Install complete".
- **Fix**: executeSpec Summary 에 1행 렌더 — `✓ karpathy hook wired` / `⊘ karpathy hook skipped (<reason>)`.

### H-3. R2: antigravity 출력 invisible

- **위치**: `src/commands/install.ts:409-500` — artifacts 섹션이 `codex || opencode` 만 gate, `report.antigravity`/`antigravityOptIn` 미렌더. Summary CLI 행(:492-499)이 claude/codex/opencode 조합만 열거 → `--cli antigravity` 가 `CLI Claude` 로 출력. `--cli` help 텍스트(:866)도 antigravity 누락.
- **Fix**: Summary CLI 행을 pairwise if-chain 대신 `spec.cli` 배열에서 derive. antigravity 산출물 행(rulesFile/skills/workflows) 렌더. help 문자열 수정.

### Phase H 검증 (AC)

- [ ] `npm run ci` exit 0
- [ ] wizard-parity 단위 테스트: 8 카테고리 전부 페이지에 1회 등장 PASS
- [ ] `node dist/index.js install --help` 출력에 antigravity 포함
- [ ] Docker 시나리오 (기존 `test/docker/scenarios/` 패턴): `--cli antigravity` 설치 출력에 antigravity 행 표시 확인 (wizard 는 interactive 라 단위 테스트로 갈음)
- [ ] 태그 `v26.78.1` → `gh run watch` green (publish/ci/install-matrix)

---

## Phase S — 카탈로그 SSOT 화 (P1a, v26.79.0 minor)

**목표**: "N곳을 기억해서 동기화" → "컴파일러/derivation 이 drift 를 불가능하게".

### S-1. `TRUST_TIER` 병렬 Record 제거

- **현황**: `src/external-assets.ts` 의 `TRUST_TIER` 는 id 키 병렬 Record. 테스트는 누락만 검사, **stale(좀비 키)은 미검사** (v26.76.0 content-creator 제거 시 전례).
- **Fix**: `ExternalAsset` 인터페이스에 `tier: TrustTier` 필수 필드 추가 → 41개 entry 에 값 이동 → 기존 소비자(`shouldInstallAsset` :750 부근, gen-compatibility, trust-tier-drift)를 위해 `export const TRUST_TIER = Object.fromEntries(EXTERNAL_ASSETS.map(a => [a.id, a.tier]))` derive. 누락·stale 양쪽 구조적 불가능. 800줄 cap 위반(:805줄)도 해소됨.

### S-2. gen-compatibility 카테고리 하드코딩 제거

- **현황**: `scripts/gen-compatibility.mjs:40-61` 이 `CATEGORY_TITLE`+`CAT_ORDER` 복제 (경고 주석만 존재 — 이미 1회 실패한 방식).
- **Fix**: `src/trust-tier-drift.ts:19` 가 이미 스크립트용 카탈로그 re-export 패턴 보유 — 동일 패턴으로 `CATEGORIES`/`CATEGORY_TITLES` re-export 추가, 스크립트는 그것을 순회. 로컬 복제 삭제. **스크립트의 기존 import 방식(dist 경유 여부)을 먼저 확인하고 따를 것.**

### S-3. R3: 죽은 `failureMode`/`aborted` 메커니즘 삭제

- **현황**: `src/external-installer.ts:144-153` abort 경로 — `EXTERNAL_ASSETS` 에 `failureMode` 설정 자산 0개 + 도달해도 렌더러가 `aborted` 를 안 읽음. Rule 2 (speculative 금지).
- **Fix**: 필드 + 분기 + 관련 테스트 삭제. (대안인 "렌더 추가"는 사용처 0 이므로 기각)

### S-4. (동승 소형 정리 — 선택)

- `external-assets.ts` `EMPTY_USER_OVERRIDE` dead export 삭제 (참조 0 — 삭제 전 grep 재확인)
- `external-installer.ts:403` `formatSkippedReport` 프로덕션 미사용 — 삭제 또는 렌더러 연결 중 택1
- marketplace-add 실패 stderr 를 install 단계 실패 메시지에 포함 (`external-installer.ts:280-284`)

### Phase S 검증 (AC)

- [ ] `npm run ci` exit 0 (TRUST_TIER 일방향 테스트는 삭제, derivation 으로 대체)
- [ ] `node scripts/gen-compatibility.mjs` 산출 `docs/COMPATIBILITY.md` 가 기존과 동일 내용 (diff 검증 — 카테고리/자산 누락 0)
- [ ] 신규 카테고리를 일부러 추가했다 빼는 스모크: prompts 가드 throw + gen-compatibility 자동 반영 확인 (수동 1회)

---

## Phase P — 자산 버전 pinning (P1b, v26.80.0 minor) — 보안 wedge 실체화

**근거**: injection 자체는 깨끗 (spawnSync arg array, shell 미사용, 입력 검증 OK), tier 도 코드 강제 OK. 그러나 vetting 은 **시점 검증**인데 `npx ...@latest` 는 **미래 코드 실행** — "지속 검증되는 큐레이션" 주장(ADR-021)과 정면 모순. hijacked vetted repo 가 사용자에게 직행하는 구멍.

- **P-1**: `external-assets.ts` 의 `@latest` 전수 제거 — `bmad-method@latest`(:303 부근), `get-shit-done-cc@latest`(:666 부근) + npm 자산(vercel/supabase 등) 버전 고정. 고정 버전은 구현 시점 latest 를 Docker 시나리오로 검증 후 채택.
- **P-2**: 테스트 추가 — `EXTERNAL_ASSETS` 내 npm/npx-run method 에 `@latest`/버전 미지정 금지 단언.
- **P-3**: `docs/COMPATIBILITY.md` 에 pinned 버전 + bump 정책 명시 (기존 A2 자산 audit 주기에 bump 포함). 잔여 리스크(plugin/skill 류는 pin 불가) 명시.
- **P-4 (보류 — 별도 결정)**: `claude-harness.lock` (버전+무결성 해시) — novel 툴링이므로 본 Phase 에서 안 함. ADR 후보로만 기록.

### Phase P 검증 (AC)

- [ ] `grep -c "@latest" src/external-assets.ts` = 0
- [ ] Docker 시나리오: pinned 버전으로 openspec/bmad 설치 PASS (기존 `scenario-workflow-scope.sh` 재실행)
- [ ] `npm run ci` exit 0

---

## Phase O — OptionFlags 점진 폐기 (P2a, ADR-022 필요 — **사용자 승인 게이트**)

**현황**: 19 boolean 중 11개가 자산 id 와 1:1 (withGsd/withEcc/withTob/withSuperpowers/withAddyAgentSkills/withWshobsonAgents/withOpenspec/withBmad/withClaudeVideo/withUnderstandAnything/withAgentmemory). 자산 1개 추가 = 프로덕션 ~8곳 + 테스트 10+ 파일 수정. 대체 메커니즘(`userOverride.forceInclude`, v26.47.0)은 이미 존재·테스트됨.

- **O-1**: **즉시 규칙 (코드 변경 0)** — "신규 자산에 OptionFlags 추가 금지, `forceInclude` + generic `--with <asset-id>` 사용". 본 plan 머지로 발효.
- **O-2**: ADR-022 작성 (Proposed) — 기존 11 flag 를 forceInclude alias 로 전환 + deprecation window. CLI surface 영향 → **Major CR, 사용자 결정 필수.**
- **O-3**: ADR Accepted 후 구현. 실 행동 flag (withTauri/withUzysHarness/withKarpathyHook/withCodex*/withAntigravityGlobal/withPrune) 는 OptionFlags 유지.
- **(독립 소형)** S3 정리: `interactive.ts:39-62` toOptionFlags / `commands/install.ts:221-244` spec build / `:773-792` formatOptions 를 `DEFAULT_OPTIONS` 키 순회로 collapse — ADR 없이 가능, Phase S 에 동승 가능.

---

## Phase R — `commands/install.ts` 렌더러 분리 (P2b, 인접 minor 에 동승 가능)

- **현황**: `commands/install.ts` 955줄 (자체 cap 800 초과 — repo 내 최대 위반), `runInstall` ~260줄 (cap 50). `installer.ts:341-396` per-CLI transform 블록, `:234-261` update-mode 20-field empty literal.
- **Fix**: 렌더러(`renderPhase1Rows`/artifact renderers)를 `src/commands/install-render.ts` 로 추출. 동작 변경 0, 테스트 그대로 green. S6 중복(interactive.ts formatSummary ↔ install.ts computeFinalAssets 의 recommended+override merge)도 `preset-recommend.ts` 로 단일화 (v26.62.4 주석이 이미 통합 위치로 지목).

---

## 실행 순서 & 버전 매핑

| 순서 | Phase | 버전 | 게이트 |
|------|-------|------|--------|
| 1 | **H** (hotfix C1+R1+R2) | v26.78.1 (patch) | npm run ci → PR → 사용자 머지 동의 → 태그 |
| 2 | **S** (SSOT + R3) | v26.79.0 | 동일 + COMPATIBILITY diff 검증 |
| 3 | **P** (pinning) | v26.80.0 | 동일 + Docker 시나리오 |
| 4 | **O** (flags) | ADR-022 → 승인 후 v26.81.0 | **사용자 결정 대기** |
| 5 | **R** (렌더 분리) | 인접 minor 동승 또는 단독 | npm run ci |

각 Phase = 독립 feature branch + PR. Phase 간 의존: H 는 독립, S-2 가드는 H-1 가드 위에 누적, P/O/R 은 S 이후 권장 (충돌 최소화).

## 명시적 Non-Goals

- `claude-harness.lock` 무결성 해시 (P-4 — ADR 후보로만)
- 자산-소스 보안 스캐너 신규 개발 (todo.md A-1 보류 결정 유지)
- wizard TUI 개편 / 페이지네이션 재설계
- C 채널 등재 제출 (사용자 outward 액션 — 에이전트는 초안만, 기존 kit `docs/research/adoption-c2-submission-kit.md` 완료 상태)
