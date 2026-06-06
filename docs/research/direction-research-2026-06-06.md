# 향후 방향 리서치 — 시장·경쟁·채택 (2026-06-06)

> **생성**: 2026-06-06 · **방법**: 3개 독립 병렬 리서치 에이전트(WebSearch/WebFetch/GitHub) · **소스**: 50+ (대부분 1차 문서·changelog·평판 매체) · **신뢰도**: High (3 에이전트 독립 수렴)
> **목적**: Phase 2 자율 backlog 소진 후, 프로젝트가 "무엇을 더 만들지"가 아니라 **"어느 방향으로 갈지"** 결정하기 위한 근거.
> **anchor**: [`docs/NORTH_STAR.md`](../NORTH_STAR.md) · [`docs/todo.md`](../todo.md)

---

## Executive Summary

세 에이전트(플랫폼·경쟁·채택)가 **독립적으로 동일한 결론에 수렴**했다:

1. **"4-CLI 자산 설치(installer/sync)" 명제는 사실상 commoditized 됐다.** 지난 ~12개월(2026-01~05) 사이 빈 시장이 15+ 경쟁자로 포화됐고, 그중 둘은 본 프로젝트보다 훨씬 넓은 범위를 이미 커버한다 — **Vercel `npx skills`/skills.sh (21.5k★, 70+ 에이전트)**, **rulesync (1.1k★, 25+ 도구)**, **Microsoft APM**. 위로는 Claude Code·Codex가 **1st-party 마켓플레이스**를 내장했다.
2. **차별화로 내세운 3가지가 각각 이미 시장에 존재한다.** ① 4-CLI parity → skills.sh/rulesync가 상위집합 ② "CLI 한계 정직 표기(Promise=Impl)" → Vercel(capability matrix)·MS APM(hooks gap 문서화)가 이미 구현 ③ Trust Tier 큐레이션 → Anthropic 공식 마켓플레이스가 2~3단 vetting 운영.
3. **표준이 수렴 중이라 "CLI 간 번역" 가치가 줄고 있다.** AGENTS.md(60k+ repo, Linux Foundation AAIF) · MCP(10k+ 서버, AAIF 기부) · SKILL.md — 전부 재단 거버넌스. format은 이미 portable, 남은 fragmentation은 **설치 경로(install path)**라는 좁고 기계적인 문제뿐이고 그조차 skills.sh가 symlink로 해결.

**그러나 방어 가능한 좁은 wedge가 하나 있다 — 보안·신뢰 기반 큐레이션.** Snyk "ToxicSkills" 연구가 테스트한 skill의 **36%에서 prompt injection**을, 별도 감사가 22,511 skill에서 **140,963 이슈(~6.3/skill)**를 발견했다. 마켓플레이스가 1개(2025-12)→8개(2026 Q2)로 늘며 **선택 과부하**가 생겼다. "믿을 수 있는, 검증된, 진짜 멀티-CLI" 큐레이터에 대한 수요는 측정 가능하게 존재하고 커지고 있다.

**한 줄 결론**: *설치(installer)는 table-stakes가 됐다. 남은 차별화는 **검증·신뢰 기반 큐레이션 + 결과 지표(≤3 prompts)**에 있다. "설치 서비스"라는 헤드라인은 erodible part다.*

---

## 1. 플랫폼·표준 궤적 — 강화 vs 잠식

**판정: net-EROSIVE (설치 가치 commoditized=High, 전체 명제=Medium-High)**

| 플랫폼 | native 자산 지원 (2026) | 판정 |
|--------|------------------------|------|
| **Claude Code** | 1st-party 마켓플레이스 내장(`claude-plugins-official` ~101 plugins), `/plugin` Discover, community 마켓플레이스 자동 검증+SHA pin, `.claude/skills` 자동 로드, **설치 UI에 context-token 비용 표시** | **COMMODITIZES** |
| **Codex CLI** | 마켓플레이스 2026-03-27 출시, `/plugins`, skill native(SKILL.md), **custom prompts deprecated→skills**. self-serve publishing만 "coming soon"(2026-05) | **COMMODITIZES** (단기 publishing gap) |
| **OpenCode** | 1st-party 마켓플레이스 **없음**, 로컬/npm 로드 + community ecosystem | **FRAGMENTED** (유일 soft spot, but skills.sh가 이미 커버) |
| **Antigravity** | native skills/plugins/MCP, **단일 통합 config**, Gemini CLI 흡수(2026-06-18 종료→`.agents/`+`AGENTS.md` 강제 이주), 단 closed-source | **COMMODITIZES** (Google 생태계 내) |

