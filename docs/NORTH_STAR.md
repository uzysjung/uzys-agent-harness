# uzys-agent-harness — North Star

> 장기 방향성. PRD/SPEC이 "무엇을 어떻게"를 다루면, 본 문서는 **왜·어디로**를 다룬다.
> 의사결정이 모호할 때 본 문서를 기준으로 우선순위를 판정한다.

---

## 1. North Star Statement

> **"하네스 + 컨텍스트 엔지니어링으로, Claude Code · Codex · OpenCode · Antigravity 에서 사용자가 신속·정확하게 원하는 서비스를 만들 수 있는 환경을 설치해주는 서비스."**

본 프로젝트의 본질 = **설치 서비스 (installer + curator)**. 4개 AI 코딩 CLI 어디서나, 검증된 플러그인·스킬·룰·hook 을 사용자가 **이해하고 선택**해서 한 번에 설치하고, 그 위에서 AI와 사용자가 공유 어휘(하네스 규칙)로 적은 왕복에 빠르게 개발한다.

> **신속** = 적은 왕복 — 어휘가 정확할수록 같은 결과에 재설명이 준다. **정확** = Promise = Implementation (광고한 자산은 100% 실제 작동).

**대상**: 퍼블릭 — 누구나 vibe coder. 시니어/주니어/멀티 역할 무관.

> 이 Statement 를 떠받치는 3개 전략 축과 모듈 매핑은 **§3 Pillars** 참조.

---

## 2. North Star Metric (NSM)

> **프록시 선언**: 진짜 목표인 *"사용자가 원하는 서비스를 신속·정확하게 만들었는가"* 는 사용자
> 프로젝트 안에서 지연되어 발생하므로 이 리포에서 직접 측정할 수 없다. 따라서 **하네스 경제성**을
> 프록시로 최적화한다 — **Context Cost per Install(양: 설치가 상주·발화시키는 토큰)** 과
> **Justified Asset Ratio(사후 품질: 그 토큰이 근거로 정당화되는 비율)** 의 **짝**.
> 근거: 프론티어 모델 시대에 하네스의 한계효용은 "얼마나 많이 주는가"가 아니라 **"모델이 스스로
> 못 하는 것만 남겼는가"**에서 나온다(ADR-032·043). 비용만 재면 굿하트로 붕괴한다 — 자산을 전부
> 빼면 토큰은 0 이 되고 하네스도 사라지므로, 근거율이 "빼고도 쓸모가 남았는가"를 붙잡는다.
> **기능·자산 평가 기준** = "이것이 두 프록시 중 하나를 개선하는가" — NO 면 북극성 이탈 신호.

### 1차 지표 — 하네스 경제성 (lean core, ADR-043)

| Metric | 정의 | 목표 |
|--------|------|------|
| **Context Cost per Install** | 트랙별 **기본 설치**가 물리는 토큰. **상주** = 설치가 상시 컨텍스트에 올리는 전부(rules 전문 · CLAUDE.md · skill/agent descriptor) + **발화** = 트리거 시 들어오는 body. 판정은 표면 열거가 아니라 *상주인가 발화인가* (ADR-044) | 트랙별 baseline 대비 **비증가 ratchet** (증가 시 명시적 정당화). 절대 상한은 실측 후 — 근거 없는 수치 고정 금지 |
| **Justified Asset Ratio** | 기본 설치 자산 중 편익 근거(with/without eval 델타 또는 `operational-fact` 분류)를 **문서로 보유**한 비율 | **100%** (기본 설치 한정 — opt-in 자산은 미요구) |

> **현재 상태 (2026-07-19)**: **상주 + 발화 양축 계측 완료** — `npm run cost:report`.
> 실측(tooling 트랙): **상주 ~5,467 tokens/세션** = rules ~3,340 · CLAUDE.md ~938 ·
> agent descriptors ~615 · skill descriptors ~574. 발화 = 기본 설치 8종 전부 트리거 시 ~26,930.
> (이 4개 수치는 `tests/north-star-cost-figures.test.ts` 가 `npm run cost:report` 산출과 정확히
> 대조한다 — 수기 갱신을 잊으면 CI 가 막는다.)
> **룰이 최대 비용 항목**이라는 사실은 ADR-044 의 범위 정정으로 처음 드러났다 — 그전 정의는
> 상주의 10%만 재고 있었다. **`Justified Asset Ratio` 는 여전히 미구현·미측정**(2단계 eval
> 미실행) — 지표 선언 ≠ 달성. 상주/발화는 **단위가 다르므로** 가중 합산하지 않는다.
> 미계측: 외부 자산 · MCP tool schema. 비대상: hooks(컨텍스트 미탑재).

