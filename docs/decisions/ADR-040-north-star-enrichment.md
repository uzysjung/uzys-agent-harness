# ADR-040: north-star 스킬 보강 — metric-as-proxy · Pillars · 우선순위 순서 (라이프사이클 자산화 ④)

- Status: Accepted
- Date: 2026-07-18
- PR: #226
- Context: 라이프사이클 자산화 큐 ④ (SSOT `docs/plans/lifecycle-codification-2026-07-18.md`).
  실무 증거 = 실운영 프로젝트 2종의 North Star 문서 읽기 감사(쓰기 0): ⓐ 투자 분석 서비스 —
  측정 불가 목표(사용자 수익)의 프록시 선언 + 5 Pillars(정의/현재 위치/전방 목표/가설) + 전
  모듈↔축 매핑 표 + 로드맵 정렬 점검 기록 ⓑ 목표 추적 SaaS — 4-gate 휴리스틱 + 작업 우선순위
  순서 3단계(기본→완성도→차별화, 건너뛰기 금지) 실운영. 기존 `north-star` 스킬(전 트랙 기본)엔
  Statement/NSM/Will-Won't/4-gate 는 있으나 위 3요소가 없었다.
- Decision:
  1. **기존 스킬 보강, 신설 아님** — `templates/skills/north-star/` 의 SKILL.md + 템플릿에 주입
     (원칙: 기배포 자산과 중복 신설 금지). 카탈로그 무변경.
  2. 주입 3요소: **metric-as-proxy**(측정 불가 목표 → 프록시 명시 선언 + 양·품질 짝 + 굿하트
     경계) / **Pillars + 모듈↔축 매핑**(축 4요소 정의, 미매핑 모듈 = 착수 전 재검토) /
     **우선순위 순서 게이트**(4-gate "할 것인가"와 직교하는 "언제": 기본→완성도→차별화, 상위
     미완 시 건너뛰기 금지, advanced 는 research/ADR 선행).
  3. 계약 테스트 신설 — 주입 마커 + **도메인 중립 가드**(실프로젝트 지표명·고유명이 템플릿에
     유입되면 fail; SKILL.md Examples 의 참고 사례 언급만 허용).
- Alternatives:
  - **별도 스킬 신설 (예: pillars-map)**: 기각 — 세 요소 모두 "North Star 문서의 구성 요소"라
    한 문서·한 스킬의 응집이 맞다. 스킬 분리는 트리거 중복(Jaccard)과 설치 발자국만 늘린다.
  - **rule 로 승격 (상시 로드)**: 기각 — North Star 작성/리뷰는 호출형 절차(신규 프로젝트·분기
    리뷰·scope 의심 시)지 상시 의무가 아니다. 상시 의무는 rule, 호출형 절차는 skill 경계 유지
    (ADR-038 과 동일 논리).
  - **우선순위 순서를 gates-taxonomy 룰에 주입**: 기각 — gates-taxonomy 는 검증 체크포인트
    4유형(Pre-flight/Revision/Escalation/Abort)의 분류지 작업 순서 규칙이 아니다. 순서는 북극성
    문서의 의사결정 휴리스틱 소속.
- Consequences:
  - 전 트랙 신규 설치본의 NORTH_STAR 스캐폴드가 8섹션으로 확장 — 측정 불가 목표를 가진
    프로젝트(대부분의 실서비스)가 "좋은 제품" 류 목표에서 멈추지 않고 최적화 대상을 선언하게
    된다.
  - 기존 설치본은 재설치 전까지 구판 유지 (스킬 dir copy — update 모드에서 갱신).
  - 도달 범위 = 4-CLI (north-star 는 COMMON_SKILL_DIRS 로 claude 설치, codex/antigravity/
    opencode 는 dev-method 만 포팅되므로 **비-claude 는 미도달** — ① doc-governance 와 동일
    조건의 skills 판. 비-internal 스킬 포팅 커버리지 확장은 별도 백로그).
