# Hono · htpy · FastHTML + htmx 스택 트랙 — 조사

> 이슈 #935 · `/deep-research` 결과(2026-11-02). 웹 검색 → 출처 수집 → 주장마다 3표 반박 검증(2표 이상 반박이면 기각) → 종합.
> 출처 22개 · 추출 주장 108개 · 검증 25 · 통과 20 · 기각 5.
> 아래 '결과'는 검증을 통과한 주장이다. '추론'이라 적힌 문장과 리포 관측은 검증 투표 대상이 아니었다.

## 요약

세 스택은 성숙도가 크게 다르다. 판정 기준인 "설치자가 AI 코딩 도구로 더 잘 개발하게 되는가"를 적용하면 결론도 스택마다 다르다. Hono+JSX+htmx는 공식 테스트 도구(testClient)와 서버 JSX 렌더링이 있어 트랙으로 만들 근거가 가장 단단하다. 다만 기존 Fastify 트랙(@kitajs/html)과 템플릿 방식은 같아도 이스케이프 기본값이 정반대다. 그래서 기존 룰 문장을 그대로 옮겨 쓸 수 없고, 룰에는 라우트 체이닝 제약과 Hono 주 버전(v4 안정판, v5는 RC)을 따로 적어야 한다. FastAPI+htpy+htmx는 htpy가 PyPI Beta이고 실질적으로 관리자 1인이며, 2025–2026년에 예외를 던지는 파괴적 변경이 세 번 있었고 최근 5개월간 릴리스가 없다. 그래서 독립 트랙보다는 기존 ssr-htmx 룰에 선택 절로 넣는 쪽이 위험이 작다(추론). FastHTML은 0.x 버전에서 마이너 판이 import를 깨고(0.14.0), README가 직접 "LLM이 쓸모 있는 답을 못 한다"며 113 KB짜리 llms-ctx.txt를 내놓는다. 상주 룰로 품질을 보장하기 어려우므로 보류하거나, 벤더 문서를 가리키는 스킬·참조 수준으로만 다루는 쪽이 낫다(추론). 세 스택 모두에 걸리는 위험이 하나 있다. htmx 4.0이 2026-08-28 안정판으로 나왔고 4xx/5xx 응답 swap, 명시적 상속, hx-disable 의미 변경 같은 조용한 의미 변화가 있다. 따라서 기존 두 htmx 룰을 포함한 모든 htmx 룰이 어느 주 버전을 대상으로 하는지 밝혀야 한다.

## 결과

### 1. (high · 투표 3-0 ×3 (claims 16·17·18))

[공통·최우선 위험] htmx 4가 안정판으로 출시됐다(4.0.0 2026-08-28, 4.0.1 2026-11-01). htmx 2 시절 학습 데이터로 쓴 코드가 오류 없이 다르게 동작한다. 바뀐 점은 네 가지다. (a) 속성 상속이 명시적으로 바뀌어 `:inherited` 수식자가 있어야 상속된다(되돌리려면 `htmx.config.implicitInheritance=true`). (b) 4xx/5xx 응답도 swap한다. 기본 noSwap이 [204,304]이고, 되돌리려면 `[204,304,'4xx','5xx']`로 설정하며, `responseHandling`은 `hx-status`로 대체됐다. (c) `hx-disable`이 예전 `hx-disabled-elt` 역할을 하고, 처리 건너뛰기는 `hx-ignore`로 옮겨 갔다. v4.0.1 소스에서는 값 없는 `hx-disable`이 오류 없이 아무 일도 하지 않는다. (d) `hx-vars`는 `hx-vals`의 `js:` 접두사로 바뀌었고 `hx-params`·`hx-request`·`hx-inherit`·`hx-disinherit`는 제거됐다. 반면 npm `latest`는 아직 2.0.11이고 4.x는 `next` 태그라서, 버전을 고정하지 않고 설치하면 아직 htmx 2가 깔린다. 세 신규 트랙과 기존 두 htmx 룰 모두 대상 주 버전을 룰에 명시해야 한다.

