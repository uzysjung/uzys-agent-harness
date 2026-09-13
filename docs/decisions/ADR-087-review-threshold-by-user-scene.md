# ADR-087: 독립 리뷰의 시점은 사용자 씬, 머지 전 독립 검증의 문턱은 핵심 기능 · 되돌리기 어려운 것 · 돈·권한

- Status: Accepted
- Date: 2026-09-13
- PR: #436
- Amends: ADR-056 (머지 행의 "독립 에이전트 리뷰 필수" → 문턱. 커밋 · 배포 행은 그대로)
- Context: 코드 리뷰 문턱이 세 층에 세 값으로 있었다(감사 F-01 · `docs/plans/harness-conflict-audit-2026-09-13.md`).
  `code-reviewer` descriptor = *"MUST BE USED for all code changes"*(ECC 원본 문구) · 앵커 §4 = 완료 선언 전 ·
  Delivery 룰 = 머지 전. 가장 넓은 문으로 읽으면 CSS 한 줄에도 리뷰 에이전트가 뜨고, 씬을 이루는 수정 5건이면
  리뷰 5회다. 씬 단위 리듬(변경부 빠른 검사 → 씬 수정분 모아 독립 검토 → 통합·빌드·실사용 흐름)은 어느
  룰에도 없었다(F-14). 사용자가 #424 · #423 에 문안을 썼다 — *"코드 리뷰는 전체 사용자 씬이 완성되면 그때
  모아서"* · *"기준 = 핵심 사용자 기능 · 되돌리기 어려운 것 · 돈·권한처럼 틀리면 큰 사고만 머지 전 독립검증"*.
  벤더도 같은 말이다(OpenAI GPT-6 Astra 안내, `docs/research/vendor-signals.md`).
- Decision:
  1. **검증의 리듬**을 Delivery 룰에 넣는다 — 구현 중 변경부 빠른 검사 · 씬 수정분이 모이면 독립 검토 · 끝난 뒤
     통합 테스트 · 빌드 · 실사용 흐름. 작은 수정마다 전체 검증 반복 금지, 재검사는 영향받은 부분만.
  2. **머지 전 독립 검증의 문턱** = 핵심 사용자 기능 · 되돌리기 어려운 변경 · 돈·권한. UX 큰 변경은 페르소나
     리뷰(선택). 그 밖(테스트 하네스 · 문서 · 리팩터 · 문구 · UI · 리뷰어 처방)은 리그레션 테스트. 배포 게이트가
     풀 테스트 · E2E · 독립 검증으로 마지막에 본다 — 전역 6원칙 §4 의 "before deployment" 가 여기 착지한다.
     필수 보안 · 데이터 보호 검사는 유지.
  3. 문턱의 SSOT 는 **Delivery 룰 한 곳**. Testing 룰은 *"independent verification only where the Delivery rule
     requires it"* 로 가리키고, `code-reviewer` descriptor(배포판 · 이 리포 사본)는 씬 완료 · 문턱 위 머지 전으로
     발화 조건을 바꾼다. 앵커(전역 6원칙)는 사용자 문안이라 손대지 않는다 — *"before declaring an implementation
     complete"* 는 씬 완료와 같은 뜻으로 읽는다.
  4. 이 리포에서 문턱 위 = **설치자에게 나가는 것**(`templates/` · `src/` · 설치기 동작) · 릴리즈 배선 · 공유 상태.
     `tests/` · `docs/` · `.claude/` 개발 사본 · 문구는 리그레션만. 갈리면 독립 리뷰 쪽.
- Alternatives:
  - descriptor 만 고친다 — 기각: 룰이 "머지 전" 을 무조건으로 두면 문턱이 여전히 두 값이다.
  - 새 룰 파일(`review-policy`) — 기각: 룰은 영역별 대원칙(ADR-071)이고 Delivery 가 이미 "언제" 를 소유한다.
    파일 하나가 늘면 Codex `AGENTS.md` 32 KiB 예산을 더 먹는다.
  - 문턱을 게이트로 — 기각: "핵심 사용자 기능인가" 는 판단이라 결정론적으로 못 잡는다. descriptor 원문
    토큰의 회귀 게이트도 한 번 만들었다 빼냈다(사용자 질문 *"의미 있는거야?"*) — ECC → `templates/` 복사
    절차가 없고 그 파일은 초기 커밋 이후 첫 변경이라 되돌릴 경로가 없다. 아무도 만들지 않는 상태에는
    방어를 달지 않는다.
- Consequences:
  - 설치자의 에이전트가 수정마다 리뷰 에이전트를 띄우지 않는다. 씬이 끝날 때 한 번, 문턱 위 변경은 머지 전에
    한 번 더. 리뷰 횟수가 씬당 1~2회로 준다(측정은 없다 — 설치자 세션을 볼 수 없다).
  - 이 리포의 머지 게이트가 약해지는 구간이 있다: `docs/` · `tests/` · `.claude/` 만 바꾼 PR 은 독립 리뷰 없이
    들어온다. 그 위험은 배포 게이트의 독립 검증과 릴리즈 CI 가 받는다. ADR-056 Consequences 2 의 "머지 행은
    프로즈뿐" 은 그대로다.
  - 상주 지시문: Delivery 룰 +887 B · Testing 룰 +19 B(설치자 전원). tooling 지시문 4,379 → 4,481 tok.
    Codex `AGENTS.md` 24,414 → 25,320 B — ratchet 24.75 KiB 로 상향, F-12 PR 에서 되내린다. `context-cost-baseline.json` 의 의도적 갱신(ADR-083).
  - `reviewer` 에이전트 본문의 입력(씬 + 완료 기준, F-15)과 `AGENTS.md` 껍데기의 "즉시 commit"(F-02)은 이
    결정의 착지점이지만 별 PR 이다(감사 보고서 §적용 순서).
