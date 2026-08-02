---
name: ui-visual-review
description: "Captures screenshots of key UI flows after E2E tests pass, runs an agent-side first-pass diff (regressions, console errors, layout shifts), then surfaces a checklist for the user's final approval. Also owns the browser-launch procedure the `playwright-launch` rule delegates here: use it whenever a browser must be opened for a human to drive or for automated capture — manual E2E checks, UX/fidelity comparison against a reference product, or a one-time OAuth login. Use after E2E tests pass on a UI track (csr-*, ssr-*, full)."
---

# UI Visual Review

## Purpose

E2E 테스트가 PASS 했어도 시각적 회귀(layout shift, 색상/간격 변화, 빈 화면, 잘림)는 functional test가 못 잡는다. 본 skill은:

1. 핵심 사용자 화면을 자동 캡처
2. 이전 baseline과 diff
3. 에이전트가 명백한 regression 1차 판정
4. 사용자가 최종 승인 → 새 baseline 채택 또는 수정 요청

수동으로 스크린샷을 모아 눈으로 비교하던 패턴을 자동화 + diff + 에이전트 사전 판정으로 옮긴 형태.

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

## 브라우저를 띄우는 법 (영속 profile)

`playwright-launch` 룰이 **금지**를 소유하고, 여기가 **절차**를 소유한다. 금지문은 상주해야
하지만(위반은 작업 도중에 일어난다) 아래 절차는 실제로 브라우저를 띄울 때만 필요하다.

핵심은 셋이다. ⓐ **영속 profile dir** — 프로젝트별로 분리해 매 iteration 재사용한다. cookie ·
IndexedDB · Service Worker 가 보존돼야 재로그인이 사라진다. ⓑ **Chrome for Testing 별도 binary**
(`npx playwright install chromium`) — 사용자의 일반 Chrome 과 완전히 분리한다. ⓒ **사용자가 키를
입력하는 동안 자동화 layer 0** — main session 은 창을 띄우기만 하고, capture·검증은 입력이 끝난 뒤
별도 process 에서 돈다.

```js
import { chromium } from 'playwright';

const PROFILE_DIR = process.env.PROJECT_PROFILE_DIR || `${process.env.HOME}/.<project>-audit-profile`;
const TARGET = process.env.PROJECT_URL || 'http://localhost:<port>';

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1440, height: 900 },
  args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

// (선택) dev bypass auth — OAuth 의 webdriver 차단을 피한다. same-origin cookie 로 저장된다.
await page.goto(`${TARGET}/`, { waitUntil: 'domcontentloaded' });
await ctx.request.post(`${TARGET}/api/v1/_dev/test-login`, {
  data: { key: process.env.E2E_TEST_KEY ?? 'e2e-dev-key', email: 'e2e@example.local' },
});
await page.reload({ waitUntil: 'networkidle' });

// 창을 띄운 채 자동화는 detach — 사용자가 직접 쓴다. ctx.close() 를 부르지 않는다.
```

**두 가지 사용 형태**

0. **기존 launcher 를 먼저 정리한다** — `pkill -f "playwright|Chrome for Testing"`. 같은 profile
   dir 을 잡고 있는 창이 살아 있으면 `launchPersistentContext` 가 기동하지 못한다. 첫 실행은 되고
   **2회차부터** 실패하기 때문에 프로필 잠금이 아니라 스크립트 버그로 오진하기 쉽다.
1. **사용자가 직접 보는 경우** — `node scripts/<project>-launch.mjs` 를 포그라운드로 띄우고
   "URL / 로그인됨 / 직접 쓰세요"를 보고한 뒤, 추가 navigation·evaluate 를 **하지 않는다**.
   사용자 입력과 충돌한다.
2. **자동 capture (fidelity·audit)** — 같은 `launchPersistentContext` 로 시나리오를 자동 click 하고
   산출물을 `docs/research/<area>_audit_<sprint>/iter_<N>/` 에 남긴다.

> **이 launcher 로 띄운 창은 Playwright API 로 캡처한다**(`page.screenshot({ fullPage: true })`,
> 콘솔은 `page.on('console')`). 아래 §2·§4 의 chrome-devtools MCP 예시는 launcher 없이 MCP 로
> 작업하는 경우다 — Playwright 는 CDP 를 파이프로 물어 외부 프로세스가 붙을 엔드포인트를 열지
> 않으므로, 이 둘을 한 세션에서 섞으려 하면 붙을 대상이 없다. **하나를 고르고 끝까지 그걸로 간다.**

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

파일명이 곧 비교 단위다 — 무엇을 무엇과 견줄지가 이름에서 보여야 한다:
- `<화면>-empty.png` / `<화면>-list.png` — 같은 화면의 다른 상태
- `<화면>-after-fix.png` / `<화면>-round2.png` — 수정 round 별 보존
- `<기능>.png` — 기능별 핵심 화면 1장
