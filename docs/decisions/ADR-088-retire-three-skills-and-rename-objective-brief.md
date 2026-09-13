# ADR-088: 스킬 3종 은퇴 · `task-brief` → `objective-brief` 개명과 문턱 상향

- Status: Accepted
- Date: 2026-09-13
- PR: #444
- Amended-by: ADR-090 (은퇴 목록에 스킬 4종이 더해진다. 개명·은퇴를 화면이 갈라 말한다는
  결정은 그대로다)
- Amends: ADR-085 (`CONTINUOUS_SKILLS` 3종 → 2종. 상시 스킬 안내를 설치기가 프로젝트 블록에
  쓴다는 결정은 그대로다)

## Context

전체 하네스 충돌 감사(`docs/plans/harness-conflict-audit-2026-09-13.md`, #426)가 자산 4건을 보류로
올렸고 사용자가 2026-09-13 에 넷을 확정했다(같은 문서 §사용자 결정 · `docs/plans/harness-conflict-2026-09-13-todo.md` D4–D7).
결정 원문:

- **F-04** — *"스킬은 긴 작업 · 피처 · 프로젝트 개발 규모 이상에만 쓴다. 이름이 그 문턱을 숨기므로
  `objective-brief` 로 개명"*(`object-brief` 는 "객체"로 읽혀 기각). 설치자와 이 리포가 같은 문턱을
  받는다 — descriptor · 본문 "When to use" 를 규모 기준으로, 매 프롬프트 넛지 훅 제거, 상시 스킬
  안내에서 제외. 감사가 적은 문제 상황: 설치자가 긴 요청을 하나 던질 때마다 브리프가 앞서 한
  라운드가 늘었고, 스킬 Do-NOT 은 한 줄 질문만 빼고 "긴 요청"은 전부 걸었다.
- **F-09** — *"스킬·훅 모두 제거. 실제로 도움이 안 됐고 Claude Code 순정에 자동 컴팩션이 있다."*
  매 Write/Edit 에 async 로 돌던 훅의 출력은 `consider /compact` 한 줄뿐이었고 행동이 달라졌다는
  관측이 없다(차단 로그 대상도 아니다).
- **F-10** — *"제거. 재발 방지는 번들 `recurrence-prevention` 이 이미 담당한다."* 관측 훅이
  `templates/settings.json` 에 배선되지 않은 채 descriptor 235자가 매 세션 상주하며
  *"observes sessions via hooks"* 라고 말했다 — 관측은 일어나지 않았다.
- **F-11** — *"retire + 간단한 룰로 대체."* 한 문장짜리 판단("SPEC 이 300줄을 넘으면 나눠라")이고
  현 세대 모델이 스스로 한다. 이 스킬이 생긴 **원인**은 SPEC/PRD · 메모리 · CLAUDE.md 에 이력과
  결정 경위가 쌓여 비대해진 것이었으므로, 새 룰 파일이 아니라 기존 `doc-governance` 룰에 한 줄.

## Decision

1. **`task-brief` → `objective-brief` 개명 + 문턱 상향.** 카탈로그 id·descriptor·`SKILL.md`
   name·본문 Inbound 첫 문단이 **위임 · 설계 · 다단계(피처/프로젝트 규모 이상)** 를 말한다.
   Do-NOT = 한 줄 질문 · 조회 · 단일 수정 · 루틴 변경. 트리거 문구는 그대로 유지한다(ADR-083 —
   발화 표면을 깎으면 스킬이 안 불린다). 본문 XML 템플릿은 한 글자도 바뀌지 않는다.
2. **매 프롬프트 넛지 훅 제거.** `ALWAYS_HOOKS`·`templates/settings.json` 배선·스크립트·전용
   테스트가 함께 빠진다. 판정 조건("400자 이상 && `<objective>` 부재")은 결정적이었지만 **길이는
   규모의 증거가 아니다** — 새 문턱을 매 프롬프트 훅으로는 표현할 수 없다. 상시 스킬 안내
   (`CONTINUOUS_SKILLS`)에서도 빠진다: 이 스킬은 "매 응답·매 위임" 축이 아니다.
3. **스킬 3종 은퇴** — 컴팩션 타이밍(`strategic-compact`, 사이드카 훅 포함) · 세션 관측
   (`continuous-learning-v2`) · SPEC 분리(`spec-scaling`). `templates/skills/` 와 `.claude/` 미러,
   manifest 배선, `cherrypicks.lock` 의 두 행이 함께 빠진다.
4. **`doc-governance` 룰 한 줄**(배포판·개발 사본 양쪽, 기존 불릿의 마지막):
   *"상주 문서(CLAUDE.md · SPEC/PRD · 메모리)에는 현행 결정만 적는다. 이력·근거·정정 경위는
   ADR·계획 문서로 분리하고 한 줄로 링크한다 — 상주 문서가 이력으로 비대해지면 매 세션 그
   이력을 읽는다."*

## Alternatives

| 기각안 | 사유 |
|---|---|
| 넷 다 그대로 둔다 | F-04 는 사용자 확정 방식(2026-08-03)이었으나 **설치자 전원의 기본값으로도 맞는지**는 사용자만 정할 수 있었고, 사용자가 문턱을 올렸다. 나머지 셋은 상주 비용이 관측 없이 계속 나간다 |
| descriptor 에 "for multi-part requests" 한 줄만 덧붙인다 (F-04 ⓑ) | 이름이 문턱과 어긋난 채로 남는다 — 사용자가 기각하고 개명을 택했다 |
| `objective-brief` 를 opt-in 으로 강등 (F-04 ⓒ) | 위임·설계는 전 트랙의 행위다. 문턱 문제를 도달 범위 문제로 바꾸는 것이어서 기각 |
| 훅 배선만 빼고 컴팩션 스킬은 한 릴리즈 더 둔다 (F-09 제안) | 사용자가 스킬까지 제거로 확정 — 순정 자동 컴팩션이 그 자리를 덮는다 |
| 관측 훅을 실제로 배선한다 (F-10) | 매 툴 호출 관측 비용을 새로 들이는 방향이고, 같은 일을 `recurrence-prevention` 이 한다 |
| SPEC 분리를 새 룰 파일로 | 룰 하나가 늘면 4 CLI 전부에 상주가 늘어난다. 같은 원칙(R-03)을 이미 가진 룰에 한 줄이 싸다 |
| 이미 깐 설치본에서 은퇴 스킬을 자동 삭제 | ADR-046 의 "스킬은 지우지 않는다"를 뒤집는다 — 스킬 디렉터리 안에는 사용자 파일이 섞인다. 대신 화면이 무엇을 지워도 되는지 말한다 |

## Consequences

- **이미 깐 설치본은 자동으로 바뀌지 않는다.** `update` 는 설치된 디렉터리만 갱신하므로
  `.claude/skills/task-brief` 와 은퇴 3종이 그대로 남는다. 그래서 `update` 화면이 셋으로 갈라
  말한다(`RENAMED_SKILL_IDS` · `RETIRED_SKILL_IDS` → `install-render`): 개명은 *"`<old>` 는
  `<new>` 가 됐다 · update 뒤 지우고 새 이름을 선택해 받는다"*, 은퇴는 *"이 릴리즈에서 은퇴 —
  지워도 된다"*, 그 밖은 기존 문구. 판정 자료는 **디스크**다(`staleSkillDirs`) — 설치 기록의
  외부 스킬 목록만 보면 번들 스킬은 한 건도 안 걸린다.
- **카탈로그 수는 62 그대로다.** 은퇴한 3종은 카탈로그 엔트리가 아니라 manifest 번들이었다
  (감사 todo 의 "62 → 59" 는 이 사실을 모르고 쓴 수치다). 번들 uzys 스킬은 16종 → 15종.
- **상주 비용(tooling, `npm run cost:report` 실측)**: 지시문 8개 ~4,481 → ~4,452 ·
  발화 표면 26개 ~3,409 → 23개 ~3,233 · 합계 34개 ~7,890 → 31개 ~7,685.
  내역: rules ~1,462 → ~1,495(룰 한 줄) · CLAUDE.md ~3,019 → ~2,957(상시 안내 한 줄 감소) ·
  skill 17개 ~2,643 → 14개 ~2,467.
- **Codex `AGENTS.md`**: 23,283 B → 23,304 B (+21). 룰 한 줄(+약 350 B)의 대부분이 상시 스킬
  안내 감소분으로 상계됐다. ratchet 은 22.75 KiB → **23.0 KiB**(여유 248 B) — 올린 사유·실측은
  `tests/resident-reach-4cli.test.ts` 의 그 자리 주석에 적는다.
- **훅 수**: 배포판 `templates/hooks/` 3 → 2(session-start · protect-files). 차단하는 훅은
  `protect-files` 하나로 그대로다. 이 리포 `.claude/settings.json` 의 훅 명령은 5 → 4.
- **C2(ECC opt-out 폴백) 공통 목록이 비었다.** 상수와 루프는 남긴다 — 다음 cherry-pick 자리다.
  계약을 무는 표본은 dev 축(`agent-introspection-debugging`)으로 옮겼다.
- 옛 이름은 `docs/plans/` · `docs/decisions/` · `CHANGELOG` · `docs/archive` 에 **이력으로 남는다**.
  그쪽은 지우지 않는다 — 무엇이 왜 은퇴했는지가 거기에서만 읽힌다.
