# SPEC: 문서 체계 재정비 (F 사이클)

- Status: Active

> 이 파일은 **지금 무엇을 만드는가**만 담는다. 직전 앵커(Foundation v26.38)는
> `docs/archive/spec-foundation-v26.38.md` 로 옮겼다 — 내용은 그대로이고 이동만 했다.
> 왜 옮겼나: 세션 시작 훅이 매번 "이 파일을 먼저 읽어라"고 안내하는데 그 본문이
> *"현재 목표로 읽지 말 것"* 이라 자기를 부정하고 있었다.

## North Star Check

| 질문 | 답 | 근거 |
|---|---|---|
| 어느 지표를 움직이나 | **1차 축 — 무게이트 주장 수 → 0** | 문서에 적힌 사실 주장(필수 절·Status 값·템플릿 서술)이 거짓이 되어도 `npm run ci` 가 red 가 안 되는 상태를 게이트로 덮는다. NORTH_STAR §2 |
| Won't 를 침범하나 | 아니오 | 산출물 4종은 `docs/templates/`(이 리포 전용, npm tarball 밖). 배포물 변경은 별도 승인 항목으로 분리 |

## AC — 무엇이 완료인가

> **정의만 여기 있고 진행 표시는 없다.** 이 리포는 *main 을 항상 출하 가능하게* 두려고 열린 항목을
> `docs/plans/*-todo.md` 로 분리한다(🧪 `tests/spec-drift-backlog-exemption.test.ts` —
> 강제 범위는 `docs/todo.md` 의 우회 문구 부재·면제 표식 축이고, SPEC 축은 ⬜ 관행이다). SPEC 에
> 미완 체크박스를 두면 사이클 내내 ship 이 막히고, 그 상태가 길어지면 우회가 관행이 된다 — #237 이
> 없앤 바로 그 형태다. 진행 추적 = `docs/plans/doc-system-cycle-todo.md`.

| ID | 완료 조건 (관측 가능한 형태) | 판정 주체 |
|---|---|---|
| **AC1** | 의무 계수기가 리포에 있고 설치 집합을 `resolveRules()` 에서 derive 한다. 대상 파일 부재 시 0 이 아니라 **throw**. 집계 대상에 `$HOME` 경로가 없다 | 🧪 신규 `tests/obligation-counter.test.ts` |
| **AC2** | `docs/templates/` 에 ADR·SPEC·PLAN·RESEARCH 4종이 있고 현행 문서가 각 템플릿의 필수 절을 갖는다. **템플릿에서 절을 지우면 red** | 🧪 신규 G-F3 `required-sections` |
| **AC3** | 현행 md 의 `Status` 줄이 전부 "한 줄 한 토큰" 규약을 만족한다 (착수 시점 위반 29건 / 파일 21건) | 🧪 신규 G-F2 `status-token` |
| **AC4** | `docs/plans/*-todo.md` 전부가 frontmatter `status:` 를 갖고 값이 enum 안에 있다 (착수 시점 0/22) | 🧪 신규 G-F1 `plan-status` |
| **AC5** | 템플릿과 그것을 서술하는 문서(`docs/REFERENCE.md` §Templates · `templates/rules/change-management.md` 인라인 골격)가 derive 로 묶여 **함께** red 가 된다 | 🧪 신규 G-F6 `template-doc-sync` |
| **AC6** | ADR 58개의 관계 표기(`Supersedes`/`Amends`)가 대칭이다. 전면/부분이 갈리는 건은 사용자 결정을 받아 기재 | 🧪 신규 G-F4 — **경고 모드**. 기계가 전면/부분을 못 가르므로 red 로 두지 않는다 |
| **AC7** | 위 게이트 각각이 **음성 대조 양방향**으로 확인됐다: 잡혀야 할 N 건을 잡고 잡히면 안 되는 M 건을 안 잡는다. 되돌린 코드가 typecheck 를 통과한 상태에서 red 를 봤다 | ⬜ **없음** — 사람이 확인하고 PR 본문에 증거를 적는다 |

## Non-Goals

- **상주 룰의 내용 감축** — 판정 기준이 이 사이클 산출물에서 나오므로 순서상 뒤다(H 사이클,
  이슈 #261). **그 H 사이클은 2026-08-02 에 별도로 착수됐다** — 범위·AC·진행은
  `docs/plans/rules-hooks-diet-2026-08-02-todo.md` 와 ADR-061 이 SSOT 이고, 이 SPEC 의 Non-Goal
  경계는 그대로다(F 사이클은 여전히 룰 본문을 건드리지 않는다). 옛 문안의 "33개"는 착수 시점
  수치라 지웠다 — 룰 개수의 SSOT 는 `src/manifest.ts` 의 `resolveRules()` 이고 실측 표기는
  `docs/REFERENCE.md` §Rules 다.
- **기본 설치 항목 재정의 · 스킬 통합** — G 사이클(이슈 #262).
- **비가역 조작 차단의 방향 뒤집기** — A 사이클. 설계는 있으나 `.git/hooks` 기본 설치 여부가 사용자 결정 대기.
- **문서 전수 개명** — 참조 실측 119건이고 ADR 은 append-only 다. 새 문서부터 게이트로, 기존은 archive 갈 때 자연 소멸.
- **상주 부하 감축** — 이 사이클은 부하를 줄이지 않는다. 템플릿 축소로는 지배항(상주 룰)이 안 움직인다는 것이 실측으로 확인됐다(`docs/plans/doc-template-standard.md` §6-3).

## DO NOT CHANGE

- `docs/archive/spec-foundation-v26.38.md` — 보존 앵커. **내용 불변**이 이동의 전제였다(`tests/spec-anchor-preserved.test.ts` 가 해시로 고정).
- `~/.claude/` 전역 — 이 리포의 작업이 호스트 전역을 건드리지 않는다.
- `package.json` 의 `files`(게시 계약) — 4종 템플릿을 tarball 밖에 두는 결정이 여기 걸려 있다.
- 배포물(`templates/**`)에 이 리포의 태그·ADR 번호·홈 경로 유입 — `no-false-ship` §templates 는 배포물이다.

## 출하 시

AC 가 전부 `[x]` 가 되면 이 파일을 `docs/archive/` 로 옮기고 다음 사이클 SPEC 을 이 자리에 새로
쓴다. **완료된 AC 를 이 파일에 누적하지 않는다.** 미결 결정의 SSOT 는 `Status: Proposed` ADR 이다.

> 설계·검토 산출물 = `docs/plans/doc-template-standard.md` + `-review.md`.
> 진행 추적 = `docs/plans/doc-system-cycle-todo.md`.

## Change Log

> AC·Non-Goals·DO NOT CHANGE 가 움직인 이력만 한 줄씩. 진행 상태는 여기 담지 않는다
> (`docs/plans/*-todo.md` 소관).

| 날짜 | 유형 | 변경 |
|---|---|---|
| 2026-08-02 | Clarification | Non-Goals "룰 내용 감축" 줄 현행화 — 착수 시점 수치 "33개" 삭제, 그 H 사이클이 별도로 실행 중임을 `docs/plans/rules-hooks-diet-2026-08-02-todo.md`·ADR-061 로 위임. **경계는 불변**(F 사이클은 룰 본문 미변경) |
