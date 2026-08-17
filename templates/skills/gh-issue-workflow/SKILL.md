---
name: gh-issue-workflow
description: >-
  Runs work through GitHub Issues so the user and the agent can see the same backlog: normalize an
  incoming request into an issue before building, group tasks under a parent (epic) issue, order
  them with milestones and priority labels, read every comment before starting, and promote
  decisions out of comments into the issue body so they survive. Enforces the body template
  (배경/문제/근거/레퍼런스/제안/전제/방향성/AC/후속) so issues become reusable agent context, and
  keeps read-only, draft, remote-write, implement, verify, and status stages distinct. Use whenever
  a request will outlive the chat turn, whenever work needs an order the user can review, or when
  the user names issues ("이슈로 등록해줘", "에픽으로 묶어줘", "이슈 정리해줘", "#42 작업해줘",
  "우선순위 다시 잡자", "backlog this", "break this into sub-issues", "implement issue #N").
  Read-only stages make no remote change; never create, edit, label, comment on, close, or
  re-parent a remote issue, and never touch a project board, without the user asking for that
  change.
---

# GitHub Issue Workflow

## Purpose

채팅은 휘발하고 `plan.md` 는 한 사람만 본다. 그 사이를 GitHub Issue 가 채운다 — **사용자와
에이전트가 같은 목록을 보면서** 순서를 조정하고, 결정을 남기고, 방향이 바뀌어도 무엇이 빠졌는지
셀 수 있는 자리다.

세 가지를 한다:

1. **요청 → 이슈**. 이번 턴에 끝나지 않을 요청은 먼저 이슈 형태로 정규화해 보여준다.
2. **이슈 → 계층**. 낱개 작업을 부모 이슈(에픽) 아래 묶고 마일스톤으로 순서를 준다.
3. **이슈 → 이력**. 논의는 코멘트로, **결정은 본문으로** 올린다. 코멘트는 스크롤에 묻힌다.

1인 사용자 + 에이전트 협업에 맞춘다(팀 assign·reviewer 자동화는 범위 밖).

## 활성 조건 — 3단

| 단계 | 조건 (전부 관측 가능해야 한다) | 할 수 있는 것 |
|---|---|---|
| **비활성** | `git remote -v` 에 GitHub remote 없음, 또는 `gh auth status` 실패 | 아무것도 안 한다. 에러도 안 낸다 |
| **읽기** (기본) | remote + `gh` 인증 있음 | 열린 이슈·코멘트를 **읽는다**. 이슈 등록을 **제안**한다. 원격은 안 건드린다 |
| **적극** | `docs/SPEC.md` 에 `issue_tracking: enabled`, **또는** 사용자가 이 세션에서 이슈 등록·계층화를 **명시적으로 요청** | 요청이 오면 이슈 초안을 먼저 보여주고, 승인 후 등록·계층화 |

적극 단계의 두 번째 가지는 **명시적 요청**이지 맥락 추론이 아니다 — "사용자가 이슈로 일하는 것
같다"는 사후에 아무렇게나 성립한다. 판별이 안 서면 읽기 단계로 남는다.

읽기가 기본인 이유와 그 대가(컨텍스트 오염)는 이 스킬을 만든 저장소의 ADR 에 있다. 요약하면:
스킬이 설치돼 있다는 사실과 작동한다는 사실이 달랐고, 읽기는 원격을 바꾸지 않는다.

**`WRITE`/`UPDATE` 승인 규칙은 단계와 무관하다** — 적극 단계에서도 원격 변경은 사용자가 그것을
요청했을 때만 한다.

## Modes — 무엇이 원격을 건드리는가

단계를 섞으면 "조사해줘"가 원격 쓰기로 번진다. 요청된 모드를 먼저 정하고, 그 모드가 허용하는
것만 한다.

| Mode | 하는 일 | 원격 변경 |
|---|---|---|
| `INVESTIGATE` | 이슈·코멘트·계층·의존을 읽고 배경/결정/AC/링크를 수집 | 없음 |
| `DRAFT` | `ISSUE.template.md` 로 본문 초안 작성 (빈 섹션 삭제) | 없음 |
| `WRITE` | 이슈 생성·수정 · label · milestone · parent/sub-issue · comment · **project 보드** | **있음** |
| `IMPLEMENT` | 합의된 범위만 구현, 이슈 → 구현 → 검증 추적성 유지 | 없음 |
| `VERIFY` | AC 를 해당 사용자 표면에서 증거로 확인 | 없음 |
| `UPDATE` | 상태 갱신 · close · 후속 링크 · 재정렬(마일스톤·부모 해제) | **있음** |

