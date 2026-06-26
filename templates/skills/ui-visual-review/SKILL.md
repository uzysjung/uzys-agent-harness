---
name: ui-visual-review
description: "Captures screenshots of key UI flows after E2E tests pass, runs an agent-side first-pass diff (regressions, console errors, layout shifts), then surfaces a checklist for the user's final approval. Use after E2E tests pass on a UI track (csr-*, ssr-*, full). Adapts the GoalTrack screenshot-review pattern into a repeatable workflow."
---

# UI Visual Review

## Purpose

E2E 테스트가 PASS 했어도 시각적 회귀(layout shift, 색상/간격 변화, 빈 화면, 잘림)는 functional test가 못 잡는다. 본 skill은:

1. 핵심 사용자 화면을 자동 캡처
2. 이전 baseline과 diff
3. 에이전트가 명백한 regression 1차 판정
4. 사용자가 최종 승인 → 새 baseline 채택 또는 수정 요청

GoalTrack의 `docs/screenshots/` 수동 패턴(mvp-home / v3-search / v4-wiki 등)을 자동화한 형태.

## When to Invoke

| 트리거 | 행동 |
|--------|------|
| E2E 테스트 PASS + UI Track(csr-*/ssr-*/full) | 본 skill 호출 권유 |
| UI 변경 PR review | visual diff 결과 review 입력으로 |
| 의도적 디자인 변경 후 baseline 갱신 | "approve all" 옵션 |
| Track이 data/tooling/executive | **skip** — UI 없음 |

## Pre-conditions

- Playwright 또는 chrome-devtools MCP 사용 가능 (UI Track 설치 시 기본 포함)
- 앱이 로컬에서 기동 가능 (예: `pnpm dev`, `docker-compose up`)
- 핵심 화면 URL 리스트가 정의됨 (없으면 본 skill 첫 실행 시 사용자 질의)

## Process

### 1. 화면 리스트업 (한 번만)

`docs/visual-pages.json` 부재 시 사용자에게 핵심 화면을 묻는다 (5-10개 권장):

```json
{
  "base_url": "http://localhost:3000",
  "pages": [
    { "id": "login", "path": "/login", "wait_for": "form" },
    { "id": "home", "path": "/", "wait_for": "main", "auth": "user1" },
    { "id": "detail", "path": "/items/sample", "auth": "user1" },
    { "id": "settings", "path": "/settings", "auth": "user1" }
  ],
  "viewports": [
    { "name": "desktop", "width": 1440, "height": 900 },
    { "name": "mobile",  "width": 375,  "height": 812 }
  ]
}
```

`auth` 키는 `docs/visual-auth.example.json`(별도 시크릿)에서 매핑.

### 2. 캡처

각 page × viewport 조합으로 스크린샷 캡처. chrome-devtools MCP 사용 예:

```
for page in pages:
  navigate_page({url: base_url + page.path})
  wait_for({text: page.wait_for})
  take_screenshot({fullPage: true})
  → 저장: docs/screenshots/<branch-or-date>/<page.id>__<viewport.name>.png
```

저장 경로 규칙: `docs/screenshots/<phase>/<page_id>__<viewport>.png`. `phase`는 git branch 이름 또는 `YYYY-MM-DD-HHmm`.

### 3. Diff (baseline 대비)

baseline 위치: `docs/screenshots/baseline/`. 첫 실행이면 현재 캡처가 baseline.

비교 방식 (간단 → 정밀 순):
- **L1 (해시)**: `sha256` 비교. 같으면 PASS, 다르면 L2.
- **L2 (pixelmatch)**: `pixelmatch` 또는 ImageMagick `compare -metric AE`. threshold(예: 0.5%) 이내 PASS.
- **L3 (시각 검토)**: L2 fail 시 에이전트가 두 이미지를 LLM 입력으로 보고 차이 서술.

L1만 구현해도 50% 가치. L2는 의존성 추가.

### 4. 에이전트 1차 리뷰 (자동)

L2/L3 fail이거나 차이가 임계 이상이면 에이전트가 다음 휴리스틱으로 명백한 regression 판정:

| 시그널 | 분류 |
|--------|------|
| 빈 화면 / 흰 페이지 | **REGRESSION** |
| 콘솔 에러 (chrome-devtools `list_console_messages`) | **REGRESSION** |
| 핵심 컴포넌트(navbar, main content) 누락 | **REGRESSION** |
| 색상/간격 미세 변화 | **CHANGED** (사용자 판단) |
| 의도된 카피/레이아웃 변경 | **EXPECTED** (커밋 메시지 매칭) |

### 5. 결과 보고

`docs/visual-review-<phase>.md` 생성:

```markdown
# Visual Review — 2026-04-20

## Summary
- 8 pages × 2 viewports = 16 captures
- PASS (no diff): 12
- CHANGED (review needed): 3
- REGRESSION: 1

## REGRESSION
- `home__desktop`: 콘솔 에러 "Cannot read properties of undefined" + main 영역 빈 화면

## CHANGED
- `login__mobile`: 버튼 색상 변경 (의도 추정 — git diff에 button.primary 수정 발견)
- `settings__desktop`: spacing 변화

## PASS
- (생략)
```

### 6. 사용자 승인 게이트

사용자가 `docs/visual-review-<phase>.md` 보고 다음 중 결정:

- **REGRESSION 있음** → 수정 후 재실행 (Revision Gate)
- **CHANGED만 있음** → 항목별 approve 또는 reject. approve 시 baseline 업데이트
- **PASS만 있음** → 자동 baseline 업데이트 가능

## Output

- `docs/screenshots/<phase>/*.png` — 캡처본
- `docs/screenshots/baseline/*.png` — 승인된 baseline
- `docs/visual-review-<phase>.md` — diff 리포트

## Integration with Workflow

- **E2E 테스트 후**: UI Track + `docs/visual-pages.json` 존재 시 PASS 후 본 skill 자동 호출 권유
- **Review 시**: visual-review-<phase>.md 가 있으면 review 입력으로 흡수. REGRESSION 1건이라도 있으면 차단
- **Revision loop 중**: REGRESSION → 수정 → 재캡처 → 재diff 로 포함

## Anti-Patterns

- **사용자 승인 없이 baseline 자동 갱신** — 의도하지 않은 regression이 영구화. 항상 명시적 approve 필요
- **모든 페이지 다 캡처 (50+)** — 노이즈 폭증. 핵심 5-10개로 시작
- **viewport 1개만** — mobile 깨짐 놓침. desktop + mobile 최소 2개
- **L3(LLM 시각 비교) 매번 호출** — 비용. L1/L2에서 못 거른 것만 L3
- **screenshots/ 디렉토리 git에 커밋 X** — 회귀 비교 불가. `docs/screenshots/baseline/`은 커밋, `<phase>/`는 gitignore

## Examples

GoalTrack 프로젝트의 수동 패턴 (참고):
- `docs/screenshots/mvp-home-empty.png`, `mvp-home-list.png` — 같은 화면 다른 상태
- `crypto-365d-after-fix.png`, `crypto-365d-round2.png` — 수정 round별 보존
- `shared_portfolio.png`, `shared_simulation.png` — 기능별 핵심 화면

본 skill은 그 패턴을 자동화 + diff + 에이전트 사전 판정 추가.
