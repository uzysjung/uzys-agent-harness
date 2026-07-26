# ADR-055: 설치 앵커 2파일의 역할을 분리하고 `.claude/CLAUDE.md` 를 6원칙 + 3문장으로 교체한다

- Status: Accepted
- Date: 2026-07-26
- PR: (머지 시 기재)
- Supersedes: — (없음. ADR-054 는 **폐기가 아니라 재배치** — 아래 Consequences 참조)

## Context

설치 앵커가 두 파일인데 역할이 겹쳐 있었다: 루트 `CLAUDE.md`(프로젝트 설명 스캐폴드)와
`.claude/CLAUDE.md`(하네스 원칙). 후자가 `Rule 1~12` + 안티패턴 + 의사결정 절차 + Self-Audit +
Context Management 를 이고 있었는데, 리뷰 실측에서 **그 5항목 중 앵커가 유일 소유자인 것이 0개**로
나왔다 — 전부 룰·스킬·descriptor·다른 문서가 이미 소유한다.

사용자가 최상위 `~/.claude/CLAUDE.md` 를 *"프로시저가 너무 많아서"* **6개 결정 원칙**으로 교체했고,
그것을 이 하네스의 배포 앵커에도 적용하기로 했다.

## Decision

**A1 — 앵커에는 원칙만 둔다.** 기술스택·스킬 라우팅·agents 목록·필수 스킬·문서 위치는 앵커에서
**제외**한다(사용자 AskUserQuestion 확답).

`templates/CLAUDE.md`(= 설치되는 `.claude/CLAUDE.md`, 그리고 임베드로 non-claude 3 CLI 의 앵커 —
codex·opencode 는 `AGENTS.md`, antigravity 는 `.agents/rules/uzys-harness.md`)를
**사용자 기준선 6원칙 본문 그대로 + 3문장**으로 교체한다:

- **삽입 1**(원칙 1 끝) — 적대적 패널을 **문턱과 함께** 규정. 문턱이 없으면 두 방향으로 다 실패한다:
  안 쓰거나(사용자가 두 번 지시해야 했다), 사소한 것에까지 써서 비용이 판단 가치를 넘는다.
- **삽입 2**(원칙 4 안) — *"A reviewer verifies the work itself rather than trusting the author's
  report."* 리뷰어가 **보고서를 믿는 대신 자기 증거를 얻는다**.
- **삽입 3**(파일 끝, `## Decisions and explanations`) — 옛 `When Requesting Decisions` **5요소를
  전부** 옮긴다(전후 맥락 상세 · 추천 · UI/UX 형태 · AS-IS→TO-BE · trade-off). 그리고
  *"이름 하나가 두 대상을 가리키는 것"*이 설명 실패의 통상 원인이라는 진단. 조건절
  (`Where … are installed`)은 **필수**다 — `explain-plainly` 는 opt-in(기본 미설치),
  `asis-tobe-decision` 은 `has-dev-track` 이라 3개 트랙에 없다.

**이 리포 `.claude/CLAUDE.md` 는 6원칙을 복제하지 않는다** — 전역 파일이 SSOT 다. 리포 고유분만
남긴다: 대원칙(레인) + 구현 위임 + 의사결정 4줄 + Non-Goals 한 줄.

## 적용 범위

| 축 | 범위 |
|---|---|
| 파일 | `templates/CLAUDE.md`(전면 교체) · `.claude/CLAUDE.md`(리포 고유분만) · `src/project-claude-merge.ts`(배너) |
| CLI | **4 CLI 전부.** claude 는 `.claude/CLAUDE.md`. non-claude 3종은 **같은** `{PROJECT_RULES}` 임베드(`src/codex/agents-md.ts` 의 `renderAgentsMd`)를 쓰되 **산출 경로가 갈린다** — codex(`src/codex/transform.ts:78`)·opencode(`src/opencode/transform.ts:72`) 는 `AGENTS.md`, **antigravity 는 `.agents/rules/uzys-harness.md`**(`src/antigravity/transform.ts:109`). `templates/antigravity/AGENTS.md.template` 는 **소스 템플릿이지 산출 경로가 아니다** |
| 트랙 | 전 트랙 (앵커는 트랙 무관 상주) |
| 범위 밖 | 루트 `CLAUDE.md` 의 FILL 6섹션(배너 3행만 예외) · 리포 루트 `/CLAUDE.md` · non-claude 앵커의 `## Agents` 표 · 게이트 개정(E6, 테스트 작성 레인) |

