---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
---

# UI Components

React · Next.js 프로젝트의 UI 는 shadcn/ui 컴포넌트로 만들고, 공식 린터 `@shadcn/lint`(shadcn-ui/lint — ESLint·Oxlint 플러그인)로 검사한다. shadcn CLI 에는 `lint` 명령이 없다.

- **전제**: shadcn/ui 는 Tailwind 가, `@shadcn/lint` 는 Tailwind v4 와 ESLint 9.30+ 또는 Oxlint 1.80+ 가 필요하다. 프로젝트가 다른 컴포넌트 라이브러리·스타일 체계를 쓰거나 Tailwind v3 이면, 바꾸기 전에 사용자에게 묻는다 — 컴포넌트 소스·CSS 변수·의존성을 써 넣는 구조 변경이다.
- **없으면 첫 UI 작업 때 설치한다**: shadcn/ui 는 `npx shadcn@latest init`, 린터는 `https://github.com/shadcn-ui/lint/blob/main/SETUP.md` 를 읽고 그 절차대로 등록한다. 그 절차는 규칙을 하나도 켜지 않는다 — 바뀐 파일을 알리고, README 의 Rules 표에서 시작할 규칙을 제안해 사용자 확인을 받아 켠다. 켜기 전의 lint 는 설정이 로드되는지만 확인한다.
- **UI 를 바꾼 뒤** 프로젝트의 lint 명령(`npm run lint` 등)을 돌려 오류를 고친다. 오류 문구가 그 프로젝트의 컴포넌트·variant·테마에 맞는 대안을 알려 준다.