**`WRITE`/`UPDATE` 실행 전에 영향받는 이슈 번호와 바뀔 내용을 목록으로 보여주고 진행한다.**
단계·모드와 무관한 상시 요구다. 재조정은 본질적으로 다건 일괄 변경이라(§8) 여기가 가장 중요하다.

MCP `mcp__github__*` 를 쓸 수 있으면 셸 `gh` 보다 우선한다 — 같은 승인 규칙이 그대로 적용된다.

## 계층 — Project · Milestone · Epic · Task

GitHub 에는 "에픽"이라는 물건이 **없다.** 사용자가 말하는 4단은 아래로 매핑된다:

| 어휘 | GitHub 실물 | 명령 |
|---|---|---|
| Project | Projects v2 보드 | `gh project item-add …` — **원격 쓰기** |
| Milestone | Milestone (기한·진척 막대) | `gh issue edit <N> -m "<title>"` — **원격 쓰기** |
| **Epic** | **부모 이슈** (sub-issue 의 부모) | `gh issue edit <EPIC> --add-sub-issue <N>` — **원격 쓰기** |
| **Task** | **하위 이슈** | `gh issue create --parent <EPIC> …` — **원격 쓰기** |

**쓰기 전에 무엇이 되는지 먼저 재라.** 셋은 환경에 따라 없다:

- **Issue type** (`--type bug`) 은 **조직 리포 전용**이다. 개인 리포에서는 없는 기능이라
  `gh api repos/:owner/:repo/issues/types` 가 404 를 낸다 → 그 축은 **라벨**로 대신한다.
- **Projects** 는 토큰에 `read:project`/`project` 스코프가 필요하다. 없으면
  `gh auth refresh -s project` 인데 이건 **사용자가 하는 일**이다 — 대신 실행하지 않는다.
  스코프가 있어도 **어느 보드를 쓸지 사용자가 지정하기 전에는 보드를 건드리지 않는다**
  (`docs/SPEC.md` 의 `github_project: <URL>` 또는 그 세션의 명시 지정).
- **하위 이슈 명령**은 `gh` 2.94 이상에서만 있다. 낮으면 조용히 무시되는 게 아니라 unknown flag 로
  실패한다.

가용성 판정 절차·전체 명령면·한계 수치는 `references/hierarchy.md`.

**계층을 만들기 전에 물어야 할 것 하나**: 지금 이슈가 3개인데 에픽을 만들면 껍데기가 하나 늘 뿐이다.
**하위 작업이 3개 이상 나오고, 그것들이 한 결정을 공유할 때** 에픽이 값을 한다.

## Process

### 1. 착수 전 — 코멘트까지 읽는다

```bash
gh issue view <N> --comments        # 본문만 읽고 시작하면 결정을 놓친다
gh issue view <N> --json number,title,body,labels,milestone,parent,subIssues,blockedBy,state
```

**본문만 읽고 착수하지 마라.** 결정은 대개 나중에 코멘트로 온다. 본문은 처음 쓴 사람의 이해이고,
코멘트는 그 뒤에 바뀐 것이다.

### 2. 본문 — 육하원칙을 칸으로

`ISSUE.template.md` 를 본문으로 채운다. 비어 있는 섹션은 통째로 삭제한다(placeholder 금지).
**최소 섹션은 템플릿이 정한다** — 여기 숫자를 다시 박으면 두 벌이 갈라진다.