## Alternatives

| 대안 | 왜 기각 |
|---|---|
| 앵커에 스택·라우팅·agents·문서위치도 유지 | 리뷰 실측에서 **유일 소유자인 항목 0개**. 두 번째 사본은 drift 밭이 된다 |
| 6원칙을 이 리포 `.claude/CLAUDE.md` 에도 복제 | 전역 파일이 SSOT. doc-governance "같은 사실을 두 곳에 두지 않는다" |
| 배포판에 구현 위임 문장 유지 | 에이전트는 `.claude/agents/` + dev 트랙만 → **4 CLI 앵커 전부에 나가므로 설치 절반에서 거짓**(ADR-052 가 CRITICAL 로 기록한 형태) |
| 삽입 1 을 3문장으로 직선화 | 내용이 미세하게 변한다는 지적 후 **사용자가 원안 채택으로 확정** |
| 배너에서 `.claude/CLAUDE.md` 만 지목 | 루트 `CLAUDE.md` 는 무조건 생성되나 `.claude/` 는 claude 선택 시만 → **non-claude 단독 설치에서 거짓 문장** |

## Consequences

1. **상주 비용 — 이번 단위는 순감이 아니라 `순증 +151`(tooling, 개수 축 불변)이다.**
   3값: ⓐ 앞 단위(레인 원칙) 순증 **+217** ⓑ **이번 단위 +151** ⓒ 현재 절대값 **29개 · 6,323 tok**.
   원인은 **기준선 6원칙 원문 자체가 옛 12룰보다 길다** — 6원칙 = 1,189 tok, 옛
   `Rule 1~12` 구조 전체 = 1,064 tok. 여기에 삽입 3 이 옛 5요소를 **전부** 옮기면서(사용자 정정)
   더해졌다. 삽입 1·2 로 옛 레인 원칙 18줄 절을 압축해 되돌린 몫이 있으나
   본문 증가를 상쇄하지 못했다. **방향이 기준이 아니라 필요성이 기준**이므로(ADR-054 · NORTH_STAR §3)
   순증 자체가 기각 사유는 아니다 — 다만 **"개편하면 준다"는 기대는 실측으로 반증됐고**, 그
   기대를 근거로 쓴 문장이 있으면 정정 대상이다.
2. **삭제된 절의 이관처** — 그냥 없어지면 다음 세션이 이유를 모른다:

   | 삭제 | 이관처 |
   |---|---|
   | `Rule 1`~`Rule 12` | 6원칙이 흡수 (매핑표 = `docs/plans/resident-reduction-2026-07-26-todo.md`) |
   | `Anti-Patterns (Forbidden)` | 원칙 1 *"Do not present assumptions or judgments as evidence"* |
   | `When Requesting Decisions` **5요소 전부**(ⓐ전후 맥락 상세 · ⓑ추천 · ⓒUI/UX 형태 · ⓓAS-IS/TO-BE · ⓔtrade-off) | **삽입 3 이 전부 대체 — 유실 0.** 착수 후 사용자가 직전 결정을 뒤집었다: *"미안 claude.md에 추가해서 넣는 것으로 ⓐⓒ 해줘"*. 폐기된 판본은 ⓐⓒ 를 배포판에서 빼고 리포 사본만 소유하게 했었다 |
   | `Run Self-Audit` | 원칙 4(완료 기준) + 원칙 5(미검증=미완). "Non-Goals 침범 없음"만 리포 사본에 잔존 |
   | `Context Management` | autocompact → `strategic-compact` 스킬 · "SPEC/PRD 재참조"는 죽은 참조(문서 0개)라 ① 로 |
   | 옛 `## The Lane Principle` 18줄 절 | 삽입 1·2 로 압축 (ADR-054 문안의 재배치) |

