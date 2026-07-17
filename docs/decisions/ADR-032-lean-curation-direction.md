# ADR-032: Lean 큐레이션 방향 — 인사이트 스킬 중심 재정렬

- Status: Accepted
- Date: 2026-07-17
- PR: #212 (본 CR) · #211 (README 선반영 — 방향 서술 + disclaimer)
- Supersedes: 없음 (ADR-021 보완 — 대체 아님, 아래 Decision ①)

## Context

사용자(메인테이너) 방향 지시 (2026-07-17):

> "루프/하네스 엔지니어링 관점에서 도움을 주는 인스톨러가 되고 싶어. 간결하게 꼭 필요한 것만
> 남겨야겠지 … gpt5.6, opus4.8에서도 굉장히 좋아져서 대부분 정말 인사이트풀한 스킬 외에는 필요
> 없다는 것을 절감해 … superpowers, gsd, bmad 같은 예전의 스펙드리븐이나 워크플로우 강제하는
> 구조는 이제는 별로 필요없는 것 같아 … git, pr 정책만 잡고 애자일이 무엇을 추구하는지를 잘
> 정의해서 ai에게 원칙을 잘 지키면서 필요한 것들은 직접 만들어 갈 수 있는 구조가 좋을 것 같아."

테제 5개(T1 정체성 / T2 모델 향상 근거 / T3 생존 스킬 / T4 번들 폐기 / T5 원칙 기반 구조)로
정리 후 **5-페르소나 독립 패널**(회의적 신규 사용자 · 방법론 실천가 steelman · 메인테이너 경제성 ·
적대적 증거 검증자 · 루프 엔지니어링 전문가, Sonnet 티어, 상호 비공개)로 검토했다.

패널 실측 발견: ⓐ 워크플로 번들 6종은 **이미 전부 opt-in·비체크** — 미설치 사용자의 컨텍스트
비용이 이미 0 ⓑ README에 1st-party 자산 3종(model-orchestration·harness-health-audit·
codex-consult) 미표기 drift(#211에서 정정) ⓒ 컨텍스트 비용을 재는 NSM이 부재해 "간결" 주장
자체가 검증 불가 ⓓ Docker 검증 49/61 = 12자산이 이미 RED(축소론의 유일한 정량 근거)
ⓔ 외부 사용자 ~0(M2 보류 중) = 카탈로그 재구조화 이행비용이 0인 유일한 창.

## Decision

1. **정체성**: 기둥①(하네스 + 컨텍스트 엔지니어링)을 "루프/하네스 엔지니어링 노하우"로
   전면화. 기둥②(검증 큐레이션, ADR-021)는 **대체가 아니라 보완** — 규모(quantity)를 줄이되
   품질 기준(vetted + Docker 실설치 검증)은 유지. (경제성 페르소나 R3 채택)
2. **번들 처리**: 워크플로 번들 6종(superpowers·ecc·openspec·bmad·addy·wshobson)은
   **opt-in 유지 — 제거하지 않는다** (사용자 확정 2026-07-17). wshobson-agents는 T3
   기준(오케스트레이션·cross-CLI)에 부합하므로 "번들 일괄" 취급 금지 — 향후 개별 판정.
3. **T2의 지위**: "모델 향상 → 스킬 불필요"는 **가설**로 취급한다(공개 문서에는 관점/방향으로만
   표기 — README #211이 그렇게 서술). 검증 경로 = 기존 HITO 계측으로 번들 有/無 A/B 비교.
4. **축소 원칙**: 카테고리 일괄 컷 금지. 자산 단위로 `pattern-guide`(모델 대체 가능성 높음 —
   1순위 축소 후보) vs `operational-fact`(CLI 플래그·인증 플로우 — 모델 무관 upstream drift,
   유지) 구분. 축소 착수점 = 검증실패 12자산 개별 판정.
5. **T5의 구체화**: "애자일 방향성 정의"는 그대로는 Vocabulary Gate(-1) 탈락 — 기존
   `gates-taxonomy`(Pre-flight/Revision/Escalation/Abort) + rules 10개가 이미 그 구체화
   결과물임을 인정하고, 신규 산문 원칙 문서를 만들지 않는다.
6. **실행 큐** (사용자 승인, 4건 전부): ① Session-Start Context Cost 표시 + CI ratchet
   ② 검증실패 12자산 판정 ③ WORKFLOWS.md "언제 필요 없는가" 조건표(본 CR에 포함)
   ④ 트리거 중복 탐지 CI. SSOT = `docs/plans/lean-direction-2026-07-17.md`.

## Alternatives (기각)

- **번들 카탈로그 제거**: 패널 4/5 반대 수렴 — 이미 opt-in이라 잠식 감소 효과 0, vetted
  기준(★≥1000 + Docker 검증) 통과 자산을 주관 판단으로 빼면 검증 체계 자체의 신뢰 훼손,
  BMAD 등 검색 유입 경로 상실. 기각.
- **번들 "비권장" 배지 강등**: "tiers inform, never block" 원칙과 긴장 + 강등 근거(모델 능력
  주장)가 다인 팀/감사 니즈(인간측 문제)에 대한 근거가 아님. 기각 — 대신 WORKFLOWS.md
  조건표로 "언제 필요 없는가"를 정직하게 안내.
- **스킬 개수 상한**: 잠식의 실체는 descriptor 상주비용(작음)보다 유사 스킬 간 라우팅
  혼란(큼) — 개수 캡 대신 트리거 중복 탐지 CI + Context Cost ratchet 채택.
- **"루프/하네스 엔지니어링"을 랜딩 카피로**: 신규 사용자 페르소나 10초 테스트 실패
  (미정의 전문용어 2연속). 랜딩 첫 문장 유지, 철학은 README 섹션으로 격리.

## Consequences

- README(#211): "Curation philosophy — lean by default" 섹션 + 자산 3종 표기 정정. 방향
  서술 프레이밍("catalog unchanged" 명시)이라 no-false-ship 비위반.
- NORTH_STAR: Lean 개정 문단 + Session-Start Context Cost NSM + Will(컨텍스트 이코노미) +
  Trade-offs(Lean 기본값 — 포기 사용자군 명시) + Changelog.
- "멀티에이전트 동시 개발 가능"은 안전장치(worktree 관례·파일 클레임 hook) 출하 전까지
  **광고 금지** — README에 roadmap으로만 표기. 동시성은 공유 계약을 덜이 아니라 더 요구한다
  (방법론 실천가 페르소나 W2).
- 신규 자산 추가의 암묵 기준 상승: 컨텍스트 비용 의식 + 인사이트/운영사실 우선. 자산 수
  성장을 feat 로 보는 관행 종료.
- 리스크: 가설(T2)이 실측(HITO A/B)에서 반증되면 Lean 개정의 근거 문단을 갱신해야 함 —
  가설 표기를 유지하는 이유.
