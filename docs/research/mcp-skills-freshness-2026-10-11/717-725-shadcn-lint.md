# #717 · #725 사실 조사 — "shadcn lint"의 정체와 근거

조사일 2026-10-11 · 조사자: 리서치 레인(저장소 수정 없음)

## 요약

- **"shadcn lint" = shadcn 공식 조직이 2026-09에 낸 별도 린터 `@shadcn/lint`(github.com/shadcn-ui/lint, npm `@shadcn/lint` 0.2.1)다.** shadcn CLI의 서브명령이 아니고(`npx shadcn lint`는 없음), 공식 shadcn skill도 아니다. ESLint·Oxlint 플러그인으로 쓰며, Tailwind v4 프로젝트에서 에이전트가 디자인 시스템을 벗어난 클래스(임의 값·원색·컴포넌트 재스타일 등)를 쓰면 **고치는 방법까지 담은 오류**를 내는 "agent-first linter"다.
- **추천**: #717·#725가 가리키는 대상은 `@shadcn/lint`로 특정하는 것이 가장 공신력 있다(공식 조직 · MIT · 주간 다운로드 155만). 단 **설치 형태가 우리 카탈로그의 기존 축과 다르다** — 이건 스킬이 아니라 *프로젝트 devDependency + 린트 설정*이고, 공식 저장소에 SKILL.md가 없다. 공식이 제시하는 에이전트 경로는 ① `SETUP.md`를 에이전트에게 읽혀 설치시키기 ② `AGENTS.md`에 "After making changes, run `npm run lint` and fix all errors." 한 줄 넣기, 두 가지다.
- 우리가 이미 까는 공식 `shadcn` skill 본문은 lint를 **한 번도 언급하지 않는다**(대조군 포함 확인). 즉 지금 설치자는 `@shadcn/lint`의 존재를 우리 자산으로부터 알 방법이 없다.

## 근거

### 1. shadcn CLI에 `lint` 서브명령은 없다 (killed 후보: "CLI 서브명령")

- **소스 등록 목록** — `gh api repos/shadcn-ui/ui/contents/packages/shadcn/src/index.ts`(main, 2026-10-11): `addCommand` 14개 = `init · apply · add · diff · docs · view · search · migrate · eject · info · build · mcp · preset · registry`. lint/check/audit 없음.
- **배포물 재확인(대조군 포함)** — `npm pack shadcn@4.21.4`(latest, 2026-10-07 게시) 후 `dist/`에서 `("<이름>")` 리터럴 개수:

  | 이름 | 개수 | 성격 |
  |---|---|---|
  | init / add / diff / docs / view / search / migrate / eject / info / build / mcp / preset / registry / apply | 각 1~10 | **양성 대조군(실재 명령) — 전부 잡힘** |
  | lint / check / audit / doctor | **0** | 대상 |

  예: `new Command().name("migrate").description("run a migration.")` 가 잡혀 탐지기가 무는 것을 확인.
- **최신 rc**(`0.0.0-rc-20261007105214`)도 같은 방법으로 migrate·mcp=1, lint·check·audit·doctor=0.
- 비슷한 이름의 혼동 요소(사실만): shadcn MCP 서버에 `shadcn:get_audit_checklist` 도구가 있다 — "Returns a checklist for verifying components (imports, deps, lint, TypeScript)."(skills/shadcn/mcp.md 76행, context7 `/shadcn-ui/ui` 동일). **체크리스트를 돌려줄 뿐 린터가 아니다.** 또 shadcn-ui/ui #11598 "feat(cli): css variable contract checker"는 closed(머지 여부 미확인)이고 현재 명령 목록엔 없다.

### 2. `@shadcn/lint` — 실체 (confirmed)

