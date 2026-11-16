# #979 디자인 시스템 스킬 — 기획

> 이슈 #979 · 작성 2026-11-16 · 기획 레인 산출물(구현 없음). 외부 사실은 전부 2026-11-16 에 출처에서 다시 확인했고,
> 확인하지 못한 것은 §6 에 따로 적었다. **2판(2026-11-16)** — 설계 검증 1회차가 BLOCK 3건을 냈고, 이 판은 그 세 곳
> (실행 수단과 순서 → §4.0 · 출하를 가르는 기준 → AC4 · AC11 · 쇼케이스와 린트의 충돌 → AC5)과 한 문장으로 닫히는 지적만 고쳤다. 2회차 검증은 아직 받지 않았다.

## 결정 (2026-11-16) — 스킬도 UI 룰 한 줄도 내지 않는다

| 단계 | 한 일 | 결과 |
|---|---|---|
| 증분 0 (Kimi A/B) | 서비스 4종(SaaS · 습관 앱 · 패션몰 · 자산관리) × 스킬 없음/있음, Kimi CLI K2.8 · 1회씩. 스킬은 4/4 스스로 발동했다. 블라인드 비교 | 사전 기준(4종 중 3종 이상에서 스킬 쪽이 통일성 · 심미성 · 방향성 모두 앞섬) **미달**. 스킬 쪽은 값 정리만 됐다(글자색 종류 24 → 13, 글자 크기 종류 18 → 9 등) — 사용자: "컬러감이 좀 정돈되는 정도". 심미성은 대부분 스킬 없는 쪽 |
| 후속: UI 룰 한 줄 | "테마를 먼저 정하고 그 값만 쓴다" 한 줄을 배포 htmx UI 룰에 넣을지 쟀다(사용자 제안 · 동의). 1차 시험(Kimi · zcode)은 내용을 통제하지 않았고 대조 쪽에 기존 룰이 없어 판정에 쓰지 않았다. 재설계 = 내용 고정 HTML 뼈대 · 대조 = 지금 나가는 룰 · 두 세션(대시보드+이슈 → 설정) · Kimi · zcode(GLM) · agy(Opus) × 2회. agy 는 사용량 소진으로 대조 1회의 둘째 세션을 못 끝내 사전에 정한 축소판(zcode · Kimi 4쌍)으로 판정했다 | **넣지 않는다** — 사전 기준 H(블라인드 통일성 이긴 수 − 진 수 ≥ 4) 미달: 1승 1패 2무 = 0. agy 2쌍이 더해져도 최대 2라 결론이 같다. 계산값으로는 줄었다(역할별 모양 개수 M2: zcode 21·14 → 13·10, Kimi 13·15 → 15·10 · 교차 8비교 6승 1무 1패) — **값은 정리되지만 사용자 눈에 통일성 차이로 보이지 않는다**. 해는 없었다(G: 심미 2승 2패 · 서비스 방향 0승 1패 · 화면 깨짐/요청 위반 룰 쪽 0 · 대조 쪽 1 — 처음 2로 셌으나 하나는 채점기 오판: 문장 속 이슈 번호를 감싼 것을 새 문구로 셌다)). **추가 탐색 — 순수 Tailwind(daisyUI 없음, 설치자가 기존 체계를 유지한 경우)**: zcode 1회 × 2팔. 룰 없는 쪽도 첫 세션에 `@theme` 에 색 역할을 스스로 정의했다. 블라인드 판정은 셋 다 비슷(사용자: "통일성은 둘 다 아쉽다" — 설정 화면의 폭 들쭉날쭉이 눈에 띄었다). 계산값은 룰 쪽이 값 종류 39 → 29 · 역할별 모양 14 → 11 로 적었지만 화면에 박힌 원색 · 임의 값은 0 → 6 으로 오히려 많았다. 테마 체계가 없는 스택에서도 이 한 줄이 보태는 것이 보이지 않아 넣지 않는다 |
| 참조 디자인 시스템 안내 | 룰에 넣지 않고 문서로(측정하려면 서비스 종류 둘이 더 필요해 이번 범위에서 뺐다) | — |

남기는 것: 참조 6종 실측(§1.5) · 컨셉별 출발값 표(§4.4) · 유사 서비스 실측(`979-benchmark.md`). 스킬 초안(`service-design-system`)은
배선하지 않고 브랜치와 함께 닫는다 — 다시 꺼낼 때는 커밋 50bf6b9.

부수 관측: daisyUI CDN 단일 HTML 에서 `@plugin` 을 `text/tailwindcss` 안에 쓰면 스타일이 통째로 빠진다 — 스킬 없는 Kimi 실행 6회 중 2회
(zcode 8회 중 0회). 실제 Tailwind 빌드에서는 정상 문법이라 CDN 전용 함정이다.

## 0. 한눈에

**설치자에게 달라지는 것.** 지금은 "디자인 시스템 만들어줘"라고 하면 에이전트가 그때그때 색·크기를 고른다. 같은 요청이라도
업무용 SaaS 와 소비자 앱이 비슷한 간격·글자 크기로 나오고, 화면이 늘수록 값이 흩어진다. 이 스킬을 고른 설치자는
① 서비스 종류(SaaS · B2C · 커머스)에 맞는 출발값에서 시작해 ② 참조 디자인 시스템과 유사 서비스 실측으로 고친 값을
`DESIGN.md` 한 파일로 받고 ③ 그 값이 shadcn/ui(React) 또는 daisyUI(그 밖)의 테마에 들어가고 ④ 앱 안 `/design-system`
페이지에서 눈으로 확인하며 ⑤ 린트가 켜져서 이후 화면이 그 토큰·컴포넌트 밖으로 나가면 빨간불이 된다.
만들던 중간에 불러도 기존 값을 먼저 모아 `DESIGN.md` 로 수렴시킨 뒤 화면 단위로 정리한다.

**추천.** 번들 스킬 **하나**(`service-design-system`)를 만들되 얇게 만든다. 이 스킬이 직접 하는 일은
"컨셉 → `DESIGN.md`"와 "daisyUI 적용·쇼케이스", "중간 정리"이고, **shadcn 적용과 쇼케이스 페이지는 이미 React 트랙
기본으로 깔리는 shadcn 공식 스킬에 넘긴다**(그 스킬에 2026-10-09 부터 `DESIGN.md` → 테마 → 디자인 시스템 페이지
절차가 들어 있다 — §1.2 F8). 룰·훅은 건드리지 않는다. 첫 출하는 선택 설치(opt-in)로 한다.

**순서.** 카탈로그에 배선하기 전에 **증분 0(대조 실험)**부터 한다 — 스킬 초안을 깐 쪽과 shadcn 공식 스킬만 있는 쪽을 같은 과제로
돌려, 차이가 없으면 스킬을 내지 않는다(§4.0). 통과해야 증분 1(배선 · 테스트 · 문서)로 간다.

**이슈가 든 것 중 첫 증분에 못 들어가는 것.** 출발값은 이슈가 든 참조 여섯(Carbon · Polaris · Material 3 · Apple HIG · SLDS 2 · Astryx)과
유사 서비스 10곳의 실측에서 온다(§1.5 · §4.4). 커머스 구매자 화면은 공개 토큰 출처가 없어 실측(국내 2 · 해외 2)이 받치고, 섹션 간격 · B2C 읽기 폭 ·
장바구니 · 결제 화면은 여전히 가정이다. 실행 검증은 Claude Code 에서만 하고
나머지 세 CLI 는 설치 안착까지만 확인한다(§3.3).

---

## 1. 현재 사실

### 1.1 하네스가 UI 쪽에 이미 내보내는 것