```
## 배경    — 왜(Why) · 누가(Who) 겪는가
## 문제    — 무엇이(What) · 언제·어디서(When/Where). 관측만, 추정은 아래로
## 근거    — 붙여넣어 재현 가능한 형태 + 대조군
## 레퍼런스 — 안은 `#N`, 밖은 URL + 핵심 문장 인용
## 제안    — 어떻게(How). 강제가 아니라 출발점 + 안 하기로 생각한 것
## 전제 (Given) · ## 방향성 · ## 적용 대상/AC (When→Then) · ## 후속 작업
```

두 칸이 특히 값을 한다. **`문제` 와 `제안` 을 나누는 것** — 섞으면 원인 추정이 사실로 굳는다.
그리고 **`레퍼런스` 에 인용을 함께 두는 것** — 링크는 죽는다(측정치는 `references/operating-model.md` §P3).

BDD 매핑: 전제(Given) → 적용 대상(When) → AC(Then).

### 3. 준비도 확인 — 등록 전에 8줄을 센다

이슈가 에이전트에게 실제로 작동하는지는 측정된 축이 있다. 실증 연구(Copilot PR 3,180건과 그에
대응하는 이슈)에서 머지율을 가장 크게 올린 것은 **범위가 좁을 것(+16.4%p)** 과 **그 이슈만 읽고
착수 가능할 것(+16.7%p)** 이었다. **본문 길이는 모델에서 가장 중요한 피처(rank 1)이고 방향이
단조 감소**다 — 길수록 나쁘다.

등록 전 최소 체크:

- [ ] **범위** — 한 PR 로 닫히는가. 아니면 하위 이슈로 쪼갠다
- [ ] **자족** — 이 이슈만 읽고 착수 가능한가. 링크를 따라가야 알 수 있으면 요지를 본문에 옮긴다
- [ ] **모호성** — "개선한다"·"정리한다" 같은 판정 불가 동사가 없는가
- [ ] **AC** — When → Then 이 pass/fail 로 갈리는가
- [ ] **좌표** — 건드릴 파일/모듈이 적혀 있는가
- [ ] **경계 동작** — 정상 경로 말고 예외/edge 를 하나라도 적었는가
- [ ] **길이** — 위를 채우고 나서 남는 서술을 지웠는가

여덟 번째는 **역방향 신호**다. 이슈에 성능·마이그레이션·환경 설정 얘기가 크게 들어가면 그건
글이 나쁜 게 아니라 **작업이 에이전트 범위를 넘었다는 표시**일 수 있다. 그럴 땐 문장을 지우지
말고 **쪼개거나 사람 레인으로 보내는 쪽을 검토한다.** (성능 축의 수치는 표본 21건이고 원저자가
원인을 못 찾았다고 유보를 달았다 — 규칙이 아니라 신호로만 쓴다. `references/readiness.md` §3)

전체 지표·수치·출처는 `references/readiness.md`.

### 4. 방향성 상태로 착수 가능 여부 판정

| 상태 | 의미 | 행동 |
|---|---|---|
| **절이 없거나 판별 불가** | 결정된 적 없음 | **착수하지 않는다.** 1회 묻고 답을 받은 뒤 진행 |
| **OPEN** | 사용자 결정 대기 | 이 이슈 작업 차단. 다른 이슈를 하거나 결정을 1회 요청 |
| **YYYY-MM-DD 확정** | 결정 완료 | 착수 가능. AC 충족 후 close |

**미해결 옵션 목록을 승인으로 해석하지 않는다** — 옵션이 나열돼 있다는 것은 결정이 없다는 뜻이다.

### 5. 전제(Given) 체크 — 착수 직전

- 체크박스 `[x]` 가 **모두** 채워졌는가. 하나라도 비면 착수하지 않는다.
- 미충족 항목은 **차단 사유와 누가/무엇이 그것을 채우는지**를 함께 보고한다.
- 전제가 다른 이슈에 의존하면 **그 이슈가 close 됐는지 확인**한 뒤 진행한다.
- 본문 체크박스와 `blocked-by` 관계는 **다른 축**이다. 둘 다 있으면 둘 다 본다
  (`blockedBy.totalCount == 0` 은 관계 필드이지 본문 전제가 아니다).

### 6. 코멘트 → 결정 승격 (이력이 남는 자리)

코멘트는 시간순으로 쌓이고 곧 스크롤에 묻힌다. **결정만 본문으로 올린다.**

```
사용자 코멘트에 결정이 있음
  → 본문 `## 방향성` 을 `YYYY-MM-DD 확정` 으로 고치고 채택 근거 1줄
  → 그 줄에 근거 코멘트 링크를 단다
  → 코멘트로 답한다: 무엇을 반영했고, 무엇을 안 했고, 왜 안 했는지
