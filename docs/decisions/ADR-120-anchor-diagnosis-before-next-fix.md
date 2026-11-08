# ADR-120: 배포 앵커 §5 에 "같은 가정의 수정 두 번 실패 → 가정 시험 · 처음 생긴 곳에서 고치기"를 넣는다

- Status: Accepted
- Date: 2026-11-08
- PR: #975
- Amends: ADR-091 결정 1(앵커는 사용자 문안) — 사용자가 조사 결과의 앵커 복원 후보 3건 중 추천안(§5 두 문장)을 채택했다(2026-11-08, #974).
- Context: pstack 원칙 24종을 앵커와 원칙별로 대조했다(근거 = `docs/research/pstack-principles-comparison-2026-11.md`).
  충돌 8건은 모두 하네스 쪽을 유지했고, pstack 이 더 구체적으로 말하는 자리 3곳을 앵커 복원 후보로 냈다.
  - M1+M2(§5): 예상 밖 결과가 나오면 다음 수정 전에 진단을 고친다 · 같은 가정의 수정 두 번 실패 시 가정을 시험한다 · 처음 생긴 곳에서 고친다 · 가드 판별 기준.
  - M3(§3): 검증 · 에러 처리는 신뢰 경계와 실제 실패 가능성에만 둔다.
  셋 다 사용자 전역 원칙에 같은 뜻이 있고 배포 문안(#463)으로 옮길 때 빠졌다.
  M1+M2 가 막으려는 실패(수정 실패 뒤 가드를 덧대 회차를 소모)는 이 리포에서 반복 관측됐다. PR-B 는 +457줄로 커졌고, #911 · #918 은 각각 5회차를 돌았다(`docs/model-evidence.md` E-2026-10-25-07).
  그 교훈은 `implementer` 에이전트 파일에만 있고, 그 파일은 Claude Code 에만 설치된다.
- Decision:
  - 배포 앵커 `templates/CLAUDE.md` §5 두 번째 문단을 다음으로 바꾼다.
    ```
    Use unexpected results to update the diagnosis before trying another fix; when
    two fixes built on the same assumption have failed, test that assumption first.
    Fix a fault where it first arises rather than where it surfaces; a guard is a fix
    only when the state it handles can legitimately occur. When no productive,
    authorized path remains, report the precise blocker and what would resolve it.
    ```
  - 이 리포는 자기 자신에 하네스를 설치하지 않으므로 앵커가 닿지 않는다. 그래서 개발 레인 문서 `.claude/CLAUDE.md` 에 같은 결정을 한국어로 둔다.
    - 그 문서는 `AGENTS.md` 가 가리켜 4 CLI 모두 읽는다.
    - 사용자 전역 원칙과 겹치는 "진단부터 고친다"는 그 문서 규칙(전역 6원칙을 복제하지 않는다)에 따라 빼고, 전역에 없는 두 문장만 둔다.
- Alternatives:
  - **세 문장 모두 넣는다(M3 포함, +392 B)**: 보류. 과잉 방어 코드는 관측된 적이 없다. 벤더(Anthropic)도 "그 행동이 보일 때" 넣으라고 조건을 단다. 관측되면 다시 판정한다.
  - **넣지 않고 효과부터 측정한다**: 기각. 사용자가 추천안을 채택했다. 리포 관측은 "문장이 없을 때의 실패"이지 문장이 막는다는 증거가 아니다. 그 한계는 아래 Consequences 에 남긴다.
  - **사용자 전역 `~/.claude/CLAUDE.md` 에 넣어 이 리포에 반영한다**: 채택하지 않았다. 사용자 개인 파일이라 모든 프로젝트에 영향을 준다. 게다가 Claude Code 만 읽으므로 이 리포의 다른 CLI 작업에는 닿지 않는다.
- Consequences:
  - 4 CLI 설치자가 매 세션 읽는 앵커가 +236 B(약 +59 토큰) 늘어난다. tooling 지시문 기준 ~4,107 → ~4,166 이다.
  - 원문 "update the diagnosis or approach" 의 "or approach"(수정이 아닌 일에서 예상 밖 결과가 나오면 접근을 바꾼다)가 빠진다. 사용자가 채택한 문안 그대로다.
  - 효과는 측정하지 않았다. 반영 뒤 첫 관측은 이 리포 리뷰에서 "가드 덧대기" 지적 회차가 줄었는가다. 설치자 프로젝트 관측은 0이다.
