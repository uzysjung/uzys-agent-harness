# ADR-064: audit-harness-fit — 상주 조종층 밥값 감사 스킬 신설

- Status: Accepted
- Date: 2026-08-02
- PR: #273
- Context: 사용자 제안(2026-08-02) — "공식 문서 2편(prompting-claude-opus-5 ·
  claude-code-power-user-tips)의 CLAUDE.md·rule·hook 관점을 기반으로 하네스 정리 스킬".
  두 문서는 반대 방향의 루프 한 쌍이다: power-user-tips 는 축적 루프(실수→CLAUDE.md 추가,
  강제는 hooks·permissions 로), opus-5 프롬프팅 문서는 감량 루프(검증·재확인 지시 제거 —
  "legacy harness scaffolding" 명시, 부정문→긍정 예시, 심각도 억제 지시의 문자적 순종 함정).
  축적 루프만 있으면 상주층은 자라기만 한다. 같은 날 이 리포가 수동으로 수행한 룰·훅 다이어트
  (룰 1,100→535줄·죽은 훅 삭제·차단 계측 도입)가 이 스킬이 자동화할 사이클의 원형이고,
  판정 기준 원문 인용은 `docs/research/rules-hooks-value-audit-2026-08-02/` 에 영속돼 있다.
  스킬 지형상 이 슬롯은 설계적으로 비어 있다 — `recurrence-prevention` 이 "평시 조종층 감사에
  쓰지 말라"고 명시하고, `audit-service-gaps` DRIFT 는 서비스 문서↔코드만 본다.
- Decision:
  1. 번들 스킬 `audit-harness-fit` 신설 — 설치된 프로젝트의 상주 조종층(CLAUDE.md 와
     @import 체인 · rules · hooks · permissions · 스킬 descriptor)을 5단계로 감사:
     INVENTORY(상주 표면·항목 수·토큰 실측) → EVIDENCE(hook-blocks.log · git 정정 이력 —
     로그 0줄 ≠ 무죄) → VERDICT(절 단위 keep/rewrite/demote/delete, 판정 질문 "이 줄을
     지우면 실수하는가" + Opus 5 세대 린트: 검증·재확인 지시, 부정문 다발, 심각도 억제,
     thinking 금지 지시 플래그) → RELOCATE(절차→스킬 · 강제→훅/permissions · 사실→코드/테스트)
     → APPLY(제안까지 기본, 적용은 사용자 승인 후).
  2. 판정 근거는 세 가지만: 공식 문서 기준(인용을 references/ 로 동봉) · 차단 로그 ·
     계측 수치. "느낌 대 느낌" 판정 금지.
  3. 배치: `INTERNAL_BUNDLED_SKILL_IDS` 에 추가, condition = any-track(전 트랙 기본,
     사용자 확정) — 하네스가 모든 트랙에 룰·훅을 설치하므로 자기유지 루프도 전 트랙이다.
     카탈로그 56→57. DEV_METHOD(개발 방법론 6종)에는 넣지 않는다 — 개발 전용이 아니다.
  4. 스킬은 이 리포 아닌 **임의 프로젝트에서 동작**해야 한다 — 이 리포의 npm 스크립트
     (cost:report 등)에 의존하지 않고 범용 계측(파일 열거·토큰 추정)으로 잰다.
     hook-blocks.log 는 있으면 읽고, 없음을 무죄 증거로 쓰지 않는다.
- Alternatives:
  - 같은 날 폐기 확정한 `harness-health-audit` 부활 — 기각: 그 스킬은 4질문 판단 프레임
    (truth/efficacy/economy/SAFE)으로 판정이 판단자 역량에 의존했다. 신설 스킬은 공식 기준
    인용 + 로그 + 계측의 세 데이터 근거로만 판정하며, 차단 로그라는 데이터 축은 폐기 시점에
    존재하지 않았다(같은 날 도입). 폐기 결정은 유지된다.
  - 룰(상주 프로즈)로 만들기 — 기각: 여러 단계 절차는 공식 기준 자체가 스킬로 내리라는 대상.
  - opt-in — 기각(사용자 확정): 계측된 최소 하네스가 제품 북극성이고, 스스로를 감사하는
    루프는 그 상품화다. 상주 비용은 descriptor 1줄.
- 적용 범위: 신규 설치 + `update`(스킬 동기화 경로). 기존 설치본은 update 시 수신.
- Consequences:
  - 카탈로그 56→57 · any-track 기본 스킬 3→4종. 문서 분모·트랙 매트릭스 테스트 갱신 필요.
  - 이 리포 자신도 설치 대상이다 — 다음 정기 감사부터 이 스킬 절차로 수행해 dogfood 한다.
  - references/ 동봉 인용의 원문 대조 책임은 `docs/research/rules-hooks-value-audit-2026-08-02/`
    가 SSOT (배포 사본에는 리포 경로·ADR 번호를 싣지 않는다 — distribution-hygiene).