| 항목 | 값 | 출처·명령 |
|---|---|---|
| 저장소 | github.com/shadcn-ui/lint (shadcn-ui 조직, ui 저장소와 같은 조직) | `gh api repos/shadcn-ui/lint` |
| 생성 / 최근 push | 2026-09-02 / 2026-10-10 · archived=false | 同 |
| 별 · 라이선스 | 3,162 · MIT | 同 |
| npm | `@shadcn/lint` 0.2.1 (최초 0.1.0 2026-09-14, 최신 2026-10-10) · repository = shadcn-ui/lint | `npm view @shadcn/lint` |
| 다운로드 | 1,558,504/주 (2026-10-03~09). 참고: `shadcn` CLI 11,882,290/주 | api.npmjs.org downloads/point/last-week |
| peer · engine | `eslint >=9.30.0`, `@typescript-eslint/parser >=8.40.0` · node `>=20.19` | `npm view` |
| 0.x 버전 | 9월에만 0.1.0→0.2.0 7회, 10/10에 0.2.1 | GitHub releases |

**무엇을 하나**(README 원문, 벤더 주장):
- "`@shadcn/lint` is an agent-first linter for Tailwind design systems." "works with Tailwind v4 projects (**shadcn/ui not required**). Available for both **ESLint and Oxlint**. Works with **React, Svelte, and Vue**."
- 규칙 6종: `no-restyle`(className으로 컴포넌트 재스타일) · `no-raw-colors`(`bg-pink-500` 등) · `no-arbitrary-values`(`p-[13px]`) · `no-inline-styles` · `no-unknown-classes`(Tailwind가 생성 못 하는 클래스) · `require-static-classes`(`` `bg-${color}` ``).
- 오류 문구가 대안을 알려준다. 예: `"p-4" is not allowed on <Button>: <Button> owns its spacing. Use a size (sm, lg), or margin here or gap on the parent…`
- shadcn/ui 프로젝트는 `components.json`으로 컴포넌트·테마 자동 인식. 그 밖은 `settings.shadcn.componentImports` 등으로 지정.

**설치·사용**(README "Get started" · "After setup"):
- React+ESLint: `npm install -D @shadcn/lint eslint @typescript-eslint/parser` → `eslint.config.mjs`에 `plugins: { shadcn }`, 규칙 켜기 → `npx eslint .`
- React+Oxlint(1.80+): `npm install -D @shadcn/lint oxlint` → `.oxlintrc.json`에 `"jsPlugins": ["@shadcn/lint"]` → `npx oxlint`
- 이후 `package.json`의 `lint` 스크립트로 묶고 **AGENTS.md에** `After making changes, run \`npm run lint\` and fix all errors.`
- 에이전트용 퀵스타트: "Read https://github.com/shadcn-ui/lint/blob/main/SETUP.md and set up @shadcn/lint in this project."
- `SETUP.md`(67행) 핵심 지시: 패키지 매니저·모노레포 감지, 기존 ESLint/Oxlint 재사용(없으면 Oxlint, Vue/Svelte면 ESLint), **"Do not enable new rules or change existing rule policies"** · "Do not add rule presets, enable new rules, or add rule overrides" · "Leave choosing rules and defining what is allowed to the user." → **공식 설치 절차는 규칙을 하나도 켜지 않는다.** 설치만으로는 아무것도 잡지 않고, 규칙 선택은 사용자 몫.

**효과 근거**(docs/evals.md, 벤더 자체 측정 — 독립 재현 없음):
- 150+ 태스크 런, 피드백 후 위반 수 0(예외 2건은 당일 고친 린터 버그). 표: Sonnet 5 69→0, Haiku 4.5 66→0, Opus 5 42→0, GPT 5.6 Terra 117→0, GPT 5.6 Sol 98→0(6/8 완료).
- 대조군("규칙 텍스트만 주고 자기 검토") 대비 수정 비용 10~48% 절감(Claude 계열). "Diagnostics matter most for weaker models" — Opus는 규칙 텍스트만으로도 다 고쳤고 Haiku는 1건 실패.
- 벤더 스스로 "These are measurements of specific runs, not promises for every model or project."라고 적었다.
- 픽스처는 "small shadcn project" — 실제 대형 기존 코드베이스 측정은 아님.

