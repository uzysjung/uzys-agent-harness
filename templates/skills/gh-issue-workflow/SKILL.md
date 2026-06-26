---
name: gh-issue-workflow
description: "Treats GitHub Issues as the async backlog + decision channel between user and AI agent. Use when a non-blocking todo / bug / decision needs to persist beyond the chat session. Enforces 5-section body template (Background / Given / Decision / AC / Next) so issues become reusable agent context, not just sticky notes."
---

# GitHub Issue Workflow

## Purpose

채팅(휘발성)과 plan.md(정적) 사이의 빈 곳을 GitHub Issue가 채운다. 1인 사용자 + AI agent 협업에서:

- 사용자가 발견한 bug/feature 요청 → issue로 backlog (chat을 끊지 않고)
- 의사결정이 필요한 갈림길 → issue body에 옵션 정리 → 사용자가 비동기로 결정 → AI agent가 fetch해서 작업
- 모든 결정의 영구 검색 가능 기록 (cross-link `#N`, label, milestone 활용)

dyld-vantage 프로젝트의 실제 운용 패턴(`#52~#55`)을 일반화. 1인 시나리오에 최적화 (팀 assign / reviewer 자동화 같은 건 안 함).

## When to Invoke

| 트리거 | 행동 |
|--------|------|
| 프로젝트 착수 + GitHub remote 존재 | "epic issue 만들까?" 1회 권유 (선택) |
| 작업 계획 시작 | OPEN issue 목록 fetch → 우선순위 결정 후 todo.md로 이관 |
| 구현 중 사용자가 새 bug/req 발견 | "issue로 backlog?" 권유 |
| 구현 commit | message에 `Refs #N` (작업 진행 기록) |
| PR 작성 시 | body에 `Closes #N` (자동 close) |
| 의사결정 갈림길 등장 | issue body에 `방향성 (OPEN)` 로 등록 → 사용자 대기 |

## Pre-conditions

- 프로젝트가 GitHub remote 보유 (`git remote -v`로 확인)
- `gh` CLI 설치 + 인증 (`gh auth status`로 확인). MCP `mcp__github__*` 사용 가능하면 우선.
- `docs/SPEC.md`에 `issue_tracking: enabled` 라인 있을 때만 활성 (opt-in). 기본 비활성.

조건 미충족이면 본 skill 자동 skip — 에러 X.

## Process

### 1. ISSUE.template.md 5섹션 강제

새 issue 생성 시 본 skill 디렉토리의 `ISSUE.template.md`를 body로 채운다.

```
## 배경         — Why
## 전제 (Given) — 시작 전 의존성/조건
## 방향성       — OPEN | YYYY-MM-DD 확정
## 적용 대상 / AC (When → Then)
## 후속 작업    — Next
```

비어있는 섹션은 통째로 삭제 (placeholder 금지). BDD 매핑: 전제(Given) → 적용 대상(When) → AC(Then).

### 2. 방향성 상태로 작업 가능 여부 판정

| 상태 | 의미 | AI agent 행동 |
|------|------|--------------|
| **OPEN** | 사용자 결정 대기 | 본 issue 작업 차단. 다른 issue 우선 처리 또는 사용자에게 결정 요청 |
| **YYYY-MM-DD 확정** | 결정 완료 | 작업 가능. AC 충족 후 close |

확정 날짜 미달 시 → 사용자에게 1회 결정 요청 (Escalation Gate) → 응답 후에만 진행.

### 3. 전제(Given) 체크

작업 시작 전 전제 조건 모두 충족됐는지 확인:
- 체크박스 `[x]` 모두 채워졌나?
- 미충족 항목 → 차단 사유 + 책임 분기 보고

전제가 다른 issue 완료에 의존하면 → 의존 issue가 close 됐는지 확인 후 진행.

### 4. Label 체계 (자동 토글 가이드)

**3-축 label 체계** — 각 축에서 1개씩 부착 권장:

| 축 | Label | 부착 시점 |
|----|-------|---------|
| **type** | `bug` / `feature` / `refactor` / `docs` / `infra` | issue 생성 시 1회 |
| **상태** | `decision-pending` / `ready` / `in-progress` / `blocked` | 방향성·전제 변화에 따라 토글 |
| **우선순위** | `P0` / `P1` / `P2` (선택) | 사용자 결정 |

**상태 자동 토글 규칙** (skill이 사용자에게 권유):

```
방향성: OPEN          → decision-pending
방향성: YYYY-MM-DD 확정 → ready (decision-pending 제거)
전제 체크박스 미완      → blocked (ready 제거)
PR open               → in-progress
PR merged             → 자동 close (label 무관)
```

