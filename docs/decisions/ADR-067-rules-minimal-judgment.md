# ADR-067: 배포 룰을 최소 판단 원칙으로 — 수단은 모델이 고른다

- Status: Accepted
- Date: 2026-08-04
- PR: #285
- Supersedes: ADR-038 (benchmark-parity 룰 도입 — 배포에서 제거)

## Context

배포판 `templates/rules/` 8종(258줄)이 세 가지를 뒤섞고 있었다: 판단 원칙, 절차(체크리스트·명령
시퀀스·템플릿), 그리고 강제 통제인 척하는 프로즈. 공식 문서가 확인해 주는 사실은
룰이 **매 세션 로드되는 컨텍스트이지 강제 설정이 아니라는 것**이다 — "To block an action
regardless of what Claude decides, use a PreToolUse hook instead."

여기에 사용자 판정이 더해졌다(2026-08-04): **현재 LLM 은 똑똑하다. 목표와 원칙은 정하되 수단과
방법은 모델이 자유롭게 고르게 하고, 정말 반드시 지켜야 하는 수단만 구체화한다.**

문제는 구체적이었다. 커버리지 하한표(UI 60/API 80/로직 90%)는 프로젝트마다 다른 값을 범용
배포물에 고정했고, 테스트 종류 3종 일괄 요구는 순수 계산 로직에도 E2E 를 부과했으며,
`gh pr merge --squash → checkout → branch -d` 같은 명령 시퀀스와 ADR 템플릿은 모델이 이미 하는
일을 매 세션 상주 비용으로 물렸다.

## Decision

룰에 남기는 것을 **셋 중 하나에 해당하는 것**으로 좁혔다:

1. 모델이 코드·환경에서 알 수 없는 사실 (이 하네스가 설치해 둔 스크립트, 브라우저 환경 제약)
2. 승인 경계 (되돌리기 어려운 조작, 합의 범위 이탈)
3. 반복 관측된 실패를 막는 행동 원칙 (빈 결과를 부재로 읽기, 게이트 통과를 반영으로 읽기)

| 룰 | 처분 |
|---|---|
| `test-policy` | #282 확정안으로 교체 — 고정 수치·테스트 종류 강제 제거 |
| `ship-checklist` → Delivery | 체크리스트 → 원칙 4줄 |
| `git-policy` → Git Safety | 커밋 형식·머지 명령 시퀀스 삭제, 승인 경계와 세션 정리만 |
| `change-management` → Change Boundaries | ADR 템플릿·Savepoint 절차 삭제 |
| `doc-governance` → Documentation Boundaries | SSOT 표·3분류 표 → 원칙 3줄 |
| `cli-development` → Shell Safety | `paths: **/*.sh` path-scoped 전환 (상시 상주 해제) |
| `playwright-launch` | 유지 (이미 금지문뿐) |
| `benchmark-parity` | **배포에서 제거** |

`benchmark-parity` 제거 근거: 그 룰이 담던 gap.md 표 스키마·PR 의무 필드·dogfood walkthrough 는
전부 그 작업을 할 때만 필요한 절차인데 매 세션 상주했고, 같은 일을 `audit-service-gaps` 스킬이
온디맨드로 담당한다. 상주 룰과 온디맨드 스킬의 중복이었다.

**구체적 수단을 남긴 예외 2건**과 그 근거를 문안에 명시했다 — `spec-drift-check.sh` 와
`protect-branch.sh` 는 이 하네스가 설치해 주는 도구라 모델이 존재를 알 방법이 없다. 외부 모델
리뷰(Gemini)가 "수단은 자유라면서 명령을 박아 둔 것은 자기모순"이라고 지적했고, 모순이 아니라
사용자 기준이 허용한 예외임을 각 문안에 적는 것으로 처리했다.

## Alternatives

- **이슈 #284 의 목표 구조 그대로** (룰 7종 개명 + 신규 스킬 10종 + governance 문서 5종) — 기각.
  신규 스킬 다수가 기존 스킬(`verification-loop`·`audit-service-gaps`·`ui-visual-review`)과
  겹쳤고, 룰 개명은 배포 계약 breaking 인데 얻는 것이 이름뿐이다. 사용자가 "삭제 우선"을 선택.
- **절차를 전부 스킬로 이관** — 기각. 이관은 자산 수를 늘리면서 같은 내용을 다른 층에 남긴다.
  모델이 이미 할 수 있는 절차는 **어디로도 옮기지 않는 것**이 맞다.
- **룰 파일 개명(delivery·git-safety·…)** — 기각. 기존 설치자의 update 경로에서 옛 파일이 prune
  되고 새 파일은 안 깔려 룰을 잃는다(#283 이 고친 결함과 같은 자리). 이름은 유지했다.

## Consequences

- 상주 실측 (tooling): 23개 ~5,837 → 23개 ~4,711 tok. rules 2,430 → 1,048.
  UI 트랙은 항목도 −1 (26→25, `benchmark-parity` 제거).
- **게이트 계약이 좁아졌다.** 삭제된 절 구조를 물던 테스트를 "잃으면 결함이 되살아나는 것"으로
  재작성했다 — `doc-governance-baseline-rule` 은 절 헤딩·발동조건표·3분류표 대신 원칙 4개를,
  `manifest` 는 benchmark-parity 가 "어느 트랙에도 안 깔린다"를 문다. 좁힌 만큼 옛 구조의
  재출현은 못 잡는다.
- `cli-development` 이 path-scoped 가 되면서 `.sh` 를 안 만지는 세션에서는 로드되지 않는다.
  이 저장소의 `paths:` 사용 0개 원칙이 여기서 깨진다 — 지연 로드는 공식 지원이고, 이 룰은
  "관련 파일을 다룰 때만 필요"라는 조건에 실제로 부합한다.
- **효과는 미검증이다.** 줄어든 토큰 수는 그 자체로 층이 나아졌다는 증거가 아니다. 실제 판정은
  행동 관측이고, 이 릴리스 시점에 그 관측은 없다.
