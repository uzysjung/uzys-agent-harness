# ADR-021: 검증+보안 큐레이션으로 재포지셔닝 (설치 = 전달 메커니즘)

- Status: Proposed
- Date: 2026-06-06
- PR: (이 PR)
- Supersedes: (없음 — NORTH_STAR Statement는 유지, 차별화 축 emphasis만 격상)

## Context

Phase 2 자율 backlog 소진 후(`docs/todo.md`), "다음에 무엇을 만들지"가 아니라 "어느 방향으로 갈지"를 정하기 위해 deep-research(2026-06-06, `docs/research/direction-research-2026-06-06.md`)를 수행했다. 3개 독립 병렬 리서치 에이전트(플랫폼·표준 / 경쟁 지형 / 채택·하네스 제품성)가 **독립적으로 동일 결론에 수렴**했다:

1. **"4-CLI 자산 설치(installer/sync)" 명제의 절반은 commoditized.** 지난 ~12개월(2026-01~05)에 시장이 빈 곳→15+ 경쟁자로 포화. Vercel `npx skills`/skills.sh(21.5k★, 70+ 에이전트), rulesync(1.1k★, 25+ 도구), Microsoft APM이 본 프로젝트보다 넓은 cross-CLI 설치를 이미 제공. 위로는 Claude Code·Codex가 **1st-party 마켓플레이스**를 내장.
2. **차별화로 내세운 3종이 각각 이미 시장에 존재.** ① 4-CLI parity → skills.sh가 상위집합 ② "CLI 한계 정직 표기(Promise=Impl)" → Vercel capability matrix + MS APM(hooks gap 문서화)이 이미 구현 ③ Trust Tier 큐레이션 → Anthropic 공식 마켓플레이스가 2~3단 vetting 운영.
3. **표준 수렴(AGENTS.md 60k+ repo·MCP·SKILL.md, 전부 Linux Foundation AAIF)** 으로 "CLI 간 번역" 가치 축소. 남은 fragmentation은 설치 경로(install path)뿐이며 그조차 skills.sh가 symlink로 해결.

그러나 **방어 가능한 좁은 wedge가 하나 존재**한다 — **보안·신뢰 기반 큐레이션**. Snyk "ToxicSkills" 연구가 테스트 skill의 **36%에서 prompt injection**을, 별도 감사가 22,511 skill에서 **140,963 이슈(~6.3/skill)**를 발견. 마켓플레이스가 1개(2025-12)→8개(2026 Q2)로 늘며 선택 과부하 발생. "믿을 수 있는, 검증된, 진짜 멀티-CLI" 큐레이터 수요는 측정 가능하게 존재·성장 중이다.

본 프로젝트는 이 wedge에 **이미 무기를 보유**한다: CLAUDE.md가 의무화한 **Docker 격리 실-바이너리 검증**(`test/docker/`) + ship-checklist의 `agentshield` 스캔. 경쟁사(Vercel/APM)의 *정적* capability matrix와 달리, 본 프로젝트는 CI에서 매번 실제로 검증하는 **지속 테스트 호환·보안 매트릭스**를 만들 수 있다 — 단, 이를 **공개 artifact로 surface해야** 가치가 발생한다.

## Decision

**헤드라인 차별화 축을 "설치 서비스"에서 "검증된 + 보안 감사된(security-vetted) 큐레이션 레이어"로 격상한다. 설치(installer)는 차별화가 아니라 전달 메커니즘(table-stakes)으로 재정의한다.**

NORTH_STAR Statement 자체는 유지하되(세 기둥 구조 보존), 다음을 반영한다:
- 기둥 ②("검증된 자산 큐레이션 + 사용자 선택권")를 **"검증 + 보안 감사 큐레이션"**으로 격상.
- 2차 NSM에 **Asset Security Pass Rate**(자산 보안 스캔 CRITICAL/HIGH 0건 = 100%) 추가.
- Phase 3 핵심 산출물에 **공개 보안·호환 매트릭스(Docker 자동, `docs/COMPATIBILITY.md`)** + **발견 채널 등재(CC 마켓플레이스 + awesome-list)** 추가.

실행 로드맵 = **C → A → B → D** (사용자 결정 2026-06-06, 상세 `docs/todo.md`):
- **C** 발견 채널 등재 + HITO 실측 (저노력, Phase 3 진입 — N=1 탈출)
- **A** 보안·호환 매트릭스 공개 artifact (wedge 빌드)
- **B** 표준 채택 자세 (AGENTS.md/SKILL.md/MCP, path 번역 재구현 금지)
- **D** 분기 (C 실데이터 후: installer 중복 판명 시 큐레이션+보안 레이어 피벗 또는 upstream 기여)

## Alternatives

- **(A) 현 명제 유지 (설치 서비스 헤드라인 고수)** — 기각. 3-에이전트 리서치가 설치 자체의 commoditization을 독립 수렴으로 입증. installer를 moat로 광고하면 거짓 광고(Promise≠Impl 정신 위반)에 가까워짐.
- **(B) 즉시 완전 피벗/upstream 기여** — 기각(현 시점). 외부 사용자 실데이터(C) 없이 도구를 접는 건 근거 부족. D로 보류 — C 결과가 중복성을 입증하면 그때 결정.
- **(C) 저가치 유지보수 지속(P2-04 dep bump 등)** — 기각. NSM(HITO ≤3)을 전진시키지 못함. 시간 대비 가치 낮음.

## Consequences

- **긍정**: 방어 가능한 단일 wedge(보안 vetting)에 집중. 이미 보유한 Docker 검증 인프라를 공개 자산으로 전환 → 낮은 추가 비용. C가 Phase 3 chicken-egg(외부 사용자↔HITO 측정)를 깸.
- **부정/리스크**: ① harness/큐레이션 제품성은 논쟁적(Böckeler — 고가치 harness는 self-built). ② 보안 vetting도 결국 플랫폼/incumbent가 흡수할 수 있음 → D 분기로 대비. ③ C의 등재/게시는 outward-facing(사용자 GitHub/계정) — 에이전트 단독 수행 불가, 초안만 준비.
- **문서 영향**: NORTH_STAR(Statement emphasis·NSM·Phase 3·Changelog) · todo.md(로드맵 재작성) · 신규 `docs/COMPATIBILITY.md`(A 단계).
- **검증 원칙 불변**: 실환경 검증=Docker 격리, 호스트 글로벌 write 금지(CLAUDE.md).

> 본 ADR은 머지 시 Status: Accepted로 전환. NORTH_STAR Statement 변경은 Major CR(NORTH_STAR §6) — 사용자 방향 결정(2026-06-06 2회 confirm + "진행하자")이 인간 결정에 해당.
