# ADR-031: 4-CLI cliSupport 데이터축 — derive 기반 도달 범위 필터 (Batch3)

- Status: Accepted
- Date: 2026-07-17
- PR: (fix/cli-support-data-axis)
- Supersedes: 없음

## Context

2026-07-14 하네스 감사 P0 2건 (둘 다 `✓CONFIRMED`, SSOT `docs/plans/harness-audit-2026-07-14.md`):

1. **[4cli-asymmetry-cluster]** — plugin 자산(26종, 카탈로그의 ~43%)이 비-claude CLI 미도달인데
   `installPlugin`(external-installer.ts)이 `claude plugin marketplace/install` 을 하드코딩 spawn
   하고, `installOne`/`runExternalPhase`/`filterApplicableAssets` 어느 레이어도 CLI 축을 참조하지
   않았다. 결과: **codex 단독 설치에서도 claude CLI 가 실행돼 `~/.claude/plugins` 를 오염** —
   프로젝트 룰 "무동의 글로벌 write 금지" 위반이자 Cross-CLI Parity/Promise=Implementation 위반.
2. **[cli-external-path-untested]** — 위 경로 테스트 0건. installer-cli-matrix.test 7조합 전부
   `runExternal=null` 로 스킵 → branches 88 게이트로도 잡히지 않았다.

사용자 확정(2026-07-14 결정표): **"데이터축(cliSupport) + 고지 = 정직화"**. 대칭 실현(plugin 의
codex 등가 설치, L)은 M4+ 유지. 실행 재개 = 사용자 "다음진행해" (2026-07-17).

## Decision

**도달 범위를 entry 필드가 아니라 `assetCliSupport(asset)` 함수로 method.kind 에서 derive 한다.**

- 도달 범위의 SSOT 는 `installOne` 의 실동작이다: `plugin` 은 claude CLI spawn, `shell-script`
  (ecc-prune)는 `.claude/local-plugins/` write → **claude 전용**. `skill` 은 skills CLI
  `--agent` 매핑으로 선택 CLI 전부 설치, `npm`/`npx-run` 은 프로젝트 레벨(CLI 무관), `internal`
  은 Phase 1 manifest/transform 이 CLI 별 렌더 → **전 CLI**. 같은 사실을 61개 entry 필드로 중복
  기입하면 kind ↔ 필드 drift 가 가능해진다 (no-false-ship "동일 목록 2곳 하드코딩 금지").
- **spawn 배제 지점 = `runExternalInstall`**: 선택 CLI 와 교집합 없는 자산(`assetReachesCli`)은
  시도 자체가 없다 — P0 오염 경로의 구조적 차단. `cli: []` 는 레거시 관례(buildSkillArgs 의
  "미지정 = 전체")대로 무필터.
- **침묵 제외 금지**: 배제분은 `ExternalInstallReport.excludedByCli` **필수 필드**로 보고(누락 =
  컴파일 에러, tier 필드 전례) → install-render 가
  `⊘ N claude-only asset(s) skipped for [codex]: <ids>` 고지. `External assets (N)` 헤더 카운트도
  실제 시도 목록과 정합(internal + 도달 불가 제외).
- **COMPATIBILITY CLI 열 derive**: gen-compatibility 의 수동 `CLI_SCOPE` 맵 제거 —
  `assetCliSupport` re-export(trust-tier-drift barrel) 에서 도달 범위를 derive, `KIND_FLAVOR` 는
  설치 메커니즘 표기(표현 계층)만. skill 의 "Claude Code (+skills.sh)" 과소 표기(실동작 =
  `--agent` 4-CLI)를 정직화.
- **게이트**: `tests/cli-external-path.test.ts` (+7, RED 실증 — assetCliSupport 부재로 6 fail
  확인 후 구현). 핵심 불변식 = "codex 단독 설치는 `claude` 를 절대 spawn 하지 않는다".

## Alternatives

- **`ExternalAsset.cliSupport` entry 필드** (감사 원제안) — 기각. 61 entry 전수 기입 = method.kind
  가 이미 결정하는 사실의 2번째 하드코딩. tier 필드의 "entry 통합" 전례는 tier 가 자산 고유
  속성(별점·유지보수)이라 derive 불가한 경우 — 도달 범위는 설치 코드가 결정하므로 반대 케이스.
  per-asset 예외가 생기면 그때 optional override 필드 추가 (Rule 2 — 현재 예외 0).
- **`filterApplicableAssets` 에 CLI 축 통합** (감사 표현 "filterApplicable 교집합") — 기각.
  해당 함수는 조건(track/opt-in) 축으로 wizard·보고 등 CLI 무관 문맥에서도 쓰인다. 교집합은
  spawn 직전 레이어(runExternalInstall)가 정위치 — 조건 통과분과 도달 배제분을 분리 보고할 수
  있는 유일한 지점이기도 하다.
- **wizard 단계에서 claude-only 자산 숨김** — 기각(스코프 외). 사용자 결정은 "고지 = 정직화"
  까지. 숨김은 선택권 제거이고, 표시+제외 고지가 no-false-ship 요건을 충족한다.
- **plugin 의 비-claude 등가 설치(대칭 실현)** — 기각(사용자 결정: M4+ 로 유지, 크기 L).

## Consequences

- **긍정**: codex/opencode/antigravity 단독 설치의 호스트 오염 구조적 소멸. "4-CLI 지원" 광고와
  실동작의 어긋남이 3표면(설치 동작·설치 리포트·COMPATIBILITY 표)에서 동시 정직화. 신규 자산이
  어떤 kind 로 추가돼도 도달 범위가 자동 판정 — 필드 기입 누락이라는 실패 모드 자체가 없다.
- **부정/리스크**:
  - (a) kind 단위 derive 는 **개별 자산의 예외를 표현 못 함** — 예: 미래에 claude 전용 skill 이
    생기면 과대 표기된다. 그 시점에 optional override 필드 추가 필요 (현재 해당 자산 0, 테스트가
    전수 검증).
  - (b) `excludedByCli` 필수 필드화로 이 타입을 만드는 모든 코드/테스트가 갱신됨(5 파일) —
    의도된 fail-loud. 외부 소비자는 없음(내부 타입).
  - (c) 실 CLI 바이너리로의 e2e(코드 아닌 실환경)는 본 릴리즈 미검증 — 단위/통합 게이트로
    spawn 인자를 검증했고, Docker 실검증은 install-matrix 태그 워크플로우가 커버.
  - (d) 감사 항목 ④(SSOT 수치 derive 가드)는 Batch2(#199) `docs-supply-chain.test.ts` 총계
    게이트로 기충족 — 본 릴리즈 무변경.
- **Batch3 완료 → M2 게시가 다음 관문** (사용자 결정 2026-07-14: "P0 처리 후 이번 주기 게시",
  제출 클릭 = 사용자).
