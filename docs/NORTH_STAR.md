# uzys-agent-harness — North Star

> 장기 방향성. PRD/SPEC이 "무엇을 어떻게"를 다루면, 본 문서는 **왜·어디로**를 다룬다.
> 의사결정이 모호할 때 본 문서를 기준으로 우선순위를 판정한다.

---

## 1. North Star Statement

> **"하네스 + 컨텍스트 엔지니어링으로, Claude Code · Codex · OpenCode · Antigravity 에서 사용자가 신속·정확하게 원하는 서비스를 만들 수 있는 환경을 설치해주는 서비스."**

본 프로젝트의 본질 = **설치 서비스 (installer + curator)**. 4개 AI 코딩 CLI 어디서나, 검증된 플러그인·스킬·룰·hook 을 사용자가 **이해하고 선택**해서 한 번에 설치하고, 그 위에서 AI와 사용자가 공유 어휘(하네스 규칙)로 적은 왕복에 빠르게 개발한다.

### 세 기둥

1. **하네스 + 컨텍스트 엔지니어링** — rules / hooks / skills / 6-gate / Track / SPEC + CLAUDE.md persistence 가 AI ↔ 사용자의 공유 어휘이자 컨텍스트다. AI 단독 자동화가 아니라 **양쪽이 같은 의미로 해석하는 통신 프로토콜**의 풍부함·정확성이 핵심. 어휘가 정확할수록 동일 결과에 더 적은 왕복 + 더 적은 재설명.
2. **검증된 자산 큐레이션 + 사용자 선택권** — "무엇이든 설치"가 아니라 **검증된** 플러그인/스킬만 후보. 각 자산의 출처·역할을 한 줄씩 명시해 사용자가 **이해하고 선택**한다. 권장 자산은 pre-checked + 설명으로 **적극 어필**하되, 최종 결정은 사용자.
3. **4-CLI 동등성** — Claude Code / Codex / OpenCode / Antigravity 어디서나 같은 어휘가 동등 작동. CLI 잠금(lock-in) 없음.

**차별화 축 (2026-06 재포지셔닝 · ADR-021)**: 시장 리서치(`docs/research/direction-research-2026-06-06.md`, 3-에이전트 독립 수렴) 결과 **"설치(installer)" 자체는 commoditized** — Vercel skills.sh(70+ 에이전트)·rulesync·MS APM + Claude Code/Codex 1st-party 마켓플레이스가 이미 cross-CLI 설치를 제공한다. 따라서 **설치는 전달 메커니즘(table-stakes)**으로 재정의하고, 방어 가능한 차별화는 기둥 ②를 **"검증된 + 보안 감사된(security-vetted) 큐레이션"**으로 격상한 데 둔다. 근거: Snyk "ToxicSkills" — 테스트 skill의 36%에서 prompt injection. 보유 무기 = CLAUDE.md Docker 실-바이너리 검증 의무 → 경쟁사의 *정적* 호환표와 달리 *지속 테스트되는* 호환·보안 매트릭스(공개 artifact화 = Phase 3 산출물).

> **신속** = 적은 왕복 (HITO ≤ 3/feature). **정확** = Promise = Implementation (광고한 자산은 100% 실제 작동).

**대상**: 퍼블릭 — 누구나 vibe coder. 시니어/주니어/멀티 역할 무관.

---

## 2. North Star Metric (NSM)

### 1차 지표 — 소통 효율 (vibe core)

| Metric | 정의 | 목표 |
|--------|------|------|
| **HITO per Feature** | feature 1개 완주(`/uzys:spec` → `/uzys:ship`)까지 사용자 명시 개입 (지시문/승인/수정 요청) 횟수 | **≤ 3** |
| **Re-clarification Rate** | AI가 동일 context를 두 번 이상 묻거나, 사용자가 같은 결정을 두 번 이상 내리는 빈도 (sample 기반) | **≤ 5%** of total prompts |

### 2차 지표 — 속도 + 진입 + 신뢰

