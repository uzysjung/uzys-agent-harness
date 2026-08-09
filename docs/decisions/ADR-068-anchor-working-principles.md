# ADR-068: 배포 앵커를 7원칙 판단 문서로 좁힌다

- Status: Accepted
- Date: 2026-08-10
- PR: #288
- Supersedes: 없음 (ADR-055 의 앵커 5요소 절과 ADR-060 의 앵커 도입을 **유지한 채** 본문을 교체한다)

## Context

이슈 #287 에서 사용자가 직접 작성한 7원칙 본문을 배포 앵커(`templates/CLAUDE.md`)에 반영해
달라고 요청했다. 이 앵커는 한 원본이 설치 시 4개 CLI 로 각각 다른 파일명으로 나간다 —
`CLAUDE-uzys-harness.md`(Claude Code, 루트 `CLAUDE.md` 가 `@import`) · `AGENTS.md`(Codex·
OpenCode) · `.agents/rules/uzys-harness.md`(Antigravity).

**1차 출처 5건을 새로 수집했다**(원장: `docs/research/claude-md-standards-2026-08-09/`).
그 결과 세 가지가 정해졌다.

- **원칙 문서라는 장르 자체가 정당하다.** OpenAI 는 *"we started encoding what we call
  "golden principles" directly into the repository… opinionated, mechanical rules"* 로 이를
  권장한다. 같은 글의 *"By enforcing invariants, not micromanaging implementations"* 은 이
  저장소가 이미 채택한 판정("목표·원칙은 정하되 수단은 모델 자유")과 같은 문장이다.
- **분량은 판정 기준이 아니다.** Anthropic 200줄은 권고이고(넘어도 전량 로드된다), OpenAI
  32 KiB 는 품질 기준이 아니라 **절단 상한**이다. 지시문은 프롬프트 맨 앞의 정적 접두사라
  캐싱 대상이므로 비싼 것은 긴 지시문이 아니라 **불안정한 지시문**이다.
- **원칙 문서에 절차·중복을 섞는 것은 공식이 이름으로 부르는 안티패턴이다.**
  *"A 30-line procedure in CLAUDE.md. Procedures belong in skills."* ·
  *"As the file grows, push team-specific conventions into path-scoped rules and procedures into
  skills"* · *"dilutes adherence to the instructions that actually matter."*

그리고 실측 하나가 나왔다: **제안 원문을 그대로 넣으면 기존 게이트 12건이 red 다.**
`tests/lane-principle-anchor-parity.test.ts` 가 앵커 4종 × 축 3개를 채점하는데, 제안이 지우는
세 문장이 정확히 그 채점 대상이다.

## Decision

**7원칙을 원안 구조 그대로 채택한다.** 절 제목·순서·문장을 유지하고, 아래 넷만 손댄다.

1. **헤더에서 파일명을 뺀다** — `# Working Principles`. 한 원본이 세 파일명으로 나가므로
   제안의 `# AGENTS.md` 도 현행의 `# Uzys-agent-harness CLAUDE.md` 도 참인 설치가 하나도 없다.
2. **게이트가 무는 문장 3개를 복원한다** — 적대적 패널의 문턱(§1) · 만든 레인이 아닌 쪽의
   리뷰와 리뷰어의 직접 검증(§5). 게이트를 고치지 않는다.
3. **원안이 판별자 없이 두면 위험한 곳 3군데에 조건을 붙인다.**
   - §3 *"Delete verified-unused paths"* → 판별자를 **저장소 경계**로 고정. 공개 API 는
     정의상 저장소 안 호출자가 0건이라, 조건이 없으면 공개 표면 전체가 삭제 대상이 된다.
     원안의 *"Breaking active dependencies requires explicit authorization"* 은 `active` 를
     이미 알 때만 작동해 판별 단계에서는 순환이다.
   - §1 *"examine how established products…"* → 밖을 봐야만 답이 나오는데 볼 수 없으면
     "답 못 했다"고 적는다. 조사 의무와 추측 금지만 있으면 기억으로 채우고 조사했다고 적게 된다.
   - §2 *"Start with the smallest E2E path"* → **새로 만들 때만**. 같은 절의 "최소 변경"과
     충돌하는 것을 막는다.
4. **§5 의 리뷰 면제를 하드닝한다** — 원안 §5 안의 *"an unreviewed artifact is not verified"*
   와 *"If no reviewer is available, disclose…"* 가 서로를 무력화한다. 앞 문장을 살렸다.

