# ADR-093: 최신 모델 기준으로 불필요한 선택지 퇴역 — 외부 자산 11종 · ECC 축 · ECC 발췌 스킬 7종

- Status: Accepted
- Date: 2026-09-20
- PR: #507
- Supersedes: ADR-019(cherry-pick ↔ plugin 게이팅)의 ECC 축 · ADR-021 큐레이션 세트 중 워크플로 4종 · ADR-039(feature-dev) · ADR-073 의 전제(ECC 플러그인 존속)

## Context

이슈 #492 — 사용자가 카탈로그 61종을 "최신 모델 기준으로 아직 선택지로 둘 가치가 있는가"로 전수 판정을
요청했다. 판정 잣대는 북극성 §1(필요한 틀만 남긴다 · 모델 성능이 오르면 완화한다)과 #451/#496(필요한 제약만 ·
모델의 판단 자리를 남긴다 · 가드 증식 방지)이다. 원본 스킬·명령 본문과 설치 정의를 대조한 정적 검토(이슈 본문)가
근거이고, 제거 전후 모델별 품질·속도 실험은 하지 않았다.

세 부류가 드러났다.

1. **자율 판단을 방해하거나 일반 작업을 우회시키는 절차 체계** — `superpowers`(적용 가능성 1% 에도 호출 요구),
   `feature-dev`(7단계·에이전트 8종 고정), `wshobson-agents`(단계 병합·생략 금지), `addy-agent-skills`(하네스 위에
   또 하나의 방법론), `code-review`(PR 규모와 무관한 5-에이전트 고정 리뷰), `find-skills`(작업 대신 스킬 탐색으로
   우회), `mermaid-diagrams`(범용 문법 안내).
2. **중복 하네스 또는 불완전한 설치 구성** — `ecc-plugin`(에이전트·훅·룰을 포함한 별도 하네스와의 병존),
   `ecc-prune`(그 전용 보조 스크립트), `game-studios`(전문 에이전트 없이 스킬만 추출), `ppt-generation`(본문이
   호출하는 스크립트·실행 환경을 설치가 마련하지 않음).
3. **ECC 에서 발췌한 범용 지식 스킬 7종** — `python-patterns`·`python-testing`(항상 TDD·커버리지 80% 일괄 지정)·
   `e2e-testing`(공식 권고와 어긋난 예제)·`nextjs-turbopack`(버전 의존 개요)·`market-research`·
   `investor-materials`·`investor-outreach`. 모델이 이미 아는 것이거나 검증 방식을 미리 고정한다.

## Decision

- 위 11종을 카탈로그에서 **퇴역**시킨다(opt-in 강등이 아니라 제거). ECC 축(`--with-prune` · `withEcc`/`withPrune` ·
  `ecc-suite` 카테고리 · `scripts/prune-ecc.sh`)을 함께 걷어낸다.
- ECC 발췌 스킬 7종의 독립 제공을 종료한다 — `templates/skills/` 와 manifest 배선, `cherrypicks.lock` 에서 제거하고
  `RETIRED_SKILL_IDS` 에 올려 기존 설치본에는 `update` 화면이 "은퇴 · 지워도 된다"를 안내한다. 파일은 지우지 않는다.
- `market-research` · `investor-materials` 가 담고 있던 **품질 기준**(중요한 주장의 출처와 기준일 · 추정의 가정 ·
  반대 근거 / 수치의 출처 일치 · 지표 정의·가정·기간 일치)은 `strategist` 에이전트로 옮긴다. 시장조사 모드 목록과
  보고서 목차, 일반 피치덱 순서는 옮기지 않는다.
- 남는 외부 자산 35종은 **조건부 유지** — 삭제가 아니라 설명(description)에 "무엇을 · 언제" 를 적어 설치 화면에서
  선택 근거가 읽히게 한다. 실행 도구(배포 CLI · 문서 스크립트 · 브라우저 · 영상 처리)와 플랫폼 맥락(Supabase · shadcn ·
  Preline · GSAP · Railway)은 그 환경을 쓸 때만 고르는 자산이다.
- 퇴역은 **신규 설치·추천·선택**에서의 제거다. 기존 프로젝트의 파일과 사용자 수정분은 건드리지 않고, 설치 로그에 남은
  퇴역 자산은 `list` · `uninstall` 이 계속 다룬다.

## Alternatives

- **11종을 opt-in 으로 강등** — 기각. 이미 대부분 opt-in 이었고, 선택지로 남는 것 자체가 사용자 노이즈다(이슈 원문).
- **35종까지 "최신 모델이면 불필요"로 일괄 제거** — 기각. 실행 도구 · 파일 처리 스크립트 · 전문 참조 · 지속되는 팀
  계약(OpenSpec)이 섞여 있어 근거가 부족하다. 필요하면 자산 단위로 다시 판정한다.
- **ECC 플러그인만 남기고 발췌 스킬만 제거** — 기각. 플러그인 자체가 별도 하네스(훅 기본 활성)라 병존 비용이 크고,
  발췌 스킬은 플러그인 미선택 시의 폴백이었다. 축을 통째로 걷는 편이 배선이 단순하다.

## Consequences

- 카탈로그 61 → 50, `templates/skills/` 21 → 14, 위저드 페이지 "Workflow & ECC Suite" → "Workflow".
- 상주 비용은 스킬 본문이 아니라 descriptor 만 줄어든다 — 스킬은 메타데이터로 발견되고 본문은 필요할 때 읽히므로
  본문 분량을 절감량으로 계산하지 않는다. 효과는 "잘못된 호출 · 반복 승인 · 불필요한 위임 · 실패한 실행 경로"가
  줄었는지로 본다(이슈 원문).
- 기존 설치본의 ECC 플러그인은 그대로 남는다 — 이 릴리즈는 그것을 지우지 않고, `uninstall` 로 사용자가 뺀다.
- ADR-019 의 게이팅 축과 ADR-073 의 "플러그인이 명령을 제공한다" 전제는 더 이상 성립하지 않는다(Superseded 표기).
- 이슈가 "기본 적용 축소 · 노출 축소 · 검증 후 결정"으로 보류한 5종 — `react-best-practices` · `postgres-best-practices` ·
  `anthropic-data-plugin` · `jakubkrehel-skills` · `marketingskills` — 는 이번 범위 밖이다(condition 변경 0). 판정은
  `docs/plans/service-audit-roadmap.md` M5 축B(카탈로그 전수 keep/demote/drop)로 넘긴다.
- 문서(TRACKS · USAGE · REFERENCE · WORKFLOWS · COMPATIBILITY)의 해당 행·절을 함께 제거한다 — `doc-asset-ref-drift` 와
  `docs-supply-chain` 게이트가 누락을 잡는다.
