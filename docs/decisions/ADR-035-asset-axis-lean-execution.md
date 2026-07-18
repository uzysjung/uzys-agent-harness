# ADR-035: 자산 축 판정 실행 — 기본 설치 발자국 축소 (강등 5 + 제거 1)

- Status: Accepted
- Date: 2026-07-18
- PR: #218
- Context: Lean 큐 ④ (ADR-032 "축소는 카테고리 일괄 금지 — 자산 단위" + #213 재정의). 카탈로그
  62자산 전수를 pattern-guide(P: 일반 지식 — 모델 향상이 잠식, **T2 가설**) vs operational-fact
  (O: 외부 계약 — 모델 밖에서 드리프트) 축으로 분류. 판정표 = `docs/plans/asset-axis-judgment-2026-07-18.md`
  (독립 적대 검증 통과: 62 전수 커버리지·experimental 게이트 코드 실증·npm dl 재fetch·1st-party
  대체재 코드 확인). 사용자 컨펌 2026-07-18 — A~E 전부 승인 + impeccable 추가 강등 결정.
- Decision:
  1. **판정 원칙**: opt-in 자산은 세션 비용 0 → keep (제거는 선택권만 죽임, ADR-032). 축소는
     **기본 설치 발자국**만 대상. 순수 P 단독 근거는 T2 가설이므로 제거가 아닌 강등까지만.
  2. **강등 (기본→opt-in) 5종 + 트랙 축소 1종**:
     - python-resource-management · python-performance-optimization (순수 P, T2 가설 전제)
     - netlify-cli (배포 CLI 중복 — npm 실측 10.11:1, vercel 기본 유지)
     - web-design-guidelines (순수 P — "taste 3종 중복" 주장은 검증자 정정으로 기각, P축 단독)
     - impeccable (**사용자 결정**: frontend-design official 이 기본인 이상 taste 가이드는 opt-in
       충분 — v26.92.0 "생성↔리뷰 보완재" 논리는 권고이지 결합이 아님)
     - product-skills → project-management 트랙 한정 (dev 8트랙 기본에서 제외)
  3. **제거 1종**: architecture-decision-record (62→61) — 하드 근거 2개: 최저 star(179) +
     **1st-party 대체재 실증** (change-management 룰 = COMMON_RULES 전 트랙 무조건 설치,
     ADR 템플릿+status flow 완비 — manifest.ts:59). experimental 이라 이미 opt-in 전용이었음.
  4. **잔여 experimental 3종** (railway 268 · playwright 264 · revealjs 347): 현행 유지 —
     star 재실측 후 M5 축B 에서 승격/제거 판정.
- Alternatives:
  - **P 자산 일괄 제거**: 기각 — T2 는 가설(ADR-032), 검증 경로(HITO A/B) 미실행. 강등은 가역,
    제거는 선택권 파괴.
  - **impeccable 유지(보완재 논리)**: 기각(사용자 결정) — 보완재는 권고 관계이지 설치 결합이
    아니며, 기본 생성 자산(frontend-design)이 있는 이상 리뷰/가이드 taste 는 선택으로 충분.
  - **netlify-cli 유지(선택지 제공)**: 기각 — 선택지는 opt-in 으로 유지된다. 기본 동시 설치는
    선택지가 아니라 이중 설치.
- Consequences:
  - 카탈로그 61. 기본 설치 발자국: data 카테고리 5→3, 배포 CLI 2→1, react 트랙 taste 3→1
    (frontend-design 만), dev 트랙에서 PM 15종 제외. 외부 자산 descriptor 상주비용은 실측 불가
    (unmeasured) — 방향만 주장.
  - BREAKING: 재설치/신규 설치에서 위 자산들이 기본 미포함. 기존 설치 파일은 유지(update-mode
    prune 은 rules/agents/commands/hooks 4 dir 한정). CalVer 정책상 Minor bump (v26.106.0).
  - Lean 큐 ①~⑥ 전체 종결. 후속 = M5 축B(star 재실측 기반 keep/demote/drop 전수) + HITO A/B
    (T2 가설 검증 — 강등분의 제거/복귀 판단은 그 데이터로).