**제약**(사실):
- Tailwind v4 전제(README; `no-unknown-classes`는 설치된 Tailwind v4에 질의 — docs/how-it-works.md 112행). Tailwind v3 프로젝트 지원은 README에 없음.
- Vue/Svelte 템플릿은 ESLint로만 검사, Oxlint는 `<script>`만.
- ui.shadcn.com 공식 문서(shadcn-ui/ui `apps/v4/content/docs`)에는 `@shadcn/lint` 언급이 없다 — code search `"shadcn/lint"` 0건, 같은 방식의 대조 검색 `"mcp init"` 4건 잡힘. docs 트리에 lint 페이지 없음(mcp·skills 페이지는 있음). 웹 검색에서도 공식 발표 글을 못 찾았다(아래 Caveats).

### 3. 공식 shadcn skill (우리가 이미 설치하는 것)

- 위치: github.com/shadcn-ui/ui `skills/shadcn/SKILL.md`(295행) + `cli.md · mcp.md · customization.md · design-system*.md · registry.md · rules/*.md(6) · scripts/showcase-coverage.mjs · evals/evals.json · agents/openai.yml`. 최근 커밋 2026-10-09 "add DESIGN.md design system workflow".
- frontmatter: `name: shadcn` · `user-invocable: false` · `allowed-tools: Bash(npx shadcn@latest *)…` · description "Applies when working with shadcn/ui … or any project with a components.json file."
- 본문 규칙: "Critical Rules … always enforced" — semantic colors(원색 금지), 기존 variant 우선, `className`으로 재스타일 자제 등. **`@shadcn/lint` 규칙과 의도가 겹친다**(no-raw-colors ↔ "Use semantic colors… never raw values like bg-blue-500").
- **lint 언급**: `check-absence.sh --canary "run npm run lint" -i 'lint' SKILL.md` → 매치 0 (exit 0, canary 검증 통과). 하위 파일 grep -ci lint: cli/customization/design-system/registry/rules 6종 = 0, **mcp.md = 1**(위 get_audit_checklist 설명줄뿐). 즉 skill 어디에서도 `@shadcn/lint` 설치·실행을 지시하지 않는다.

### 4. shadcn MCP 서버 (confirmed, lint와는 간접 관계)

- `shadcn mcp`(stdio 서버) · `shadcn mcp init`(에디터 설정 작성) — CLI에 `mcp` 명령 실재(위 1절 대조군). 문서: ui.shadcn.com/docs/mcp (repo `apps/v4/content/docs/(root)/mcp.mdx`), 출시 changelog 2025-04-mcp · 2025-08-cli-3-mcp.
- 용도: 레지스트리 검색·열람·설치. lint 관련은 `get_audit_checklist`(체크리스트 반환)뿐 — 린트를 실행하지 않는다.

### 5. 커뮤니티 후보 (killed — 공신력·관련성 낮음)

`gh api search/repositories?q=shadcn+lint` 상위:
- `remorses/lintcn`(102★) — "shadcn for type aware lint rules"(shadcn식 배포 방식을 빌린 tsgolint 규칙 모음, shadcn/ui 린트 아님).
- `sergioazoc/oxlint-tailwindcss`(101★) — Tailwind v4 일반 규칙.
- `lirena00/compadcn`(41★, 2025-07 이후 정체) — shadcn CLI 래퍼의 `lint`(미사용 컴포넌트 탐지).
- ESLint 플러그인 공식판은 `@shadcn/lint`가 곧 그것(ESLint·Oxlint 겸용). 별도 `eslint-plugin-shadcn` 공식 패키지는 이번 조사에서 확인하지 않았다(미검증).

### 6. #725 관련 사실 ("React/Next.js면 무조건 shadcn/ui + shadcn lint")

이슈 원문(2026-10-08): "React , next.js 사용시에는 무조건 shadcn/ui 와 shadcn lint를 사용하도록 해줘". #717 원문(2026-10-05): "Shadcn lint를 쓰도록 하는 스킬 , 설치하도록 등록". 둘 다 코멘트 0, 라벨 없음.