### 2차 지표 — 속도 · 진입 · 신뢰

> **HITO per Feature 는 2026-07-18 폐기** (ADR-043). 3개월(2026-04-23~07-18) 수집했으나 판정에
> 쓰인 것은 1회(Phase D 종료)뿐이고, 그때 목표 6.7배 초과로 나왔음에도 그 수치로 하네스를 고친
> 사례가 0건이었다. 원인 두 가지: ⓐ 훅이 세는 것은 `prompt_submit` **총계**라 "feature 당"이라는
> 정의와 불일치 — 매번 사람이 구간을 수기로 잘라야 했다 ⓑ 로그가 사용자 로컬에만 남아 **외부
> 사용자 측정이 구조적으로 불가**했다. 죽은 지표를 NSM 에 두면 북극성 자체가 거짓이 된다.
> **Re-clarification Rate 도 같이 폐기** — 측정 방법이 "세션 transcript 수동 sampling(분기 1회)"
> 였고 실제 sampling 기록이 남은 적이 없다. 두 지표가 재던 "소통 효율"은 Statement §1 의 정의로
> 남되, 최적화 대상은 1차 지표로 이관한다.

| Metric | 정의 | 목표 |
|--------|------|------|
| **Time-to-first-Build** | `npx -y github:.../uzys-agent-harness` 실행부터 첫 feature build 완료까지 | **≤ 30분 (p90)** |
| **First-Run Success Rate** | 첫 설치 시도가 사용자 수동 개입 (에러 fix / 누락 파일 / 의존성 추가 install) **0건**으로 종료 | **≥ 95%** |
| **Promise = Implementation** | README/USAGE/SPEC에서 광고된 모든 자산 (skill / plugin / MCP / hook)이 실제 설치·작동 | **100%** (거짓 광고 0건) |
| **Cross-CLI Parity** | Claude Code / Codex / OpenCode / Antigravity 4 CLI 동일 어휘 동등 작동률 (slash 호출 + hook 발화 + skill 인식) | **≥ 95%** |
| **Generated-config Security Pass Rate** | 하네스가 *생성*하는 `.claude/` 산출물이 `agentshield` 게이트에서 CRITICAL/HIGH **0건** (COMPATIBILITY.md §보안). 자산 repo *콘텐츠* 스캔은 미실행 — trust-tier(★≥1000+활성) + Docker install-verification 으로 보완, prompt-injection 콘텐츠 스캔은 로드맵 (ADR-021 차별화 축) | **100% (산출물)** |

> `Session-Start Context Cost`(ADR-032)는 2026-07-18 **1차 `Context Cost per Install` 로 흡수**됐다
> (상주분 = 그 지표의 절반). 같은 사실을 두 곳에 두지 않는다 — doc-governance.

### 측정 방법

- Time-to-first-Build: dogfood 세션 + early adopter 자체 보고
- First-Run Success: GitHub Issues + Discord/email 보고 + dogfood log
- Promise = Implementation: install pipeline E2E test + grep README ↔ manifest cross-check (CI)
- Cross-CLI Parity: `tests/installer-cli-matrix.test.ts` (11 Track × CLI 조합 매트릭스, 4 CLI)
- Generated-config Security: `agentshield` 가 하네스 *산출물*(`.claude/`)을 스캔 (자산 repo 콘텐츠 스캔 아님 — COMPATIBILITY.md §보안) + Docker 실행 호환 매트릭스 자동 생성 (CI → `docs/COMPATIBILITY.md` 공개 artifact, ADR-021 A 단계)
- Context Cost per Install: repo-bundled 템플릿 자산 = frontmatter+body 실측(결정론적 문자열 계측), 외부 자산 = "미측정" 명시 (no-false-ship — 추정치를 실측처럼 표기 금지). 상주분 + SKILL.md body 토큰. 값싼 결정론 계측이라 **전수** 적용 — `npm run cost:report`(`scripts/context-cost-report.mjs`)가 자산별 순위표를 출력한다
- Justified Asset Ratio: 비용 순위 **상위 자산에 한해** with/without eval(`eval-harness` + `skill-creator` baseline 패턴)로 편익 델타 측정. 나머지는 `operational-fact` 분류(모델이 알 수 없는 upstream 사실)로 근거 성립. **미구현**

---

## 3. Pillars (전략 축)

각 축은 North Star 로 가는 단계이며, 모든 모듈은 최소 1개 축에 속한다.