- 근거: 3건 모두 3-0. 검증자가 공식 문서 문구를 그대로 대조했고, v4.0.1 소스에서 hx-vars/hx-params/hx-request/hx-disinherit/hx-disabled-elt가 0회 등장하는 것과 `if (!hxDisable) return;`를 확인했다. 원 claim에 인용된 URL(four.htmx.org/migration-guide-htmx-2)은 htmx 1→2 가이드로 301 리다이렉트되는 잘못된 출처라서, 출처를 /docs·/whats-new-in-htmx-4로 바꿨다.
- 출처: https://four.htmx.org/docs · https://four.htmx.org/whats-new-in-htmx-4 · https://raw.githubusercontent.com/bigskysoftware/htmx/v4.0.1/src/htmx.js · npm view htmx.org (dist-tags: latest 2.0.11, next 4.0.1)

### 2. (high · 투표 3-0 ×2 (claims 1·2))

[Hono 룰: 테스트] Hono에는 1st-party 타입 테스트 도구 `testClient`(`hono/testing`, hono 패키지 내장 subpath export)가 있다. 그래서 룰에 서드파티 없이 테스트 방식을 지정할 수 있다. 다만 라우트 타입은 Hono 인스턴스에 메서드를 체이닝해 정의할 때만 추론된다. `app.get(...)`을 별도 문장으로 쓰거나 서브앱 `.route()`를 체이닝하지 않으면 타입이 빠진다. Vitest는 기본으로 타입 검사를 하지 않으므로, 이 손실은 테스트 파일을 tsc로 검사하지 않을 때만 조용히 넘어간다. 룰 문안은 '라우트(서브앱 마운트 포함)를 체이닝하고 그 결과의 `typeof`를 export한다'로 적고, 러너(vitest·bun test)는 따로 필요하다고 쓴다.

- 근거: claims 1·2 모두 3-0이다. 공식 문서 문구가 'you must define your routes using chained methods directly on the Hono instance'와 일치하고, npm 4.13.16의 ./testing export도 확인했다.
- 출처: https://hono.dev/docs/helpers/testing · https://hono.dev/docs/guides/rpc · npm view hono exports (4.13.16, ./testing)

### 3. (medium · 투표 2-1 (claim 3))

[Hono 룰: 템플릿·보안] hono/jsx는 서버 렌더링을 주 용도로 안내한다. `c.html()`이 async 컴포넌트를 자동으로 await한다. 서버 JSX라는 템플릿 방식은 기존 ssr-htmx-fastify 트랙(@kitajs/html)과 같지만 XSS 기본값은 정반대다. @kitajs/html은 속성만 이스케이프하므로 자식에 `safe`를 붙이고 `@kitajs/ts-html-plugin` xss-scan을 돌려야 한다. Hono는 자식을 기본으로 이스케이프한다. 대신 CVE-2026-24771(ErrorBoundary 출력이 기본 이스케이프를 우회)이 있다. Suspense/ErrorBoundary는 API가 다르고 Experimental이며, 스트리밍 API도 `renderToReadableStream`과 `renderToStream`으로 다르다. 그래서 '서버 JSX 계열'로 묶을 수는 있어도 Fastify 룰의 XSS·린트 지침을 Hono에 그대로 복사하면 안 된다.

- 근거: 2-1 표결이다. 첫 두 문장은 공식 문서와 일치한다. '같은 방식'은 저자의 추론이고, 검증자가 리포 룰과 kitajs README로 템플릿 층위에서만 성립함을 확인했다. 2차 출처의 CVE-2026-93981(4.13.7 수정)은 공식 권고와 대조하지 못해 제외했다. tsconfig `jsxImportSource: hono/jsx` 설정을 반드시 룰에 넣어야 한다는 별도 claim은 1-2로 기각됐다.
- 출처: https://hono.dev/docs/guides/jsx · templates/rules/htmx-fastify-ui.md (line 9, @kitajs/html 예시) · @kitajs/html README · CVE-2026-24771

