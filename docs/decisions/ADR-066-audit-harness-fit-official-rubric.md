# ADR-066: audit-harness-fit 판정 루브릭을 공식 체크리스트 우선으로 재정렬

- Status: Proposed
- Date: 2026-08-03
- PR: #TBD
- Supersedes: ADR-064 의 판정 프레임("3근거가 판정 기준") 부분 — 스킬 존재·5단계·전 트랙
  기본 결정은 현행 유지

## Context

첫 실전(이 리포 전체 감사, 2026-08-03)에서 사용자 판정: **"밥값" 프레임은 객관 판정이 어렵고,
감사 산출물의 성공 기준이 모호했다.** 공식 문서(support 14553240 · code.claude.com/memory ·
best-practices)가 이미 구체 기준을 제공한다 — 담으라 5범주(Commands · Conventions ·
Architecture · Hard constraints · Known gotchas) · 빼라 목록(history/changelogs · 코드에서 유도
가능 · 자주 변하는 정보 · aspirational) · 구체성("concrete enough to verify") · 200줄 ·
프루닝 질문("Would removing this cause Claude to make mistakes?"). 추상 프레임이 이 목록 위에
얹혀 판정을 흐렸다.

## Decision

1. **Stage 3 VERDICT 의 1차 루브릭 = 공식 체크리스트.** 각 절을 5범주에 매핑하고, 빼라
   목록 해당 여부를 판정한다. 매핑 불가 + 빼라 미해당이면 프루닝 질문으로 판정한다.
2. **감사 실행의 성공 기준을 기계 확인 가능 형태로 스킬에 명시한다**: 전 절 범주 매핑표 ·
   제외 목록 위반 0(grep 가능한 것은 grep 명령 병기) · 분량 before→after 실측 · 기존 게이트
   green · 남는 줄 전부 현재형 원칙.
3. **"3근거"(공식 인용·차단 로그·계측)는 EVIDENCE 수집 축으로 유지**하되, 판정 서열에서
   공식 인용이 1순위다. 주관 판정 금지 원칙은 유지("의견은 근거가 아니다").
4. **description 을 공식 상한 1,024자 이내로 단축** — 현행 1,156자. 테스트가 단언하는 트리거
   문구는 보존한다.

## Alternatives

- 스킬 폐기 후 공식 문서 링크만 남김 — 기각: 측정 절차(Stage 1 함정 3종)·증거 수집(로그
  0줄 ≠ 무죄)·RELOCATE 표는 공식 문서에 없는 실행층이고 인용 게이트로 검증돼 있다.
- 프레임 유지 + 예시만 보강 — 기각: 첫 실전에서 산출물이 이미 모호 판정을 받았다.

## 적용 범위

`templates/skills/audit-harness-fit/`(SKILL.md · references) + `.claude/skills/` byte 미러 +
`tests/audit-harness-fit-skill.test.ts`(인용 전량 대조 재고정 + description 상한 단언 신설).

## Consequences

- 감사 보고서가 "판정표"가 아니라 "재작성 결과물 + 기준 충족 실측"을 내게 된다.
- description 단축은 트리거 정확도 회귀 위험이 있다 — 트리거 문구 보존을 테스트로 잠근다.
- 나머지 자작 스킬 6종의 description 초과는 본 ADR 범위 밖(별도 사이클).
