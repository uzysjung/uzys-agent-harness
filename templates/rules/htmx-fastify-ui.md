---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
---

# htmx UI — Fastify 서버 JSX

Fastify 가 렌더하는 htmx 화면은 서버 JSX 템플릿(`.tsx`, 예: `@kitajs/html`)으로 쓰고 Tailwind v4 + daisyUI 클래스(`btn` · `card` · `bg-base-100`)로 만든다 — 브라우저 React 가 아니라 shadcn/ui 는 안 쓴다. 다른 템플릿 엔진·CSS 체계나 Tailwind v3 이면 바꾸기 전에 묻는다. 없으면 첫 UI 작업 때 `https://daisyui.com/docs/install/` 대로 설치하고, 린터 `@shadcn/lint` 는 `https://github.com/shadcn-ui/lint/blob/main/SETUP.md` 대로 등록한 뒤 켤 규칙을 사용자와 정한다(`class` 속성도 검사하고 daisyUI 클래스를 안다). UI 를 바꾼 뒤 lint 를 돌려 고친다.
