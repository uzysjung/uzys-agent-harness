# 스킬 이관 감사 판정 (2026-08-02) — 이관 리포 폐기, 이 리포 복원·개선

- 감사 대상: uzysjung/uzys-agent-skills 9스킬 vs 이 리포 pre-#267(`399e225`) 원본 14스킬
- 방법: 쌍별 전 파일 비교(스크립트·템플릿·references 포함, sonnet 읽기 전용 워커 9 + 리포
  프레이밍 1) → Fable 오케스트레이터 판정. 원시 데이터 = `audit-raw.json` (증거 전문).
- 사용자 조건: "제대로 옮겨지지 않았다면 이관 리포를 버리고 이 리포 스킬을 개선" — **조건 성립.**

## 판정: 제대로 옮겨지지 않았다 — 뭉개짐은 우연이 아니라 설계였다

집계 (9쌍 전수):

| 소실 유형 | 건수 | 대표 사례 |
|---|---|---|
| decision-rule | **27** | north-star 4-Gate 판정표·우선순위 순서 게이트, gh-issue-workflow 5건 |
| worked-example | **14** | asis-tobe 의 캐시 도입 결정 예제(140s→12s, 11배 등 수치표 완결 세트) |
| incident-evidence | **7** | explain-plainly 의 "뭔 소린지 모르겠다" 2연속 실패 실측 전례 |
| executable-script | **2** | consult wrapper 2종(432줄) — env allowlist·secret 거부·timeout·artifact 수거를 **코드로 강제**하던 가드가 통째로 소실 |
| contract-schema / guardrail | 7 / 6 | NSM 3단계 절차, Will/Won't/Trade-offs 3분할 계약 등 |

- 줄 수: 원본 합계 3,164 → 이관본 1,362 (external-model-consult 는 1,019→98).
- description 트리거: 원본의 verbatim 사용자 발화("ASIS TOBE로 설명"·"뭔 소리야" 등) →
  추상 use-case 범주로 후퇴 — 공식 스킬 작성 가이드의 "구체 트리거" 기준 역행.
- **프레이밍 증거**: 이관 리포 설계 문서(agent-skills-portfolio-design.md)가 "제거할 가정"
  목록으로 구체성 제거를 **명시 지시** — "Sonnet/Opus 등급·xhigh floor 제거"(=사용자 모델
  정책), "날짜 붙은 quota 측정 제거"(=실측 전례), "고정 경로·고정 7차원·고정 coverage 제거".
  공식 가이드의 "Claude 가 이미 아는 것을 빼라"를 **정반대로 적용**했다 — 모델이 모르는
  구체(전례·수치·환경 고유 사실)를 지우고 모델이 이미 아는 일반론을 남겼다.

## 이관 리포에서 역수입할 가치 (버리기 전에 건질 것)

1. **progressive disclosure 구조** — SKILL.md 본문 + `references/` 조건부 로드 분리
2. **evals/evals.json** — 스킬별 검증 계약 (원본에 없던 것)
3. **trigger fixture 회귀 테스트** — 스킬당 positive/negative/boundary 고정
4. 결정론적 훅 2종 아이디어(agent-loop-guard·verification-evidence-gate) — 도입 여부 별도 판정
5. 일부 본문 개선 — Do-NOT 트리거 절, 과다발동 제어 게이트, 발송 전 체크리스트화

## 실행 방향 (복원 사이클 — 별도 계획 문서로)

- 원본 14스킬을 git 이력에서 복원하되 **이슈 #262 의 통합 매핑은 유지**(통합 자체는 사용자
  결정 — 실행이 문제였다): 통합 시 원본의 전례·수치·결정 규칙·스크립트를 보존 병합.
- model-orchestration 은 사용자 2026-08-02 개정판(`model-orchestration-SKILL-user-draft.md`,
  Sonnet 반복·단순 구현 레인 복원 반영)으로 대체.
- harness-health-audit·ultracode-service-audit 은 폐기 유지(사용자 확정 2026-08-02).
- 카탈로그: `kind:"skill"` npx 엔트리 9종 제거 → 번들 복원. ADR-062 (ADR-060 결정 1 부분
  Supersede) 필요.
- 구조 개선 역수입: references/ 분리·evals·트리거 픽스처를 복원본에 적용.