### 4. (high · 투표 3-0 (claim 0))

[Hono 버전] Hono v5에서는 런타임 어댑터가 `hono/<runtime>`에서 빠져 `@hono/*` 패키지로 분리된다(aws-lambda·bun·cloudflare-workers·deno·lambda-edge·netlify·service-worker·vercel). `hono/cloudflare-pages`는 대체 없이 제거된다. 하지만 v5는 아직 RC(5.0.0-rc.1, 2026-10-10)이고 npm `latest`는 4.13.16(2026-11-01)이다. 그러므로 v4 시절 import가 실패하는 것은 v5를 채택한 프로젝트에 한한다. 룰은 대상 주 버전을 밝히거나 v5 GA 이후에 갱신해야 한다. 'v5는 ESM 전용이고 Node 22.12 이상이 필요하다'는 별도 claim은 0-3으로 기각됐으므로 룰에 넣지 않는다.

- 근거: 3-0. 검증자가 gh api로 MIGRATION.md 109–132행을 직접 읽었고, @hono/bun 등 패키지가 2026-10-08에 게시된 것을 npm에서 확인했다. RC 단계라 GA 전에 바뀔 수 있다.
- 출처: https://github.com/honojs/hono/blob/v5.0.0-rc.1/docs/MIGRATION.md · npm dist-tags hono (latest 4.13.16, next 5.0.0-rc.1)

### 5. (high · 투표 3-0 ×3 (claims 4·5·6))

[htpy 성숙도] htpy는 PyPI에서 'Development Status :: 4 - Beta'로 분류돼 있다. 등록 관리자는 1인(Andreas Pelme)이고, 커밋도 pelme 318, 다음 기여자 15로 한 사람에게 쏠려 있다. 버전은 calver이며 2023-10-29(23.0) 이후 릴리스가 60개다. 최신은 26.5.1(2026-05-22)이고, 25.12.0 뒤 약 5.7개월 공백이 있었으며 지금까지 다시 약 5.4개월째 릴리스가 없다(GitHub 커밋도 같음). 예외를 던지는 변경이 이어졌다. 25.7.0은 제너레이터를 두 번 렌더하면 RuntimeError를 낸다(예전에는 조용히 빈 출력이었다). 25.10.0은 `div('.foo bar')`에 ValueError를 낸다. 26.5.0은 id/class 단축 표기의 공백에 FutureWarning을 냈고, 약 75분 뒤 26.5.1에서 ValueError로 바뀌었다. 이 때문에 예전에 통하던 `'#a '`·`'.a '`도 이제 실패한다. 26.5 이전 데이터로 학습한 에이전트 코드는 런타임에 실패할 수 있다.

- 근거: claims 4·5·6 모두 3-0이다. 검증자가 PyPI JSON의 릴리스 60개, 날짜, 분류자와 GitHub PR·contributors API를 직접 대조했다. 한계는 세 가지다. Beta 분류는 저자가 스스로 다는 약한 신호다. 26.5.x의 PR 작성자에 StabbarN이 있어 코드 수준 버스 팩터는 엄밀히 1이 아니다. '학습 데이터 때문에 실패한다'는 출처가 말한 것이 아니라 추론이다.
- 출처: https://pypi.org/project/htpy/ · https://pypi.org/pypi/htpy/json · https://github.com/pelme/htpy/releases · pelme/htpy PR #142 · #153 · #176 · #177, issue #152

### 6. (high · 투표 3-0 (claim 9) · 2-1 (claims 7·8))