| Metric | 정의 | 목표 |
|--------|------|------|
| **Time-to-first-Build** | `npx -y github:.../uzys-agent-harness` 실행부터 첫 `/uzys:build` 완료까지 | **≤ 30분 (p90)** |
| **First-Run Success Rate** | 첫 설치 시도가 사용자 수동 개입 (에러 fix / 누락 파일 / 의존성 추가 install) **0건**으로 종료 | **≥ 95%** |
| **Promise = Implementation** | README/USAGE/SPEC에서 광고된 모든 자산 (skill / plugin / MCP / hook)이 실제 설치·작동 | **100%** (거짓 광고 0건) |
| **Cross-CLI Parity** | Claude Code / Codex / OpenCode / Antigravity 4 CLI 동일 어휘 동등 작동률 (slash 호출 + hook 발화 + skill 인식) | **≥ 95%** |
| **Generated-config Security Pass Rate** | 하네스가 *생성*하는 `.claude/` 산출물이 `agentshield` 게이트에서 CRITICAL/HIGH **0건** (COMPATIBILITY.md §보안). 자산 repo *콘텐츠* 스캔은 미실행 — trust-tier(★≥1000+활성) + Docker install-verification 으로 보완, prompt-injection 콘텐츠 스캔은 로드맵 (ADR-021 차별화 축) | **100% (산출물)** |

### 측정 방법

- HITO: `templates/hooks/hito-counter.sh` + `scripts/hito-aggregate.sh` (자동)
- Re-clarification: 세션 transcript 수동 sampling (분기 1회)
- Time-to-first-Build: dogfood 세션 + early adopter 자체 보고
- First-Run Success: GitHub Issues + Discord/email 보고 + dogfood log
- Promise = Implementation: install pipeline E2E test + grep README ↔ manifest cross-check (CI)
- Cross-CLI Parity: `tests/installer-cli-matrix.test.ts` (11 Track × CLI 조합 매트릭스, 4 CLI)
- Generated-config Security: `agentshield` 가 하네스 *산출물*(`.claude/`)을 스캔 (자산 repo 콘텐츠 스캔 아님 — COMPATIBILITY.md §보안) + Docker 실행 호환 매트릭스 자동 생성 (CI → `docs/COMPATIBILITY.md` 공개 artifact, ADR-021 A 단계)

---

## 3. Strategic Boundaries (방향성 경계)

### 3.1 Will (vibe coding 핵심)

- **공통 어휘 풍부화** — Rule / Hook / Skill 추가 기준: "AI와 사용자가 같은 의미로 해석하는가". 모호하면 거절
- **재설명 제거** — 같은 context를 두 번 묻게 만드는 모든 friction 제거 (CLAUDE.md persistence, gate-status, decision log, ADR)
- **Promise = Implementation** — README/USAGE/SPEC 광고는 100% 실제 동작. 거짓 광고는 vibe를 가장 빠르게 깨뜨림
- **Public-first** — 처음 보는 사용자가 즉시 같은 어휘로 대화 시작 가능. 한 줄 설치 + 자동 컨텍스트 로드
- **Deterministic Harness** — 게이트/규칙/순서는 hook으로 강제. LLM 판단 의존은 최후 수단
- **Multi-Stack 동등성** — Python REST / Next.js / SSR / 데이터 / 임원 문서 / 순수 CLI 어디서나 같은 6-gate + 같은 `/uzys:*` 어휘
- **Project-Scope 오염 금지** — 글로벌 `~/.claude/`, `~/.codex/`, `~/.opencode/`, `npm -g` 는 사용자 명시 opt-in (`--scope global` 또는 interactive 에서 Global 선택) 없이는 미수정. Default install scope = Project. (D16, ADR-020)
- **Transparent Defaults** — 설치 중 어떤 자산이 들어가는지 한 줄씩 명시. 숨김 동작 0건
- **검증된 자산 큐레이션 + 선택권** — 후보는 검증된 플러그인/스킬로 한정. 각 자산 출처·역할 명시 → 사용자가 이해하고 선택. "무엇이든 설치" 안 함
- **권장 적극 어필** — 권장 자산은 pre-checked + 설명으로 강하게 제안. 단 강제 아님 — 사용자가 토글로 최종 결정 (Promise=Implementation 유지: 권장 ≠ 거짓 광고)

### 3.2 Won't (의도적 비-방향)

scope creep 1차 방어선. "X는 안 한다"를 명시.

