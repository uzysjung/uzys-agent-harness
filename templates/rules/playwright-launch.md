# Playwright Launch

브라우저를 띄워 **사용자가 직접 사용**하는 모든 상황 (E2E 수동 확인, UX 비교, fidelity audit, OAuth 1회 로그인 등) 에 적용. 핵심 원칙: **영속 profile + Chrome for Testing 별도 binary + 자동화 0 patten**. MCP 일회성 context = 휘발 → 입력 버벅임. 정리하고 영속 profile로 재기동.

## 절대 금지

- `mcp__chrome-devtools__*` 로 **사용자 활성 Chrome** attach (입력 latency)
- Playwright MCP (`mcp__plugin_playwright__*`) **일회성** browser context — 영속 profile dir 없음 → IndexedDB / cookie / localStorage / SW 휘발 → 매 launch 마다 재로그인 + 버벅임
- `browser.newContext()` 일회성 패턴
- **사용자 OAuth 입력 시점에 자동화 process 동시 실행** (CDP latency)
- reference SaaS (Linear / Notion / Jira 등) 측 `page.goto(URL)` 또는 `page.reload()` — sidebar click only

## 필수 패턴

1. **영속 profile dir** — 프로젝트별 분리, 매 iter 재사용. cookie + IndexedDB + Service Worker 영구 보존.
   - 예: `~/.<project>-dev-audit-profile`, `~/.<reference>-audit-profile`, `${PROJECT_PROFILE_DIR}` env var
2. **Chrome for Testing 별도 binary** — `npx playwright install chromium` 으로 받은 `~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google Chrome for Testing.app`. 사용자 일반 Chrome 과 완전 분리.
3. **사용자 키 입력 시 자동화 layer 0** — main session 은 chromium 창 띄우기만. **사용자가 키보드 직접 입력**. 자동화 capture/검증은 **별도 process** (`node scripts/<launch>.mjs`) 에서 입력 끝난 후.
4. **자체 구현 측 = dev bypass auth** — Google OAuth 등 webdriver 차단 회피. 예: `POST /api/v1/_dev/test-login` 으로 JWT cookie 발급.

## 표준 launch 스크립트 골격

```js
import { chromium } from 'playwright';

const PROFILE_DIR = process.env.PROJECT_PROFILE_DIR || `${process.env.HOME}/.<project>-audit-profile`;
const TARGET = process.env.PROJECT_URL || 'http://localhost:<port>';
const TEST_KEY = process.env.E2E_TEST_KEY || 'e2e-dev-key';

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1440, height: 900 },
  args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

// (선택) dev bypass auth — same-origin cookie 자동 저장
await page.goto(`${TARGET}/`, { waitUntil: 'domcontentloaded' });
await ctx.request.post(`${TARGET}/api/v1/_dev/test-login`, {
  data: { key: TEST_KEY, email: 'e2e@example.local' },
});
await page.reload({ waitUntil: 'networkidle' });

// 창 떠 있게 두고 자동화 detach — 사용자가 직접 사용.
// ctx.close() 호출 금지.
```

## 사용 패턴

### A. 사용자가 직접 보고 싶을 때 (most common)

1. `pkill -f "playwright|Chrome for Testing"` 기존 launcher 정리 (선택)
2. `node scripts/<project>-launch.mjs` 실행 (chromium 창 살아있어야 함, 백그라운드 X)
3. 사용자에게 "URL: localhost:<port>, 로그인됨, 직접 사용하세요" 보고
4. **MCP playwright 로 추가 navigation/evaluate 금지** — 사용자 입력과 충돌

### B. fidelity 비교 / audit 자동 capture

1. `node scripts/<audit>.mjs` — launchPersistentContext + 비교 시나리오 자동 click
2. 산출물 = `docs/research/<ref>_audit_<sprint>/iter_<N>/`

## 위반 시 즉시 조치

1. 일회성 Playwright MCP context 사용 발견 → 닫고 영속 profile launcher 로 재기동
2. `chrome-devtools` MCP attach 발견 → 즉시 detach + Playwright 영속 패턴 전환
3. 사용자가 "버벅인다" / "느리다" 호소 → 본 rule 위반 확인 1순위