[htpy 룰 내용] (a) 응답: 1st-party `htpy.starlette.HtpyResponse`가 있다(25.12.0부터, 문서 제목은 'Starlette/FastAPI'). 핸들러는 이 객체를 직접 반환한다. 이 클래스는 StreamingResponse를 상속하므로 Content-Length가 없고, 렌더 도중 예외가 나면 200 헤더가 이미 나간 뒤라 HTML이 잘린다. 일반 `HTMLResponse(el)`도 유효한 대안이다. 이 도우미는 2025-12에 생겨 학습 데이터에 없을 가능성이 크므로 룰에 이름을 적을 가치가 있다. `response_class=HtpyResponse`로 쓰면 첫 인자가 `node`라 실패할 것으로 보이지만 검증자가 실행해 보지 않았다. (b) 속성 문법: `hx_post=`는 `hx-post`로 바뀐다. 키워드 인자로 넘길 때 class/for(파이썬 예약어 전반)는 `class_`·`for_`로 쓴다. `@click.shift`처럼 식별자가 아닌 이름은 dict로 넘긴다. dict 키는 밑줄이 하이픈으로 바뀌지 않으므로 `{'hx_post': ...}`는 변환되지 않는다. 클래스는 `.a.b` 단축 표기를 쓰되 공백을 넣지 않는다. (c) 린트: htpy 템플릿은 평범한 파이썬이므로 mypy/pyright가 데이터·컴포넌트 오류(예: 없는 속성 접근)를 잡는다. 다만 hx-* 같은 HTML 속성의 유효성은 검사하지 않는다. Jinja 쪽 타입 검사기(typja 0.1.3 Beta)는 아직 초기 단계라, 'Jinja 룰에는 없는 타입 검사 단계'라는 대비는 실질적으로 성립한다.

- 근거: HtpyResponse(claim 9)는 3-0, 속성 문법(claim 8)은 2-1, 타입 검사(claim 7)는 2-1이다. claim 8은 인용 URL이 틀렸다(/static-typing/에는 해당 문구가 없고 /usage/에 있다). 검증자가 _elements.py의 `_python_to_html_name`으로 변환 규칙을 확인했다. 'htpy가 Jinja를 대체하므로 Jinja 룰이 그대로 적용되지 않는다'는 claim은 0-3으로 기각됐으므로, htpy와 Jinja를 배타적으로 다루는 근거로 쓰지 않는다.
- 출처: https://htpy.dev/how-to/starlette/ · https://htpy.dev/usage/ · https://htpy.dev/static-typing/ · pelme/htpy src/htpy/starlette.py · src/htpy/_elements.py

### 7. (high · 투표 3-0 ×3 (claims 10·11·13))

[FastHTML 성숙도·API 변동] FastHTML은 0.x(최신 0.14.17, 2026-10-30)이지만 활발히 유지된다. 2026-02-20부터 10-30 사이 GitHub 릴리스가 약 30개이고, PyPI 누적 146개, 스타 7,061개다. 다만 릴리스는 몰아서 나오고 47일 공백도 있었다. 마이너 판이 파괴적 변경을 낸다. 0.14.0(2026-05-10)은 `fasthtml.common` star-import에서 uvicorn·apswutils Database·fastlite·pico를 뺐다. 그래서 `from fasthtml.common import *`로 Card/Grid/Database를 쓰던 튜토리얼 코드는 NameError가 난다. fastlite는 런타임 의존성이 아니라 `dev` extra에만 있어 따로 `pip install fastlite`해야 한다. README는 여전히 star-import를 가르치고, 문서가 미완이니 소스·노트북을 읽으라고 스스로 경고한다.

- 근거: claims 10·11·13 모두 3-0이다. 검증자가 태그별 common.py를 대조해 네 줄이 사라진 것을 확인했다. '마이너에서 깬다'는 0.13→0.14 한 사례에 근거하므로 빈도는 재지 않았다.
- 출처: https://github.com/AnswerDotAI/fasthtml/releases · https://github.com/AnswerDotAI/fasthtml (README line 88) · https://pypi.org/pypi/python-fasthtml/json · fasthtml/common.py @0.13.3 vs @0.14.0/0.14.17, pyproject.toml @0.14.17

### 8. (high · 투표 3-0 ×2 (claims 12·19))

