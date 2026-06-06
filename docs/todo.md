# Todo — 현재 목표 & 상태

> **갱신**: 2026-06-06 (재포지셔닝 로드맵 C→A→B→D · ADR-021)
> **목표 anchor**: [`docs/NORTH_STAR.md`](NORTH_STAR.md) (왜·어디로) · **이력**: [`CHANGELOG.md`](../CHANGELOG.md)
> **Foundation(v26.38) 상세 완료 기록**: [`docs/archive/phase1-foundation/`](archive/phase1-foundation/)
>
> 본 파일은 6-Gate 워크플로우 활성 경로 (`gate-check.sh` 존재 확인 + `spec-drift-check.sh` unchecked 파싱).
> `/uzys:plan` 실행 시 새 사이클 내용으로 덮어써진다. 열린 목표는 ship gate drift 를 피하려 비체크박스로 둔다.

---

## 현재 상태 (2026-06-06)

- **버전**: v26.74.0 (main, npm `@uzysjung/claude-harness@26.74.0` 라이브).
- **활성 작업 사이클**: **재포지셔닝 로드맵 C→A→B→D** (deep-research `docs/research/direction-research-2026-06-06.md` + ADR-021). 아래 "열린 목표" 참조.
- **CI 정책**: GitHub Actions 는 릴리스 태그(`v*`) push 시에만 (v26.70.3). 로컬 `npm run ci` 가 1차 게이트.

---

## 완료된 마일스톤 ✅

- [x] **Foundation (v26.38)** — Phase 1~F. bash setup-harness.sh → TypeScript CLI rewrite, 등가성 복원. (상세: `archive/phase1-foundation/`)
- [x] **CLI rewrite 완결 (~v26.55)** — 11 Track × CLI 매트릭스, 외부 자산 32건, Router 분기, 환경 파일, all-in-one wizard, ECC opt-in gating (ADR-015/016).
- [x] **Install UX 재설계 (v26.56~63)** — 5-step 통합 wizard, 카테고리 페이지네이션, 자산 description 보강, 영어 통일.
- [x] **Project-scope default + Global opt-in (v26.64, ADR-020 BREAKING)** — 모든 자산 default project, global 명시 opt-in, install log + `claude-harness uninstall`.
- [x] **Codex / OpenCode / Antigravity 호환 (~v26.70)** — 4번째 CliBase(Antigravity) 포함. AGENTS.md / `.agents/` / `~/.gemini/` 산출. 6-Gate workflow opt-in.
- [x] **코드 품질 (v26.70.1~3)** — 코드리뷰 버그 9건 fix, cleanStaleHookRefs 단순화, GitHub Actions 태그 트리거 전환.
- [x] **검증 Trust Tier + 적극 권장 (v26.71.0, PRD v26-71)** — Trust Tier(official/vetted/experimental, T2=star≥1000) 분류 + Recommended 배지·우선정렬 + experimental opt-in. North Star 세 기둥 ②.

---

## 열린 목표 (재포지셔닝 로드맵 — C → A → B → D)

> 출처: [`docs/research/direction-research-2026-06-06.md`](research/direction-research-2026-06-06.md) (3-에이전트 시장·경쟁·채택 리서치) · 결정: [`docs/decisions/ADR-021`](decisions/ADR-021-repositioning-verified-curation.md) (Proposed)
> **핵심 발견 (3 에이전트 독립 수렴)**: "4-CLI 설치(installer)" 명제 절반은 commoditized — Vercel skills.sh(21.5k★/70+에이전트)·rulesync(1.1k★/25+도구)·MS APM + Claude Code/Codex 1st-party 마켓플레이스. 방어 wedge = **보안·신뢰 큐레이션** (Snyk ToxicSkills 36% prompt injection / 마켓 8개 과부하). 보유 무기 = Docker 실-바이너리 검증(CLAUDE.md) → 경쟁사 *정적* 표과 달리 *지속 테스트* 호환·보안 매트릭스.
> **방향 (사용자 결정 2026-06-06)**: C(저노력 검증) → A(보안 wedge 빌드) → B(표준 채택 자세) → D(분기).
> **outward-facing 주의**: C 의 등재/PR 제출/포스팅은 사용자 GitHub·계정으로 — 에이전트는 **초안·내부 파일만** 준비. 실 게시는 사용자 확인 후.

### C — 발견 채널 등재 + HITO 실측 (지금, Phase 3 진입 — N=1 탈출)
- **C-1** Claude Code 마켓플레이스 등재 — `.claude-plugin/marketplace.json` + README 한 줄 소개·데모 자리 (에이전트 작성 → Docker 격리로 native 인식 검증)
- **C-2** awesome-list 등재 PR 초안 ×3~4 — awesome-claude-code(46k★)/awesome-agent-skills/awesome-claude-skills/awesome-cursorrules (에이전트 diff·본문 초안, 사용자 제출)
- **C-3** README 30초 데모(GIF/asciinema) + 한 줄 가치 소개
- **C-4** Show HN + r/ClaudeCode Showcase 글 초안 (에이전트 초안, 사용자 게시)
- **C-측정** 설치 사용자 HITO 측정 — #138 fresh-dogfood 키트(`scripts/fresh-dogfood-setup.sh` + protocol) 연결

### A — 보안·호환 매트릭스 공개 artifact (방어 wedge 빌드)
- **A-1** agentshield 자산 스캔 — 33 외부 자산(skill/plugin)에 prompt-injection/보안 스캔 적용 (NSM: Asset Security Pass Rate 100%)
- **A-2** 자산×CLI 호환 매트릭스 자동 생성 — Docker 실행 결과 기반 (정적 표 아닌 지속 테스트)
- **A-3** `docs/COMPATIBILITY.md` 공개 + README 배지 자동 갱신

### B — 표준 채택 자세 (원칙, 산출물 적음)
- path 번역 재구현 금지(=skills.sh 중복). AGENTS.md/SKILL.md native emit, tool 통합은 MCP(`.mcp.json`) 위임. 신규 CLI/자산 추가 시 적용.

### D — 분기 (C 실데이터 후 결정, 지금 미결)
- 외부 사용자가 installer를 native/skills.sh와 중복으로 판단 시 → 큐레이션+보안 content 레이어 피벗 또는 upstream 기여.

### 보류/잔여 (Phase 3 의존 또는 저가치)
- **P2-01**(fresh-dogfood HITO 키트 #138 보존) · **A3**(권장 수락률): C로 외부 사용자 확보 시 재개 (N=1 의존 해소)
- **P2-02** Step2 (per-feature NSM, C 외부 baseline 후) · **E2** branch-protection 재정의 · **P2-04** dep bump(저가치)

### 완료된 Phase 2 작업 (이력)
- **C2** fresh-env 설치 매트릭스 CI ✅ (v26.72.0, `install-matrix.yml`) · **P2-NPM** npm publish ✅ (v26.72.1, `@uzysjung/claude-harness` 라이브)
- **B2+B1** 4-CLI 실환경 Docker 검증 ✅ (v26.73.0) · **A1** Trust Tier star-drift CI ✅ (`trust-tier-drift.yml`) · **A2** 자산 Promise audit ✅ (v26.74.0)

---

## 완료 조건 (현 사이클)

재포지셔닝 로드맵은 비체크박스(ship gate drift 회피). C-1 부터 순차 착수. 각 단계 완료 시 본 파일 갱신.