**차별화 축 (2026-07-18 격상 · ADR-043)**: 차별화를 **"계측된 최소 하네스"**로 정의한다 — 주장의 형태가 "우리는 검증된 것을 준다"에서 **"우리는 재봤고, 남길 근거가 있는 것만 준다"**로 바뀐다. 경쟁 지형이 "더 많이"(skills.sh 70+ 에이전트)인 상황에서 대비가 서는 쪽은 규모가 아니라 **자산마다 붙은 숫자**라는 판단(**가설** — 검증 경로 = Phase 3 외부 채택 신호). 아래 ADR-021 의 검증 큐레이션은 폐기가 아니라 **이 축의 하위 수단**으로 존속한다: 출처 검증은 *안전*에, 계측 최소성은 *경제성*에 답한다.

**검증 큐레이션 (2026-06 재포지셔닝 · ADR-021)**: 시장 리서치(`docs/research/direction-research-2026-06-06.md`, 3-에이전트 독립 수렴) 결과 **"설치(installer)" 자체는 commoditized** — Vercel skills.sh(70+ 에이전트)·rulesync·MS APM + Claude Code/Codex 1st-party 마켓플레이스가 이미 cross-CLI 설치를 제공한다. 따라서 **설치는 전달 메커니즘(table-stakes)**으로 재정의하고, 방어 가능한 차별화는 P2 를 **"출처·설치 검증된(source/install-verified) 큐레이션"**으로 격상한 데 둔다 (실제 수단 = trust-tier ★≥1000+활성 + Docker 실설치 검증. **자산 콘텐츠 prompt-injection 스캔은 미실행 — 로드맵**이므로 "보안 감사(security-vetted)"로 표기하지 않는다). 시장 근거: Snyk "ToxicSkills" — 테스트 skill의 36%에서 prompt injection. 보유 무기 = CLAUDE.md Docker 실-바이너리 검증 의무 → 경쟁사의 *정적* 호환표와 달리 *지속 테스트되는* 호환·보안 매트릭스(공개 artifact화 = Phase 3 산출물).

**Lean 개정 (2026-07-17 · ADR-032)**: 프론티어 모델(Opus 4.8 / GPT-5.6급) 상향으로 스킬의 한계효용이 급감했다는 메인테이너 판단(**가설** — 검증 경로는 자산별 with/without eval, ADR-043)에 따라, P1 을 **"루프/하네스 엔지니어링 노하우"**로 전면화하고 P2 는 **규모(quantity)를 줄이되 품질 기준(vetted + Docker 실설치 검증)은 유지**한다. 살아남는 자산 기준 = **인사이트 레이어**(오케스트레이션 노하우 · cross-CLI 활용 · 다중 페르소나 검증)와 **운영 사실**(CLI 플래그·인증 플로우 — 모델 지능과 무관하게 upstream drift). 범용 패턴 가이드류가 1순위 축소 후보. **자산 추가 = 컨텍스트 비용**으로 취급한다. 방법론 워크플로 번들은 opt-in 유지 — 제거 아님(WORKFLOWS.md "언제 방법론 워크플로가 필요 없는가" 조건표 참조).

### Pillar 1 — 하네스 / 루프 엔지니어링 노하우

- **정의**: rules·hooks·skills 가 AI ↔ 사용자의 **공유 어휘이자 통신 프로토콜**이다. AI 단독 자동화가 아니라, 양쪽이 같은 의미로 해석하는 어휘의 정확성이 왕복 수를 줄인다.
- **현재 위치**: `templates/rules/` · `templates/hooks/` · 방법론 스킬(`DEV_METHOD_SKILL_IDS` — 목표/스코프·ADR·결함보고·재발방지·V&V 등) · `src/manifest.ts`(룰·훅 배선) · `src/context-cost.ts`(descriptor 비용 계측).
- **전방 목표**: 라이프사이클 규율의 자산화 잔여분(로드맵 **생성** 전환 등) · 프로즈 규약을 결정론 게이트로 승격하는 사다리 정착.
- **가설**(미검증): 어휘가 정확할수록 동일 결과에 더 적은 왕복/재설명. 검증 경로 = 자산별 with/without eval (ADR-043) — 번들 有/無 동일 과제 비교.

### Pillar 2 — 계측된 최소 큐레이션 (차별화 축 · ADR-043)