```

**안 한 것을 적는 게 요점이다.** 반영분만 적으면 같은 제안이 다음 사이클에 다시 온다.
논의(왜 그렇게 생각했나)는 코멘트에 그대로 둔다 — 본문으로 옮기면 본문이 길어져 준비도가 떨어진다.

### 7. 순서 — 라벨·마일스톤

| 축 | 값 | 부착 시점 |
|---|---|---|
| type | `bug` `enhancement` `documentation` (기본 라벨에 있는 것) | 생성 시 1회 |
| 상태 | `decision-pending` `ready` `blocked` `in-progress` | 방향성·전제 변화에 따라 |
| 우선순위 | `P0` `P1` `P2` | 사용자 결정 |

**없는 라벨은 못 붙인다.** `gh label list` 로 먼저 확인하고, 없으면 만들 것인지 사용자에게 묻는다
(`gh label create` 는 `WRITE`다). 상태·우선순위 축은 기본 라벨에 없으므로 만들어야 있다 —
부트스트랩 목록은 `references/hierarchy.md` §7.

우선순위 라벨과 마일스톤은 역할이 다르다 — **라벨은 "무엇이 먼저인가", 마일스톤은 "무엇까지가
이번 묶음인가"** 다. 마일스톤은 진척 막대를 주므로 사용자가 남은 양을 한눈에 본다.

### 8. 방향 재조정 — 빼되 지우지 않는다

범위가 바뀔 때 **이슈를 지우거나 조용히 close 하지 않는다.** 그러면 "왜 안 하기로 했나"가 사라지고
다음 사이클에 같은 논의가 다시 열린다.

```
이번 묶음에서 뺀다  → 마일스톤 해제 + 부모(에픽) 해제 + 사유 코멘트 1줄. 이슈는 OPEN 유지
안 하기로 확정한다  → 사유를 본문 `## 방향성` 에 적고 close (`wontfix` 라벨)
다른 이슈가 대체한다 → 새 이슈 번호를 적고 close. 새 이슈 본문에 `Supersedes #N`
```

에픽에서 하위 이슈를 뗄 때 `gh issue edit <EPIC> --remove-sub-issue <N>` — **이슈 자체는 남는다.**
이게 "재조정해도 누락이 없다"의 실제 배선이다. 뺀 수 + 남은 수 = 원래 수를 **세어서** 확인한다.

### 9. 백로그 → 착수 목록

```
1. gh issue list --state open --json number,title,labels,milestone,blockedBy
2. 방향성이 확정된 것만 후보로 (§4)
3. 전제 미충족·blocked-by 있는 것 제외 (§5)
4. 우선순위 라벨 순 정렬
5. 상위 1-3개를 프로젝트의 로컬 추적 문서(`docs/todo.md` 등)로 이관하고 계획 단계로
```

이 시퀀스 전체가 `INVESTIGATE` 다 — 읽기만 하고 원격을 바꾸지 않는다.

### 10. 구현 — commit / PR 컨벤션

| 시점 | 컨벤션 |
|---|---|
| 진행 commit | `<type>: ... (refs #N)` |
| PR body | `Closes #N` / `Fixes #N` (머지 시 자동 close) |
| 부분 진행 | `Refs #N` (close 안 함) |
| 후속 이슈 생성 | 원본 `## 후속 작업` 에 `#M` cross-link |

**에픽은 `Closes` 로 닫지 않는다.** 하위가 전부 닫히면 GitHub 이 진척을 표시하고, 에픽은 사람이
남은 게 없음을 확인하고 닫는다.

### 11. VERIFY — AC 는 사용자 표면에서 확인한다

close 전에 **AC 항목마다** 증거를 코멘트로 남긴다: 어떤 명령/화면에서 무엇을 관측했는지.
커밋이 있다거나 빌드가 초록이라는 사실은 AC 충족의 증거가 아니다. 부분 확인·미확인은 그렇게 적는다.

## Output

- 생성·갱신된 이슈(템플릿 변형 Task/Epic) + 계층 배선(parent / milestone / label)
- 코멘트: 반영분 · 미반영분과 사유 · AC 별 검증 증거
- 보고: mode · repo/이슈 번호 · 결정과 의존 · AC · 로컬 변경 · 검증 증거 · **수행한 원격 변경** · 잔여

## Side effects and stop conditions

- `WRITE` 와 `UPDATE` 만 GitHub 상태를 바꾼다. 다른 모드는 원격을 건드리지 않는다.
- 원격 변경 전에 **영향받는 이슈 번호와 바뀔 내용을 보여준다.**
- repo·이슈 번호·권한·정확한 변경 내용 중 하나라도 불확실하면 **원격 변경 전에 멈춘다**.
- 방향성이나 전제가 열려 있으면 **구현을 멈춘다** — 옵션 목록은 승인이 아니다.
- AC 증거가 없으면 close 하지 않는다.
- 스코프·`gh` 버전·조직 여부로 못 하는 기능은 **대신 인증을 고치지 말고** 사용자에게 넘긴다.

## Anti-Patterns

- **본문만 읽고 착수** — 결정은 코멘트에 있다. `--comments` 를 빼먹으면 확정된 방향을 다시 묻는다.
- **방향성 미명시인데 착수** — 절이 없거나 OPEN/확정을 판별할 수 없으면 **작업 시작 불가**.
- **전제 무시하고 진행** — 의존 이슈가 미해결인 채로 착수 금지.
- **PR 에서 `Closes #N` 누락** — 수동 close 는 잊힌다. 컨벤션을 강제한다.
- **에픽 먼저 만들기** — 하위 3개 미만이면 껍데기만 는다. 작업이 갈라진 뒤에 묶는다.
- **한 줄 이슈** ("login 안 됨") — 템플릿의 최소 섹션을 채운다. 준비도 체크의 절반도 못 채운다.
- **본문에 다 적기** — 길이는 측정된 감점 요인이다. 논의는 코멘트, 결정만 본문.
- **모든 이슈에 라벨을 다 붙임** — 노이즈다. 축마다 하나씩, 핵심 분류만.
- **재조정을 delete/close 로** — "안 하기로 한 이유"가 사라져 같은 논의가 재발한다.
- **없는 라벨·타입·프로젝트를 쓰려다 실패** — 쓰기 전에 존재를 잰다.
- **인증 스코프를 대신 고치기** — `gh auth refresh` 는 사용자 행동이다.
- **remote 가 있다는 이유만으로 이슈·라벨·코멘트·보드를 만든다** — 읽기는 자유, 쓰기는 요청이 조건.
- **커밋 하나나 초록 빌드만 보고 close** — AC 증거가 close 조건이다.
- **팀 기능 도입** (assignee 자동, code owner 자동 review) — 본 스킬 범위 밖.

## Boundary

- GitHub remote 없음 · `gh` 미인증 → 자동 비활성 (에러 아님)
- `docs/SPEC.md` 에 `issue_tracking: enabled` 가 없고 사용자의 명시 요청도 없으면 → **읽기 단계에
  머문다.** 등록·계층화는 제안만 하고 실행하지 않는다
- private repo 권한 없음 → fetch 실패를 사용자에게 보고
- 조직 전용 기능(issue type)·스코프 부족(Projects) → 대체 축으로 우회하고 그 사실을 보고

## 층 — 무엇이 고정이고 무엇이 움직이나

목표는 안 바뀌고 묶음과 순서는 계속 바뀐다. 결론 둘만 여기 둔다:

- **결정은 이슈 본문에, 순서는 묶음(마일스톤·프로젝트)에.** 묶음이 자유롭게 재편되는 이유는
  거기에 이력이 없기 때문이다 — 마일스톤 설명란에 결정을 적으면 그것을 못 지우게 된다.
- **순서를 표현하는 세 축은 수명이 다르니 섞지 않는다** — 라벨은 오늘의 판단, 마일스톤은 이번
  묶음의 경계, `blocked-by` 는 사실이다.

3층 표(목표/이슈/묶음)와 근거 수치는 `references/operating-model.md` §P1·§P4.

## References

- `references/operating-model.md` — 고정/축적/재편 3층, 링크 감쇠, 순서의 세 축, 크기 상한
- `references/hierarchy.md` — 가용성 판정 절차, `gh` 명령 전체, GitHub 한계 수치, 라벨 부트스트랩
- `references/readiness.md` — 준비도 지표 전체와 실증 수치·출처
- `ISSUE.template.md` — 본문 템플릿 (Task 육하원칙 · Epic 두 변형). **최소 섹션의 SSOT**