[FastHTML과 AI 에이전트] FastHTML README가 'Cursor·ChatGPT·Claude·Copilot은 FastHTML에 대해 쓸모 있는 답을 못 준다'고 스스로 밝히고, 해결책으로 LLM용 컨텍스트 파일 https://www.fastht.ml/docs/llms-ctx.txt 를 제공한다(HTTP 200, 113,101 B, 2026-10-28 갱신, llms.txt에서 자동 생성). 이 파일은 Antigravity 상한 24,000 B와 Codex 합계 32 KiB 상한을 크게 넘으므로 AGENTS.md에 인라인할 수 없다. 현실적인 방법은 이 파일을 가리키거나 상주 밖 스킬·참조로 두는 것이다. 템플릿 방식은 Jinja가 아니라 FT(FastTag)다. `Div`·`P` 같은 대문자 태그 함수에서 위치 인자는 자식, 키워드 인자는 속성이 되고, `hx_` 키워드 인자는 htmx 속성이 된다. 그러므로 룰도 FT와 hx_ 규약을 다뤄야 한다. 템플릿 층은 금지가 아니라 제공되지 않는 것이며, Starlette Jinja2Templates를 직접 호출할 수는 있다.

- 근거: claims 12·19 모두 3-0이다. 검증자가 curl로 크기와 갱신일을 실측했다. 'LLM이 못 답한다'는 2024년 출시 당시 메인테이너의 진술이고, 2026년 모델에서 지금도 그런지는 검증하지 않았다.
- 출처: https://github.com/AnswerDotAI/fasthtml (Getting help from AI) · https://www.fastht.ml/docs/llms-ctx.txt · https://fastht.ml/about/components

### 9. (high · 투표 3-0 ×2 (claims 14·15))

[FastHTML은 htmx 주 버전이 둘] PR #881(2026-08-10 머지)로 `fast_app(htmx4=True)` 또는 `FastHTML(htmx4=True)`를 켜면 htmx 4(htmx.org@4.0.0)를 쓴다. 기본값은 0.14.17 기준으로 여전히 htmx 2다. htmx4 모드에서 바뀌는 점은 다음과 같다. ws 속성은 `ws_connect`·`hx_ext='ws'`에서 `hx_ws_connect`(hx_ext 없음)로 바뀌고, WS 데이터는 `data['msg']`에서 `data['values']['msg']`로 바뀐다. 핸들러 인자는 `hx_trigger`에서 `hx_source`로 바뀐다(HTML 속성 hx-trigger 자체는 그대로다). 상속은 `_inherited`로 명시해야 한다. FastHTML은 `metaCharacter='-'`를 설정하므로 JS 이벤트가 htmx 일반 표기(`htmx:before:request`)가 아니라 대시 구분(`htmx-before-request`)이 된다. 그래서 FastHTML 룰은 대상 주 버전과 함께 이 FastHTML 고유 표기까지 밝혀야 한다. hx_swap_oob·sse_message·HtmxHeaders처럼 양쪽에서 그대로 동작하는 것도 있고, 공식 호환성 검사 스크립트(htmxv4_migration/htmx_compat_checker.py)가 있다.

- 근거: claims 14·15 모두 3-0이다. 검증자가 gh pr view와 0.14.17 태그 코드의 기본값을 직접 확인했다. '10월 말부터 htmx4 API를 추가하기 시작했다'는 별도 claim은 0-3으로 기각됐다(지원은 8월에 이미 머지됐다).
- 출처: https://github.com/AnswerDotAI/fasthtml/pull/881 · htmxv4_migration/fasthtml_htmxv4_migration.md (main) · fasthtml/core.py @0.14.17 (def_hdrs htmx4=False, htmx4src 4.0.0)

### 10. (low · 투표 n/a (종합 추론))