- **정의**: "무엇이든 설치"도 "많이 설치"도 아니다. **재보고, 남길 근거가 있는 것만** 준다. 자산마다 비용(상주+발화 토큰)과 편익(eval 델타 또는 `operational-fact` 분류)이 붙고, 설명되지 않으면 drop 또는 opt-in 강등. 출처·역할은 한 줄씩 명시해 사용자가 **이해하고 선택**하며, 권장은 pre-checked 로 어필하되 최종 결정은 사용자.
- **현재 위치**: `src/external-assets.ts`(카탈로그 + trust-tier) · `src/context-cost.ts`(상주 비용 계측) · `src/external-installer.ts` · `src/interactive.ts`·`src/wizard-steps.ts`(선택 UI) · `src/preset-recommend.ts` · `test/docker/`(실설치 검증) · `src/trust-tier-drift.ts` · v26.106.0 전수 축 판정(ADR-035).
- **전방 목표**: ~~① body 토큰 계측 → 비용 순위표~~ ✅ v26.116.0 · ② 상위 비용 자산 with/without eval ③ 재판정 반영(keep/drop/강등) ④ 자산 콘텐츠 prompt-injection 스캔(ADR-021, **미실행**).
- **가설**(미검증): "더 많이"가 표준인 시장에서 **"재보고 줄였다"**가 방어 가능한 대비를 만든다. 검증 경로 = Phase 3 외부 채택 신호. 하위 가설(검증·선택권 → 신뢰)은 trust-tier·Docker 검증으로 실행 중.

### Pillar 3 — 4-CLI 동등성

- **정의**: Claude Code / Codex / OpenCode / Antigravity 어디서나 같은 어휘가 동등 작동. CLI 잠금(lock-in) 없음.
- **현재 위치**: `src/codex/` · `src/opencode/` · `src/antigravity/` · `src/cli-targets.ts` · `tests/installer-cli-matrix.test.ts`.
- **전방 목표**: 비-internal 스킬의 codex/agy 포팅 커버리지 확장(현재 일부 자산은 claude 전용).
- **가설**(미검증): CLI 종속이 없어야 사용자가 도구를 바꿔도 어휘 투자가 보존된다 → 이탈 비용 감소.

### 모듈 ↔ 축 매핑

| 모듈 | 주 축 | 비고 |
|---|---|---|
| `templates/rules`·`templates/hooks`·방법론 스킬 | P1 | 공유 어휘 본체 |
| `src/manifest.ts` | P1 / 공통 | 어휘 배선 + 설치 계획 |
| `src/context-cost.ts` | P1 | 컨텍스트 이코노미 계측 |
| `src/external-assets.ts`·`external-installer.ts`·`trust-tier-drift.ts` | P2 | 카탈로그·검증·설치 |
| `src/interactive.ts`·`wizard-steps.ts`·`preset-recommend.ts` | P2 | 이해하고 선택하는 경로 |
| `src/codex/`·`src/opencode/`·`src/antigravity/`·`cli-targets.ts` | P3 | CLI별 변환·타깃 |
| `src/installer.ts`·`commands/`·`fs-ops.ts`·`state.ts`·`router.ts`·`update-mode.ts` | 공통 | 축을 가로지르는 설치 플랫폼 |
| `env-files.ts`·`settings-merge.ts`·`mcp-merge.ts`·`project-claude-merge.ts` | 공통 | 산출물 병합 인프라 |

> 신규 모듈이 위 축 어디에도 매핑되지 않으면 **착수 전에 북극성 정렬을 재검토**한다 — 매핑 실패 =
> scope creep 의 조기 신호. 로드맵 항목도 정기 리뷰 때 축에 매핑해 "새 축·방향 변경 필요 여부"를
> 판정·기록한다. (Pillars = `northstar-roadmap` 스킬의 *Inputs* 와 동일 개념.)

---

## 4. Strategic Boundaries (방향성 경계)

### 4.1 Will (vibe coding 핵심)