3. **추가 1(테스트 작성 분리)은 기각됐다 — 사용자 발언 그대로 남긴다**:
   *"테스트 누가 작성하던 테스트케이스도 결국 코딩이니깐 리뷰어가 검증할거야."*
   즉 분리 요구는 **작성**이 아니라 **리뷰**에 걸린다. **이것은 앞선 지시
   (*"테스트 생성도 독립 에이전트"*, ADR-054 Context)와 시간순으로 충돌하며 뒤가 이긴다.**
   이 사실 자체가 기록 대상이다 — 안 적으면 다음 세션이 앞선 지시만 보고 축을 되살린다.
4. **구현 위임을 배포판에서 뺀 이유**: `implementer` 는 `.claude/agents/` + dev 트랙 조건인데
   앵커는 4 CLI 전부에 도달한다. **에이전트 설치 조건 ≠ 앵커 도달 범위**이므로 배포판에 쓰면
   설치 절반에서 거짓이 된다. 리포 사본에는 남긴다(여기엔 실재한다).
5. **미판정으로 남긴 것 2건** — 근거 없이 지우지 않는다:
   ⓐ Self-Audit 의 **"Non-Goals 침범 없음"** — 원칙 5 는 *미검증 보고*를 덮지만 *범위 침범*은 다른
   축이고 SPEC 에 Non-Goals 절이 실재한다. 리포 앵커에 한 줄로 존치.
   ⓑ **옛 Rule 5** *"코드가 답할 수 있으면 코드가 답한다"* — 원칙 2 가 근처를 지나가지만
   *"라우팅·재시도·결정론 변환에 모델을 쓰지 마라"* 는 명시가 없다. 이 리포는 설치기라 결정론이
   핵심이다. **따라서 `Rule 5` 를 지목하던 주석들은 새 번호로 재지목하지 않고 죽은 포인터만
   제거하고 취지를 프로즈로 보존했다**(`src/ci-scaffold.ts`, `src/external-assets.ts`,
   `observation-digest.mjs` 양 사본).
6. **문서 위치·스택·라우팅·목록을 앵커에서 뺀 이유**: 앵커는 **원칙**의 자리다. 스택·레이아웃·설치
   자산 목록은 프로젝트마다 다르므로 루트 `CLAUDE.md` 의 FILL 스캐폴드가 소유하고(설치 시점에
   실제 리포를 읽어 채운다), 스킬 라우팅은 각 스킬의 descriptor 가 소유하며(발화 시점에 알면 되는
   것), 문서 위치 규약은 ① `@import` 배선이 소유한다. 앵커에 두면 **설치자 프로젝트와 무관한 사실을
   매 세션 물린다**.

7. **정정 이력 — 배너가 antigravity 앵커를 `AGENTS.md` 로 잘못 적었고, 어떤 게이트도 이를 잡지
   않았다.** `src/project-claude-merge.ts` 의 배너와 본 ADR 이 non-claude 3종을 `AGENTS.md` 로
   뭉뚱그렸으나, antigravity 의 실제 산출 경로는 `.agents/rules/uzys-harness.md` 다
   (`src/antigravity/transform.ts:109`) — `templates/antigravity/AGENTS.md.template` 은 소스
   템플릿이라 그 둘을 혼동했다. 이는 ADR-054 가 닫은 결함(*"존재하지 않는 대상을 지목"*)이 **다른
   CLI 에서 반대 방향으로 재현**된 것이다. 적발은 사람(검증 레인)이었고 **앵커 경로 서술 ↔ 실제
   산출 경로를 대조하는 게이트는 0건**이다(후속 과제). 다음엔 사람이 못 잡는다.

**ADR-054 와의 관계 (supersede 아님)**: ADR-054 의 상위 원칙("만든 레인은 자기 산출물을 판정하지
않는다")은 유효하다. 그 **문안이 배포판에서 원칙 1·4 로 분산 배치**됐고(전용 절 → 삽입 1·2),
**테스트 작성 분리 축은 사용자 결정으로 기각**됐다. 결정 대상이 다르므로 supersede 가 아니라
**재배치 + 축 1개 철회**다.