[트랙 구성안: 추론] 검증된 사실에서 다음 구성이 도출된다. ① Hono+JSX+htmx는 새 트랙으로 추가하는 것을 우선 검토한다. 템플릿 방식(서버 JSX)은 ssr-htmx-fastify와 같아서 '확장'도 가능해 보인다. 그러나 이스케이프 기본값, 테스트 도구(testClient와 체이닝 제약), 런타임 어댑터가 모두 달라서 한 룰에 두 프레임워크를 넣으면 문장 대부분이 분기된다. 기존 트랙 id `ssr-htmx-fastify`를 그대로 두면 설치 기록 호환이 깨지지 않는다. ② FastAPI+htpy+htmx는 독립 트랙보다 기존 ssr-htmx(htmx-fastapi-ui) 룰에 htpy 선택 절을 넣는 쪽을 권한다. FastAPI·htmx 부분은 공통이고, htpy는 Beta·1인 관리·파괴적 변경 이력이 있어 위저드 선택지를 늘릴 만큼 단단하지 않다. 'htpy가 Jinja를 배타적으로 대체한다'는 claim은 기각됐으므로 둘이 공존할 수 있다고 본다. ③ FastHTML은 보류하거나 스킬 수준으로 둔다. 마이너 판 import 파괴, 미완 문서, htmx 2/4 이중 모드가 겹쳐 우리 룰이 빨리 낡는다. 벤더가 관리하는 llms-ctx.txt(113 KB)가 우리 룰보다 최신을 유지한다. 그래서 상주 룰 대신 그 문서를 가리키는 쪽이 판정 기준에 더 맞다. ④ 예산: 현행 htmx 룰 실측 크기는 htmx-fastify-ui 741 B, htmx-fastapi-ui 1,505 B다. 같은 규모의 Hono 룰 하나나 htpy 절 하나는 24,000 B 상한에서 작은 몫이다. 다만 현재 트랙별 AGENTS.md 합계를 재지 않았으므로 여유는 미확정이다.

- 근거: 검증 표결을 거친 claim이 아니다. 앞 findings를 종합한 판단과 리포 실측 두 가지(트랙→룰 매핑, 룰 바이트 수)를 근거로 한다. 위저드 선택지 수와 설치 기록 트랙 id 호환 경로(rename/alias 처리)는 코드로 확인하지 않았다.
- 출처: src/manifest.ts:125-126 ("ssr-htmx": ["htmx-fastapi-ui"], "ssr-htmx-fastify": ["htmx-fastify-ui"]) · wc -c templates/rules/htmx-fastify-ui.md (741) · htmx-fastapi-ui.md (1505), 2026-11-02 실측 · 위 findings 1–9

## 한계

1. 시점 민감성이 크다. Hono v5는 RC(5.0.0-rc.1)라서 GA 전에 어댑터 분리 내용이 바뀔 수 있다. htmx 4.x는 npm `next` 태그이므로 `latest`가 4로 넘어가는 순간 버전을 고정하지 않은 설치자가 한꺼번에 영향을 받는다. FastHTML은 며칠 간격으로 릴리스하므로 이 보고서의 FastHTML 사실은 몇 주 안에 낡을 수 있다(측정일 2026-11-02).
2. 출처 결함을 보정했다. htmx 4 claim 3건은 잘못된 URL(four.htmx.org/migration-guide-htmx-2는 v2 가이드로 301된다)을 인용했다. 실제 근거는 /docs·/whats-new-in-htmx-4·v4.0.1 소스다. htpy 속성 문법 claim은 /static-typing/이 아니라 /usage/가 출처다.
3. 2-1 표결 두 건은 medium으로 다뤘다. 'Hono JSX가 kitajs와 같은 방식'이라는 주장은 템플릿 층위에서만 성립하고 보안 지침에서는 반대다. 'mypy를 htpy 린트로 쓴다'는 주장은 파이썬 데이터 검사에 한정되고 HTML 속성 유효성은 검사하지 않는다.
4. 기각된 claim은 근거로 쓰지 않는다. Hono v5가 ESM 전용이고 Node 22.12 이상을 요구한다는 것, hono/jsx tsconfig 필수 설정, 'htpy가 Jinja를 대체한다', FastHTML htmx4 API가 10월 말에 시작됐다는 것이 여기에 해당한다. 특히 tsconfig 설정이 룰에 필요한지는 기각됐을 뿐 반증된 것이 아니므로 미정이다.
5. CVE-2026-93981(Hono Suspense/ErrorBoundary 이스케이프, 4.13.7 수정)은 2차 출처에만 있고 공식 권고와 대조하지 못했다.
6. 질문 ②(트랙 id 호환·위저드 선택지 수)와 ④(AGENTS.md 예산)는 검증 대상 claim에 없었다. 마지막 finding은 리포 실측 두 가지와 추론을 근거로 한 low confidence다.
7. 'AI 에이전트가 학습 데이터 때문에 틀린다'는 진술은 모두 릴리스 날짜에서 나온 추론이다. 2026년 모델로 실제 생성 실패를 관측한 근거는 없다.
8. 공식 스킬·MCP 존재 여부(Hono·htpy·FastHTML)는 조사됐으나 검증을 통과한 claim이 없다. 확인된 것은 FastHTML의 llms-ctx.txt뿐이다.