- **공통 어휘 풍부화** — Rule / Hook / Skill 추가 기준: "AI와 사용자가 같은 의미로 해석하는가". 모호하면 거절
- **재설명 제거** — 같은 context를 두 번 묻게 만드는 모든 friction 제거 (CLAUDE.md persistence, decision log, ADR)
- **Promise = Implementation** — README/USAGE/SPEC 광고는 100% 실제 동작. 거짓 광고는 vibe를 가장 빠르게 깨뜨림
- **Public-first** — 처음 보는 사용자가 즉시 같은 어휘로 대화 시작 가능. 한 줄 설치 + 자동 컨텍스트 로드
- **Deterministic Harness** — 게이트/규칙/순서는 hook으로 강제. LLM 판단 의존은 최후 수단
- **Multi-Stack 동등성** — Python REST / Next.js / SSR / 데이터 / 임원 문서 / 순수 CLI 어디서나 같은 하네스 어휘(rules·hooks·skills)가 동등 작동
- **Project-Scope 오염 금지** — 글로벌 `~/.claude/`, `~/.codex/`, `~/.opencode/`, `npm -g` 는 사용자 명시 opt-in (`--scope global` 또는 interactive 에서 Global 선택) 없이는 미수정. Default install scope = Project. (D16, ADR-020)
- **Transparent Defaults** — 설치 중 어떤 자산이 들어가는지 한 줄씩 명시. 숨김 동작 0건
- **검증된 자산 큐레이션 + 선택권** — 후보는 검증된 플러그인/스킬로 한정. 각 자산 출처·역할 명시 → 사용자가 이해하고 선택. "무엇이든 설치" 안 함
- **권장 적극 어필** — 권장 자산은 pre-checked + 설명으로 강하게 제안. 단 강제 아님 — 사용자가 토글로 최종 결정 (Promise=Implementation 유지: 권장 ≠ 거짓 광고)
- **컨텍스트 이코노미 (2026-07-17 · ADR-032)** — 자산 추가 = 컨텍스트 비용. 신규 자산은 descriptor 비용을 의식하고, 기본 설치(pre-checked) 확대는 Session-Start Context Cost ratchet 게이트 통과 필요. "간결"은 슬로건이 아니라 계측 대상

### 4.2 Won't (의도적 비-방향)

scope creep 1차 방어선. "X는 안 한다"를 명시.

- **AI 단독 자동화** — vibe coding은 소통이지 "맡기기" 아님. 인간 결정 게이트(SPEC, Major CR, Ship)는 유지
- **사용자가 외워야 하는 어휘** — 모든 어휘는 skill descriptor / hook 메시지 / 인터랙티브 prompt로 자동 노출
- **범용 Best Practice 강요** — 린터 영역(naming, formatting, import 순서)은 린터에. Rule은 프로젝트 특화 불변식만
- **UI 스킨 / 테마 / 시각 장식** — CLI 출력 색상 수준. gum/whiptail TUI 의존 금지
- **모든 Track에 모든 자산** — 어휘는 맥락별 분리 (UI 어휘는 UI track에만)
- **특정 Stack tied hack** — "Postgres + Next.js만 지원" 같은 단일 스택 가정 금지

### 4.3 Trade-offs (의식적 선택)

| 선택 | 포기한 것 | 근거 |
|------|----------|------|
| Rule 17 / Hook 6 slim-down | 범용 guide 두께 | 어휘는 정확성 > 분량. 린터 가능한 건 린터에. 분기 1회 재평가 |
| ECC cherry-pick + 외부 plugin install | 통합 플러그인 자체 관리 | 상위 커뮤니티 어휘에 위임. sync 자동 drift 감지 + 한 줄 설치로 어휘 자동 등록 |
| `npx` + `prepare` 빌드 | bash + curl 1줄 | 의존성 0 가정 폐기. Node 20+ 전제로 단순화 + 결정론 향상 |
| 11 Track 분리 | 단일 monolith | 어휘 맥락 분리. TSV + helper로 복잡도 관리 |
| 도메인 비종속 generic 템플릿 | 특정 도메인 맞춤 편의 | 누구나 fork. 특정 private repo 참조 제거 |
| Lean 기본값 — 인사이트 스킬 중심, 방법론 번들 비(非)어필 (ADR-032) | 다인 팀 · 규제/감사 · 주니어 온보딩 사용자군에 대한 적극 어필 (opt-in 자가 선택에 위임) | 프론티어 모델 시대 스킬 한계효용 급감(가설) + 컨텍스트 잠식 방지. 해당 사용자군 경로는 WORKFLOWS.md 조건표로 보존 — 인간측 문제(합의·온보딩·감사 추적)는 모델 향상이 풀어주지 않음 |

---

## 5. Phase Roadmap (장기 진화 단계)

### Phase 1 — 어휘 완전성 ✅ 완료 (v26.38, 2026-04-30)

- 목표: **bash setup-harness.sh 등가성 100% 복원**. 약속 = 동작. CLI rewrite (v0.2.0) 시 누락된 외부 자산 32건 + Router 분기 + 환경 파일 모두 복원
- 진입 조건: 본 NORTH_STAR.md 수정 완료 (2026-04-25)
- 성공 조건: Reviewer CRITICAL 4 + HIGH 9 모두 fix. 9 Track install 성공 100%. test 248 → 250+ PASS
- 핵심 산출물: `docs/specs/cli-rewrite-completeness.md`, install pipeline 외부 plugin 호출 통합, Router 3 액션 분기, .env/.gitignore/.mcp-allowlist 자동 생성, Codex opt-in (`~/.codex/skills/`, trust entry)