근거 쪽 사실:
- shadcn CLI 주간 1,188만 다운로드, ui 저장소 125k★ — React 생태계 기본값 수준의 채택.
- `@shadcn/lint`의 벤더 측정: 디자인 시스템 이탈을 1라운드에 0으로 수렴, 약한 모델일수록 효과 큼.
- 공식 저장소가 직접 "AGENTS.md에 `npm run lint` 실행 지시"를 권장 — 에이전트 지시문에 넣는 형태가 벤더 권장 경로와 일치.
- Next.js 16에서 `next lint` 제거, `next build`가 더는 린트 안 돌림(context7 `/vercel/next.js` upgrading/version-16) → Next.js 16 프로젝트는 린트를 **명시적으로** 돌려야 하므로 "변경 후 lint 실행" 지시의 빈자리가 실재한다.

반례·제약 쪽 사실:
- **shadcn/ui는 Tailwind가 전제다.** `packages/shadcn/src/preflights/preflight-init.ts` 105~127행: Tailwind 버전이 감지되지 않으면 `TAILWIND_NOT_CONFIGURED` 오류로 init 실패. Tailwind를 안 쓰는 React 프로젝트(CSS Modules, styled-components, MUI·Chakra·Mantine·Ant Design 등 자체 스타일 체계)에는 그대로 못 넣는다.
- **`@shadcn/lint`는 Tailwind v4 전제**(v3 지원 문구 없음). shadcn/ui 자체는 v3도 init 허용(같은 파일 115~118행) → "shadcn/ui 프로젝트인데 lint는 못 쓰는" v3 구간이 존재.
- 공식 shadcn skill도 자기 적용 범위를 "projects with a components.json"으로 한정하고, 우리 카탈로그 설명도 "Only for projects that use shadcn"(src/external-assets.ts 838행).
- `@shadcn/lint`의 공식 설치 절차는 규칙을 켜지 않는다 — "무조건 사용"을 지시해도 규칙 선택은 사용자 결정으로 남는다고 벤더가 명시.
- 기존 프로젝트에 shadcn/ui를 추가하는 것은 컴포넌트 소스·`components.json`·CSS 변수·의존성을 프로젝트에 써넣는 작업(init 설명: "installs dependencies, adds the cn util, and configures CSS variables") — 되돌리기 비용이 있는 구조 변경이다.
- `@shadcn/lint` 0.x, 출시 4주, 9월에만 7회 릴리스 — API·규칙 옵션이 아직 움직이는 단계.
- 이 리포의 이력: 2026-08-02 기술스택 상세 룰(shadcn 포함)을 배포에서 뺐다 — "모델이 이미 아는 것을 상주로 부담시키던 자리"(src/manifest.ts 107~110행, ADR-060). #725는 CLAUDE.md "스택" 상주 문구를 요청하므로 이 결정과 같은 축을 건드린다(판정은 하지 않음).
- 배포 템플릿 `templates/CLAUDE.md`에는 현재 스택·트랙별 절이 없다(grep `stack|스택|track` 0건) — #725가 말한 "CLAUDE.md 프로젝트 스택들"에 대응하는 자리가 현행 배포판에 없다는 사실만 기록.

## 우리 기존 shadcn 스킬과의 관계

