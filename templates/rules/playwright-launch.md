# Playwright Launch

브라우저를 띄워 **사용자가 직접 쓰는** 모든 상황(E2E 수동 확인, UX 비교, fidelity audit, OAuth 로그인)에 적용. 여기 남긴 것은 **위반을 막는 금지문뿐**이다 — 절차·스크립트 골격·사용 패턴은 `ui-visual-review` 스킬이 SSOT. 금지문만 상주하는 이유는 위반이 **작업을 시작한 뒤에** 일어나서, 스킬 발화를 기다리면 이미 늦기 때문이다.

## 절대 금지

- **사용자 활성 Chrome 에 attach** (`mcp__chrome-devtools__*`) — 입력 latency.
- **일회성 browser context** (Playwright MCP, `browser.newContext()`) — 영속 profile dir 이 없어 cookie/IndexedDB/SW 가 휘발한다. 매 launch 재로그인 + 버벅임.
- **사용자가 키를 입력하는 동안 자동화 process 동시 실행** (CDP latency).
- **reference SaaS(Linear/Notion/Jira 등) 측 `page.goto()`·`page.reload()`** — sidebar click only.

## 필수 · 위반 시

영속 profile dir + Chrome for Testing 별도 binary. 사용자 입력 구간에는 자동화 layer 0 — capture 는 입력이 끝난 뒤 별도 process 에서. 구현 형태는 `ui-visual-review` 스킬 참조.

일회성 context 나 devtools attach 를 발견하면 즉시 닫고 영속 profile launcher 로 재기동한다. 사용자가 "버벅인다"고 하면 본 rule 위반 확인이 1순위다.