### Phase 2 — 진입 효율 (Vibe Onboarding) ← 현재

- 목표: **First-Run Success Rate ≥ 95%**. 처음 설치하는 사용자가 첫 실행에서 수동 개입 0건
- 진입 조건: Phase 1 완료 + Promise=Implementation 100% 검증
- 성공 조건: fresh env 5+ (Linux/macOS, Node 20/22, npm/pnpm) 매트릭스에서 첫 실행 성공률 측정
- 핵심 산출물: 다양 환경 매트릭스 CI, GitHub Action E2E install 검증, 사용자 발견 issue 우선 처리 SLA

### Phase 3 — Adoption Signal Loop

- 목표: 외부 사용자(stars / forks / issue 보고) 신호로 어휘 부족분 역추적 + 보강
- 진입 조건: Phase 2 안정화 + 외부 사용자 5+
- 성공 조건: 외부 사용자 자가 보고 성공 사례 3+, instinct confidence ≥ 0.8 사례 3+
- 핵심 산출물: 외부 dogfood 보고서 자동화, instinct → Rule 승격 첫 사례, **공개 보안·호환 매트릭스(Docker 자동, `docs/COMPATIBILITY.md` — ADR-021 A)**, **발견 채널 등재(CC 마켓플레이스 + awesome-list — ADR-021 C)**
- 진입 메커니즘(2026-06): 외부 사용자 5+ 는 수동 발견 채널 등재(C)로 확보 — chicken-egg(사용자↔채택 신호) 타파

### Phase 4 — 어휘 자기 진화 (Self-Improvement Loop)

- 가설: instinct → Rule 자동 승격으로 harness 어휘가 세션 경험에서 스스로 진화
- 진입 조건: Phase 3 안정화 + instinct → Rule 승격 인간 검토 5+ 사례
- 결정 사항: 본 문서 분기 갱신 시 검토

### Phase 5 (탐색) — Multi-User / Team Harness