**표준 수렴 (crux):**
- **AGENTS.md** = de facto cross-tool 명령 표준, 20+ 도구 native read, 60k+ repo, Linux Foundation AAIF 거버넌스. → "shared harness rules"를 사용자가 `AGENTS.md` 하나로 쓰면 끝 → "shared vocabulary" pillar 압박.
- **MCP** = tool/data 연결 표준(서버), 명령/skill과는 **다른 보완 레이어**. → tool 통합의 per-CLI 설치는 무의미(한 번 등록=모든 클라이언트 사용).
- **SKILL.md** = cross-agent skill 표준, "Codex용 skill이 CC·Antigravity·Cursor 등 30+에서 무수정 실행". 남은 fragmentation = 설치 **경로**뿐(`.claude/skills` vs `.agents/skills` vs `.opencode/skills`...) → skills.sh symlink로 해결.

**날짜 트리거 2개(설치 표면적 추가 축소):** Codex self-serve publishing 출시 · Gemini CLI 종료(2026-06-18).

---

## 2. 경쟁 지형 — 차별화 vs commoditized

**시장이 ~12개월 만에 빈 곳→포화. 경쟁자 repo 대부분 2026-01~05 생성.**

| 도구 | ★ | 범위 | Cross-CLI | 큐레이션 | 활성 |
|------|--:|------|-----------|----------|------|
| **Vercel skills.sh** | 21.5k | skill 패키지 매니저(find/add/update), **per-agent capability matrix** | 70+ 에이전트 | install-count 랭킹 | v1.5.10 (06-03) |
| **Microsoft APM** | (MS) | `apm.yml` 의존성 매니저(lockfile), **hooks gap 2/39 문서화** | Copilot/Claude/Cursor/OpenCode/Codex/Gemini/Windsurf | 재현가능 설치 | 2026 |
| **rulesync** | 1.1k | unified rule→config 생성(rules/cmd/MCP/skills/hooks) | 25+ 도구+AGENTS.md | 없음(순수 sync) | v8.24.1 (06-03) |
| agentpack | 13 | manifest+lock 패키지 매니저, **Antigravity 포함** | + Grok | 없음 | 05-2026 |

**큐레이션 registry:** Anthropic 공식(29.5k★, **2단 trust 구조** — 직접 vs vetted partner) · VoltAgent awesome-agent-skills(24.4k★, 1,424+ skill, multi-CLI) · ComposioHQ awesome-claude-skills(63.4k★) · awesome-cursorrules(36.9k★) · claudemarketplaces.com(20,300+ skill, install/star/vote 랭킹) · **GitHub `gh skill`(2026-04, 1st-party 설치/게시)**.

**commoditized (FACT):** cross-CLI install/sync(15+ 도구) · "CLI 한계 정직 표기"(Vercel matrix + MS APM hooks gap) · trust-tier 큐레이션(Anthropic).

**덜 흔함(잠재 edge, mixed):** ① 숫자 star-gate(≥1000★) Trust Tier를 *투명·기계적 규칙*으로 = 경쟁자 없음(but 라벨링 컨벤션, 복제 쉬움) ② **큐레이션된 자산 + shared harness 규칙을 하나의 opinionated 설치로 묶기** = sync 도구(mechanism, BYO content)와 registry(content, no harness) 사이 seam = 가장 덜 경쟁됨 ③ Antigravity 커버리지(아직 드뭄, AGENTS.md 확산으로 축소 중).

---

## 3. 채택·하네스 제품성

### Part 1 — 채택 playbook (solo 유지보수자, 첫 5~50명 목표)

| 순위 | 채널 | 노력 | 보상 | 근거 |
|------|------|------|------|------|
| **1** | **native Claude Code 마켓플레이스 등재** (3rd-party source) | 저~중 | 높음·지속 | CC가 2026 봄 1st-party 마켓플레이스 오픈, `--plugin-url`/`--plugin-dir` 수용. 사용자가 이미 있는 곳 |
| **2** | **awesome-list PR** (claude-code 46k★, claude-skills, agent-skills, cursorrules) | 저 | 중·복리 | 등재당 "월 50~200 사용자" 주장(*비감사 추정*). 4-CLI 범위가 VoltAgent 프레이밍과 일치 |
| **3** | **Show HN** (1회) | 저 | 스파이크·낮은 잔존 | 니치 설치기엔 호기심 스파이크. README+30초 GIF 후 1회만 |
| **4** | **r/ClaudeCode(292k)·r/ClaudeAI(899k) Showcase** | 저·반복 | 중 | 정확한 페르소나 밀집. 광고 아닌 before/after 워크플로 |
| **5** | **dev.to SEO 글** ("4-CLI 단일 harness") | 중 | 중·복리 | 스파이크 아닌 linkable artifact+SEO |

