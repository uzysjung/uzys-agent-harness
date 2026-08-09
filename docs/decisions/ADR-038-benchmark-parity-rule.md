# ADR-038: benchmark-parity 룰 — 레퍼런스 실측→gap.md→완결성 루프 (라이프사이클 자산화 ③)

- Status: Superseded (ADR-067 — 배포 룰에서 제거, 2026-08-04)
- Date: 2026-07-18
- PR: #222
- Context: 라이프사이클 자산화 큐 ③ (SSOT `docs/plans/lifecycle-codification-2026-07-18.md`).
  사용자 지시(2026-07-18) "실제 브라우저 실검증 … 이 부분들이 지켜지는 것이 하네스다"의 벤치마크
  파트. 실무 증거 = GoalTrack `.claude/rules/benchmark-parity.md` 실운영 + `docs/research/`
  audit 디렉토리 20회 내외(gap.md 다수, CRITICAL→fix PR→`[x] #번호` 라이프사이클 실증). 하네스에는
  capture 수단 룰(playwright-launch)만 있고 "무엇을 왜 실측해 어떻게 추적하나"의 워크플로우 룰이
  없었다 — capture 는 하는데 갭이 문서 없이 휘발되는 갭.
- Decision:
  1. **`templates/rules/benchmark-parity.md` 신설, `UI_RULES` 배선** (csr-*/ssr-*/full 자동 설치).
     capture 수단의 SSOT 인 playwright-launch 와 항상 짝으로 설치된다 — 본 룰은 수단을 재규정하지
     않고 cross-ref 만 한다 (중복 신설 금지 원칙).
  2. **내용 = GT 룰의 도메인 중립 일반화**: 벤치마크 정의 표(프로젝트별 fill-in, NORTH_STAR 핵심
     경쟁력 매핑) · capture→핵심 기능→완결성→발전 루프 · gap.md 표 스키마(ID·항목·Severity·
     근본원인·증거·수정안·상태) · PR "## Fidelity" 의무 섹션 + CRITICAL/임의-HIGH 잔존 시 머지
     차단 · 자율 루프 완료조건 = 기계검증 프록시만 · 임의 구현 안티패턴. GT 고유 요소(특정 벤치마크
     3종, 우클릭 특화 섹션)는 제외하거나 "(예: ...)" fill-in 예시로만.
  3. **gap.md 스키마는 룰 안에 복붙 스켈레톤으로 내장** — 별도 템플릿 파일/설치 단계 신설 없음.
  4. 카탈로그 카운트 무변경 — 룰은 external-assets 카탈로그가 아닌 manifest 자산 (① doc-governance
     v26.107.0 전례).
- Alternatives:
  - **COMMON_RULES (전 트랙)**: 기각 — 화면 없는 트랙(tooling/data/executive)에 "capture 확보 전
    코드 변경 금지" 같은 실행 불가능한 의무를 부과한다. 비-UI 벤치마킹(CLI 경쟁 제품 등)은 실무
    증거가 없어 코드화 대상이 아니다 (검증한 것만 주장).
  - **별도 gap.md 템플릿 파일 + 전용 설치 단계**: 기각 — ci-scaffold 식 설치 기계를 늘릴 근거
    없음. 스키마는 룰 프로즈에 내장해도 계약이 성립하고, GT 실운영도 그렇게 동작했다 (Rule 2).
  - **스킬로 제작 (dev-method 번들)**: 기각 — 이것은 "호출하는 절차"가 아니라 UI PR 전반에 상시
    적용되는 의무(Pre-flight·머지 차단·PR 필드)다. 상시 의무는 rule, 호출형 절차는 skill 이라는
    기존 경계 유지.
- Consequences:
  - UI 트랙 신규 설치본은 벤치마크 갭이 gap.md 로 추적되고 PR 에 Fidelity 근거가 강제된다.
    "벤치마크 동등" 자처가 capture 증거 없이는 불가 (no-false-ship 의 설치본 판).
  - 룰 강제력은 프로즈 수준 — reviewer cross-check 를 명시했지만 결정론 게이트(훅)는 없다. 규약이
    안 지켜지는 것이 확인되면 recurrence-prevention 에스컬레이션 사다리로 게이트화한다 (①의
    spec-drift 훅 짝과 같은 진화 경로).
  - 벤치마크 정의 표는 fill-in — 채우지 않은 설치본에서는 루프가 공회전한다. 이는 의도된
    트레이드오프 (프로젝트 고유 정보를 하네스가 추정 기재하지 않는다). 발동은 "UI/UX 에 영향하는
    PR" 프로즈 기준 — GT 원본의 경로 패턴 목록은 프로젝트 고유라 일반화에서 제외했다.
  - 도달 범위 = Claude Code 설치본 한정. codex/opencode/antigravity 는 rules 레이어가
    AGENTS.md/`.agents/rules` 임베드(CLAUDE.md 본문)라 본 룰 미도달 — ① doc-governance 와 동일
    조건. 비-claude rules 포팅은 별도 결정 사항 (본 ADR 범위 밖).

## 정정 (v26.138.0)

Decision 1 의 "capture 수단의 SSOT 인 playwright-launch" 는 **작성 시점에는 참이었으나 더 이상
아니다.** v26.138.0 에서 `playwright-launch` 룰을 금지문만 남기고(738 → 220 tok) 절차 · launcher
골격 · 사용 패턴을 `ui-visual-review` 스킬로 옮겼다 — 위반은 작업 도중에 일어나므로 금지문은
상주해야 하지만, 절차는 브라우저를 실제로 띄울 때만 필요하기 때문이다.

**현행**: 금지 = `playwright-launch` 룰 · 절차 = `ui-visual-review` 스킬.

본 ADR 의 나머지 결정(룰 신설 · UI_RULES 배선 · 내용 6종 · gap.md 스켈레톤 내장 · 카탈로그
무변경)은 **전부 유효**하다 — 같은 릴리즈에서 benchmark-parity 에 같은 이관을 시도했다가
**철회**했기 때문이다. 룰은 UI 트랙에 무조건 설치되는데 위임처 스킬은 `--without` 으로 빠져
"게이트만 받고 절차는 못 받는" 설치본이 성립했다(6축 검증이 buildManifest 프로브로 실증).

그래서 Status 는 `Accepted` 를 유지한다 — 결정이 뒤집힌 것이 아니라 인접 룰의 구조가 바뀌어
한 문장의 지시대상이 이동했다. 결정 자체가 바뀌었다면 `change-management` 규약대로 새 ADR 과
`Supersedes:` 가 필요했을 것이다.
