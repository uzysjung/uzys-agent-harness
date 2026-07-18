# ADR-036: doc-governance 룰 — 라이프사이클 자산화 ① (문서 현행화 강제)

- Status: Accepted
- Date: 2026-07-18
- PR: #220
- Context: 사용자 지시(2026-07-18): 실제 프로젝트(dyld_vantage·GoalTrack)에서 지키는 라이프사이클
  (북극성→아이디어 검증→스펙→로드맵/TODO 현행화→V&V→브라우저 실검증→CI)이 하네스에 녹아들어야
  하며 "이 부분들이 **지켜지는 것**이 하네스". 두 프로젝트 읽기 전용 감사 결과, 하네스의 최대
  공백 중 하나 = **로드맵/TODO 현행화의 강제 구조** — 조각(spec-drift 훅·ship-checklist)은
  배포되지만 이를 규정하는 문서 규약(SSOT 위계·동기화 의무)이 없었다. GoalTrack 의
  `doc-governance.md` 가 이 문제를 실전 해결(머지 = 코드+추적 동기화, 위반 시
  spec-drift-check.sh 가 ship 차단).
- Decision:
  1. **`templates/rules/doc-governance.md` 신설, COMMON_RULES 합류** (전 트랙 기본 — 문서 규약은
     executive 트랙에도 적용): SSOT 위계 표(역할·갱신 시점, 충돌 시 상위 우선) · "한 사실은 한 곳" ·
     spec-first · **merge = 코드+추적 동기화 의무**(TODO `[x]`+PR# / SPEC Change Log / README 현재
     상태를 머지와 같은 작업 단위로) · 현행 vs archive 격리 · 작성 원칙(why 중심·800줄 분리·추정
     금지). 파일 위치는 프로젝트 레이아웃 자유, 역할·의무는 불변 — 도메인 중립 일반화.
  2. **spec-drift-check.sh 검사 #3 백포트**: SPEC Status "Define" ↔ gate-status.json build/verify
     완료 불일치 검출. gate-status.json 부재/jq 부재 시 조용히 skip — 6-gate 미사용 프로젝트의
     First-Run 에 무영향.
  3. 룰과 훅의 관계를 룰 본문에 명시: 프로즈 규약 + 결정론 게이트는 짝이며, 규약 위반 재발 시
     게이트 확장 (recurrence-prevention 사다리 참조).
- Alternatives:
  - **스킬로 배포**: 기각 — 이 규약은 특정 시점에 발화하는 절차가 아니라 **매 작업의 상시 의무**
    (머지 직후 동기화). 상시 의무는 rules 가 올바른 표면 (트리거형은 스킬).
  - **dev 트랙 한정**: 기각 — executive/PM 트랙도 SPEC/TODO/README 를 쓰며 거짓 상태 문제는 동일.
  - **GT 원문 그대로 이식**: 기각 — GT 고유 요소(3-서비스 TODO 분할·DESIGN.md·benchmark-parity
    참조·memory 키)는 일반화에서 제거. benchmark-parity 참조는 ③ 출하 후 추가 검토.
- Consequences:
  - 전 트랙 기본 룰 4종(git-policy·change-management·gates-taxonomy·doc-governance). 룰은 상시
    컨텍스트 — 본 룰 ~60줄, 상주 비용 증가는 rules 로드 방식(요약 로드) 하에서 소폭. 라이프사이클
    큐 ②~⑥ 은 별도 릴리즈.
  - 사용자 프로젝트의 "TODO 자주 바뀌어도 현행화" 단계가 규약+게이트 짝으로 처음 완결된다.
