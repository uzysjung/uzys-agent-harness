# ADR-028: wizard — 방법론 번들 단일 row + Dev 페이지 분할

- Status: Accepted
- Date: 2026-07-17
- PR: #204
- Supersedes: 없음 (ADR-022 의 generic `--with <id>` 표면은 불변)

## Context

사용자 지적(2026-07-16): *"내가 만든 스킬이나 커맨드 … 쌓이다 보니 너무 많아서 선택 row 를 너무 많이 차지한다. 필수로 설치되어야 하는 것들은 묶어서 설치 패키지화 하고 선택도 구분에 따라 좀 묶자."*

**실측(추정 금지)** — uzys 1st-party 자산 11개(dev-method 8 + gemini-consult + tauri-desktop + ecc-prune). wizard 표시 행수(옵션 + 카테고리 헤더):

| 페이지 | 행수 |
|---|---|
| **Dev** (frontend·backend·dev-tools·data·understanding) | **37** |
| Workflow & ECC | 13 |
| Visual & Media | 10 |
| Business | 9 |

**핵심 발견 — 코드가 자기 제약을 위반 중이었다.** `prompts.ts` 는 페이지 묶음의 근거를 *"clack groupMultiselect 의 maxItems 한계(페이지당 옵션 ≤ ~30)를 우회"* 라고 명시한다. 그런데 Dev 페이지는 **37행**이다. 터미널을 넘겨 스크롤이 생기는 것이 사용자가 보고한 "row 가 너무 많다"의 **실제 메커니즘**이다. v26.98.0(harness-health-audit)이 dev-tools 를 10→11 로 밀어 이 초과를 키웠다 — 즉 원인 제공자가 본 ADR 을 쓴다.

**사용자 가설의 부분 반박(정직 보고)**: "내 스킬이 row 를 많이 차지한다"는 **부분적으로만** 맞다. Dev 32항목 중 dev-method 는 **4개뿐**이다. 번들링만 하면 37→**33** 으로 **여전히 30 초과**(번들 row 는 `workflow` 에 렌더되므로 Dev 는 4행을 잃고 0행을 얻는다: 37-4=33). 진짜 원인은 Dev 페이지가 **5개 카테고리를 한 장에 몰아넣은 것**. 이 측정을 사용자에게 제시했고, 사용자는 **"번들 + Dev 분할"** 을 선택했다(2026-07-16).

