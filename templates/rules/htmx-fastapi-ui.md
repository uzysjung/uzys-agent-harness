---
paths:
  - "**/*.html"
  - "**/*.jinja"
  - "**/*.jinja2"
  - "**/*.j2"
---

# htmx UI — FastAPI 템플릿

FastAPI 가 렌더하는 htmx 화면(Jinja·HTML)은 Tailwind v4 + daisyUI 클래스(`btn` · `card` · `bg-base-100`)로 만든다. 다른 CSS 체계나 Tailwind v3 이면 바꾸기 전에 묻는다. 없으면 첫 UI 작업 때 `https://daisyui.com/docs/install/` 대로 설치한다.

`@shadcn/lint` 는 템플릿을 못 읽으니 ast-grep(`pip install ast-grep-cli`)으로 검사한다. 없으면 아래 두 파일을 프로젝트 루트에 만들고 lint 명령에 `ast-grep scan` 을 더한다. UI 를 바꾼 뒤 돌려 보고된 줄을 고친다 — 오타·없는 클래스는 못 잡는다.

`sgconfig.yml`:

```yaml
ruleDirs: [rules]
languageGlobs: { html: ["*.jinja", "*.jinja2", "*.j2"] }
```

`rules/tailwind.yml`:

```yaml
id: tailwind-tokens
language: html
severity: error
message: 원색 팔레트·임의 값·인라인 style 대신 daisyUI 테마 색·스케일 값·클래스를 쓴다
rule:
  any:
    - kind: attribute_value
      regex: (^|[^\w-])[a-z-]+-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|[1-9]00|950)(/\d+)?([^\w-]|$)
      inside: &class { kind: attribute, has: { kind: attribute_name, regex: ^class$ }, stopBy: end }
    - { kind: attribute_value, regex: '-\[[^\]]+\]', inside: *class }
    - { kind: attribute, has: { kind: attribute_name, regex: ^style$ } }
```