## 열린 질문

- 기존 htmx 룰 두 개(htmx-fastapi-ui·htmx-fastify-ui)가 지금 htmx 2를 전제하는가? htmx 4 안정판 출시(2026-08-28)에 맞춰 대상 주 버전을 명시하는 수정이 신규 트랙보다 먼저 필요한가?
- Hono를 새 트랙(id 신설)으로 넣을 때와 ssr-htmx-fastify를 'server-JSX htmx' 트랙으로 넓혀 프레임워크를 분기할 때, 위저드 선택지 수와 설치 기록 트랙 id 호환(rename·alias 필요 여부)은 각각 어떻게 달라지는가? src/manifest.ts와 설치 기록 판독 경로에서 확인해야 한다.
- Codex·OpenCode에서 AGENTS.md에 룰이 인라인될 때, 해당 트랙 조합의 현재 합계 바이트는 24,000 B(Antigravity)와 32 KiB(Codex 합계)에 대해 얼마나 여유가 있는가? npm run cost:report로 트랙별로 실측해야 한다.
- Hono·htpy·FastHTML에 공식 llms.txt·MCP 서버·Agent Skill이 있는가? 특히 hono.dev/llms.txt와 htpy 문서의 LLM용 산출물 존재 여부가 확인되지 않았다.

## 기각된 주장(0-3 등)

- (0-3) Hono v5 (at v5.0.0-rc.1, a prerelease published 2026-10-10; stable v4.13.16 is still current as of 2026-11-01) is a breaking major: the package is ESM-only with the CommonJS build removed, and Node.js 22.12 or later is required. An AI agent trained on v4 code that writes a CJS or older-Node Hono setup will produce something v5 no longer accepts. — https://github.com/honojs/hono/blob/v5.0.0-rc.1/docs/MIGRATION.md
- (1-2) Using hono/jsx for server-rendered HTML takes tsconfig settings (jsx: react-jsx, jsxImportSource: hono/jsx), or deno.json on Deno, or a per-file pragma. A rule for a Hono+JSX+htmx track has to name this setup, because an agent that assumes React's JSX runtime will set it up wrong. — https://hono.dev/docs/guides/jsx
- (0-3) htpy has added built-in async rendering and a Starlette response helper, `htpy.starlette.HtpyResponse`, which makes it usable with FastAPI as of release 25.12.0 (2025-12-01). Earlier code examples or model training data from before December 2025 will not show this integration. — https://github.com/pelme/htpy/releases
- (0-3) htpy writes HTML in plain Python instead of a template language, so it replaces Jinja templates rather than sitting alongside them. A rule written for the Jinja-based ssr-htmx track would not apply directly. — https://pypi.org/project/htpy/
- (0-3) FastHTML started adding htmx 4-specific APIs in late October 2026: a new Partial component, hx-partial toasts, htmx4 headers and an htmx4 indicator option. Its htmx surface is still moving, so a rule for this stack would need to name the htmx major version it targets. — https://github.com/AnswerDotAI/fasthtml/releases