- **AI 단독 자동화** — vibe coding은 소통이지 "맡기기" 아님. 인간 결정 게이트(SPEC, Major CR, Ship)는 유지
- **사용자가 외워야 하는 어휘** — 모든 어휘는 skill descriptor / hook 메시지 / 인터랙티브 prompt로 자동 노출
- **범용 Best Practice 강요** — 린터 영역(naming, formatting, import 순서)은 린터에. Rule은 프로젝트 특화 불변식만
- **UI 스킨 / 테마 / 시각 장식** — CLI 출력 색상 수준. gum/whiptail TUI 의존 금지
- **모든 Track에 모든 자산** — 어휘는 맥락별 분리 (UI 어휘는 UI track에만)
- **특정 Stack tied hack** — "Postgres + Next.js만 지원" 같은 단일 스택 가정 금지

### 3.3 Trade-offs (의식적 선택)

| 선택 | 포기한 것 | 근거 |
|------|----------|------|
| Rule 17 / Hook 6 slim-down | 범용 guide 두께 | 어휘는 정확성 > 분량. 린터 가능한 건 린터에. 분기 1회 재평가 |
| `/uzys:auto` revision 자동 루프 | 매 단계 인간 승인 | 소통 왕복 최소화. revision 상한 + Escalation Gate로 폭주 방지 |
| ECC cherry-pick + 외부 plugin install | 통합 플러그인 자체 관리 | 상위 커뮤니티 어휘에 위임. sync 자동 drift 감지 + 한 줄 설치로 어휘 자동 등록 |
| `npx` + `prepare` 빌드 | bash + curl 1줄 | 의존성 0 가정 폐기. Node 20+ 전제로 단순화 + 결정론 향상 |
| 11 Track 분리 | 단일 monolith | 어휘 맥락 분리. TSV + helper로 복잡도 관리 |
| 도메인 비종속 generic 템플릿 | 특정 도메인 맞춤 편의 | 누구나 fork. 특정 private repo 참조 제거 |

---

## 4. Phase Roadmap (장기 진화 단계)

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
- 성공 조건: HITO ≤ 3 외부 사용자 자가 측정 사례 3+, instinct confidence ≥ 0.8 사례 3+
- 핵심 산출물: 외부 dogfood 보고서 자동화, instinct → Rule 승격 첫 사례, **공개 보안·호환 매트릭스(Docker 자동, `docs/COMPATIBILITY.md` — ADR-021 A)**, **발견 채널 등재(CC 마켓플레이스 + awesome-list — ADR-021 C)**
- 진입 메커니즘(2026-06): 외부 사용자 5+ 는 수동 발견 채널 등재(C)로 확보 — chicken-egg(사용자↔HITO 측정) 타파

### Phase 4 — 어휘 자기 진화 (Self-Improvement Loop)

- 가설: instinct → Rule 자동 승격으로 harness 어휘가 세션 경험에서 스스로 진화
- 진입 조건: Phase 3 안정화 + instinct → Rule 승격 인간 검토 5+ 사례
- 결정 사항: 본 문서 분기 갱신 시 검토

### Phase 5 (탐색) — Multi-User / Team Harness