- 가설: 1인 하네스를 소규모 팀이 공유 가능한 버전으로 확장
- 진입 조건: Phase 4 자기 개선 루프 안정 + 외부 early adopter 20+
- 결정 사항: 본 문서 갱신 시 재평가. 현재는 미결정 (Won't 등록 아님 — 추후 결정)

---

## 6. Decision Heuristics (의사결정 휴리스틱)

### 6.1 4-Gate — "할 것인가"

신규 요청·제안이 들어왔을 때 다음 4 게이트를 **모두** 통과해야 우선순위 진입.

| Gate | 질문 | Pass 기준 |
|------|------|---------|
| **1. Vocabulary** | AI와 사용자가 **같은 의미**로 해석하는 새 어휘인가? 모호하면 -1 | YES — 의미 + Pass/Fail 조건 명시 |
| **2. Persona** | 퍼블릭 vibe coder (시니어/주니어/멀티 역할 무관)에게 직접 가치를 주는가? | YES |
| **3. Capability** | hook / skill / plugin / MCP / rule 중 하나로 **결정론적**으로 구현 가능한가? LLM 판단에만 의존하면 -1 | YES (구현 수단 명시) |
| **4. Promise = Implementation** | 약속한 동작이 100% 구현 가능한가? "거의 작동"은 거짓 광고 → vibe killer | YES (E2E 검증 가능) |

4개 모두 Pass = 우선순위 진입. 1개라도 Fail = 보류(Open Question) 또는 거절.

#### 이 게이트로 거절될 후보 (예시)

- **외부 자산 ToB (Trail of Bits)** — Vocabulary Pass(보안 어휘), Persona Pass(공통), Capability Pass(plugin install), Promise=Implementation은 옵션 작동 시점에 검증. 4-gate Pass 시점에 P0
- **사용자가 알아야 하는 추가 명령어** — 어휘 자동 노출 안 되면 Vocabulary Fail
- **단일 Stack tied 자동화** — Persona Fail (특정 사용자만)

### 6.2 우선순위 순서 — "언제 할 것인가"

4-gate 가 "할 것인가"를 거르면, 통과한 것들 **사이의 순서**는 이 규칙으로 판정한다
(`gates-taxonomy` 룰의 검증 체크포인트 4유형과 무관 — 이것은 작업 **순서** 규칙이다):

1. **기본 필수 기능** — 없으면 제품이 성립 안 되는 기본기. 예: 설치가 끝까지 완주하는가, 광고한
   플래그가 존재하는가. "기본"이 빠진 채 화려함부터 쌓지 않는다.
2. **기능 완성도** — 이미 shipped 된 것이 사용자 관점 end-to-end 로 진짜 완결인가.
   **단순 존재 ≠ 완결** — 자산이 카탈로그에 있는 것과, wizard 에서 선택돼 실제 CLI 가 인식하는
   것은 다르다 (`no-false-ship` 의 Surface Parity 와 같은 기준).
3. **차별화 깊이** — 핵심 경쟁력(P2 검증 큐레이션·P1 루프 노하우)의 advanced 구현.
   **research/ADR 선행 필수** — advanced 부터 코드로 뛰어들지 않는다.

**상위 순위에 미완이 있으면 하위로 건너뛰지 않는다** (긴급 hotfix·사용자 명시 지시 예외).
Plan/Define 단계에서 "이 작업이 ①/②/③ 중 어디이고, 앞 순위가 남아있지 않나"를 먼저 점검한다.

---

## 7. Versioning & Review

- 본 문서는 **분기 1회** 또는 **NSM 도달/미달** 시 갱신
- 주요 갱신 (Major CR): NSM 변경 / Phase 정의 변경 / Won't 변경 / Statement 변경
- 가벼운 갱신 (Clarification): Trade-off 추가, Heuristics Pass/Fail 사례 추가
- 갱신 시 사유 + 날짜 1줄을 Changelog에 기록

---

## 8. Changelog

- **2026-07-19**: **Major CR — 상주 비용 범위 정정 (ADR-044)**. 사용자 위임 결정("A부터 정해"). `Context Cost per Install` 의 상주 항을 "스킬 descriptor"에서 **"설치가 상시 컨텍스트에 올리는 전부"**로 정정 — rules(전문)·CLAUDE.md·skill/agent descriptor. 판정은 **표면 열거가 아니라 상주/발화 구분**이라 새 표면이 생겨도 기준 불변. 기각 사유가 결정적: 스킬 한정 정의는 **굿하트로 뚫린다** — SKILL.md 산문을 룰로 옮기면 발화-시-비용이 매 세션 상주로 바뀌어 사용자에겐 악화인데 지표는 개선으로 표시된다(계약 테스트로 봉함). 실측 결과 기존 정의는 상주의 **10%만** 재고 있었고 그 값이 위저드에 그대로 표시되고 있었다 → 표시도 내역 포함으로 교체. 발견: **룰이 최대 비용 항목(60%)**.
- **2026-07-18**: **Major CR — 차별화 축 = 계측된 최소 하네스 (ADR-043)**. 사용자 방향 지시("카탈로그 전수 재판정이나 스킬별로 컨텍스트 얼마나 잡아먹는지, 정말 필요한 것인지 검토해서 꼭 필요한 것만 남겨 최적화된 하네스를 제공하는 것이 차별화 같아") + HITO A/B 기각. ⓐ **1차 NSM 교체** — `Context Cost per Install`(양) + `Justified Asset Ratio`(사후 품질) 짝. **HITO / Re-clarification Rate 는 폐기**(최초 판단은 "2차 강등"이었으나, 실사용 실측 결과 HITO 는 3개월 수집·1회 사용·수정 근거 0건, Re-clarification 은 sampling 기록 0건 — 강등이 아니라 제거가 맞다고 재판단). `hito-counter.sh`(claude·codex)·`hito-aggregate.sh`·`nsm-aggregate.sh`·기본 훅 배선 전부 제거. "신속=적은 왕복"은 Statement 정의로 존속. ⓑ Pillar 2 를 "검증된 자산 큐레이션"에서 **"계측된 최소 큐레이션"**으로 재정의. ⓒ ADR-021 검증 큐레이션은 하위 수단으로 존속(안전 ↔ 경제성, 다른 질문). ⓓ 판정 근거 2단계 확정 — 전수 비용 계측(값싼 결정론) → 상위 비용만 with/without eval(`eval-harness`·`skill-creator` baseline 재사용). **주의: body 토큰 계측과 Justified Asset Ratio 는 현재 미구현** — 선언 ≠ 달성.
- **2026-07-18**: **Clarification — north-star 스킬 계약(8섹션)에 구조 정합**. 내용 변경 없음(NSM 수치·Phase 정의·Won't 불변 → Major CR 아님). ⓐ §1 안에 있던 "세 기둥"을 **§3 Pillars** 로 승격 — 축마다 정의/현재 위치/전방 목표/가설 4요소 + **모듈 ↔ 축 매핑 표**(미매핑 모듈 = scope creep 조기 신호) 신설. ⓑ §2 에 **프록시 선언** 명문화 — 진짜 목표(사용자 프로젝트의 성과)는 지연·외부라 직접 측정 불가 → HITO(양) + Re-clarification(사후 품질) 짝으로 최적화, 굿하트 방지 근거 기재. ⓒ §6 을 6.1 4-Gate / **6.2 우선순위 순서**(기본→완성도→차별화)로 분리. ⓓ 재포지셔닝(ADR-021)·Lean 개정(ADR-032) 서술은 축 논의이므로 §1 → §3 서두로 이동. 계기: 이 리포가 배포하는 `north-star` 스킬을 자기 문서에도 적용(도그푸딩).
- **2026-07-17**: **Major CR — Lean 개정 (ADR-032)**. 사용자 방향 지시("루프/하네스 엔지니어링 관점 인스톨러, 간결하게 꼭 필요한 것만") + 5-페르소나 패널 검토 후 확정. 기둥① 전면화(루프/하네스 엔지니어링 노하우), 기둥② 규모 축소·품질 기준 유지. NSM에 Session-Start Context Cost 추가. Will에 컨텍스트 이코노미, Trade-offs에 Lean 기본값(포기 사용자군 명시) 등재. 방법론 번들 = **opt-in 유지 확정**(제거 기각 — 패널 4/5 수렴: 이미 opt-in이라 컨텍스트 잠식 0, 제거는 선택권·유입 경로만 상실). "모델 향상 → 스킬 불필요"는 **가설**로 취급 — 검증 경로 = HITO A/B(번들 有/無 동일 feature 비교). 실행 큐 = `docs/plans/lean-direction-2026-07-17.md`.
- 2026-04-20: 초안 작성. 근거 — 사용자 본인 정의 Statement + v27.8~v26.30.1 7개 커밋의 4-gate 사후 검증 결과 + Phase 1 완료 상태(147 test-harness PASS).
- **2026-04-25**: **Major CR — vibe coding 정의 정확화 + 퍼블릭 publishing 전제 명시**. Statement 변경(`AI와 사용자가 하네스 규칙을 공통 언어로 삼아…`). 1차 NSM에 Re-clarification Rate 추가. 2차 NSM에 First-Run Success Rate / Promise=Implementation / Cross-CLI Parity 추가. Strategic Boundaries 갱신 (Won't에서 1인 단독 가정 삭제). Phase Roadmap 재정의 (Phase 1 = 어휘 완전성 = bash 등가성 복원). Decision Heuristics 4-gate를 Vocabulary 중심으로 재정의. 근거: 사용자 redirect — "vibe coding = AI/사용자가 하네스 규칙으로 효율적 소통해 빨리 개발하는 것" + 리포 퍼블릭 publishing 전제 인지.
- **2026-06-06**: **Major CR — 재포지셔닝 (검증+보안 큐레이션으로 차별화 축 격상, 설치 = 전달 메커니즘)**. 근거: Phase 2 자율 소진 후 deep-research(`docs/research/direction-research-2026-06-06.md`) 3-에이전트 독립 수렴 — cross-CLI 설치는 commoditized(skills.sh 21.5k★/70+에이전트·rulesync·MS APM·Claude/Codex native 마켓플레이스), 방어 wedge = 보안 vetting(Snyk ToxicSkills 36% prompt injection). 결정(ADR-021): 기둥 ②를 "검증 + 보안 감사 큐레이션"으로 격상, 2차 NSM에 Asset Security Pass Rate 추가, Phase 3 산출물에 공개 보안·호환 매트릭스 + 발견 채널 등재 추가. 로드맵 C→A→B→D(`docs/todo.md`). Statement 자체는 유지(세 기둥 보존, "설치 서비스" 표현은 전달 메커니즘으로 재해석).
- **2026-05-31**: **Major CR — Statement 재정립 (설치 서비스 본질 + 4-CLI + 검증 자산 큐레이션·적극 권장)**. 사용자 redirect: "하네스/컨텍스트 엔지니어링으로 Claude Code/Codex/OpenCode/Antigravity 에서 신속·정확하게 원하는 서비스를 만드는 환경을 **설치해주는 서비스**. 검증된 플러그인/스킬을 사용자가 **이해·선택**해 설치, 권장은 **적극 어필**." → Statement 를 세 기둥(① 하네스+컨텍스트 엔지니어링 ② 검증 자산 큐레이션+선택권 ③ 4-CLI 동등성)으로 구조화. Cross-CLI Parity 3→4 CLI (Antigravity 추가, v26.66~70 반영). Will 에 "검증 자산 큐레이션+선택권" · "권장 적극 어필" 추가. Phase 1 완료(v26.38) 표시 + Phase 2 현재. Trade-off 9→11 Track.