**과대평가/비효율:** 유료 광고(거의 0 ROI), **모든 채널 동시 분산**. → **순차 실행**: 마켓플레이스+awesome-list(지속) 먼저 → HN/Reddit 스파이크 1회 → dev.to 1편.

**직접 analog:** `jeremylongshore/claude-code-plugins-plus-skills` + `ccpi` CLI 설치기(2.3k★, 425 plugins/2,810 skills, npm ~519 dl/30d).

### Part 2 — context-engineering/harness는 방어 가능한 카테고리인가

**REAL & 성장(High conf):**
- Anthropic "Effective Context Engineering for AI Agents"(2025-09-29) — context 구성을 에이전트 빌딩의 "#1 job"으로 정의.
- **Birgitta Böckeler(Thoughtworks Distinguished Eng), Martin Fowler 사이트 "Harness engineering for coding agent users"(2026-04-02)** — OpenAI/Stripe/Thoughtworks 실사례. 용어가 주류 담론 진입(non-vendor 고신뢰 신호).
- `awesome-harness-engineering` 리스트 존재.

**durability RISK(High conf, 반대 증거):**
- **Böckeler의 핵심 경고가 "큐레이션된 harness 제품"을 정조준**: *custom engineering > pre-packaged*, 공유 harness 템플릿은 *"버전·기여 문제, 비결정적 가이드라 더 악화될 수도"*. → **가치 있는 harness는 프로젝트-특화·자체 제작, 패키지화 가능한 부분이 commodity.**
- **플랫폼 흡수가 이미 진행**: CC 1st-party 마켓플레이스가 distribution 레이어 흡수. MCP+SKILL.md 수렴으로 cross-CLI portability가 표준의 내장 속성이 됨.

**판정:** "context/harness engineering" *개념*은 진짜 성장 카테고리(FACT). 하지만 **"harness+큐레이션을 독립 설치 제품으로"는 구조적으로 약한 moat** — 전문가는 고가치 harness는 self-built라 하고(Böckeler), 저가치 distribution은 native 흡수 중. **설치/큐레이터 = 플랫폼이 부분 흡수할 편의 레이어**지 독립 제품 카테고리가 아님. 유일한 신뢰 wedge = **multi-CLI 큐레이션 + vetting/trust**.

### Part 3 — 검증된 rule pack 수요 (가장 강한 value prop)

- **보안 driver(FACT):** 22,511 skill 감사 → 140,963 이슈(~6.3/skill). **Snyk ToxicSkills: 테스트 skill의 36%에서 prompt injection.** → 미검증 자산 sprawl = 측정 가능한 보안 문제 = vetted 큐레이터의 가장 방어 가능한 논거.
- **fragmentation driver(FACT):** registry 1개(2025-12)→8개(2026 Q2). "개발자가 skill 찾기보다 마켓플레이스 비교에 더 시간." → 필터링 큐레이터 = 인정된 니즈.
- **채택 증거:** 사람들은 남의 config 채택함(awesome-cursorrules, awesome-claude-code 46k★, ccpi 2.3k★).
- **긴장점:** *vetted·신뢰·multi-CLI* 큐레이션 수요는 입증됨. *내 opinionated harness 채택* 수요는 **데이터 불충분/논쟁적**(Böckeler 반대). → 방어 가능 제품 = **"신뢰할 수 있는 multi-CLI 설치기 + 보안/품질 vetting"**, *"내 harness 철학 채택하라"*가 아님.

---

## 종합: 어디로 갈 것인가

### ASIS (현재 포지셔닝)
> "하네스+컨텍스트 엔지니어링으로 4개 CLI 어디서나 검증된 자산을 **설치**해주는 서비스" — 헤드라인 = **설치(installer)**.

### 문제 (근거 기반)
설치 헤드라인은 위(native 마켓플레이스)·옆(skills.sh 70+ 에이전트)에서 squeezed. 표준 수렴으로 "번역" 가치 축소. **3 에이전트 독립 수렴 = installer는 moat가 아니라 feature.**

### TOBE 후보 (4개 방향)

