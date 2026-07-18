# ADR-041: V&V verdict 어휘 코드화 + verification-loop C2→C3 재분류

- Status: Accepted
- Date: 2026-07-18
- PR: #227
- Context: 라이프사이클 자산화 ⑤ (SSOT `docs/plans/lifecycle-codification-2026-07-18.md`).
  실무 증거 = dyld_vantage 의 fresh-opus verdict 의식(PRD 이력에서 V&V 가 실회귀를 반복
  검출) + 본 하네스 릴리즈 사이클의 SOD 리뷰 관행(고정 판정 + 심각도 라벨). 기존
  verification-loop 은 "Overall: READY/NOT READY" 자유 서술로 끝나 결함 은폐 여지가 있었고,
  model-orchestration 의 V&V separation 은 "누가 검증하나"만 규정하고 "무엇으로 판정을
  보고하나"는 비어 있었다.
- Decision:
  1. **verdict 어휘 고정** — 종결 판정 `PASS` / `PASS_WITH_NITS` / `FAIL` 3종 + 발견 항목
     심각도 `CRITICAL` / `HIGH` / `MEDIUM` / `LOW` 4종. 규약: severity 는 수정 난이도가
     아닌 영향 증거로 판정 / FAIL 은 수정만으로 안 닫히고 재검증 재현이 한 사이클 /
     구현 인스턴스의 자기 verdict 금지(fresh instance).
  2. **주입 위치 = 기존 자산 2곳** (신설 금지 원칙): verification-loop Output Format +
     신설 "Verdict Contract" 절, model-orchestration "V&V separation" 절 + quick reference.
  3. **verification-loop C2 → C3 재분류** — 내용 수정으로 modified cherry-pick 이 되므로
     ADR-019 분류 체계상 C3 (plugin 무관 항상 install, `applies: dev`). cl-v2 전례 준용.
     `DEV_SKILL_DIRS_ECC` 에서 분리해 `MODIFIED_DEV_SKILL_DIRS` 신설.
- Alternatives:
  - **C2 유지한 채 내용만 수정** — 기각. withEcc(plugin ON) 사용자는 ECC plugin 판(verdict
    없음)을 쓰게 되어 "verdict 코드화됨" 광고가 해당 사용자에게 거짓 (no-false-ship).
    ADR-019 가 modified=C3 를 이미 규정.
  - **이 세션 SOD 어휘(APPROVE/APPROVE WITH NITS/REQUEST CHANGES) 채택** — 기각. 코드
    리뷰 어휘와 V&V(검증) 어휘를 분리 유지 — V&V 는 게이트(빌드·테스트·보안) 통과 여부가
    본질이라 PASS/FAIL 계열이 정합. 플랜 ⑤ 명세도 PASS 계열.
  - **별도 verdict 룰 신설** — 기각. 판정 어휘는 검증 절차(verification-loop)와 위임 정책
    (model-orchestration)에 붙어야 발화 시점에 로드된다. 독립 룰은 중복 신설.
- Consequences:
  - dev 트랙 설치본은 withEcc 여부와 무관하게 수정판 verification-loop 을 받는다. plugin
    ON 사용자는 plugin 판과 병존 (cl-v2 와 동일한 수용된 트레이드오프).
  - 도달 범위(4-CLI 관점) = claude 설치본 한정 — ECC cherry-pick 스킬은 codex/agy 포팅
    커버리지 밖 (기존 백로그 "비-internal 스킬 포팅 확장"에 귀속, ①③④와 동일 조건).
  - 계약 테스트 `tests/vnv-verdict.test.ts` (섹션 슬라이스 앵커, ④ mutation 교훈) +
    manifest C3 테스트가 어휘·재분류를 가드. repo-local `.claude/skills` 복사본 byte-동일
    가드 포함.