- 가설: 1인 하네스를 소규모 팀이 공유 가능한 버전으로 확장
- 진입 조건: Phase 4 자기 개선 루프 안정 + 외부 early adopter 20+
- 결정 사항: 본 문서 갱신 시 재평가. 현재는 미결정 (Won't 등록 아님 — 추후 결정)

---

## 5. Decision Heuristics (의사결정 휴리스틱)

신규 요청·제안이 들어왔을 때 다음 4 게이트를 **모두** 통과해야 우선순위 진입.

| Gate | 질문 | Pass 기준 |
|------|------|---------|
| **1. Vocabulary** | AI와 사용자가 **같은 의미**로 해석하는 새 어휘인가? 모호하면 -1 | YES — 의미 + Pass/Fail 조건 명시 |
| **2. Persona** | 퍼블릭 vibe coder (시니어/주니어/멀티 역할 무관)에게 직접 가치를 주는가? | YES |
| **3. Capability** | hook / skill / plugin / MCP / rule 중 하나로 **결정론적**으로 구현 가능한가? LLM 판단에만 의존하면 -1 | YES (구현 수단 명시) |
| **4. Promise = Implementation** | 약속한 동작이 100% 구현 가능한가? "거의 작동"은 거짓 광고 → vibe killer | YES (E2E 검증 가능) |

4개 모두 Pass = 우선순위 진입. 1개라도 Fail = 보류(Open Question) 또는 거절.

### 이 게이트로 거절될 후보 (예시)

- **외부 자산 ToB (Trail of Bits)** — Vocabulary Pass(보안 어휘), Persona Pass(공통), Capability Pass(plugin install), Promise=Implementation은 옵션 작동 시점에 검증. 4-gate Pass 시점에 P0
- **사용자가 알아야 하는 추가 명령어** — 어휘 자동 노출 안 되면 Vocabulary Fail
- **단일 Stack tied 자동화** — Persona Fail (특정 사용자만)

---

## 6. Versioning & Review

- 본 문서는 **분기 1회** 또는 **NSM 도달/미달** 시 갱신
- 주요 갱신 (Major CR): NSM 변경 / Phase 정의 변경 / Won't 변경 / Statement 변경
- 가벼운 갱신 (Clarification): Trade-off 추가, Heuristics Pass/Fail 사례 추가
- 갱신 시 사유 + 날짜 1줄을 Changelog에 기록

---

## 7. Changelog

- 2026-04-20: 초안 작성. 근거 — 사용자 본인 정의 Statement + v27.8~v26.30.1 7개 커밋의 4-gate 사후 검증 결과 + Phase 1 완료 상태(147 test-harness PASS).
- **2026-04-25**: **Major CR — vibe coding 정의 정확화 + 퍼블릭 publishing 전제 명시**. Statement 변경(`AI와 사용자가 하네스 규칙을 공통 언어로 삼아…`). 1차 NSM에 Re-clarification Rate 추가. 2차 NSM에 First-Run Success Rate / Promise=Implementation / Cross-CLI Parity 추가. Strategic Boundaries 갱신 (Won't에서 1인 단독 가정 삭제). Phase Roadmap 재정의 (Phase 1 = 어휘 완전성 = bash 등가성 복원). Decision Heuristics 4-gate를 Vocabulary 중심으로 재정의. 근거: 사용자 redirect — "vibe coding = AI/사용자가 하네스 규칙으로 효율적 소통해 빨리 개발하는 것" + 리포 퍼블릭 publishing 전제 인지.
- **2026-06-06**: **Major CR — 재포지셔닝 (검증+보안 큐레이션으로 차별화 축 격상, 설치 = 전달 메커니즘)**. 근거: Phase 2 자율 소진 후 deep-research(`docs/research/direction-research-2026-06-06.md`) 3-에이전트 독립 수렴 — cross-CLI 설치는 commoditized(skills.sh 21.5k★/70+에이전트·rulesync·MS APM·Claude/Codex native 마켓플레이스), 방어 wedge = 보안 vetting(Snyk ToxicSkills 36% prompt injection). 결정(ADR-021): 기둥 ②를 "검증 + 보안 감사 큐레이션"으로 격상, 2차 NSM에 Asset Security Pass Rate 추가, Phase 3 산출물에 공개 보안·호환 매트릭스 + 발견 채널 등재 추가. 로드맵 C→A→B→D(`docs/todo.md`). Statement 자체는 유지(세 기둥 보존, "설치 서비스" 표현은 전달 메커니즘으로 재해석).
- **2026-05-31**: **Major CR — Statement 재정립 (설치 서비스 본질 + 4-CLI + 검증 자산 큐레이션·적극 권장)**. 사용자 redirect: "하네스/컨텍스트 엔지니어링으로 Claude Code/Codex/OpenCode/Antigravity 에서 신속·정확하게 원하는 서비스를 만드는 환경을 **설치해주는 서비스**. 검증된 플러그인/스킬을 사용자가 **이해·선택**해 설치, 권장은 **적극 어필**." → Statement 를 세 기둥(① 하네스+컨텍스트 엔지니어링 ② 검증 자산 큐레이션+선택권 ③ 4-CLI 동등성)으로 구조화. Cross-CLI Parity 3→4 CLI (Antigravity 추가, v26.66~70 반영). Will 에 "검증 자산 큐레이션+선택권" · "권장 적극 어필" 추가. Phase 1 완료(v26.38) 표시 + Phase 2 현재. Trade-off 9→11 Track.