**방향 A — 보안·신뢰 vetting 레이어로 재포지셔닝 (근거 가장 강함)**
- ASIS: "설치기" → TOBE: "AI 코딩 자산의 *검증된·보안 감사된* 큐레이션 레이어 (4-CLI)".
- 근거: Snyk 36% prompt injection + 마켓플레이스 8개 과부하 = 측정 가능한 수요. 프로젝트는 이미 ship-checklist에 `agentshield scan` 보유 + **CLAUDE.md가 Docker 격리 실-바이너리 검증 의무화** = 정적 capability matrix(Vercel/APM)와 달리 **지속 테스트되는 호환성·보안 매트릭스**라는 진짜 white space. 단, 공개 artifact로 surface해야 가치 발생.

**방향 B — 표준 채택 + 큐레이션 번들로 집중**
- CLI 추상화 중단, AGENTS.md+SKILL.md native emit, tool 통합은 MCP 의존. 경쟁은 오직 **큐레이션 set의 품질·의견(≤3 prompt 결과)**으로. "설치기"가 아니라 "opinionated starter harness".
- 리스크: Böckeler — opinionated harness 채택 수요는 논쟁적.

**방향 C — Phase 3 검증 푸시 (feature임을 수용, 저노력·고검증)**
- native CC 마켓플레이스 + awesome-list 등재 → 첫 외부 사용자 수동 유입 → **HITO ≤3 지표를 실측** → 명제를 실데이터로 검증 또는 기각. 비용 ~1일.

**방향 D — 정직한 축소/upstream 기여 (Rule 12, surface 의무)**
- commoditization이 확정적이면, 독립 도구 유지 가치 vs 기존 고-star 프로젝트(skills.sh/awesome-list)에 큐레이션 기여 비교. validation 실패 시 분기.

### 추천 (순차 결합: C → A, 자세 B, 분기 D)

1. **지금 (저노력·검증):** 방향 C — 사용자 있는 곳(CC 마켓플레이스 + 3~4 awesome-list)에 등재. Phase 3 chicken-egg를 깨고 **HITO 실측**을 수동으로 시작. ~1일.
2. **빌드할 wedge:** 방향 A — Docker 실-바이너리 검증 의무를 **공개 보안/호환 매트릭스 artifact**로 전환. Snyk 보안 수요에 직결되는, 프로젝트가 이미 가진 *드문 자산*.
3. **기술 자세:** 방향 B — path 번역 재구현(=skills.sh 중복) 대신 AGENTS.md/SKILL.md/MCP 채택.
4. **정직한 분기:** 방향 D — 실사용자가 installer를 native/skills.sh와 중복이라 보이면, 큐레이션+보안 content 레이어로 완전 피벗 또는 upstream 기여.

---

## Key Takeaways

- **설치는 졌다, 검증은 안 졌다.** "4-CLI 설치" 헤드라인은 commoditized(3 에이전트 수렴). 살아있는 차별화 = **보안 vetting + 지속 검증된 호환 매트릭스 + ≤3 prompt 결과 지표**.
- **이미 가진 무기:** CLAUDE.md의 Docker 실-바이너리 검증 의무 + agentshield scan = Vercel/APM의 *정적* matrix를 능가할 *지속 테스트* 매트릭스 잠재력. 단 **공개 artifact로 내보내야** 가치.
- **Phase 3 병목은 등재로 깬다:** native CC 마켓플레이스 + awesome-list PR = 수동 유입. 분산 말고 순차.
- **표준에 올라타라:** AGENTS.md/SKILL.md/MCP 채택, path 번역 재구현 금지.
- **정직하게:** 본질 명제의 절반(설치)이 시장에서 졌다는 건 fail-loud 대상. 피벗 또는 재포지셔닝 결정이 다음 마일스톤.

---

## Methodology / 한계

- 3개 독립 병렬 에이전트(플랫폼·경쟁·채택), WebSearch/WebFetch/GitHub MCP. 50+ 소스, 1차 문서·changelog 우선, 최근 12개월.
- **한계:** ① 일부 star/install 수치는 search-snippet(근사 표기) ② "숫자 star-gate Trust Tier 경쟁자 없음"은 ~20 소스 기반 부재 증명(시사적, 비망라) ③ 본 프로젝트의 실제 채택 vs 경쟁자 데이터 불충분(N=1 그대로) ④ 환경 clock 2026 기준 future-dated release를 "2026 활성"으로 처리.
- **하위질문:** 플랫폼 native 지원 궤적 / AGENTS.md·MCP 표준화 / 경쟁 설치기·registry / 채택 채널 / harness 제품 방어성 / vetted pack 수요.