> 정정(SOD 리뷰 Nit #2): 본 절 초안은 이 값을 **34** 로 적었다. 최초 측정 스크립트가 번들 row 가 Dev 페이지에 남는다고 가정(`37 - (4-1)`)한 추론값이었고, 실제 렌더는 33 이다. **"실측(추정 금지)" 라 표방한 절에 추론값이 들어간 것** — 본 repo 가 가장 경계하는 유형(`harness-health-audit` A1 "값을 추측하지 말고 읽어라")이라 명시 기록한다. 결론(33 > 30 → 분할 필요)은 불변이며, 페이지 분할 되돌림 RED 실증이 33 을 독립 확인했다.

## Decision

**ⓐ dev-method 8종을 wizard 단일 번들 row 로 접고, ⓑ Dev 페이지를 2장으로 분할한다.**

- **번들 = 순수 표현 계층.** `collapseDevMethodBundle`(입력) / `expandDevMethodBundle`(제출) 로 접고 펼친다. downstream(`computeUserOverride`·installer·설치 보고)은 **개별 8개 asset id 를 그대로** 본다 → **번들이 "무엇이 설치되는지" 를 숨기지 않는다**(사용자 요구 가드). hint 에 구성원 id 8개 전부 노출.
- **구성원은 `DEV_METHOD_SKILL_IDS` 에서 derive.** 하드코딩 금지 — 자산 추가 시 자동 반영(no-false-ship "2곳 이상 하드코딩 → derive 또는 게이트").
- **번들 위치 = `workflow` 카테고리.** 방법론 = 개발 사이클 도구. dev-tools 에 있던 4종(multi-persona-review·gap-analysis-e2e·ultracode-service-audit·harness-health-audit)도 번들에 흡수되어 개별 row 로 렌더되지 않는다. **자산의 `category` 필드 자체는 불변** — 표현만 바뀐다(카탈로그·문서·`--with` 표면 무영향).
- **해제 시맨틱 = 8종 전부 제외** (사용자 확정 2026-07-16). 체크박스 1개 = 의미 1개. 개별 예외는 `--with <id>` / `--without <id>`.
- **페이지 분할**: Dev → `Dev Core`(frontend+backend+data, 20행) + `Dev Tools`(dev-tools+understanding, 13행). 전 페이지 ≤30 달성 (실측 렌더: 20/13/9/10/10, 총 69→62행).
- **행수 상한을 게이트로 못박는다** (`tests/wizard-bundle.test.ts`, MAX_ROWS=30). 주석 경고는 차단 수단이 아니다 — 이번 초과가 그 증거(제약이 주석으로만 있어 37행까지 감).

## Alternatives

- **번들만 (사용자 원 요청 그대로)** — 기각(사용자 결정). Dev 34행으로 **한계 미해결** → 사용자가 겪은 터미널 넘침이 그대로 남는다. RED 실증으로 확인: 분할을 되돌리면 게이트가 "33행 — 상한 30 초과"로 fail.
- **Dev 분할만** — 기각. 한계는 풀리나 사용자가 요청한 "필수 항목 패키지화" 미실행 → 방법론 8행이 계속 지면 점유.
- **해제 시 하위 8개 펼쳐 개별 선택** — 기각(사용자 결정). clack `groupMultiselect` 가 동적 펼침을 지원하지 않아 별도 페이지 + 상태 전이가 필요 → 복잡도 증가하고 row 절감 효과도 반감.
- **자산의 `category` 를 실제로 바꿔 한 곳에 모으기** — 기각. 카탈로그 SSOT·`gen:compat` 문서·wizard-page-parity 가 전부 category 를 읽는다. 표현 문제를 데이터 변경으로 풀면 표면이 넓어진다(Rule 3 surgical).
- **번들을 새 카테고리(`uzys-method`)로 신설** — 기각. CATEGORIES·CATEGORY_TITLES·페이지·parity 테스트·gen:compat 을 전부 건드리는데, 얻는 것은 헤더 한 줄뿐이고 오히려 +1 행.

## Consequences

- **긍정**: 전 페이지가 터미널에 fit(≤30) → 사용자가 보고한 증상의 **실제 원인** 해소. 기본설치라 사실상 선택이 아니던 8행이 1행으로 축약되어, 진짜 선택(서드파티 큐레이션)이 지면을 되찾음 — Workflow 페이지에서 superpowers·bmad·openspec 등이 한눈에 보인다. downstream 계약 불변이라 installer/보고/문서/`--with` 표면 무영향.
- **드리프트 차단**: 구성원 = `DEV_METHOD_SKILL_IDS` derive. 행수 상한 = 게이트(자산이 늘면 fail). **all-or-none 불변식 게이트** — 접기가 "멤버가 하나라도 있으면 번들 체크"이므로 8종의 `condition` 이 갈리면 접기가 나머지를 **조용히 추가**할 수 있다(사용자가 고르지 않은 자산 설치 = no-false-ship 위반). 8종이 `has-dev-track` 을 공유하는 한 부분집합은 생기지 않으며, 그 전제를 테스트가 강제한다(RED 실증: condition 하나를 `opt-in` 으로 바꾸면 즉시 fail).
- **부정/리스크**:
  (a) **wizard 개별 granularity 상실** — 방법론 1종만 빼려면 `--without <id>` 를 써야 한다. 사용자가 시맨틱을 명시 선택했고(체크박스 1개=의미 1개), 8종 전부 기본설치라 개별 해제 수요가 낮다는 판단. 수요가 확인되면 펼침 페이지는 후속 여지.
  (b) **번들 row 가 `workflow` 에 산다** — dev-tools 계열 4종(감사/리뷰 도구)을 workflow 페이지에서 찾게 된다. 8종을 한 줄로 접는 이상 어느 한 곳을 골라야 하고, "방법론"의 성격상 workflow 가 근사. label("uzys 하네스 방법론 8종")과 hint(구성원 id 전부)로 탐색 가능성 보완.
  (c) **행수 상한 30 은 실측 임계값이 아니다** — `prompts.ts` 주석의 "사용자 iTerm2(30+ rows)" 근거를 그대로 승계한 실무 수치. 매우 작은 터미널(<25행)은 여전히 미해결(기존 주석이 이미 follow-up 으로 명시).
- **문서 영향**: CHANGELOG v26.99.0. wizard 페이지 수가 4→5 로 늘지만 Step 인디케이터는 페이지 내부 카운터(`Page i/N`)라 `wizard-steps.ts` 불변.