| # | 사실 | 위치 |
|---|---|---|
| H1 | React 트랙(`csr-*` · `ssr-nextjs` · `full`)에 룰 `ui-components` 가 간다. 내용: UI 는 shadcn/ui 로, 검사는 `@shadcn/lint` 로, 없으면 첫 UI 작업 때 설치, 켤 규칙은 사용자 확인. `.tsx`/`.jsx` 를 만질 때만 로드 | `templates/rules/ui-components.md:1-13` · `src/manifest.ts:111-112` |
| H2 | htmx 트랙 셋에 각각 룰이 간다. 화면은 Tailwind v4 + daisyUI, 린트는 Jinja = ast-grep(원색·임의값·인라인 style 규칙 포함), 서버 JSX = `@shadcn/lint` | `templates/rules/htmx-fastapi-ui.md` · `htmx-fastify-ui.md` · `htmx-hono-ui.md` · `src/manifest.ts:125-128` |
| H3 | 즉 이슈 첫 문단("shadcn + shadcn lint 기본, 못 쓰는 스택은 daisyUI")은 **룰 수준에서는 이미 출하돼 있다**. 빠진 것은 React 도 htmx 도 아닌 스택(트랙이 없다)뿐이다 | H1 · H2 |
| H4 | 외부 스킬 `shadcn-ui`(shadcn 공식, `shadcn/ui :: shadcn`)가 React 트랙에 **기본 체크**다. 4 CLI 전부에 `npx skills add --agent` 로 간다 | `src/external-assets.ts:1001-1009` · `docs/COMPATIBILITY.md:115` |
| H5 | 외부 스킬 `frontend-design`(Anthropic 공식)이 UI 트랙(`csr-*` · `ssr-*` · `full`) 기본이다. 카탈로그 문구가 "기존 디자인 시스템을 덮어쓰게 두지 말라"를 보완한다 — 본문에는 그 지시가 없다 | `src/external-assets.ts:691-698` · `docs/research/design-skills-2026-11.md` 결과 9 |
| H6 | 선택 설치로 `impeccable`(자체 `PRODUCT.md`/`DESIGN.md` · 네이티브 엔진 다운로드 · 끌 수 없는 외부 호출) · `taste-skill` · `jakubkrehel-skills` · `web-design-guidelines` · `preline` 이 있다 | `src/external-assets.ts:704-747, 772, 1014` · ADR-114 |
| H7 | 번들 스킬 `ui-visual-review` 가 React 트랙 기본이다(스크린샷 캡처 · baseline 비교 · 브라우저 띄우는 규칙). `docs/visual-pages.json` 에 적힌 화면을 찍는다 | `templates/skills/ui-visual-review/SKILL.md` · `src/external-assets.ts:252-263` |
| H8 | UI 트랙에는 `chrome-devtools` MCP 가 기본이다(브라우저에서 계산된 스타일을 읽을 수 있다) | `docs/TRACKS.md` "MCP servers" 행 |
| H9 | `DESIGN.md` 를 읽으라던 룰 `design-workflow` 는 2026-08-02 에 은퇴했다(모델 발전 전제의 감량) | `src/manifest.ts:253` · 커밋 `5d0bfdc`(ADR-060) |
| H10 | 번들 스킬은 폴더째 두 자리에 간다: `.claude/skills/<id>/`(Claude Code) · `.agents/skills/<id>/`(Codex · OpenCode · Antigravity 공용) | `docs/TRACKS.md:45` · ADR-086 |
| H11 | 가장 최근 번들 스킬(`benchmark-checklist`, #971)은 "설치자 쪽 관측이 아직 없다"는 이유로 opt-in 으로 들어왔다. 건드린 파일: `src/external-assets.ts`(key 유니언 · 카탈로그 항목 · `INTERNAL_BUNDLED_SKILL_IDS`) · `context-cost-baseline.json`(`skillDescriptors`) · `tests/installer-track-matrix.test.ts` · 안착 테스트 1개 · `docs/TRACKS.md` · `docs/COMPATIBILITY.md` · 카탈로그 총계를 적은 문서 2개 | 커밋 `c8bf7b1` |
| H12 | 기본 설치 항목을 바꾸는 것은 SPEC Non-Goals("기본 설치 항목 재정의") 경계를 건드리는 Major CR 이고, 전례는 전부 사용자 결정으로 처리됐다 | `docs/SPEC.md:44, 71-73` |
| H13 | 상주 지시는 "그것 없이보다 빠르고 안정적"이라는 관측이 있어야 남는다. 룰 프로즈가 행동을 바꿨다는 긍정 관측은 44문장 중 0건이었다 | `docs/NORTH_STAR.md` §1 · ADR-090 |
| H14 | **디자인 시스템을 만드는 번들 스킬은 없다.** `templates/skills/` 19종 중 UI 관련은 `ui-visual-review` 하나다. `src` · `templates` 전체에서 `design system` · `design-system` · `디자인 시스템`(대소문자 무시)은 한 줄(H5 의 카탈로그 문구, `src/external-assets.ts:694`), `DESIGN.md` 도 한 줄(H6 의 `impeccable` 문구, `:742`)에만 나온다 — 같은 grep 이 이 두 줄을 잡으므로 탐지기는 동작한다 | `ls templates/skills/` · `grep -rn -i -E 'design system\|design-system\|디자인 시스템' src templates` · `grep -rn 'DESIGN\.md' src templates` |
| H15 | **이 저장소의 컨테이너 게이트는 모델을 부르는 실행을 못 한다.** 실 CLI 이미지에서 `claude` 와 `skills` 는 모의 스크립트이고(모의 `claude` 는 `plugin` 하위 명령만 받는다), 이미지가 스스로 "C 실행: … auth-gated → 범위 외"라고 적는다. 브라우저도 없다 | `test/docker/Dockerfile.realcli:9-11, 22-25` · `test/docker/mocks/claude:9-12` |
| H16 | 실 Claude Code 를 컨테이너에서 사람 없이 돌려 하네스 유무를 비교하는 수단은 저장소 밖에 있다 — 메인테이너의 비공개 A/B 평가 실행기(#513). 팔은 A(하네스 없음) · B(하네스 설치) · C(후보 변경), 모델은 GLM 계열, **에이전트 단계에는 인터넷이 없다**(모델 API 호스트 하나만 통과 · 팔 준비와 채점은 일반망), 시행마다 토큰 · 시간을 남기고 채점은 결정적이다. 과제 본문 · 채점기 · 결과 원본은 공개 저장소에 두지 않는다. 품질 판정용 상위 모델은 지금 쓸 수 없다 | #513 작업 브랜치의 측정 프레임워크 설계 초안(2026-11-09) §2 · §3 · §5 · 조정 레인 전달(2026-11-16) |
| H17 | Antigravity 는 하네스의 `chrome-devtools` MCP 를 받지 않는다(도달 = claude + codex + opencode) | `docs/COMPATIBILITY.md:169` |
| H18 | 위저드 3단계에서 `frontend` 범주가 속한 묶음의 이름은 "Dev Core (Frontend · Backend · Data)"다 | `src/prompts.ts:211` |

### 1.2 shadcn 쪽이 지금 실제로 주는 것

| # | 사실 | 출처 |
|---|---|---|
| F1 | CLI `shadcn` 최신 4.23.0. 명령: `init`(별칭 `create`) · `add` · `apply` · `preset decode/resolve/url/open` · `view` · `search` · `build` · `docs` · `info` · `migrate` · `eject`. **`lint` 명령은 없다** | `npm view shadcn version` · https://ui.shadcn.com/docs/cli |
| F2 | `init` 에 `-p, --preset [name]` · `-b, --base <base>`(base · radix · aria) · `-t, --template`(next · vite · start · react-router · laravel · astro)가 있다. `--defaults` 는 `--template=next --preset=nova` 다 | https://ui.shadcn.com/docs/cli |
| F3 | `apply --preset <code>` 는 기존 프로젝트에 프리셋을 적용하고, `--only theme` · `--only font` · `--only theme,font` 로 테마·서체만 바꿀 수 있다(컴포넌트는 그대로) | https://ui.shadcn.com/docs/changelog/2026-04-partial-preset-apply |
| F4 | 프리셋 코드는 style · baseColor · theme · chartColor · iconLibrary · font · fontHeading · radius · menuAccent · menuColor 를 담는다 | https://ui.shadcn.com/docs/changelog/2026-04-preset-commands |
| F5 | 스타일(= CSS 변수로 못 바꾸는 지오메트리: 컨트롤 패딩 · 밀도 · 둥글기)이 8종이다. 2025-12 출시 때 5종(vega · nova · maia · lyra · mira)이었고 2026 년에 luma(3월) · sera(4월) · rhea(5월)가 더해졌다 — **출시 다섯 달 만에 5 → 8** | https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create · https://ui.shadcn.com/docs/changelog · 스킬 `design-system.md` "Picking a style" |
| F6 | 레지스트리 항목 타입 `registry:base`("a complete design system base") · `registry:theme` · `registry:style` 로 자기 디자인 시스템을 배포할 수 있다. `shadcn build` 가 `registry.json` 을 `public/r` 로 굽는다. 2026-06 부터 GitHub 저장소를 레지스트리로 쓸 수 있다 | https://ui.shadcn.com/docs/registry/examples · https://ui.shadcn.com/docs/cli · https://ui.shadcn.com/docs/changelog |
| F7 | `@shadcn/lint` 0.2.5(npm 수정 2026-11-02 · MIT · ★3,364). "An agent-first linter for Tailwind design systems". 요구: Tailwind v4 · Node 20.19+ · ESLint 9.30+ 또는 Oxlint 1.80+ · React · Svelte · Vue. shadcn/ui 는 필수가 아니다. 규칙 6개: `no-restyle` · `no-raw-colors` · `no-arbitrary-values` · `no-inline-styles` · `no-unknown-classes` · `require-static-classes`. shadcn 프로젝트는 `components.json` 으로 컴포넌트·테마를 자동으로 찾는다 | `npm view @shadcn/lint` · `gh api repos/shadcn-ui/lint` · https://github.com/shadcn-ui/lint |
| F8 | **shadcn 공식 스킬에 `DESIGN.md` 워크플로가 있다**(2026-10-09 커밋 `2d3f1cd`, #12252). `design-system.md`(386줄): 프리셋/스타일 선택 → 전 컴포넌트 설치 → `DESIGN.md` 읽기 → 토큰을 테마에 매핑(색 역할 · 반경 · 그림자 · 서체 · **자간을 포함한 타입 스케일을 `type-*` 유틸로** · 컨트롤 높이) → 컴포넌트 variant 매핑 → 디자인 시스템 페이지 → 검증. `design-system-page.md`(268줄): 페이지 구성(색 역할 대비쌍 · 타이포 표본표 · 간격 · 반경 · 엘리베이션 · 변형×상태 행렬). `scripts/showcase-coverage.mjs` 가 쇼케이스에 빠진 컴포넌트를 낸다 | `gh api repos/shadcn-ui/ui/commits?path=skills/shadcn/design-system.md` · https://github.com/shadcn-ui/ui/tree/main/skills/shadcn |
| F9 | 그 워크플로의 입력표에서 **`DESIGN.md` 는 Required** 다. 누가 어떻게 쓰는지는 다루지 않는다. 첫 줄이 "Build a new app from a preset"이고 Step 1 이 새 앱 scaffold 다 — 만들던 프로젝트를 정리하는 경로는 없다 | 같은 파일 3행 · 26행 · 35-47행 |
| F10 | 그 스킬의 description 이 "building a design system or applying a DESIGN.md or brand spec to shadcn/ui"에 발화한다고 적는다 | 같은 저장소 `skills/shadcn/SKILL.md` frontmatter |
| F11 | 2026-07 에 `shadcn/typeset`(본문·마크다운용 타이포 CSS 한 파일. `--typeset-size` · `--typeset-leading` · `--typeset-flow`)이 나왔다. 자간 변수는 없다 | https://ui.shadcn.com/docs/changelog/2026-07-typeset |
| F12 | 상류 쇼케이스 도우미 `assets/showcase/color-pair.tsx:100-103` 이 인라인 `style={{ backgroundColor, color }}` 를 쓴다. `@shadcn/lint` 의 `no-inline-styles` 는 이런 일반 인라인 속성을 보고한다(CSS 사용자 속성만 허용). 상류 스킬 네 파일(`SKILL.md` · `design-system.md` · `design-system-page.md` · `cli.md`)에 `lint` 라는 낱말은 0건이다(같은 grep 이 `preset` 은 각각 32 · 9 · 0 · 22건 잡는다) — **상류 워크플로는 이 린터를 전제로 쓰이지 않았다** | 상류 사본 직접 확인(2026-11-16) · `shadcn-ui/lint` `docs/rules/no-inline-styles.md`(검증 레인 확인) |
| F13 | `showcase-coverage.mjs` 는 빠진 것이 없어도 `N/N components shown.` 한 줄을 내고 exit 0, 빠진 것이 있으면 `Missing: …` 과 exit 1 이다 | 상류 `scripts/showcase-coverage.mjs:45-52` |
| F14 | shadcn CLI 는 `--overwrite` 없이 이미 있는 파일을 건너뛴다(비대화형). 덮어쓰는 것은 프리셋 전환 `apply <code>` 다 — "Overwrites detected components, fonts, and CSS variables" | `shadcn-ui/ui` `packages/registry/src/updaters/update-files.ts:226-229` · 상류 `SKILL.md:191` |

### 1.3 daisyUI 쪽이 지금 실제로 주는 것

| # | 사실 | 출처 |
|---|---|---|
| D1 | daisyUI 5.8.1(MIT · ★42,849). Tailwind v4 의 CSS 플러그인이다 | `npm view daisyui version` · `gh api repos/saadeghi/daisyui` |
| D2 | 테마는 CSS 안의 `@plugin "daisyui/theme" { … }` 블록 하나다. 변수: 색 20개(`--color-base-100…300` · `-content` 쌍들) · `--radius-selector` · `--radius-field` · `--radius-box` · `--size-selector` · `--size-field` · `--border` · `--depth` · `--noise` | https://daisyui.com/docs/themes/ |
| D3 | 값의 허용 범위를 daisyUI 가 직접 적어 둔다: 반경 권장 0 · 0.25 · 0.5 · 1 · 2rem / `--size-field` 는 기본 0.25rem, 크게 0.28125 · 0.3125, 작게 0.21875 · 0.1875 / `--border` 는 1px(0.5 · 1.5 · 2) / `--depth` · `--noise` 는 0 또는 1 | https://daisyui.com/SKILL.md 의 테마 절 |
| D4 | **글자 크기·행간·자간·간격 토큰은 daisyUI 에 없다.** 그건 Tailwind v4 `@theme` 가 맡는다: 간격은 `--spacing` 한 변수(기본 0.25rem, 유틸은 `calc(var(--spacing) * N)`), 글자는 `--text-*`(+ `--text-*--line-height`), 자간 `--tracking-*`, 폭 `--container-*`, 반경 `--radius-*` | https://tailwindcss.com/docs/theme (namespace 표 · default theme) |
| D5 | 공식 스킬이 있다(`npx skills add saadeghi/daisyui`). 본문은 daisyUI 문서의 축약본으로 **2,317줄 · 79,993바이트**이고, description 이 "When you write HTML or JSX code, you must use it. Even if the user does not request it, use it."다 | https://daisyui.com/docs/skill/ · https://daisyui.com/SKILL.md (2026-11-16 내려받아 계측) |
| D6 | 공식 MCP(Blueprint)는 라이선스 키가 필요하다 | https://daisyui.com/blueprint/ (검색 요약으로만 확인) |
| D7 | 디자인 시스템 페이지를 만드는 절차나 도우미는 daisyUI 쪽에 없다(F8 에 해당하는 것이 없다) | D5 본문에서 `showcase` · `design system` 검색 — 미확인(§6 U3) |

### 1.4 `DESIGN.md` 와 보여 주는 자리

| # | 사실 | 출처 |
|---|---|---|
| S1 | `DESIGN.md` 는 Google Labs 가 낸 형식이다(`google-labs-code/design.md` · Apache-2.0 · ★28,888 · 버전 `alpha` — "Expect changes"). YAML 토큰(`colors` · `typography` · `rounded` · `spacing` · `components`)과 정해진 순서의 절(Overview · Colors · Typography · Layout · Elevation & Depth · Shapes · Components · Do's and Don'ts). 타이포 속성에 `letterSpacing` 이 있다. `primary` 색은 필수다. 형식이 모르는 절 제목은 "Preserve; do not error", 모르는 간격 값은 문자열로 받아들인다(예: `grid-columns: '5'`) — 레이아웃 값을 `spacing` 토큰과 Layout 절에 둘 수 있다 | https://github.com/google-labs-code/design.md · `gh api` · 같은 저장소 `docs/spec.md` 의 Colors 절 · "Consumer Behavior for Unknown Content" 표 |
| S2 | CLI `@google/design.md` 0.4.0: `lint`(구조 + WCAG 대비) · `diff` · `export --format css-tailwind`(Tailwind v4 `@theme`) / `json-tailwind` / `dtcg` · `spec` | 같은 README · `npm view @google/design.md` |
| S3 | 코드에서 `DESIGN.md` 를 뽑는 스킬이 있다: `google-labs-code/stitch-skills` 의 `extract-design-md`(365줄, "Stitch-compatible", ★9,328). 같은 저장소의 `design-md` 는 Stitch MCP 가 있어야 한다 | https://github.com/google-labs-code/stitch-skills |
| S4 | Anthropic `knowledge-work-plugins` 의 `design-system` 스킬은 audit · document · extend 세 모드로 **보고서와 문서**를 낸다. 코드베이스에 토큰을 쓰지 않는다 | https://github.com/anthropics/knowledge-work-plugins/tree/main/design/skills/design-system |
| S5 | Claude Design: Claude Code 의 `/design-sync` 가 "repo 의 **React** 디자인 시스템"을 변환해 올린다. 올리는 곳인 단독 사이트 claude.ai/design 은 **2026-12-14 까지 닫힌다**(Claude 본체로 이전 안내). Amazon Bedrock · Google Cloud · Microsoft Foundry 경유에서는 못 쓴다 | https://code.claude.com/docs/en/commands (`/design-sync` · `/design-login` 행) |
| S6 | Storybook 10.6.7(MIT · ★91,581). `npm create storybook@latest`. Node 20+ · Vite 5+. `--type` 에 `react` · `nextjs` · `html` · `server` 가 있다. Jinja · `hono/jsx` 지원은 문서에 없다 | https://storybook.js.org/docs/get-started/install · `npm view storybook version` |

### 1.5 참조 디자인 시스템에서 확인한 값

| 시스템 | 확인한 값 | 출처 |
|---|---|---|
| Carbon | 타입 세트가 둘로 갈린다. **productive**(기준 14px — "product pages, higher density of information housed inside containers") · **expressive**(기준 16px — web pages). `body-01` 14/20 자간 +0.16px · `body-compact-01` 14/18 +0.16px · `body-02` 16/24 자간 0 · `label-01` 12/16 +0.32px · `heading-compact-01` 14/18 600 · `heading-03` 20/28. 간격 2 · 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 160px | https://carbondesignsystem.com/elements/typography/type-sets/ · https://carbondesignsystem.com/elements/spacing/overview/ |
| Polaris | 4px 격자(`100` = 4px). 자간 토큰 normal 0 · dense −0.2px · denser −0.3px · densest −0.54px. 굵기 450 · 550 · 650 · 700. 카드 패딩 16px · 카드 간격 16px · 표 셀 패딩 6px · 버튼 묶음 간격 8px. 글자 조합: `body-md` 13/20 · `body-lg` 14/20 · `body-sm` 12/16(셋 다 자간 0) · `heading-md` 14/20 600 · `heading-lg` 20/24 600 dense · `heading-xl` 24/32 700 dense · `heading-2xl` 30/40 700 denser. 중단점 490 · 768 · 1040 · 1440px. 지금의 Polaris 는 Admin · Checkout · Customer accounts · POS 용 웹 컴포넌트다(스토어프런트 테마용이 아니다) | `Shopify/polaris` `polaris-tokens/src/themes/base/font.ts` · `text.ts` · `breakpoints.ts` · `space.ts` · `src/size.ts` · https://shopify.dev/docs/api/polaris |
| Material 3 | body large 16/24 · body medium 14/20 · body small 12/16 · label large 14/20 · label medium 12/16 · title medium 16/24 · headline small 24/32 · medium 28/36 · large 32/40 · display small 36/44. 자간은 Roboto 기준 양수(body large +0.5sp) | `androidx` `compose/material3/.../tokens/TypeScaleTokens.kt` |
| Apple HIG | 기본/최소 글자: iOS 17pt/11pt · macOS 13pt/10pt. iOS Large: Body 17/22 · Callout 16/21 · Subhead 15/20 · Footnote 13/18 · Title 3 20/25 · Title 1 28/34. SF Pro 자간: 17pt −0.43pt · 13pt −0.08pt · 12pt 0 · 11pt +0.06pt · 28pt +0.38pt. 컨트롤 기본/최소: iOS 44×44pt / 28×28pt · macOS 28×28 / 20×20. 컨트롤 사이 여백: 테두리 있는 요소 약 12pt, 없는 요소 약 24pt | https://developer.apple.com/design/human-interface-guidelines/typography · /accessibility (문서 JSON) |
| Android | 터치 대상 최소 48dp. 창 폭 등급: compact < 600dp · medium 600~840dp · expanded 840~1200dp · large 1200~1600dp | https://support.google.com/accessibility/android/answer/7101858 · https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes |
| 레이아웃(Carbon · HIG) | Carbon 2x 격자: 중단점 320 · 672 · 1056 · 1312 · 1584px, 열 4 · 8 · 16 · 16 · 16, 거터 32px. 고정 옆 패널은 "static width … exist outside of the responsive grid". HIG: iPhone 의 탭 바는 "at the bottom of the screen", 기본 탭은 "five or fewer" | https://carbondesignsystem.com/elements/2x-grid/overview/ · https://developer.apple.com/design/human-interface-guidelines/tab-bars (문서 JSON) |
| SLDS 2 | SLDS 2 의 기본 테마 **Cosmos** 의 전역 훅(`--slds-g-*`). 글자: 기본 13px(`font-scale-base`) · 기본 행간 1.5 · 스케일 10 · 12 · 14 · 16 · 20 · 24 · 28 · 32 · 40 · 48px(배율 1.15) · **자간 훅 없음**. 간격 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 · 56 · 64 · 72 · 80px, 밀도 두 단계(Comfy 기본 · Compact 는 대략 절반 — `spacing-var-4` 16 → 8). 반경 4 · 8 · 12 · 20px · 알약 — 버튼은 알약, 입력 8, 컨테이너 20. 입력 안쪽 여백 8 · 폼 라벨 13px 600 · 페이지 헤더 제목 28px 400 · 상단 헤더 50px · 탭 40px. 버튼 · 입력 높이 32px(라인 높이 30 + 테두리 2) · 터치 44px — 이 높이는 SLDS 1 · 2 공용 CSS 의 값이다(§6 U20) | npm `@salesforce-ux/design-tokens` 4.1.0 `dist/themes/cosmos/cosmos.global.tokens.css` · `cosmos.shared.tokens.css` · npm `@salesforce-ux/design-system` 2.264.3 `css/buttons/base/index.css:510` · `css/input/base/index.css:252-253` · `css/buttons/base/touch.css:241` · Cosmos = SLDS 2 기본 테마: https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-slds1-slds2.html . 이슈의 링크는 헤드리스 Chromium 으로 열면 200 이지만 본문이 그려지지 않는다(제목 · 내비만) |
| Astryx | Meta 의 오픈소스 디자인 시스템(MIT · ★28,961 · 베타 · React 19 + StyleX · 테마 = CSS 변수 덮어쓰기). 기본값: 글자 기준 14px · 배율 1.2 → 10 · 12 · 14 · 17 · 20 · 24 · 29 · 35 · 42px. 본문 14/20 · 보조 12/20 · 제목 h1 24/32 · h2 20/28 · h3 17/24 · h4 14/20(제목은 600). **자간 토큰 없음**. 간격 4px 배수(rem, 0.5 단 포함) 0~48px. 컨트롤 높이 sm 28 · md 32 · lg 36. 반경 inner 4 · element 8 · container 12 · page 28 · full. 테마 7종은 색 · 서체가 중심이지만 스케일을 바꾸는 테마도 있다 — Butter · Y2K 는 컨트롤 32 · 40 · 48, Y2K 는 간격 ×1.5, Neutral 은 "거친 포인터 + lg 미만 폭"에서 본문 14 → 16px. **SaaS 열의 참조**(기본값이 Carbon productive 와 같은 14/20 · 32px 밀도)이고, 터치 화면에서 본문을 16 으로 올리는 규칙은 B2C 열의 근거다 | `meta/astryx` `packages/core/src/theme/tokens.stylex.ts:186-265, 347-476` · `packages/themes/README.md` · `packages/themes/neutral/src/neutralTheme.ts:49-79, 227-236` · `packages/themes/butter/src/butterTheme.ts:262-269` · `packages/themes/y2k/src/y2kTheme.ts:127-151`(`gh api`, 2026-11-16) |
| 유사 서비스 실측 | SaaS(GitHub · GitLab · Hugging Face) · B2C(Airbnb · Spotify · 당근) · 커머스 구매자 화면(무신사 · 29CM · Nike · Allbirds)을 375 · 1440px 에서 쟀다. 값과 가운데 값은 §4.4, 서비스 × 닻 × 폭 원본은 근거 파일 | [`979-benchmark.md`](979-benchmark.md) |

**여기서 나온 판단 두 가지.**

- **자간은 서체에 딸린 값이다.** 본문 크기에서 Carbon(IBM Plex)과 M3(Roboto)는 양수, SF Pro 는 음수, Polaris 는 0 이다.
  부호부터 다르다. 그래서 프리셋이 자간 숫자를 고정해 주면 틀린다 — 서체를 먼저 정하고, 그 서체 공급자의 값이나 실측으로 정해야 한다.
  SLDS 2 와 Astryx 는 자간 토큰이 아예 없고, 실측한 열 곳의 본문 자간도 전부 `normal` 이었다 — 0 이 아닌 값은 제목 · 가격 같은 강조에만 있었다(`979-benchmark.md` §4).
- **컨셉에 따라 실제로 갈리는 축이 출처에 드러난다.** 업무용은 14px 본문 · 좁은 행간 · 32px 안팎 컨트롤(Carbon productive ·
  shadcn nova/mira), 소비자용은 16~17px 본문 · 44~48px 터치 대상 · 넉넉한 여백(HIG · M3 · shadcn maia)이다. 이슈가 말한
  "미세하게 바뀌어야 한다"는 요구는 근거가 있는 요구다. 유사 서비스 실측도 같은 쪽으로 갈렸다 — SaaS 본문 14 · 주 버튼 32 · 옆 패널 3/3,
  B2C 본문 16 · 주 버튼 48 · 알약형 버튼 3/3(§4.4).

---

## 2. 대안 비교

| 안 | 내용 | 틀린 선택일 때 생기는 일 |
|---|---|---|
| **A. 새로 만들지 않고 기존 외부 스킬로 보낸다** | shadcn 공식 스킬(F8)이 이미 기본이니 문서에 안내만 더한다. 필요하면 `extract-design-md`(S3)를 카탈로그에 넣는다 | ① `DESIGN.md` 가 Required 인데 쓰는 절차가 없다(F9) — 컨셉별 차이가 모델 재량에 남아 이슈의 핵심 요구(SaaS/B2C/커머스로 값이 갈린다)가 재현되지 않는다. ② htmx 세 트랙은 테마 매핑도 쇼케이스도 없다(D7). ③ 만들던 프로젝트 정리 경로가 없다(F9 — 새 앱 scaffold 로 시작). ④ `extract-design-md` 는 Stitch 호환을 목표로 쓰였고 하네스 설치 경로로 깔리는지 확인하지 못했다(§6 U5) |
| **B. 번들 스킬 하나 + 참조 파일, shadcn 적용은 공식 스킬에 넘긴다** *(추천)* | 스킬이 컨셉 판별 → 출발값 → 보정 → `DESIGN.md` → 스택별 적용 → 쇼케이스 → 린트 고정을 지휘한다. shadcn 적용 · 쇼케이스는 F8 에, daisyUI 는 자체 참조 파일에 | ① 상류가 `design-system.md` 를 바꾸거나 빼면 넘기는 고리가 끊긴다 → React 적용은 shadcn 공식 스킬을 전제로 한다. 없거나 그 파일이 없는 옛 판이면 `DESIGN.md` 까지만 만들고 추가 · 갱신 명령 한 줄을 알린 뒤 멈춘다(자체 매핑 분기는 두지 않는다 — 기준도 검증도 없는 경우를 하나 더 만들 뿐이다). 이 스킬은 모든 트랙에서 고를 수 있고 shadcn 공식 스킬은 React 트랙 기본일 뿐이라(H4) 이 멈춤은 실제로 생긴다. ② 프리셋 표가 낡는다(F5 — 스타일이 다섯 달에 3종 늘었다) → 우리 표는 **컨트롤 높이 · 반경 · 밀도까지만** 적고 스타일 이름은 상류의 "Picking a style" 표를 따르게 한다. ③ 작은 UI 수정에 발화해 "디자인 시스템부터"로 끌고 갈 수 있다 → description 의 Do-NOT + 첫 출하를 opt-in 으로 해 관측한다. ④ 스킬 본문 유지비가 생긴다(외부 사양 4개: shadcn · daisyUI · Tailwind · `DESIGN.md`) → 본문에 사양을 복사하지 않고 명령(`npx @google/design.md spec` · `shadcn info --json`)과 상류 파일을 가리킨다 |
| **C. 템플릿 + 레지스트리** | 컨셉별 완성 테마를 배포한다 — shadcn `registry:base`/`registry:theme` JSON(F6)과 daisyUI 테마 CSS. 설치자는 `npx shadcn add <url>` 한 줄 | ① 색과 서체는 브랜드마다 달라 완성 테마는 받자마자 덮어쓴다. 남는 가치는 밀도 · 타입 스케일 숫자인데 그건 표 한 장으로 족하다. ② 레지스트리를 공개 URL 이나 GitHub 레지스트리로 운영해야 하고 상류 스키마 변경(F5 · F6)을 따라가야 한다. ③ 하네스 설치기가 테마를 직접 써 주면 설치자 앱 소스(CSS)에 손대게 된다 — 기록 · 백업 · uninstall 경로가 새로 생긴다(루트 `CLAUDE.md` 설치자 디스크 원칙의 "설치자 파일"). ④ 만들던 프로젝트 정리에는 쓸모가 없다 — 기존 코드를 모으는 일은 템플릿이 못 한다. ⑤ 유사 서비스 실측으로 값을 고친다는 요구와 맞지 않는다(값이 고정이다) |
| **D. 컨셉별 스킬 셋**(`…-saas` · `…-b2c` · `…-commerce`) | B 를 컨셉마다 쪼갠다 | 발화 표면이 3배가 되고 트리거가 겹친다("디자인 시스템 만들어줘"에 셋이 다 맞는다). 혼합형(B2C + 커머스, 판매자 어드민이 딸린 커머스)을 못 다룬다. 컨셉은 발화 조건이 아니라 입력값이다 → 스킬 하나 + 프리셋 참조 파일이 맞다 |
| **E. 룰로 넣는다**(`ui-components` 에 "`DESIGN.md` 를 따른다" 등) | 매 UI 편집에 지시가 실린다 | 같은 뜻의 룰(`design-workflow`)을 이미 은퇴시켰다(H9). 룰 프로즈가 행동을 바꿨다는 관측이 없고(H13), OpenCode 가 섞인 설치는 룰이 `AGENTS.md` 에 인라인돼 매 세션 실린다(루트 `CLAUDE.md` 함정 3). 벗어남을 막는 일은 린트(F7 · H2)가 결정론적으로 한다 |

**daisyUI 공식 스킬(D5)을 카탈로그에 넣는 안은 따로 기각한다.** 80KB 본문이 "HTML 이나 JSX 를 쓸 때는 요청이 없어도
반드시"라는 문구로 발화하므로, React + shadcn 프로젝트에서도 열린다. htmx 룰이 이미 설치 문서를 가리키고 있어(H2)
이 스킬 없이도 htmx 트랙은 돈다.

---

## 3. 추천

### 3.1 무엇을 만드나

번들 스킬 `service-design-system` 하나. 일의 경계는 이렇다.

| 단계 | 누가 | 근거 |
|---|---|---|
| 서비스 컨셉 판별 → 출발값 → 참조·실측 보정 → `DESIGN.md` 작성 | **이 스킬** | 어디에도 없다(F9 · S4) |
| `DESIGN.md` → shadcn 테마 · variant · 디자인 시스템 페이지 | **shadcn 공식 스킬**(F8) | 이미 React 트랙 기본(H4). 복사하면 상류와 갈라진다 |
| `DESIGN.md` → daisyUI 테마 + Tailwind `@theme` + 디자인 시스템 페이지 | **이 스킬의 참조 파일** | daisyUI 쪽에 없다(D4 · D7) |
| 만들던 프로젝트: 기존 값 수집 → `DESIGN.md` 로 수렴 → 화면 단위 정리 | **이 스킬의 참조 파일** | 상류 워크플로는 새 앱 전용(F9) |
| 이후 화면이 시스템 밖으로 못 나가게 | **린트**(`@shadcn/lint` · ast-grep) + 프로젝트 지시 파일 한 줄 | H1 · H2 · F7. 룰은 더하지 않는다(대안 E) |
| 레이아웃(셸 구조 · 내비 위치 · 본문 폭)이 실제로 적용되는 자리 | `DESIGN.md` 의 Layout 절과 `spacing` 토큰에 적고(S1), 디자인 시스템 페이지의 **예시 화면 하나**를 그 셸로 그린다 | 상류 워크플로가 만드는 화면은 "one example screen" 뿐이다(상류 `design-system.md:338`). 앱 화면 전체의 셸을 갈아 끼우는 일은 이 스킬의 범위가 아니다 |
| 시각 회귀 | **`ui-visual-review`** — 쇼케이스 페이지를 `docs/visual-pages.json` 에 넣는다 | H7 |

이름을 `design-system` 으로 하지 않는 이유: skills.sh 에 같은 이름의 스킬이 여럿이고 Anthropic 플러그인에도 있어(S4),
설치자가 이미 그 이름의 폴더를 갖고 있을 가능성이 가장 높은 이름이다.

### 3.2 추천을 바꾸는 조건

| 조건 | 바뀌는 것 |
|---|---|
| 증분 0(§4.0)에서 **이 스킬 없이** shadcn 공식 스킬만 있는 팔이 판정 규칙의 "차이 없음" 조건을 채운다 | 스킬을 내지 않는다. 대안 A 로 가고 프리셋 표만 문서로 남긴다 |
| 설치자(오너)의 실제 프로젝트가 대부분 React 가 아니다 | daisyUI 분기를 먼저 깊게 만든다(쇼케이스 도우미 포함) |
| shadcn 이 `DESIGN.md` 워크플로를 빼거나 형식을 바꾼다 / `DESIGN.md` 형식(alpha)이 깨진다 | 기획을 다시 연다 — 넘기는 대신 자체 매핑을 갖는 쪽으로(지금 판은 그 분기를 두지 않는다). 형식은 shadcn 이 읽는 쪽을 따른다 |
| "같은 입력이면 매번 같은 토큰"이 요구된다 | 대안 C 의 일부(컨셉별 `registry:theme` 예시)를 참조 파일에 더한다 |
| opt-in 으로 낸 뒤 설치자 프로젝트에서 값을 했다는 관측이 생긴다 | UI 트랙 기본으로 올린다(오너 결정 — §5 D1) |

### 3.3 네 CLI 에 닿는 길 · 어느 트랙이 까나

| | Claude Code | Codex | OpenCode | Antigravity |
|---|---|---|---|---|
| 이 스킬(번들) | `.claude/skills/service-design-system/` | `.agents/skills/service-design-system/` | 같은 자리 | 같은 자리 |
| shadcn 공식 스킬(외부 · 이미 기본) | `npx skills add --agent` 로 네 CLI 전부 (H4) | ← | ← | ← |
| 셸 명령(`npx shadcn` · `npx @google/design.md` · lint) | 네 CLI 모두 셸이 있다 | ← | ← | ← |
| 유사 서비스 실측(브라우저) | `chrome-devtools` MCP — UI 트랙 기본(H8) | 같은 MCP 렌더를 받는다(ADR-101 결정 4) | ← | 받지 않는다(H17) — 다른 브라우저 도구가 없으면 실측을 건너뛴다 |
| 동작을 실행으로 확인하는 범위 | 증분 0 · V3(비공개 A/B 실행기 — H16) | 설치 안착(AC1)까지만. 동작은 **미검증**으로 보고한다 | ← | ← |

- **설치 조건(첫 출하): opt-in, 모든 트랙.** `--with service-design-system` 또는 위저드 3단계 "Dev Core (Frontend · Backend · Data)" 묶음에서 체크(H18).
  `benchmark-checklist`(H11)와 같은 배선이다. 설치기 코드는 새로 쓰지 않는다 — install · update · uninstall 이 기존 번들 스킬과 같은 경로를 탄다.
- **브라우저 도구가 없는 CLI 에서는** 실측 단계를 건너뛰고 보고에 "실측 없음 — 참조 문서값만 썼다"를 적는다. 값을 지어내지 않는다(ADR-121 과 같은 결정).

---

## 4. 범위 — 증분 0(대조 실험) 다음에 증분 1(배선)

### 4.0 증분 0 — 배선 전에, 스킬을 낼지 말지를 가르는 대조 실험

> **오너 결정(2026-11-16)으로 이 절의 GLM 대조 실험은 쓰지 않는다.** 대신 스킬 초안(SKILL.md + 참조 3개, 배선 없음)을 만든 뒤
> Kimi 로 4종(SaaS 프로젝트 관리 · B2C 습관 기록 앱 · 커머스 패션몰 · 프리셋 밖 개인 금융 앱) × 스킬 없음/있음 = 대화 8개를 돌린다.
> 산출물은 두 팔 모두 HTML 한 파일(Tailwind + daisyUI) + `DESIGN.md`, 한 대화에 화면 2~3장. 375px · 1440px 로 렌더해 A/B 를 가리고
> 오너와 세션이 각자 **통일성 · 심미성 · 서비스 방향성**으로 고른 뒤 공개한다. **4종 중 3종 이상에서 스킬 쪽이 세 기준 우위면 낸다**,
> 차이 없음이나 엇갈림이면 내지 않고 §4.4 표만 문서로 남긴다(결과 보기 전 확정). 아래 표의 채점 범위와 U21 은 이 결정으로 쓰지 않는다.

**왜 먼저인가.** "스킬 없이도 같은 결과가 나오면 내지 않는다"(§3.2)가 추천의 첫 조건인데, 이 저장소의 컨테이너 게이트로는
그 조건을 평가할 수 없다(H15). 배선 · 테스트 · ADR · 문서를 다 만든 뒤에야 그것을 알면, 조건이 한 번도 평가되지 않은 채
출하되거나 만든 것을 통째로 버린다. 그래서 스킬 초안 두 파일만 써서 먼저 잰다.

| 항목 | 내용 |
|---|---|
| 실행기 | 메인테이너의 비공개 A/B 평가 실행기(#513, H16). 이 저장소에 새 이미지를 만들지 않는다 |
| 팔 | **B** = 하네스 설치(React 트랙 — shadcn 공식 스킬 · `frontend-design` · `ui-components` 룰이 든 현행 판) · **C** = B + 스킬 초안(`SKILL.md` · `references/concept-presets.md` 를 두 스킬 자리에 손으로 복사). A(하네스 없음)는 돌리지 않는다 — 가르려는 것은 "이 스킬이 현행 하네스에 더하는 것"이다 |
| 과제 | 컨셉 2종(업무용 SaaS · 소비자용 B2C) × 변형 2개. 1차는 변형 하나만 쓴다. 서비스 설명 본문은 비공개 위치에 둔다(H16). 커머스는 판정 범위를 받칠 출처가 얇아(§4.4) 이 실험에 넣지 않는다 |
| 픽스처 | Vite + React + Tailwind v4, `components.json` 없음. 팔 준비 단계(일반망)에서 실 `npx skills add shadcn/ui --skill shadcn --copy` 로 상류 스킬을 깔고 **그 파일 목록을 확인한다 — 여기서 §6 U4 가 닫힌다. `design-system.md` 가 없으면 실험을 시작하지 않는다**(D2 의 전제가 무너진 것이다). `@google/design.md` 는 픽스처에 미리 설치한다(에이전트 단계는 인터넷이 없다) |
| 시행이 끝나는 곳 | `DESIGN.md` 작성까지. 테마 적용 · 쇼케이스 페이지는 이 실험에 넣지 않는다 — 이 스킬이 직접 맡는 단계(컨셉 → `DESIGN.md`)만 재고, 시행을 짧게 유지한다 |
| 두 팔에 똑같이 주는 것 | 요청문 · 사람이 답할 것의 답(컨셉 · 주 사용 기기 · 브랜드 색과 서체는 정해진 것이 없음) · **산출 계약**: `DESIGN.md` 앞머리에 정해진 이름의 토큰을 둔다 — `typography.body` · `typography.heading`(각각 `fontFamily` · `fontSize` · `lineHeight` · `letterSpacing`) · `components.button.height` · `spacing.control-gap` · `spacing.card-padding` · `spacing.section-gap`, 그리고 공통 보고 꼬리에 셸 구조와 모바일 내비를 고정 어휘로 적는다. 이름을 고정하는 이유: 채점이 값만 보게 하고, 토큰 이름이 달라서 대조 팔이 떨어지는 일을 없앤다 |
| 반복 | 팔 × 컨셉마다 3회 → 1차 **12시행**(2 컨셉 × 2 팔 × 3회). 같은 배치에서 돌린다 |
| 채점 | 결정적. `DESIGN.md` 앞머리를 읽어 아래 표의 범위와 대조하고 `npx @google/design.md lint` 의 종료 코드는 기록만 하고 판정에 넣지 않는다(아래 "함께 기록하는 것"과 같다). 보고 형식 · 출처 표시 · 문장은 판정에 넣지 않는다. 품질을 사람이나 상위 모델이 보는 판정은 없다(H16) |
| 채점기 자체의 검사(모델 호출 0) | 손으로 쓴 `DESIGN.md` 둘 — SaaS 열 값으로 쓴 것은 SaaS 채점을 통과하고 B2C 채점에 떨어져야 하며, 그 반대도 같다. 여기에 자간이 없거나 본문 자간이 0.05em 인 문서 하나를 더해, 그 문서는 두 채점 모두에서 자간 축이 떨어져야 한다(자간 범위는 두 열이 같아 앞의 둘로는 자간 채점을 떨어뜨려 볼 수 없다). 이렇게 갈리지 않으면 실험을 시작하지 않는다 |
| 만드는 레인 | 채점 범위는 이 문서의 표가 **스킬 초안을 쓰기 전에** 고정한다. 과제 묶음과 채점기는 스킬 초안을 쓰지 않은 레인이 만든다 |

**축별 채점 범위**(오너가 든 네 축. 근거는 §1.5 · §4.4).

| 축 | 읽는 값 | SaaS 과제 | B2C 과제 | 범위의 근거 |
|---|---|---|---|---|
| 타이포그래피 | `typography.body` 의 크기 / 행간 | 13~14px / 18~20px | 16~17px / 22~24px | Carbon `body-01` · `body-compact-01` / M3 body large · HIG Body |
| 자간 | `typography.body` · `typography.heading` 의 `fontFamily` 와 `letterSpacing` | 둘 다 서체와 자간이 있고, 본문 자간의 크기가 0.035em 이하(px 면 글자 크기로 나눠 환산) | 같다 | 확인한 참조의 본문 자간이 전부 이 안이다 — Carbon +0.011em · M3 +0.031em · SF Pro −0.025em · Polaris 0 |
| 간격 · 밀도 | `components.button.height` · `spacing.control-gap` · `spacing.section-gap` (셋 다 맞아야 통과) | 28~36px · 8px 이하 · 16~24px | 40~48px · 12px 이상 · 24~48px | shadcn nova · mira / Polaris 버튼 묶음 8 ‖ HIG 44pt · Android 48dp · HIG 컨트롤 둘레 12pt. 섹션 간격 범위는 Carbon 스케일에서 유도한 `[가정]` |
| 레이아웃 | 보고 꼬리의 셸 구조 · 모바일 내비 + Layout 절에 같은 낱말 | 셸 = 옆 패널이 있는 구조 | 한 단 · 모바일 내비 = 하단 탭(5개 이하) | Carbon 고정 옆 패널 / HIG 탭 바. 두 출처는 그 구조의 규격을 줄 뿐이고, "업무용이면 옆 패널 · 소비자용이면 한 단"이라는 대응은 `[가정]` 이다 |

`spacing.card-padding` 과 반경, 본문 폭은 값을 기록만 하고 판정에 넣지 않는다 — 두 열의 범위가 겹치거나(카드 패딩 16) 출처가 없다(본문 폭).
**자간 축은 가장 약한 축이다.** 이 스킬은 컨셉별 자간 숫자를 주장하지 않으므로(§1.5) 두 팔이 함께 통과할 가능성이 높다. 자간이 유사 서비스 값으로 고쳐지는지는 AC11 이 따로 잰다.

**판정 규칙**(1차 12시행 뒤. 한 시행의 점수 = 통과한 축 수, 0~4).

| 결과 | 조건 | 다음 |
|---|---|---|
| **차이 없음 — 내지 않는다** | B 팔이 두 컨셉 **모두**에서 3회 중 2회 이상 3축 이상 통과 | 여기서 멈춘다. 대안 A 로 가고 §4.4 표만 문서로 남긴다 |
| **낸다** | 위가 아니고, C 팔이 두 컨셉 모두에서 3회 중 2회 이상 4축 전부 통과 | 증분 1 로 간다 |
| **둘 다 아님** | B 도 C 도 조건에 못 미친다 | 초안을 **한 번** 고쳐 쓰지 않은 변형 과제로 같은 규모(12시행)를 다시 돈다. 그래도 "낸다"가 아니면 내지 않는다 |

함께 기록하는 것(판정에는 넣지 않는다): 어느 스킬이 먼저 열렸는지(같은 요청에 shadcn 공식 스킬도 발화한다 — F10) · C 팔에서 이 스킬이 열린 시행 수 · 시행당 토큰과 시간 · `DESIGN.md` lint 종료 코드.

**규모.** 1차 12시행, 재실행까지 가면 상한 24시행. 모델 등급은 하나(GLM-5.3)만 쓴다. 시행당 모델 요청 수는 이 과제 유형으로 잰 값이 없다 —
문서 하나를 쓰는 짧은 세션이라 20~40회로 **가정**하면 1차 240~480회, 상한 480~960회다. 첫 시행의 실측으로 이 줄을 고치고, 실행기의 시행 시간 상한을 건다. 시간의 근거: 같은 실행기로 돈 #513 기능 구현 과제의 시행 시간은 중앙값 24분 · 상위 10% 38분(n=39, 2026-11-16 실측)이고, 문서 한 장을 쓰는 이 과제는 그보다 짧다고 보아 시행 상한을 30분으로 둔다 — 12시행을 동시 2개로 돌리면 최대 약 3시간. 비용은 GLM 요금제의 주간 크레딧에서 나간다(정액 아님).
실행 호스트가 지금 #513 의 긴 실행에 쓰이고 있어 시작 시점은 오너가 정한다(§5 D3).

**이 실험이 말해 주지 못하는 것.** ① 결과는 GLM-5.3 등급에서의 관측이다. 더 강한 모델에서는 대조 팔이 나아져 차이가 줄 수 있다 — "낸다"는 그 등급에 한해 읽는다.
② 에이전트 단계에 인터넷이 없어 대조 팔은 참조 문서를 찾아볼 수 없고, 스킬 쪽은 출처 값이 든 표를 파일로 갖고 있다. 실제 사용보다 스킬에 유리한 조건이다.
③ 테마 적용 · 쇼케이스 · 중간 정리 · 실측은 이 실험이 재지 않는다(증분 1 의 V3).

### 4.1 더하는 파일(증분 1 — 증분 0 이 "낸다"일 때만)

| 파일 | 내용 |
|---|---|
| `templates/skills/service-design-system/SKILL.md` | 발화 조건 · 상태 판별(신규/정리) · 7단계 흐름 · 넘기는 지점 · 보고 형식. 150줄 안팎 |
| `…/references/concept-presets.md` | §4.4 의 컨셉별 출발값 표(값마다 출처) + 유사 서비스 실측 절차 |
| `…/references/daisyui.md` | `DESIGN.md` → `@plugin "daisyui/theme"` + Tailwind `@theme` 매핑 · 서버 템플릿용 디자인 시스템 페이지 구성 |
| `…/references/retrofit.md` | 기존 값 수집 명령 · 수렴 규칙 · 화면 단위 적용 순서 |
| `tests/service-design-system-landing.test.ts` | 안착만: 고르면 두 자리에 깔리고 안 고르면 없다(#971 테스트와 같은 꼴) |
| `docs/decisions/ADR-122-…md` | 새 번들 자산 · shadcn 공식 스킬에 넘기는 결정 · opt-in 근거 · 기각한 대안(§2) |

배포물(`templates/**`)에는 이 리포의 이슈 · ADR 번호 · 홈 경로를 넣지 않는다(SPEC DO NOT CHANGE). 참조 파일에는
"<이름> 의 실제 …" 꼴 문장과 `v` 뒤에 두 자리 주 버전이 오는 표기를 쓰지 않는다 — 배포물 위생 게이트(`tests/templates-distribution-hygiene.test.ts`)가 문다.
증분 0 · V3 의 과제 묶음과 채점기는 이 저장소에 두지 않는다(H16).

### 4.2 고치는 파일

| 파일 | 변경 |
|---|---|
| `src/external-assets.ts` | `internal` key 유니언에 한 줄 · 카탈로그 항목(`category: "frontend"` · `source: "uzys"` · `tier: "official"` · `condition: { kind: "opt-in" }`) · `INTERNAL_BUNDLED_SKILL_IDS` 에 한 줄 |
| `context-cost-baseline.json` | `skillDescriptors` 에 새 id 의 상한(트랙별 합계는 opt-in 이라 안 바뀐다) |
| `tests/installer-track-matrix.test.ts` | opt-in 번들 스킬 목록에 한 줄 |
| `docs/COMPATIBILITY.md` | `npm run gen:compat` 로 재생성 |
| `docs/TRACKS.md` | opt-in 스킬 한 문단 |
| 카탈로그 총계를 적은 문서 | #971 때 함께 움직인 두 곳(`docs/plans/service-audit-roadmap.md` · `docs/research/adoption-c2-submission-kit.md`) — 테스트가 대조하는 수치만 |

`docs/plans/980-marketing-content-plan.md` 의 작업도 `src/external-assets.ts` 와 `docs/COMPATIBILITY.md` 를 고친다 — 나중에 머지하는 쪽이 `npm run gen:compat` 을 다시 돌린다.

**건드리지 않는 것:** 룰 10종 · 훅 · 배포 앵커 · `src/manifest.ts` · `package.json` 의 `files` · 기존 스킬 본문
(`ui-visual-review` 포함 — 이 스킬이 그쪽 파일 형식을 따를 뿐이다).

### 4.3 스킬의 발화 설명(초안)

```yaml
name: service-design-system
description: >-
  Builds a project design system from the service concept before screens are built,
  or consolidates a half-built UI into one. Writes DESIGN.md (tokens and rules) from a
  SaaS / B2C / commerce starting profile corrected by reference design systems and
  measurements of similar services, applies it to shadcn/ui (React) or daisyUI (other
  stacks), renders an in-app design-system page, and turns on lint so later screens are
  assembled from it. Use for "디자인 시스템 만들어줘", "디자인 통일해줘",
  "컨셉에 맞게 디자인 잡아줘", "DESIGN.md 만들어줘", "set up a design system",
  or when starting the first screens of a new service that has no DESIGN.md.
  Do NOT use for a single component or screen tweak, or when DESIGN.md already exists
  and the task is only to build with it — follow DESIGN.md directly.
```

설명문의 "measurements of similar services"는 AC11 이 통과해야 남긴다. AC11 을 못 돌리면 이 구절과 `docs/TRACKS.md` 의 같은 문구를 빼고,
참조 파일의 실측 절차에 "실행으로 확인하지 못했다"를 적는다. 길이는 약 760자(190토큰 안팎)로 기존 최대인 `genspark-delegate`(207)와 같은 급이다.

**본문 흐름(구현 레인이 문장으로 옮길 뼈대).**

0. **상태 판별** — `DESIGN.md` 유무 · 스택(`components.json` / daisyUI / Tailwind 판) · 기존 화면 수. 화면이 이미 있으면 정리 모드.
   `DESIGN.md` 가 이미 있으면 덮어쓰지 않고 읽어서 이어 간다(impeccable 이 만든 것일 수도 있다 — H6).
1. **컨셉 확정** — 서비스 종류(SaaS · B2C · 커머스 · 혼합) · 주 사용 기기 · 정보 밀도 · 유사 서비스 2~3곳 · **브랜드 색과 서체가 정해져 있는지**.
   대화 · README · 북극성 문서에 이미 있으면 묻지 않는다. 물을 때는 한 번에 묶어 묻는다. 색 · 서체가 없으면 고른 값과 이유를 `가정` 으로 적는다
   (`DESIGN.md` 형식은 `primary` 색이 필수이고 — S1 — 자간은 서체가 정해져야 정할 수 있다).
2. **출발값** — `references/concept-presets.md` 의 해당 열.
3. **보정** — 그 컨셉의 참조 디자인 시스템 문서값 → 유사 서비스 실측(브라우저 도구가 있을 때). 출발값과 다른 값만, 근거와 함께 바꾼다.
4. **`DESIGN.md` 작성** — 형식은 `npx @google/design.md spec` 이 내는 것을 따른다. 쓴 뒤 `npx @google/design.md lint DESIGN.md`.
5. **적용** — React: shadcn 공식 스킬의 `design-system.md` 를 따른다. 그 스킬이 없거나 그 파일이 없는 옛 판이면 `DESIGN.md` 까지만 만들고 추가 · 갱신 명령 한 줄을 알린 뒤 멈춘다.
   **기존 프로젝트에서는 상류 Step 1(scaffold)과 Step 2(`add --all`)를 건너뛴다** — 이미 깔린 컴포넌트만 다룬다. `components.json` 이 있으면 스타일은 그대로 두고,
   덮어쓰는 명령인 `apply`(F14)는 사용자 승인 없이 돌리지 않는다. 시작 전에 작업 트리가 깨끗한지 확인하고, 아니면 커밋을 권한 뒤 멈춘다. 그 밖의 스택: `references/daisyui.md`.
6. **디자인 시스템 페이지** — 앱 안 `/design-system`(§4.5). 페이지의 예시 화면 하나를 `DESIGN.md` Layout 절의 셸 구조로 그린다(§3.1).
7. **조립 규칙 고정** — 린트 규칙을 사용자 확인을 받아 켠다(React · 서버 JSX: `no-raw-colors` · `no-arbitrary-values` · `no-restyle` · `no-unknown-classes` · `no-inline-styles` / Jinja: 프로젝트의 ast-grep 규칙).
   **린트 대상은 앱 화면 소스다.** 쇼케이스 폴더는 상류 도우미 사본이 인라인 style 을 쓰므로(F12) 설정의 파일 범위로 `no-inline-styles` 에서 빼고, 뺀 경로를 보고에 적는다.
   그 밖에 상류가 생성한 파일(`components/ui`)이 내는 위반은 규칙을 끄지 않고 건수와 파일로 보고한다. 프로젝트 지시 파일(`CLAUDE.md` 또는 `AGENTS.md` 의 설치자 구역)에 "UI 는 `DESIGN.md` 의 토큰과 `/design-system` 에 있는 컴포넌트로 조립한다" 한 줄을 제안한다. `ui-visual-review` 가 있으면 쇼케이스를 `docs/visual-pages.json` 에 넣는다.
8. **보고** — 컨셉 → 값 표(값마다 `출처` · `실측` · `가정` 중 하나), 상류 스킬에 넘긴 것, 건너뛴 단계와 이유.

### 4.4 컨셉 프리셋 — 출발값과 그 출처

"출발값"이다. 3단계(보정)에서 바뀌는 것이 정상이고, **자간 열은 숫자를 고정하지 않는다**(§1.5 판단).
`[가정]` 표시는 출처에서 확인한 값이 아니라 출처 있는 값에서 내가 유도한 것이다 — 실측으로 확정해야 한다.
`실측` 은 2026-11-16 에 공개 제품 화면을 375 · 1440px 에서 잰 값의 가운데 값(괄호 안은 범위)이다 — 서비스 × 닻 × 폭 원본은 [`979-benchmark.md`](979-benchmark.md).

| 축 | **SaaS**(업무용 제품 UI — 표 · 폼 · 대시보드) | **B2C**(소비자 서비스 — 모바일 우선 · 읽기 · 온보딩) | **커머스**(구매자 화면 — 목록 · 상세 · 장바구니 · 결제) |
|---|---|---|---|
| 1차 참조 | Carbon productive · Polaris(Admin) · SLDS 2(Cosmos) · Astryx 기본값 · 실측 GitHub · GitLab · Hugging Face | Apple HIG · Material 3 · Carbon expressive · Astryx Neutral 의 터치 규칙 · 실측 Airbnb · Spotify · 당근 | B2C 열을 기반으로 + Polaris(Checkout · Customer accounts) + 실측 무신사 · 29CM(국내) · Nike · Allbirds(해외) |
| 본문 크기/행간 | 14px / 20px (Carbon `body-01` · Astryx 본문). 실측 14 / 21 (14~16). SLDS 2 · Polaris 는 13px | 16px / 24px (M3 body large · Carbon `body-02` · Astryx 터치 화면). 실측 16 / 22~24. iOS 느낌이면 17 / 22 (HIG Body) | 16px / 24px (실측 4곳 중 3곳 16, 무신사 14). 상품 카드 글자 13~14 (실측 무신사 13 · M3 body medium 14) |
| 보조 · 라벨 | 12 / 16 (Carbon `label-01` · M3 label medium · Polaris `body-sm`). 폼 라벨 13 600 (SLDS 2) | 14 / 20 · 12 / 16. 최소 11 (HIG iOS 최소) | 12 / 16 |
| 제목 | 컴포넌트 제목 14 / 18 600 (Carbon `heading-compact-01`) · 화면 제목 20 / 28 (`heading-03` · Astryx h2). 실측 화면 제목 20 (18~30) | 24 / 32 · 28 / 36 · 32 / 40 (M3 headline) · 히어로 36 / 44 (M3 display small). 실측 화면 제목 24 (24~28) | 상품명 18 / 24 (실측 14~24 — 무신사 18 · 29CM 14 · Allbirds 24). 가격 16~18 · 굵기 500~600 (실측 3곳). 고정폭 숫자는 실측 0/3 이라 기본으로 켜지 않는다 — 금액이 세로로 줄 서는 장바구니 · 비교표에서만 `[가정]` |
| 자간 | 서체를 먼저 정한다. 참고: Carbon 은 14px 에 +0.16px(IBM Plex), SF Pro 는 13pt 에 −0.08pt, Polaris 본문은 0, SLDS 2 · Astryx 는 자간 토큰 없음. 실측 본문 3/3 `normal` | 참고: Carbon expressive 16px 은 0, M3 는 +0.5sp(Roboto), SF Pro 17pt 는 −0.43pt. 실측 본문 3/3 `normal` | B2C 와 같다. 실측 본문 4/4 `normal` |
| 컨트롤 높이 | 32px (실측 32, 28~32 · SLDS 2 32 · Astryx md 32 · shadcn nova 32~36 · mira 28~32). 입력 30 (실측 28~32) | 44px (HIG iOS 기본 44×44pt · Android 최소 48dp → 44~48). 실측 주 버튼 48 (36~48). shadcn maia 는 40px+ | 일반 컨트롤 44px `[가정]` · 구매 버튼 50 (실측 44~62), 휴대폰에서 하단 고정 막대 (실측 4/4, 막대 높이 62~69 — 상품명 · 가격을 함께 싣는 곳은 119) |
| 반경 | 6~8px (shadcn nova). 실측 버튼 4~6 (GitLab 4 · GitHub 6) · Astryx element 8 · SLDS 2 입력 8(버튼은 알약) | 버튼 · 칩은 알약형 (실측 3/3 · shadcn luma). 카드 12px+ (maia) · 실측 카드 이미지 8 | 상품 이미지 · 카드 0 (실측 4/4). 구매 버튼은 국내 4px (2/2) · 해외 알약 (2/2) — 하나로 모이지 않아 브랜드 결정으로 남긴다 |
| 간격 | 4px 격자. 컨트롤 사이 8 (Polaris 버튼 묶음 · 실측 최빈 4~8) · 카드 패딩 16 · 카드 간격 16 · 표 셀 패딩 6 (Polaris) · 밀도 두 단계(SLDS 2 Comfy · Compact) · 섹션 간격 16~24 (Carbon 스케일에서 `[가정]`) | 4px 격자. 컨트롤 사이: HIG 는 테두리 있는 요소 둘레 12pt, 실측 칩 사이 8 (8~12)(§6 U21) · 테두리 없는 요소 둘레 24 (HIG) · 휴대폰 좌우 여백 16 (실측 16~24) · 카드 패딩 16~24 `[가정]` · 섹션 간격 24~48 (Carbon 스케일에서 `[가정]`) | 상품 격자 간격 휴대폰 4 (실측 0~10) · 데스크톱 13 (실측 0~20, 29CM 은 세로 60) · 상품 카드는 테두리 상자가 아니라 이미지 + 글자다 — 카드 안쪽 여백 0 (실측 4/4). Polaris 의 카드 패딩 16 은 판매자 어드민 값이라 여기 쓰지 않는다 |
| 구분 | 그림자보다 가는 선 (shadcn nova) | 부드러운 엘리베이션 (shadcn luma) | 상품 카드에 테두리 · 그림자 없음 (실측 4/4) |
| 레이아웃 | 옆 패널 + 본문 (실측 3/3 — 내비 패널 240~256px, 휴대폰 폭에서는 접혀 한 단) · 고정 패널은 격자 밖(Carbon) · 본문은 1056px 이상에서 16열 격자, 거터 32px (Carbon 2x) · 본문 폭 유동 `[가정]` | 한 단 `[가정]` · 휴대폰 폭에서 하단 탭 (실측 2/3 — 3~4개 · HIG 5개 이하) · 읽기 폭 640~720px `[가정]`(실측 세 곳의 데스크톱 구조가 전폭 · 앱 셸 · 984px 로 갈렸다) · 창 폭 600 미만을 기본 설계 폭으로 (Android compact) | 상품 격자 휴대폰 2~3열 (실측 국내 3 · 해외 2) / 데스크톱 4열 (실측 3~6) · 이미지 1:1 (실측 목록 3/4), 패션은 5:6 · 4:5 도 (무신사 · Nike 상세) · 국내는 휴대폰 하단 탭 5개 (실측 2/2, 해외 0/2) |
| shadcn 스타일 | `nova`(촘촘한 표 중심이면 `mira`, 무난하게는 `vega`) — 최종 선택은 상류 "Picking a style" 표 | `maia`(알약 · 부드러운 그림자면 `luma`, 밀도가 필요하면 `rhea`) | `vega` 또는 `maia` `[가정]` |
| daisyUI 테마 | `--size-field: 0.21875rem`~`0.25rem` · `--radius-field: 0.25rem`~`0.5rem` · `--radius-box: 0.5rem` · `--depth: 0` `[가정 — D3 의 허용값 안에서]` | `--size-field: 0.28125rem` `[가정]` · `--radius-field: 2rem`(알약 — 실측 3/3) · `--radius-box: 1rem` `[가정]` | `--size-field: 0.25rem`~`0.28125rem` `[가정]` · `--radius-field: 0.25rem`(국내) 또는 `2rem`(해외 알약) · 상품 카드는 `--radius-box` 를 쓰지 않는 반경 0 이미지로 (실측 4/4) |
| Tailwind `@theme` | `--spacing: 0.25rem` 유지 · 본문 `--text-sm`(14px)을 기본으로 | `--spacing: 0.25rem` 유지 · 본문 `--text-base`(16px) | B2C 와 같다 |

**커머스 열은 이제 실측이 받친다 — 다만 구매자 화면 토큰을 공개한 디자인 시스템은 여전히 없다.** 이슈가 든 참조 여섯 중 커머스는 Polaris 하나인데,
지금의 Polaris 는 판매자 어드민과 결제 화면용이다(§1.5). 그래서 커머스 열의 값은 대부분 국내 2곳 · 해외 2곳의 목록 · 상세 화면 실측이고,
국내와 해외가 갈리는 축(휴대폰 열 수 · 하단 탭 · 구매 버튼 모양)은 하나로 줄이지 않고 둘 다 적었다. 장바구니 · 결제 화면은 로그인과 담기가
필요해 재지 않았다. **판매자 어드민은 SaaS 열을 쓴다.**

**`[가정]` 을 값으로 바꾸는 방법 — 유사 서비스 실측.** 참조 파일에 절차로 적는다.

1. 사용자가 유사 서비스 2~3곳을 댄다(없으면 에이전트가 제안하고 확인받는다). **로그인 없이 열리는 공개 화면만** 잰다.
   잰 화면의 종류(제품 화면 / 마케팅 화면 / 문서)를 표에 적는다. **제품 화면 값은 제품 화면에서 잰 것으로만 고친다** — 마케팅 화면만 열리면 그 축은 출발값과 `가정` 을 유지한다
   (SaaS 의 공개 화면은 대개 마케팅 페이지이고, 그 값은 Carbon 이 productive 와 가른 expressive 쪽이다 — 그대로 섞으면 SaaS 출발값이 B2C 쪽으로 끌려간다).
   SaaS 의 제품 화면 값은 참조 디자인 시스템의 공개 컴포넌트 문서(실제 컴포넌트가 그려져 있다)에서 잰다.
2. 화면 폭 375px · 1440px 에서 아래 닻(anchor)마다 계산된 스타일을 읽는다. 브라우저 도구의 스크립트 실행으로 한다.

   ```js
   const pick = (sel) => {
     const el = document.querySelector(sel);
     if (!el) return null;
     const s = getComputedStyle(el), r = el.getBoundingClientRect();
     return { fontFamily: s.fontFamily.split(",")[0], fontSize: s.fontSize, lineHeight: s.lineHeight,
       letterSpacing: s.letterSpacing, fontWeight: s.fontWeight, fontVariantNumeric: s.fontVariantNumeric,
       height: r.height, width: r.width, padding: s.padding, margin: s.margin, gap: s.gap,
       border: s.border, boxShadow: s.boxShadow, borderRadius: s.borderRadius, position: s.position,
       gridTemplateColumns: s.gridTemplateColumns, maxWidth: s.maxWidth };
   };
   ```

   닻: 본문 문단 · 화면 제목 · 주 버튼 · 입력 · 카드 · 목록(또는 표) 행 · 내비게이션 · 페이지 컨테이너(폭 · 좌우 여백) · 격자 간격 · 상품 이미지(커머스).
   스니펫으로 못 읽는 칸(격자의 열 수 등)은 스크린샷에서 세어 적는다.
3. 서비스별 값을 표로 적고 **가운데 값**을 고른다. 표본이 2곳이면 범위로 적고, 출발값이 그 안이면 그대로 둔다. 자간은 px 를 em 으로 바꿔 적는다(자간 ÷ 글자 크기) — 크기가 바뀌어도 비율이 유지된다.
4. 근거 표는 설치자 프로젝트의 `docs/design-system/benchmark.md` 에 남기고, `DESIGN.md` 의 해당 값 옆 설명에서 가리킨다.
5. 빌려 오는 것은 **스케일과 구조**다. 색 · 로고 · 유료 서체는 가져오지 않는다(SF Pro 는 Apple 플랫폼 밖에서 쓸 수 없다 — 대체 서체를 `DESIGN.md` 에 적는다).

### 4.5 보여 주는 자리 — 앱 안 `/design-system` 페이지

이슈는 네 후보(Claude Design · Storybook · Figma · 아티팩트) 중 무엇이든 좋다고 했다. 첫 증분은 **앱 자신의 라우트**로 한다.

| 후보 | 판정 | 이유 |
|---|---|---|
| **앱 안 `/design-system`** | **채택** | 실제 테마 CSS 와 실제 컴포넌트로 그려지므로 코드와 갈라질 수 없다. 추가 의존성이 없고 네 CLI 어디서나 만든다. React 는 상류 스킬이 구성 · 도우미 · 누락 검사까지 준다(F8). `ui-visual-review` 가 baseline 으로 찍을 수 있다(H7) |
| Storybook | 다음 증분(요청이 있을 때) | 프레임워크별 설치와 의존성이 붙고, Jinja · `hono/jsx` 지원이 문서에 없다(S6). 이미 Storybook 이 있는 프로젝트용 어댑터로는 가치가 있다 |
| Claude Design | 지금은 제외 | `/design-sync` 는 Claude Code 전용 · React 전용이고, 올리는 사이트가 2026-12-14 에 닫힌다(S5). 이전이 끝난 뒤 다시 본다 |
| Figma | 제외 | 계정과 커넥터가 있어야 한다. 이번에 사양을 조사하지 않았다(§6 U7) |
| 아티팩트 | 제외 | Claude 계열에서만 되고, 그 순간의 사본이라 코드가 바뀌면 낡는다 |

페이지를 프로덕션에 노출할지는 스킬이 실행 중에 설치자에게 묻는다(기본 제안: 개발 환경에서만 열리게).

### 4.6 수용 기준과 검증

| # | When | Then | 검증 |
|---|---|---|---|
| AC1 | `--with service-design-system` 으로 네 CLI 를 고른 설치 | `.claude/skills/service-design-system/` 과 `.agents/skills/service-design-system/` 의 파일 목록이 소스 폴더(`templates/skills/service-design-system/`)의 파일 목록과 같다 | V1 |
| AC2 | 같은 설치를 `--with` 없이 | 두 자리 어디에도 없다(대조군: 같은 설치에 `north-star` 는 있다) | V1 |
| AC3 | 설치한 프로젝트에서 update · uninstall | 기존 번들 스킬과 같은 경로로 갱신 · 회수된다. 새 설치기 코드는 0줄 | V1(기존 테스트) + diff 확인 |
| **AC4** *(출하를 가른다)* | 증분 0 의 픽스처(Vite + React + Tailwind v4, `components.json` 없음)에서 업무용 SaaS 과제와 소비자용 B2C 과제를 팔 B · C 로 각각 3회 | C 팔의 `DESIGN.md` 가 두 컨셉 모두에서 3회 중 2회 이상 **네 축 전부**(타이포그래피 · 자간 · 간격·밀도 · 레이아웃)를 그 컨셉의 범위에 넣는다(범위 = §4.0 표). **그리고** B 팔은 "두 컨셉 모두에서 3회 중 2회 이상 3축 이상 통과"에 못 미친다. B 팔이 그 조건을 채우면 이 AC 는 실패이고 스킬을 내지 않는다. 판정은 값만 본다 — 보고 형식과 출처 표시는 넣지 않는다 | V0 |
| AC5 | React 앱에서 끝까지 실행(컴포넌트는 픽스처에 미리 설치) | `npx @google/design.md lint DESIGN.md` 가 exit 0 · 테마 CSS 에 `letter-spacing` 이 든 `type-*` 유틸이 있다 · 앱 빌드가 exit 0 · `showcase-coverage.mjs` 가 exit 0(F13) · 린트 규칙 다섯이 설정에 켜져 있고 **앱 화면 소스**(쇼케이스 폴더와 `components/ui` 밖)의 lint 가 exit 0 · 그 통과가 헛것이 아님을 보이려고 화면 파일 하나에 `bg-pink-500` 을 심으면 lint 가 실패한다 · 쇼케이스 폴더를 `no-inline-styles` 에서 뺀 경로와 `components/ui` 의 위반 건수가 보고에 있다 · 쇼케이스 폴더는 `no-inline-styles` 하나만 빠지고 나머지 네 규칙은 그대로 받는다 — 에이전트가 직접 쓴 쇼케이스 섹션의 위반도 보고에 건수로 있다. 콘솔 오류 0 · 375px 와 1280px 에서 가로 넘침 없음은 실행 이미지에 헤드리스 브라우저가 있을 때만 재고, 없으면 미검증으로 적는다 | V3 |
| AC6 | htmx(서버 JSX) 앱에서 끝까지 실행 | CSS 에 `@plugin "daisyui/theme"` 블록과 `@theme` 의 글자 · 간격 토큰이 있다 · `/design-system` 이 200 으로 응답한다 · 원색 · 임의값 린트가 exit 0 이고, 위반 한 줄을 심으면 실패한다. Jinja(ast-grep) 경로는 돌리지 않으며 보고에 미검증으로 적는다 | V3 |
| AC7 | 임의값(`p-[13px]`)과 원색(`bg-pink-500`)을 심어 둔 앱에서 실행 | ① 기존 값 목록 표가 나온다 ② `DESIGN.md` 가 그 값들에서 수렴한 값을 담는다 ③ 수정된 파일이 `DESIGN.md` · 테마 CSS · 승인한 화면의 소스뿐이다(`git diff --name-only`). 테마 변경으로 모양이 달라진 미승인 화면은 목록으로 보고한다 ④ 승인한 화면의 린트 위반 수가 before → after 로 보고된다 ⑤ 전후 스크린샷은 헤드리스 브라우저가 있을 때만(없으면 미검증) | V3 |
| AC8 | 브라우저 도구가 없는 세션에서 실행 | 실측을 건너뛰었다고 보고하고, `benchmark.md` 를 만들지 않는다 | V3(AC5 시행에서 함께 본다) |
| AC9 | `DESIGN.md` 가 있는 프로젝트에서 "이 버튼 색만 바꿔줘" | 스킬의 절차(컨셉 질문 · 재구축)가 시작되지 않는다. **같은 실행 환경에서 이 스킬이 열린 시행(증분 0 의 C 팔)이 관측된 뒤에만 통과로 센다** — 스킬이 아예 안 열리는 환경에서는 헛통과다 | V3 |
| AC10 | PR diff | 룰 · 훅 · 앵커 · `src/manifest.ts` 변경 0. `templates/**` 에 이 리포의 이슈 · ADR 번호 없음 | diff 확인 + `tests/templates-distribution-hygiene.test.ts` |
| **AC11** *(실측의 양성 기준)* | 브라우저 도구가 있는 세션에서, 값이 알려진 참조 페이지 2개(실행 환경 안에서 서빙하는 정적 페이지 — 에이전트 단계에 인터넷이 없다)를 유사 서비스로 주고 실행 | `docs/design-system/benchmark.md` 에 페이지 · 화면 종류 · 폭 · 닻별 값이 있고 그 값이 참조 페이지에 심은 값과 같다 · `DESIGN.md` 의 값 중 하나 이상이 출발값에서 그 실측값 쪽으로 바뀌어 있다. **이 AC 를 못 돌리면** 발화 설명과 `docs/TRACKS.md` 에서 실측 문구를 빼고 내며, 보고에 "실측 경로 미검증"을 적는다 | V3(이미지에 헤드리스 브라우저가 있을 때) |

**검증 방법.**

- **V0 증분 0(배선 전)** — §4.0 그대로. AC4 를 가른다.
- **V1 상시(안착만)** — `tests/service-design-system-landing.test.ts` + `tests/installer-track-matrix.test.ts`. 스킬 문구나 개수를 단언하지 않는다.
- **V2 머지 전 리그레션** — typecheck 전체 + 영향 범위 테스트 + 변경 파일 lint. 수정이 다 모인 뒤 한 번. 영향 범위 = 위 둘 · `external-assets` · `docs-supply-chain` · `context-cost-ratchet` · `north-star-cost-figures` · `baseline-targets` · `resident-cost-honesty` · `resident-rule-reference-liveness`, 그리고 `templates/skills/` 를 폴더째 훑거나 manifest 에서 유도해 새 스킬을 자동으로 무는 여덟 — `templates-distribution-hygiene` · `skill-sidecar-paths` · `skill-registration-uniform` · `doc-asset-ref-drift` · `resident-doc-asset-reachability` · `agents-skills-slot` · `claude-slot` · `codex/skills`.
- **V3 실행 검증(증분 1 · 이 PR 에서만 · 상시 스위트 밖)** — **이 저장소의 `test/docker/run-realcli.sh` 로는 못 돈다**(H15). 증분 0 과 같은 비공개 실행기에서 C 팔로 돌린다: AC5 · AC6 · AC7 · AC9 를 각각 2회 = **8시행**, AC11 은 이미지에 헤드리스 브라우저가 있으면 2시행을 더한다(AC8 은 AC5 시행에서 함께 본다). 에이전트 단계에 인터넷이 없으므로 픽스처에 컴포넌트 · 린터 · 서체 패키지를 미리 설치하고, 사람이 답할 것(컨셉 · 켤 규칙 · 승인할 화면 · 페이지 노출 여부)의 답을 요청문에 넣는다. 채점은 종료 코드 · 파일 목록 · 빌드된 CSS 의 값으로만 한다. 긴 세션이라 시행당 요청을 40~100회로 **가정**하면 320~1,000회다(실측으로 고친다). **Codex · OpenCode · Antigravity 에서의 동작은 돌리지 않으며 출하 보고에 미검증으로 적는다.**
- **V4 설계 검증** — 구현 착수 전에 이 문서를 작성자가 아닌 레인이 읽는다(`.claude/CLAUDE.md` 대원칙). 머지 전 독립 리뷰 문턱(설치자 디스크를 되돌리기 어렵게 바꾸는 변경 · 릴리즈 배선)에는 해당하지 않는다 — 설치기 경로가 안 바뀐다.

### 4.7 다음 증분(이번 범위 밖)

- UI 트랙 기본으로 올리기(§5 D1).
- 이미 Storybook 이 있는 프로젝트용 어댑터 · Claude 본체로 이전된 뒤의 Claude Design 연동.
- React 도 htmx 도 아닌 스택(Vue · Svelte · Django 등)의 실행 검증 — 첫 증분의 스킬은 "React 가 아니면 daisyUI"로 안내하지만 검증은 htmx 한 스택만 한다.
- 커머스 컨셉의 대조 실험 · Codex · OpenCode · Antigravity 에서의 동작 실행 검증 · Jinja(ast-grep) 경로의 실행 검증.

---

## 5. 오너 결정이 필요한 것

| # | 맥락 | 문제점 | 해결방안 | 추천방안 |
|---|---|---|---|---|
| **D1** | 새 스킬을 UI 트랙에서 미리 체크할지, 고른 사람만 받을지. 기본 설치 항목을 바꾸면 SPEC Non-Goals 경계를 건드리는 Major CR 이다(H12) | 기본으로 넣으면 UI 트랙 설치자 전원이 descriptor 를 받고, 작은 UI 수정에 잘못 발화할 위험을 전원이 진다. 값을 한다는 관측은 아직 0건이다(H13). opt-in 이면 오너는 `--with` 로 바로 쓰지만 다른 설치자는 위저드에서 골라야 안다 | ⓐ 첫 출하 opt-in → 오너 프로젝트 관측 뒤 승격 ⓑ 처음부터 UI 트랙 기본 | **ⓐ** — 일주일 전 `benchmark-checklist` 와 같은 근거이고(H11), 승격은 조건 한 줄이라 싸다. 오너가 ⓑ를 원하면 Major CR 로 기록하고 진행한다 |
| **D2** | shadcn 적용과 쇼케이스를 상류 공식 스킬에 넘긴다(§3.1) | 핵심 흐름의 절반이 남의 스킬 판본에 달린다. 상류가 바꾸면 우리 스킬 동작이 따라 바뀐다 | ⓐ 넘긴다(상류가 없거나 옛 판이면 `DESIGN.md` 까지만 만들고 명령 한 줄을 알린 뒤 멈춘다) ⓑ 상류 내용을 우리 스킬에 옮겨 적는다 | **ⓐ** — 옮겨 적은 사본은 상류가 한 달만 움직여도 낡는다(F5 가 그 속도다). 하네스가 `update` 로 외부 스킬을 갱신한다(ADR-078). 전제(하네스가 깐 사본에 그 파일들이 실제로 있다 — U4)는 증분 0 의 팔 준비에서 닫고, 없으면 시작하지 않는다 |
| **D3** | 실행 검증은 이 저장소 안에서 못 한다(H15). 돌릴 수 있는 곳은 오너의 비공개 A/B 실행기(#513)이고, 그 호스트가 지금 #513 의 긴 실행에 쓰이고 있다. 새로 만들 것: 과제 묶음 하나(픽스처 · 요청문 변형 · 결정적 채점기 · 채점기 검사용 정답/오답) — 저장소 밖 | 증분 0 없이 배선하면 "스킬 없이도 되나"가 평가되지 않은 채 나간다. 반대로 전부 돌리면 호스트 시간을 #513 과 나눠 써야 한다 | ⓐ 증분 0(12시행, 상한 24) + 증분 1 의 V3(8시행, 브라우저가 있으면 10) = **20~34시행**, 모델 요청은 가정으로 560~1,960회 ⓑ 증분 0 만 돌리고(12~24시행 · 240~960회) 증분 1 의 동작 AC(AC5~AC9 · AC11)는 미검증으로 적어 opt-in 출하 — 이때 실측 문구는 설명에서 뺀다 ⓒ 아무것도 돌리지 않고 출하 | **ⓐ, 호스트가 비는 순서대로** — 증분 0 은 빠질 수 없다(낼지 말지가 거기 걸린다). 호스트가 계속 바쁘면 ⓑ 까지는 정직하게 낼 수 있다. ⓒ 는 추천하지 않는다. 요청 수는 이 과제 유형의 실측이 없어 가정이다 — 증분 0 첫 시행 뒤에 고쳐 보고한다 |

내가 정하고 넘어간 것(이의가 있으면 뒤집을 수 있다): 스킬 이름 `service-design-system` · "커머스" = 구매자 화면, 판매자 어드민은 SaaS 열 ·
쇼케이스 = 앱 안 페이지 · 실측은 공개 화면만(제품 화면 값은 제품 화면에서 잰 것으로만 고친다) · daisyUI 공식 스킬은 카탈로그에 넣지 않는다 · 룰은 더하지 않는다 ·
증분 0 은 팔 B · C 와 컨셉 2종만(A 팔과 커머스는 뺀다) · 상류 스킬이 없으면 자체 매핑 없이 멈춘다.

---

## 6. 확인하지 못한 가정

| # | 가정 | 확인 방법 |
|---|---|---|
| U3 | daisyUI 공식 스킬 본문(80KB)에 쇼케이스 · 디자인 시스템 절차가 없다(D7). description · 앞부분 · 테마 절만 읽었다 | 본문 전체 검색 |
| U4 | 하네스가 깐 shadcn 스킬 사본에 `design-system.md` · `design-system-page.md` · `assets/showcase/` · `scripts/` 가 실제로 들어 있다. 상류 저장소의 파일 목록은 확인했지만 `npx skills add … --copy` 결과물은 열어 보지 않았다. **D2 의 전제라 착수 전에 닫는다** | 증분 0 의 팔 준비에서 실 `npx skills add shadcn/ui --skill shadcn --copy` 뒤 파일 목록 확인 — 없으면 시작하지 않는다(이 저장소의 이미지는 `skills` 가 모의라 못 본다 — H15) |
| U5 | `extract-design-md`(S3)가 `npx skills add` 로 네 CLI 에 깔리는가. 이름이 `stitch::extract-design-md` 인 플러그인 구조다 | 컨테이너에서 설치 시도 — 첫 증분은 이 스킬에 기대지 않는다 |
| U7 | Figma 쪽 현행 사양(MCP 로 디자인 시스템을 쓸 수 있는지). 조사하지 않았다 | 요청이 생기면 그때 조사 |
| U8 | `impeccable` 이 만드는 `DESIGN.md` 가 Google 형식(S1)과 호환되는가. 둘을 함께 깐 설치에서 한 파일을 두 스킬이 다르게 읽을 수 있다 | `impeccable` 을 고른 컨테이너에서 생성물을 `@google/design.md lint` 로 검사 |
| U11 | Material 3 자간 값은 Compose 토큰 파일의 소수 첫째 자리 표기다(body large +0.5sp). m3.material.io 원문은 렌더가 안 돼 대조하지 못했다 | 브라우저 도구로 원문 확인 |
| U12 | §4.4 에 남은 `[가정]` 칸 — 섹션 간격(SaaS · B2C) · B2C 카드 패딩 · 한 단 구조 · 읽기 폭 · 커머스 일반 컨트롤 44px · 장바구니 · 비교표의 고정폭 숫자 · 커머스 shadcn 스타일 · daisyUI `--size-field` 와 SaaS 열 daisyUI 값. 실측 도구가 닻을 못 잡거나(섹션 간격) 서비스끼리 갈렸다(읽기 폭). 증분 0 의 판정 범위 중 섹션 간격도 여기 든다 | 섹션을 닻으로 고른 실측(`979-benchmark.md` 와 같은 방법) · 스킬 자신의 실측 절차(§4.4) · AC11 |
| U13 | "작은 UI 수정에 잘못 발화할 수 있다"는 위험도 "발화 설명만으로 새 서비스 첫 화면에서 스스로 열린다"는 기대도 관측이 없다. 같은 요청에 shadcn 공식 스킬 · `frontend-design` 이 먼저 열릴 수도 있다 | 증분 0 의 기록(어느 스킬이 먼저 열렸나 · C 팔에서 이 스킬이 열린 시행 수) · AC9 |
| U14 | 스킬 descriptor 의 정확한 토큰 수(상한 등록값). 글자 수로 190 안팎이라고만 어림했다 | `npm run cost:report` |
| U15 | 비공개 실행기의 이미지에 헤드리스 브라우저가 있는가. 없으면 AC11 · AC5 의 브라우저 항목 · AC7 ⑤ 를 못 잰다 | 실행기 이미지 확인 — 없으면 그 항목은 미검증으로 내고 실측 문구를 뺀다 |
| U16 | 상류가 생성한 `components/ui` 소스(예: `rounded-[min(var(--radius-md),Npx)]`)가 `no-arbitrary-values` 등에 걸리는가. 그래서 AC5 의 통과 기준을 앱 화면 소스로 한정하고 그쪽 위반은 건수로만 보고하게 했다 | V3 의 AC5 첫 시행 |
| U17 | 시행당 모델 요청 수(증분 0 은 20~40회, V3 은 40~100회로 가정)와 시행 시간. 이 과제 유형으로 잰 값이 없다 | 증분 0 첫 시행 |
| U18 | 증분 0 의 결과가 다른 모델 등급 · 인터넷이 있는 실제 사용 조건에서도 같은가(§4.0 "말해 주지 못하는 것" ① · ②) | opt-in 출하 뒤 오너 프로젝트의 관측 |
| U19 | 에이전트 단계에 인터넷이 없는 조건에서 스킬의 4단계(`npx @google/design.md spec` · `lint`)가 미리 설치한 패키지로 도는가 | 증분 0 의 채점기 검사 단계에서 픽스처로 확인 |
| U20 | SLDS 2(Cosmos)의 버튼 · 입력 높이 32px. 이 값은 SLDS 1 · 2 공용 CSS(`--slds-c-button-line-height` 기본값 1.875rem)에서 읽었고, Cosmos 가 버튼 높이를 따로 바꾸는지는 토큰 파일에 없다(Cosmos 공유 훅은 버튼 반경 · 좌우 여백만 바꾼다). SaaS 열 32px 은 Carbon · Astryx · 실측이 함께 받치므로 결론은 바뀌지 않는다 | SLDS 2 컴포넌트 문서를 사람이 브라우저로 열어 확인 |
| U21 | **§4.0 채점 범위 두 칸이 실측과 어긋난다.** ① SaaS 본문 행간 범위 18~20px 인데 실측 3곳은 21 · 21 · 24(14px 에 1.5) ② B2C `spacing.control-gap` 범위 "12px 이상"인데 실측 칩 사이 간격은 8 · 8 · 12(가운데 값 8). §4.0 은 "초안을 쓰기 전에 고정"하는 표라 이 판은 손대지 않았다. 그대로 두면 실측 쪽으로 쓴 `DESIGN.md` 가 그 축에서 떨어진다 | 스킬 초안을 쓰기 전에 기획 레인 · 오너가 범위를 고칠지 정한다(행간 18~21 · B2C 컨트롤 사이 8 이상 등) |
| U22 | SaaS 실측 표본이 개발자 도구(GitHub · GitLab · Hugging Face)에 치우쳤다. 대시보드 · CRM 형 SaaS 는 로그인 없이 열리는 제품 화면을 찾지 못했다 | 공개 데모 계정이 있는 대시보드형 SaaS 를 찾아 같은 방법으로 잰다 |
| U23 | 실측은 서비스마다 2026-11-16 에 한 번씩, 한국 로캘로 쟀다. A/B 실험 · 지역판 차이(Airbnb 는 한국판으로 넘어갔다)를 가르지 못한다. 프리셋의 "실측 n/m"은 잰 m 곳 중 n 곳이 그랬다는 뜻이고, 2곳뿐인 칸(국내 · 해외로 갈린 축)은 범위로만 읽는다 | 다른 날 · `en-US` 로캘로 한 번 더 재서 같은 칸이 유지되는지 본다 |

이번 판에서 닫힌 것: Antigravity 의 `chrome-devtools` 도달(받지 않는다 — H17) · `DESIGN.md` 형식이 모르는 절을 오류로 보는가(보존한다 — S1. 근거 표를 별도 파일에 두는 결정은 그대로다) ·
옛 U1 SLDS 2 값(npm 토큰 패키지로 확인 — §1.5) · 옛 U2 Astryx 토큰 값과 쓸 컨셉(SaaS — §1.5. 에이전트용 CLI · MCP 의 동작은 이 스킬이 쓰지 않아 확인하지 않았다) ·
옛 U10 Polaris 글자 조합(`text.ts` — §1.5) · 커머스 · B2C 의 `[가정]` 칸 대부분(유사 서비스 실측 — `979-benchmark.md`).

---

## 7. 구현 레인에 넘길 브리프

필드 값 중 이슈에 없던 것은 이 문서가 채운 가정이다.

```xml
<objective>
  설치자가 서비스 컨셉에 맞는 디자인 시스템을 DESIGN.md 로 받고, 그것이 shadcn/ui 또는 daisyUI 테마와
  앱 안 /design-system 페이지로 이어지게 하는 번들 스킬 service-design-system 을 opt-in 으로 낸다.
  판정 기준: docs/plans/979-design-system-plan.md §4.6 의 AC1~AC11. 순서: 증분 0(§4.0) → "낸다"일 때만 증분 1.
</objective>
<inputs>
  docs/plans/979-design-system-plan.md(§4 가 범위의 SSOT) · 커밋 c8bf7b1(같은 배선의 전례) ·
  상류 shadcn 스킬의 design-system.md · design-system-page.md(읽기 전용 참조).
</inputs>
<invariants>
  룰 · 훅 · 앵커 · src/manifest.ts · package.json files 를 건드리지 않는다. 설치기 코드를 새로 쓰지 않는다.
  templates/** 에 이 리포의 이슈 · ADR 번호 · 홈 경로를 넣지 않는다. 상류 스킬 내용을 복사하지 않고 가리킨다.
  프리셋 값은 §4.4 표 그대로, 출처 없는 칸은 [가정] 표시를 유지한다.
</invariants>
<success_criteria>
  증분 0: SKILL.md 와 references/concept-presets.md 초안만 쓴다. AC4 가 §4.0 의 판정 규칙으로 "낸다"가 아니면 멈추고 보고한다.
  증분 1: AC1~AC3 · AC5~AC11. 못 돌린 AC 는 미검증으로 적고, AC11 을 못 돌리면 실측 문구를 뺀다.
</success_criteria>
<boundaries>§4.7 의 항목 · 기본 설치 승격 · Storybook · Claude Design · Figma 는 범위 밖.</boundaries>
<autonomy>스킬 본문의 문장 · 참조 파일 구성은 구현 레인이 정한다. §5 D1~D3 은 오너 결정 뒤에 착수한다.
  §4.0 의 채점 범위와 판정 규칙은 초안을 쓰기 전에 고정된 것이다 — 결과를 보고 바꾸지 않는다.</autonomy>
<verification>V1 · V2 는 구현 레인. V0 · V3 의 과제 묶음과 채점기는 스킬 초안을 쓰지 않은 레인이 만들고,
  오너의 비공개 A/B 실행기에서 돌린다(이 저장소의 컨테이너 게이트로는 못 돈다).</verification>
<output_format>gate / main / branch 를 가른 보고(git-policy §보고 형식) + AC 별 증거 + 미검증 CLI 목록.</output_format>
```
