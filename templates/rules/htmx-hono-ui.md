---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
---

# htmx UI — Hono 서버 JSX

Hono 가 렌더하는 htmx 화면은 `hono/jsx` 컴포넌트(`.tsx`)로 써서 `c.html()` 로 돌려주고, Tailwind v4 + daisyUI 클래스(`btn` · `card` · `bg-base-100`)로 만든다 — 브라우저 React 가 아니라 shadcn/ui 는 안 쓴다. 다른 템플릿 엔진·CSS 체계나 Tailwind v3 이면 바꾸기 전에 묻는다. 없으면 첫 UI 작업 때 `https://daisyui.com/docs/install/` 대로 설치하고, 린터 `@shadcn/lint` 는 `https://github.com/shadcn-ui/lint/blob/main/SETUP.md` 대로 등록한 뒤 켤 규칙을 사용자와 정한다(`class` 속성도 검사하고 daisyUI 클래스를 안다). UI 를 바꾼 뒤 lint 를 돌려 고친다.

htmx 주 버전(package.json · `<script src>`)을 먼저 보고 그 판 문서대로 쓴다. 4 는 2 와 달리 상속이 명시적(`:inherited`)이고 4xx·5xx 응답도 swap 하며, `hx-disable` 은 옛 `hx-disabled-elt` 다(처리 끄기는 `hx-ignore`).

`hono/jsx` 는 자식·속성을 기본으로 이스케이프한다 — `raw()` · `dangerouslySetInnerHTML` 에 사용자 입력을 넣지 않는다. 4.13.7 미만은 `Suspense` · `ErrorBoundary` 바로 아래 문자열이 예외다(GHSA-hxh3-vqpv-xpqv).

테스트는 `hono/testing` 의 `testClient` 로 한다. 타입은 라우트(서브앱 `.route()` 포함)를 인스턴스에 체이닝한 결과에만 잡히니 그 결과와 `typeof` 를 export 하고, 러너는 타입을 안 보니 테스트 파일도 `tsc` 로 검사한다.

대상은 Hono v4 다. v5(RC)는 런타임 어댑터가 `@hono/*` 패키지로 갈라지니 hono 주 버전을 보고 import 한다.
