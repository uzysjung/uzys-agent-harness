# ADR-031: 4-CLI cliSupport 데이터축 — derive 기반 도달 범위 필터 (Batch3)

- Status: Accepted
- Date: 2026-07-17
- PR: (fix/cli-support-data-axis)
- Supersedes: 없음

## Context

2026-07-14 하네스 감사 P0 2건 (둘 다 `✓CONFIRMED`, SSOT `docs/plans/harness-audit-2026-07-14.md`):

1. **[4cli-asymmetry-cluster]** — claude 전용 자산(plugin 25 + shell-script 1 = 26종, 카탈로그의
   ~43%)이 비-claude CLI 미도달인데
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

- **`ExternalAsset.cliSupport` 전수 필수 필드** (감사 원제안) — 기각. 61 entry 전수 기입 =
  method.kind 가 이미 결정하는 사실의 2번째 하드코딩. tier 필드의 "entry 통합" 전례는 tier 가
  자산 고유 속성(별점·유지보수)이라 derive 불가한 경우 — 도달 범위는 설치 코드가 결정하므로
  반대 케이스. **채택된 최종형 = derive 기본 + optional `cliSupportOverride`**: 초안은 "현재
  예외 0" 을 근거로 override 도입을 유예했으나 SOD 리뷰 Critical-1 이 **bmad-method 가 이미 그
  예외**임을 실측 반증(`--tools claude-code` 하드코딩, Docker 실검증 기록
  realcli-workflows-2026-06-06 이 `.claude` 산출물 명시) → override 를 즉시 도입하고, 신규
  자산의 동일 함정은 "method 인자 claude 토큰 → override 강제" 전수 테스트가 차단.
- **`filterApplicableAssets` 에 CLI 축 통합** (감사 표현 "filterApplicable 교집합") — 기각.
  해당 함수는 조건(track/opt-in) 축으로 wizard·보고 등 CLI 무관 문맥에서도 쓰인다. 교집합은
  spawn 직전 레이어(runExternalInstall)가 정위치 — 조건 통과분과 도달 배제분을 분리 보고할 수
  있는 유일한 지점이기도 하다.
- **wizard 단계에서 claude-only 자산 숨김** — 기각(스코프 외). 사용자 결정은 "고지 = 정직화"
  까지. 숨김은 선택권 제거이고, 표시+제외 고지가 no-false-ship 요건을 충족한다.
- **plugin 의 비-claude 등가 설치(대칭 실현)** — 기각(사용자 결정: M4+ 로 유지, 크기 L).

## Consequences

- **긍정**: codex/opencode/antigravity 단독 설치의 호스트 오염 구조적 소멸(uninstall 의 동일
  경로 포함 — SOD 리뷰 SAFE-B). "4-CLI 지원" 광고와 실동작의 어긋남이 5표면(설치 동작·Phase 2
  고지·Summary EXCLUDED·wizard/헤더 ASSETS 분해·COMPATIBILITY 표)에서 동시 정직화. 신규 자산이
  어떤 kind 로 추가돼도 도달 범위가 자동 판정되고, kind 기본값이 거짓인 자산은 claude-토큰
  전수 테스트가 override 기입을 강제.
- **SOD 리뷰 반영 (독립 2기: 5축 코드 + 회귀 헌팅, 2026-07-17)** — 채택 20건. 주요:
  ①**Critical-1** bmad `--tools claude-code` 가 "npx-run=전 CLI" derive 를 반증 → override 도입
  (위 Alternatives) ②재생성 COMPATIBILITY.md 가 커밋에서 누락된 채 "정직화 완료" 를 주장할 뻔
  (F6) → 같은 커밋에 포함 + CLI 열 전수 derive 게이트 신설 ③고지 렌더 커버리지 0 (F5) → 렌더
  실행 증거 테스트 4건 ④배제 로직 2파일 중복(Important-6) → `selectExternalTargets` 단일화
  ⑤구 NOTE(v26.88.0)와 신규 고지의 이중·불일치 출력(F4) → NOTE 삭제, SSOT=excludedByCli
  ⑥ecc 힌트가 codex 단독에서 no-op 명령 권고(F2) → claude 도달 시에만 ⑦`ASSETS N selected`
  약속-실설치 불일치(F3) → 도달 분해 병기 ⑧헤더 카운트가 internal 포함으로 **기본 경로에서도
  과대**였음을 실측(F1, v26.81.0 잔재) — 정정을 릴리즈 노트에 명시 ⑨"claude-only" 문자열
  하드코딩 → 사유를 자산별 support 에서 derive ⑩매직넘버 4 / 공유 배열 반환 / 항상참 가드 /
  tauri caveat 주석 소실 등 Nit 정리. **미채택 2건(사유)**: dead `formatSkippedReport` 제거
  (기존 P2 dead-hooks 후속과 병합 — 본 PR 스코프 밖), docker 시나리오 stale `--with
  uzys-harness`(ADR-022 잔재, 본 커밋 무관 — 후속 정리 대상으로 기록).
- **부정/리스크**:
  - (a) kind 단위 derive 의 개별 예외는 override 로 표현하나, **override 기입 자체는 사람의
    판단** — 자동 가드는 method 인자의 claude 토큰 패턴만 검사한다. 토큰이 없는 방식으로 특정
    CLI 전용이 되는 자산(예: 미래의 claude 전용 skill)은 여전히 리뷰가 잡아야 한다.
  - (a') `internal` 의 "전 CLI" 는 spawn 경로 기준 — tauri-desktop 처럼 산출물이 claude 편중인
    internal 자산의 문서 라벨("4-CLI (templates)")은 기존과 동일한 **알려진 과대 표기**로 유지
    (구 CLI_SCOPE 주석 승계, SOD F11 — internal 은 Phase 1 transform 담당이라 본 축의 스코프 밖).
  - (b) `excludedByCli` 필수 필드화로 이 타입을 만드는 모든 코드/테스트가 갱신됨(5 파일) —
    의도된 fail-loud. 외부 소비자는 없음(내부 타입).
  - (c) 실 CLI 바이너리로의 e2e(코드 아닌 실환경)는 본 릴리즈 미검증 — 단위/통합 게이트로
    spawn 인자·렌더 문자열을 검증했고, Docker 실검증은 install-matrix 태그 워크플로우가 커버.
  - (d) 감사 항목 ④(SSOT 수치 derive 가드)는 Batch2(#199) `docs-supply-chain.test.ts` 총계
    게이트로 기충족 — 본 릴리즈는 CLI 열 게이트만 추가.
- **Batch3 완료 → M2 게시가 다음 관문** (사용자 결정 2026-07-14: "P0 처리 후 이번 주기 게시",
  제출 클릭 = 사용자).