| | 공식 `shadcn` skill (이미 설치) | `@shadcn/lint` (#717 대상) |
|---|---|---|
| 형태 | 에이전트 스킬(SKILL.md) | npm devDependency + ESLint/Oxlint 설정 |
| 설치 위치 | 에이전트 설정 디렉터리 | **설치자 프로젝트의 package.json · lint 설정** |
| 하는 일 | 컴포넌트 추가·구성법, Critical Rules(프로즈) | 같은 류의 규칙을 **결정론적으로 검사**하고 고칠 방법을 오류로 제시 |
| 적용 조건 | components.json 있는 프로젝트 | Tailwind v4 프로젝트(shadcn/ui 불필요) |
| lint 언급 | 0건 | — |

- 관계 요약: skill의 "Critical Rules"(프로즈)를 기계 검사로 바꾼 것이 `@shadcn/lint`에 가깝다. 벤더 evals의 "rules only" 대조군이 정확히 "규칙 텍스트만 주는" 상태 = 지금 우리 설치자의 상태다.
- 공식 저장소에 `@shadcn/lint`용 SKILL.md는 없다(lint 저장소 트리 536개 경로 중 `SKILL.md` 0, 같은 탐색에서 `SETUP.md` 1 잡힘). 따라서 #717의 "스킬 설치 등록"을 문자 그대로 하려면 **설치할 공식 스킬이 없다** — 공식 대체물은 SETUP.md(에이전트 설치 지시문)와 AGENTS.md 한 줄이다.
- 우리 하네스 원칙과의 접점(사실만): `@shadcn/lint` 설치는 설치자 `package.json`·lint 설정 = "설치자 파일"을 바꾸는 일이라, 하네스가 직접 깔면 CLAUDE.md §설치자 디스크 원칙(설치자 파일은 건드리지 않는다)과 충돌한다. 에이전트가 프로젝트에서 실행하도록 *지시*하는 형태(스킬·룰 문구)는 이 충돌이 없다.

## Research Ledger — 9 confirmed · 5 killed

Confirmed
1. `@shadcn/lint`는 shadcn-ui 공식 조직 저장소·npm 패키지다(MIT, 0.2.1, 2026-10-10).
2. ESLint(9.30+)·Oxlint(1.80+) 플러그인, React·Vue·Svelte, Tailwind v4 전제, shadcn/ui 불필요.
3. 규칙 6종과 "대안을 알려주는" 오류 문구.
4. 공식 SETUP.md는 규칙을 켜지 않고 설치만 하며, AGENTS.md에 `npm run lint` 지시 한 줄을 권장한다.
5. 벤더 evals: 150+ 런에서 위반 0 수렴, 규칙 텍스트 대비 비용 10~48% 절감(벤더 측정).
6. 공식 shadcn skill은 lint를 지시하지 않는다(대조군 포함 0건; mcp.md의 체크리스트 설명 1줄만).
7. shadcn MCP 서버 실재, lint 관련은 `get_audit_checklist`(체크리스트)뿐.
8. shadcn/ui init은 Tailwind 미감지 시 실패한다(preflight-init.ts).
9. Next.js 16에서 `next lint` 제거·`next build` 린트 미실행.

Killed
1. "shadcn CLI의 `lint`/`check`/`audit` 서브명령" — 소스·배포물·rc 모두 없음(양성 대조군 14종 확인).
2. "공식 shadcn skill이 lint를 이미 지시" — 0건.
3. "`@shadcn/lint`용 공식 skill 존재" — lint 저장소에 SKILL.md 0.
4. "shadcn MCP가 lint를 실행" — 체크리스트 반환뿐.
5. 커뮤니티 도구(lintcn·compadcn·oxlint-tailwindcss)가 "shadcn lint"의 정체 — 공식 조직 패키지가 같은 이름으로 실재하고 다운로드 규모가 수 자릿수 크다.

## Caveats

- evals 수치는 전부 벤더 자체 측정이며 독립 재현이 없다. 픽스처는 소형 shadcn 프로젝트.
- 공식 발표·블로그 원문을 찾지 못했다(웹 검색 1회 standard, 결과 없음; ui.shadcn.com changelog 목록 최신이 2026-09-cn으로 lint 항목 없음). 공식성 판단 근거는 **조직 소유 저장소 + npm repository 필드 일치**다. ui.shadcn.com 문서에 아직 편입되지 않은 상태로 보인다(GitHub code search 인덱스 지연 가능성은 남음).
- 다운로드 155만/주는 출시 4주 차 수치로, CI·미러 재다운로드를 포함한 원시 값이다.
- Tailwind v3 미지원은 "README에 v4만 적혀 있다"는 사실에서 나온 것이고, v3에서 실제로 실패하는지는 실행해 보지 않았다(패키지 설치 금지 범위).
- shadcn-ui/ui #11598(css variable contract checker)의 머지 여부는 확인하지 않았다 — 현재 CLI 명령 목록에 없다는 것만 확인.
- 사용자가 "shadcn lint"로 `@shadcn/lint`가 아닌 다른 것(예: skill의 Critical Rules 준수, MCP audit checklist)을 의도했을 가능성은 이슈 본문만으로 배제할 수 없다. 다만 이슈 작성 시점(10/05·10/08)이 `@shadcn/lint` 0.2.0 출시(9/22) 직후라는 시간 정합은 있다.