**무번호 2절은 유지한다** — `Presenting a decision`(사용자 확정 사항) ·
`Skills that apply continuously`(상시 적용 스킬은 프롬프트 매칭에 안 걸려 이름을 부르지 않으면
본문이 열리지 않는다. `resident-doc-asset-reachability` 가 물고, `audit-harness-fit` 스킬이
이 절의 존재를 규정한다).

**앵커에 절차·프로젝트 사실·다른 층이 이미 가진 것은 넣지 않는다.**
첫 초안은 "배포 표면 전체에서 0건"이라며 9건을 추가해 상주를 +1,570 tok 늘렸는데,
**그중 6건이 이미 다른 층에 있었다**:

| 추가하려던 것 | 이미 있던 곳 |
|---|---|
| 빈 결과는 부재의 증거가 아니다 | `templates/rules/cli-development.md` (거의 같은 문장) |
| 승인 대상 목록(force push 등) | `templates/rules/git-policy.md` |
| 머지·릴리즈 검증 티어 | `templates/rules/ship-checklist.md` |
| 로컬 초록 ≠ 공유 상태 | `templates/rules/git-policy.md` |
| 의존성 확인 방법(manifest·lockfile) | 루트 CLAUDE.md 스캐폴드 `stack` 절 |
| `.uzys-agent-harness/` 검사기 지목 | `templates/rules/git-policy.md` 가 같은 방식으로 |

근거는 우리 자신의 룰에 이미 있었다 — `doc-governance` **"한 사실은 한 곳에"**.
결과: 13,018자 → **7,561자**, 상주 증가 +1,570 → **+208 tok**.

## 적용 범위

- **대상**: `templates/CLAUDE.md` 및 그로 인해 갱신이 필요한 계측 2종
  (`context-cost-baseline.json` · `docs/NORTH_STAR.md`).
- **비대상**: 개발용 루트 `CLAUDE.md`·`.claude/CLAUDE.md`. 배포 룰 7종. 루트 스캐폴드.
  앵커와 룰의 잔여 중복 정리는 **별도 PR** — 도달 범위가 다르고(룰은 4 CLI 중 2곳),
  한 PR 에 섞으면 게이트 red 의 원인이 갈린다.
- **미적용 판정**: 2차 자료의 "8줄·밀도" 논변, 상주 축소를 위한 원칙 삭제. 둘 다 사용자가
  배제했다 — 토큰은 원칙을 자르는 근거가 아니다.

## Alternatives

- **제안 원문을 그대로 넣는다** — 기각. 게이트 12건이 red 이고, 그 게이트를 고치면 원칙이
  Claude Code 에만 살아 있는지 아무도 감시하지 않게 된다.
- **절 구조를 작업 순서로 재배치한다**(첫 초안의 판단) — 철회. 원안 7절이 이미 작업 순서에
  가깝고, 재배치는 근거가 취향 수준이었다. 사용자가 쓴 구조를 유지한다.
- **측정된 공백 9건을 전부 채운다**(첫 초안) — 철회. 6건이 중복이었다. 한 층의 공백은
  **나머지 층을 grep 한 뒤에만** 공백이다.
- **`AGENTS.override.md` 로 설치한다**(Codex 계층에서 이기게) — 기각. 그 파일은 하위가 상위를
  무력화하는 유일한 수단이라, 설치물이 점유하면 사용자 파일을 조용히 가린다.

## Consequences

- 배포 앵커가 142줄/6,739자 → **156줄/7,572자**. 상주 4,755 → **4,963 tok**(+208),
  상주 항목 수 23 불변. Anthropic 200줄 권고 안쪽이고, 다른 3 CLI 는 32 KiB 상한의 절반 이하다.
- `context-cost-ratchet` 이 토큰 축 red 를 냈고, 게이트가 규정한 정당화 절차대로
  `npm run cost:baseline` 을 같은 커밋에 담았다 — 증가 승인은 사용자 결정이다.
- **재사용 교훈**: 상주 지시는 층이 여럿이다(앵커=원칙 · 룰=제약 · 루트 스캐폴드=프로젝트 사실 ·
  스킬=절차). 한 층에 문장을 더하기 전에 **나머지 층을 grep** 해야 공백과 중복이 구분된다.
  "이 문장이 없으면 어떤 실수가 나는가"만으로는 부족했다 — 그 질문에 9건 전부 답이 나왔지만
  6건은 다른 층이 이미 막고 있었다.
- **미검증**: 이 문장들이 실제 모델 행동을 바꾸는지는 측정하지 않았다. 전부 문면·배선 판정이다.
  4 CLI 실설치 확인도 이 PR 범위 밖이다.