## 수집한 출처

- https://github.com/honojs/hono/blob/v5.0.0-rc.1/docs/MIGRATION.md
- https://hono.dev/helpers/testing
- https://hono.dev/docs/guides/jsx
- https://github.com/pelme/htpy/releases
- https://pypi.org/project/htpy/
- https://htpy.dev/static-typing/
- https://htpy.dev/how-to/starlette/
- https://github.com/AnswerDotAI/fasthtml/releases
- https://github.com/AnswerDotAI/fasthtml
- https://github.com/AnswerDotAI/fasthtml/pull/881
- https://four.htmx.org/migration-guide-htmx-2
- https://www.mattcollins.net/2024/09/fasthtml-the-perfect-framework-for-simple-ai-powered-web-apps
- https://fastht.ml/about/components
- https://four.htmx.org/migration-guide-htmx-4/
- https://four.htmx.org/announcements/2026-08-28-htmx-4.0.0-is-released
- https://github.com/bigskysoftware/htmx/tree/v4.0.0/dist/skills
- https://github.com/honojs/skills
- https://hono.dev/llms.txt
- https://fastht.ml/docs/llms.txt
- https://four.htmx.org/llms.txt
- https://github.com/fastapi/fastapi/blob/master/fastapi/.agents/skills/fastapi/SKILL.md
- https://github.com/pelme/htpy

## 결정 (2026-11-03, 사용자)

- **Hono = 새 트랙 `ssr-htmx-hono`** — 화면 룰 `htmx-hono-ui`(`paths:` = `**/*.tsx` · `**/*.jsx`). 기존 `ssr-htmx-fastify` id 는 그대로 둔다.
- **htpy = 쓰지 않는다** — 룰 절도 트랙도 두지 않는다.
- **FastHTML = 보류.**
- **htmx 주 버전 확인 줄 = 모든 htmx 룰**(`htmx-fastapi-ui` · `htmx-fastify-ui` · `htmx-hono-ui`)에 같은 뜻으로 넣는다.

### 구현 때 확인한 것 (#935, 2026-11-03)

- 위 한계 5 해소: CVE-2026-93981 은 공식 권고 GHSA-hxh3-vqpv-xpqv(4.13.7 수정 — Suspense · ErrorBoundary · 단일 자식 Context.Provider 의 문자열 자식)로, CVE-2026-24771 은 GHSA-9r54-q6cx-xmh5(4.11.7 수정 — 동기 ErrorBoundary)로 확인했다. 룰에는 뒤 판을 포함하는 4.13.7 만 적었다.
- 기각 주장 정정: "v5 는 ESM 전용 · Node 22.12 이상"(0-3 기각)은 hono.dev 공식 "Migrating to v5" 에 그대로 적혀 있다. 룰에는 넣지 않았다(v5 는 RC 라 어댑터 분리만 적었다).
- 이스케이프 · testClient 타입 · `@shadcn/lint` 는 Docker 스파이크로 실측했다 — `docs/plans/935-spike/run.sh`. `class` 속성 위반(원색 · 임의 값 · 없는 클래스)과 객체 `style` 은 잡고, 문자열 `style="…"` 은 놓친다.
- AGENTS.md 렌더(세 CLI · 빈 스캐폴드, `tests/agents-md-size-budget.test.ts` 와 같은 방법, Antigravity 상한 24,000 B): ssr-htmx 22,795 · ssr-htmx-fastify 22,066 · ssr-htmx-hono 22,739 · full 23,007. **`full` 과 htmx 트랙을 함께 고르면 넘는다** — full+ssr-htmx 24,698(이 변경 전에도 24,438) · full+ssr-htmx-hono 24,642 · full+ssr-htmx-fastify 23,969.