label 부착은 **hook 차원 강제 X** — skill 가이드. 사용자 또는 PR 자동화로 명시 적용. `gh issue edit <N> --add-label <name>` / `--remove-label <name>` 사용.

### 5. GitHub Projects (V2) 연계 (선택, opt-in)

GitHub Projects board를 칸반 형태 backlog로 활용 시:

**Pre-condition**:
- `docs/SPEC.md`에 `github_project: <URL>` 명시 (예: `https://github.com/users/uzysjung/projects/3`)
- 사용자가 Project 미리 생성 + status field 정의 (Backlog / Ready / In Progress / Done)

**자동 동작**:
- 새 issue 생성 시 → `gh project item-add <number> --owner <owner> --url <issue-url>` 호출
- 상태 변화 시 → status field 갱신:
  - `decision-pending` → Project status `Backlog`
  - `ready` → `Ready`
  - PR open → `In Progress`
  - merged + close → `Done`

**Project 미사용 프로젝트** → 본 섹션 skip (issue label만 활용).

**비대상**:
- iteration field / 자동 sprint 분배 (1인 시나리오 over-engineering)
- 복수 Project board 동기화 (1 SPEC = 1 Project 권장)

본 섹션은 GitHub Projects 활용을 강제하지 않음 — 사용자 선호에 따라.

### 6. 백로그 자동 처리 시퀀스

작업 사이클 시작 시 다음 시퀀스:

```
1. gh issue list --state open --json number,title,labels,body
   → OPEN issue 목록을 backlog 후보로
2. 각 issue body에서 "방향성 (YYYY-MM-DD 확정)" 패턴 grep
   → 확정된 것만 작업 가능 후보
3. 전제 미충족 issue 제외
4. 우선순위 정렬 (label P0 > P1 > P2 > unlabeled)
5. 상위 1-3개를 docs/todo.md로 이관 + 계획 단계 진입
```

### 7. Commit / PR 컨벤션

| 시점 | 메시지 컨벤션 |
|------|-------------|
| Build 중 진행 commit | `<type>: ... (refs #N)` |
| Ship PR body | `Closes #N` 또는 `Fixes #N` (자동 close) |
| 부분 진행 (close 안 함) | `Refs #N` |
| 후속 issue 생성 시 | 원본 issue body의 "후속 작업" 섹션에 `#M` cross-link |

## Output

- GitHub Issue 생성/갱신 (5섹션 body)
- `docs/todo.md` — issue list에서 이관된 task
- commit/PR 메시지에 issue 번호 자동 포함

## Anti-Patterns

- **issue body가 한 줄 ("login 안 됨")만** — 5섹션 의무. 최소 배경 + AC는 채울 것.
- **방향성 미명시** — OPEN인지 확정인지 모르면 작업 시작 불가.
- **전제 무시하고 진행** — 의존 issue 미해결 상태로 작업 진입 금지.
- **PR에서 `Closes #N` 누락** — 수동 close 잊기 쉬움. 컨벤션 강제.
- **모든 issue에 label 다 붙임** — 노이즈. 핵심 분류만.
- **팀 기능 도입 (assignee 자동, code owner 자동 review)** — 본 skill 범위 밖. 팀 사용은 별도 워크플로우.

## Boundary

- GitHub remote 없는 프로젝트 → skill 자동 비활성
- `docs/SPEC.md`에 `issue_tracking: enabled` 없으면 자동 비활성 (opt-in)
- private repo 접근 권한 없으면 fetch 실패 → 사용자에게 보고

## Examples

### dyld-vantage 실제 패턴 (참고)

```markdown
## 배경
Issue #52에서 Feature Flag 재편(16→18) + Blur gate 인프라 구축 완료.
이 이슈는 페이지별 blur 적용 + API 수량 제한의 후속 작업.

## 전제 (Given)
- [x] Issue #52 완료 (Feature Flag 인프라)
- [x] Blur gate 컴포넌트 사용 가능

## 방향성 (2026-04-22 확정)
- 메뉴 접근은 유지 (사이드바 풀 노출, 401/403 없음)
- 페이지 단위 blur: outer max-w-* mx-auto 안쪽에 blur_gate 1개만
- 개별 블록별 blur 금지 (복잡도 대비 가치 낮음)

## 적용 대상 / AC
- [ ] 모든 _content.html에 blur_gate 적용 (When Free user 방문 → Then blur 노출)
- [ ] API 수량 제한 미들웨어 (When tier 미충족 요청 → Then 403)

## 후속 작업
- [ ] Issue #56로 분리: Pricing 페이지 CTA 디자인
```
