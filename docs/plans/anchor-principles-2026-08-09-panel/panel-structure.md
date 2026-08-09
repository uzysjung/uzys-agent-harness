# 패널 — 구조 렌즈 (절 설계·순서·통합 목차)

작성 2026-08-09 · 리포 무수정 · git 무쓰기 · 측정은 `main` 워크트리(`2851c34`)에서.

전제(사용자 확정): **7원칙은 이미 옳다.** 이 문서는 채택 여부를 묻지 않는다. 문장을 다듬지도
않는다 — **절 구조**만 본다: 무엇이 한 절인가, 어디서 갈라야 하는가, 순서가 일의 순서와 맞는가,
찾으려는 사람이 찾을 수 있는가.

인용 표기: `파일:줄` = 실측 · `제안 L##` = 이슈 #287 펜스 블록(사본
`scratchpad/proposal-287.md`, 117줄) · `현행 L##` = `templates/CLAUDE.md`(142줄).

---

## 0. 결론 먼저 (BLUF)

**절 개수 7은 맞다. 틀린 것은 이음새 둘과, 이 문서가 문서로서 갖는 형태 하나다.**

| # | 무엇이 | 한 줄 |
|---|---|---|
| ① | **나가는 링크가 0이 된다** | 1차 출처 둘이 공통으로 요구하는 형태가 "목차"인데, 제안본은 가리키는 곳이 하나도 없는 **자기완결 에세이**다. 현행본에는 3개 있다(검증된 탐지기) |
| ② | **§2가 두 축을, §3이 네 주제를 담는다** | 그래서 §2의 첫 문장이 절을 대표하지 못하고, §3은 제목으로 내용을 예측할 수 없다. 재배치하면 **여전히 7절**이다 — 개수를 늘리자는 말이 아니다 |
| ③ | **형식 선택이 자유가 아니다** | §5를 번호 목록으로 바꾼 것만으로 기계 게이트가 red 가 된다. 채점 단위가 **문단**이기 때문이다(`tests/lane-principle-anchor-parity.test.ts:57-62`) |

핵심 산출물은 **§6 통합 목차**다 — 제안의 모든 문단에 목적지를 붙였고 소실은 0이다.

---

## 1. 판정 ① — 7절 분할이 옳은가

### 1.1 개수는 맞다. 이음새가 둘 틀렸다

절의 좋고 나쁨은 개수가 아니라 **한 절이 한 실패를 이름 짓는가**로 갈린다. 그 기준으로 제안을
훑으면 5개는 깨끗하고 2개가 어긋난다.

| 절 | 담는 주제 | 판정 |
|---|---|---|
| §1 Understand First | 조사·외부 확인·불확실성·되묻기 | 한 축(착수 전 앎) — **깨끗** |
| **§2 Define Success and Keep It Simple** | **완료 기준(¶1-2) + 최소 구현(¶3-5)** | **두 축** — 아래 1.2 |
| **§3 Preserve Sound Boundaries** | **모듈 경계 · 의존성 점검 · 아키텍처 수명 · 하위 호환 삭제** | **네 주제(catch-all)** — 아래 1.3 |
| §4 Make Surgical Changes | 변경 범위 | 한 축 — **깨끗** |
| §5 Verify and Review | 자기 검증 → 타 레인 판정 | 한 활동의 두 단계 — **깨끗**(가르지 말 것, 1.4) |
| §6 Protect High-Impact Boundaries | 실행 전 승인 | 한 축 — **깨끗** |
| §7 Report Evidence | 보고의 진실성 | 한 축 — **깨끗** |

### 1.2 §2 — 한 절에 두 축이 있고, 그래서 첫 문장이 절을 대표할 수 없다

절의 다섯 문단은 **완료 기준 2 + 최소 구현 3**으로 갈린다:

| 문단 | 주제 |
|---|---|
| 제안 L28-29 | 관측 가능한 완료 기준 + 검증 지점 있는 계획 → **완료 기준** |
| 제안 L31-32 | 안정 계약 경계의 회귀 테스트 → **완료 기준** |
| 제안 L34-37 | 최소 변경 · 6가지 금지 → **최소 구현** |
| 제안 L39-42 | 직접적·재현 가능 · 가장 빨리 검증에 닿는 쪽 → **최소 구현** |
| 제안 L44-45 | 가장 작은 E2E 경로부터 → **최소 구현** |

**두 축을 잇는 문장이 절 안에 없다.** 가장 가까운 것이 L40-41 *"choose the simplest one that
reaches a verified result soonest"* 인데, 이건 두 축의 접점이지 두 축을 한 절에 둘 근거가 아니다
— 접점은 상호 참조 한 줄로 충분하다.

**스캔 실패가 실측된다.** 절의 첫 문장은 L28 *"Before editing, define observable completion
criteria and how each will be verified."* 다. 이 문장은 절의 **앞 두 문단만** 대표한다.
"요청하지 않은 기능을 넣지 마라"를 찾는 독자는 첫 두 낱말이 `Define Success` 인 제목 아래를
뒤지지 않는다. 제목·첫 문장이 둘 다 절의 절반만 가리키면 그 절은 **목차 항목으로 작동하지
않는다.**

**현행 배포본은 이 둘을 이미 분리해 두고 있다** — `현행 L32` §2 "Prefer the simplest sufficient
solution" 과 `현행 L71` §4 "Define success before editing". 즉 병합은 개선이 아니라 **되돌림**이다.

> **판정: 가른다.** 단, §3의 재배치(1.3)와 함께 하면 **절 개수는 7 그대로**다.

### 1.3 §3 — catch-all. 제목으로 내용을 예측할 수 없고, 제목이 §6과 충돌한다

네 문단이 서로 다른 것을 말한다:

| 문단 | 실제 주제 | 있어야 할 곳 |
|---|---|---|
| 제안 L49-51 | 모듈을 언제 나누는가 · 인터페이스 폭 | **최소 구현**(구조도 만들지 않는 것이 최소) |
| 제안 L53-56 | 설치된 의존성을 먼저 읽는다 · 이미 있는 것을 다시 만들지 않는다 | 앞절 = **착수 전 조사**(§1) / 뒷절 = **최소 구현** |
| 제안 L58-59 | 아키텍처 수명 | **최소 구현**(적힌 요구까지만 설계) |
| 제안 L61-64 | 하위 호환 대신 미사용 경로 삭제 | **변경·삭제 범위**(§4) |

**중복이 실측된다.** L62 `Delete verified-unused paths` 와 L70 `paths verified as unused and
safe to remove` — **같은 판별자가 두 절에 있다**(grep `verified[- ]?unused|verified as unused`
→ 제안 L62, L70). 한 절이 catch-all 이 되면 다른 절과 겹치는 것이 정상 결과다.

**제목 충돌.** 제안본에서 `boundar*` 는 8회 나오고 **지시대상이 넷**이다:

| 지시대상 | 위치 |
|---|---|
| 보안·신뢰 경계 | L24 · L37 · L75 |
| 계약(테스트) 경계 | L31 |
| 모듈 경계 | L49 + **제목 §3 (L47)** |
| 리뷰 2지점(=시점) | L94 |
| 파괴적 작업 경계 | **제목 §6 (L98)** |

**일곱 절 중 둘의 제목이 같은 낱말을 쓰면서 다른 것을 가리킨다.** 이 문서 자신이 지금
`현행 L124-125` 에서 *"the usual cause is one name meaning two things"* 라고 진단하는 실패다.

**누가 그 낱말을 가져야 하는가는 이미 정해져 있다.** 같은 설치물이 프로젝트 맥락 스캐폴드에
`## Boundaries — Always / Ask First / Never` 절을 쓴다(`src/project-claude-merge.ts:106`) —
그 뜻은 §6 쪽(승인 경계)이다. **§6이 정당한 소유자이고, §3이 낱말을 내려놓아야 한다.**

> **판정: §3을 해체해 §1·§3(최소 구현)·§4로 재배치한다.** 그러면 §3 자리는 "최소 구현"이
> 이어받고, `Boundaries` 는 §6 하나만 쓴다.

### 1.4 §5는 가르지 않는다 (반대 방향 판정)

§5도 표면상 두 낱말("Verify and Review")이지만 §2와 다르다. §2는 **다른 두 실패**를 묶었고, §5는
**한 실패의 두 단계**다 — 자기 검증에서 멈추면 "만든 쪽이 자기 산출물을 판정"하게 되고, 그것이
이 절이 막는 단일 실패다. 가르면 두 절 사이에 *"자기 검증만으로는 검증이 아니다"* 라는 접합
문장을 새로 만들어야 하고, 그 문장이 없으면 §5-a를 통과한 사람이 §5-b를 건너뛴다.

다만 §5의 **첫 문장은 바꿔야 한다** — 4.2 참조.

---

## 2. 판정 ② — 절 순서

### 2.1 순서 자체는 맞다. 그리고 현행본의 실제 결함을 고친다

작업 순서 기준(이해→성공정의→경계→변경→검증→승인→보고)에 제안본은 정확히 맞는다.

**현행 배포본이 어긋나 있었다**: `현행 L52` §3 "Make surgical changes" 가 `현행 L71` §4 "Define
success **before editing**" 보다 **앞**에 있다. 편집 규칙이 "편집 전에 정의하라"보다 먼저 나오는
구성이다. 제안본은 이걸 고친다(정의 → 만들기 → 검증). **이 점은 제안본의 명백한 우위이고 유지해야
한다.**

또 하나: 현행본은 *검증 실행*(`현행 L83-88`)을 §4 "Define success" 안에 넣어, 정의와 실행이 한
절에 있고 보고(§5)·승인(§6)이 뒤따른다. 제안본은 정의(§2)와 실행·판정(§5)을 분리한다 — **일의
순서와 맞고, 두 절이 서로를 참조할 수 있는 형태다.**

### 2.2 다만 승인 축이 두 곳으로 갈라져 있고, 그 사이가 비어 있다

승인 게이트가 두 번 나온다: 제안 L20(§1 `ask before proceeding`)과 L101(§6 `obtain explicit
approval`). 두 자리가 문서의 양 끝이고, 어느 쪽이 적용되는지 가르는 문장이 없다. 게다가 `cost`
가 양쪽에 있다(L19 `cost` · L100 `costly`) — 독자가 "비용이 큰 결정"을 만나면 어느 절인지 스스로
판정해야 한다.

**더 큰 구조 결함은 사다리의 중간 단이 빠진 것이다.** 현행본은 세 단이다:

| 단 | 현행본 | 제안본 |
|---|---|---|
| 낮음 | `현행 L20-21` 가정을 명시하고 계속한다 | L20-21 ✔ |
| **중간** | **`현행 L22-24` 레인이 갈리면 적대적 패널 — 되돌리기 비싼 결정에만** | **없음** |
| 높음 | `현행 L18-20` 사용자에게 묻는다 | L18-20 ✔ |

중간 단이 빠지면 두 방향으로 다 샌다 — 사소한 것까지 사용자에게 묻거나, 갈린 판정을 목소리 큰
쪽이 가져간다. **셋을 한 문단의 순서 있는 사다리로 쓰면** 축이 하나로 보이고, 게이트도 함께
만족한다(5장).

---

## 3. 판정 ③ — 빠진 축

에이전트가 실제로 저지르는 실수 중 7원칙이 안 덮는 것. **문장 하나가 아니라 슬롯**으로 적는다.

### 3.1 이 문서가 무엇이고 나머지는 어디 있는가 (머리말 슬롯) — P0

제안본 머리말은 두 줄이다(L3-4). 그런데 이 문서는 **낯선 저장소로 나가는 입구**이고, 입구가
답해야 할 것 셋 중 하나만 답한다:

| 입구가 답해야 할 것 | 제안본 |
|---|---|
| 이건 무엇이고 무엇이 우선하는가 | ✔ L3-4 |
| **여기 못 담는 것은 어디 있는가** | **없음** |
| **이 문서가 보장하지 못하는 것은 무엇인가** | **없음** |

두 번째가 특히 위험한 이유: 이 파일은 하네스가 소유해 `update` 가 통째로 덮어쓴다
(`src/update-mode.ts:365`). 설치자가 자기 프로젝트 사실을 여기 적으면 다음 업데이트에 사라지는데,
**어디 적어야 하는지 문서가 말하지 않는다.** 반대 방향 포인터는 이미 있다 —
`src/project-claude-merge.ts:124` 의 `SCAFFOLD_BANNER` 가 *"The working principles live in this
project's harness anchor…"* 로 앵커를 지목한다. **한 방향만 배선돼 있다.**

세 번째는 공식 안티패턴에 정면으로 걸린다:
`docs/research/claude-md-standards-2026-08-09/primary-anthropic-steering.md:218-225` —
*"**"Never do this" in CLAUDE.md.** … an instruction is the wrong tool … A real guardrail needs
to be deterministic, and the enforcement methods are hooks and permissions."* 이 하네스는 훅과
permission 을 함께 설치하는데, 앵커가 **자기 집행층의 존재를 말하지 않는다.**

### 3.2 이 문서의 유지 루프 (절 슬롯) — P1

**어느 절도 "이 문서가 어떻게 자라고 줄어드는가"를 소유하지 않는다.** 1차 출처 셋이 같은 것을
요구한다:

- `primary-openai-harness.md:100-103` — *"A recurring "doc-gardening" agent scans for stale or
  obsolete documentation … and opens fix-up pull requests."* 그리고 같은 글이 "golden principles"
  (=#287 같은 원칙 문서)를 **권장하면서 조건을 붙인다**: 주기 점검이 붙어 있을 때만
  (`:168-178`). **원칙 문서의 정당성이 길이가 아니라 점검 루프에서 나온다는 것이 이 글의 논지다.**
- `primary-anthropic-steering.md:77-79` — *"Keep CLAUDE.md under 200 lines, **give it an owner,
  and review changes to it like code**."*
- `dyld-articles.md:41` 분기 점검 · `dyld-articles.md:149` *"모델이 바뀌면 프롬프트도 덜어내야
  합니다"*.

즉 "언제 더하고 언제 지우는가"는 이 장르의 **필수 절**인데 제안본에 없다.

### 3.3 §5의 빠진 축 — "빈 결과는 부재의 증거가 아니다" — P1

§5는 *검사를 돌려라*, §7은 *안 돌린 것을 통과라 하지 마라*를 말한다. **돌렸는데 아무것도 안 나온
검사**를 다루는 문장은 어디에도 없다. 그런데 에이전트가 거짓 "확인했음"을 만드는 가장 흔한 경로가
정확히 그것이다 — 없음을 증명하려고 검색을 돌리고, 빈 출력을 부재로 읽는다.

**배포 표면 전체에 0건이다**(탐지기 검증: 같은 정규식이 `.claude/rules/cli-development.md` 에서
exit 0, `templates/rules/` 전체에서 exit 1). 개발용 사본에는 있고 **배포판에는 없다** — 즉 이건
"모델이 이미 한다"가 아니라 배송에서 빠진 축이다.

### 3.4 §7의 빠진 축 — 로컬 검사와 공유 상태의 구분 — P2

§7은 무엇을 보고할지 열거하지만(L109-110) **내 기계에서 초록인 것**과 **공유 상태가 그렇게 된
것**을 가르지 않는다. `templates/rules/` 에도 없다(grep: `merged|pushed|shared state` → 무관한
1건뿐). 한 문장이면 닫힌다.

### 3.5 (판정) 축이 아니라 포인터로 덮여야 하는 것 — 위임

제안본은 위임을 §5의 "another agent" 로만 언급한다. 위임 정책 자체는 **원칙이 아니라 설치 조건에
따라 달라지는 것**이라 원칙 절로 쓰면 절반의 설치에서 거짓이 된다. 현행본은 이걸 포인터로
처리한다 — `현행 L138` `` `model-orchestration`, where installed ``. **올바른 처리이고, 그 절을
지우면 이 축의 유일한 커버가 사라진다.**

---

## 4. 판정 ④ — 첫 문장이 절을 대표하는가 (스캔 가능성)

### 4.1 절별 실측

| 절 | 첫 문장 | 절을 대표하는가 |
|---|---|---|
| §1 | L8 `Before editing, inspect the affected code, tests, callers…` | △ — 조사만. 이 절에서 **모델 기본 행동이 아닌 것**은 뒤에 있다(L9-10 *"Resolve questions from the repository before asking the user"* · L23-24 되묻기) |
| §2 | L28 `…define observable completion criteria…` | ✗ — 절의 앞 절반만(1.2) |
| §3 | L49 `Separate modules only where…` | ✗ — 네 주제 중 하나만(1.3) |
| §4 | L68 `Change only what the request and its verification require.` | **✔ 모범** |
| §5 | L83 `Run targeted checks first, then broaden according to risk.` | △ — 이건 모델 기본 행동에 가깝다. 절을 **버는** 문장은 L93-94 *"an unreviewed artifact is not verified"* 인데 절 끝에 묻혀 있다 |
| §6 | L100 `Before any destructive, privileged, costly, or shared-state operation…` | **✔ 모범** |
| §7 | L109 `Report what changed, what was verified and how…` | ✔ |

**규칙으로 정리하면**: 첫 문장은 **그 절이 없으면 일어날 실패**를 가리켜야 한다. §4·§6이 그렇고,
§1·§5는 절에서 가장 당연한 문장을 앞에 두었다.

### 4.2 제목 어조 — 지시문에서 주제 라벨로 후퇴했다

| 현행본 (지시문) | 제안본 (라벨) | 잃은 것 |
|---|---|---|
| `Report evidence, not confidence` | `Report Evidence` | **대비**. "evidence" 만으로는 무엇을 하지 말라는 건지 안 보인다 |
| `Prefer the simplest sufficient solution` | (§2에 흡수) | `sufficient` — 최소가 아니라 **충분한 최소**라는 판별자 |
| `Do not cross high-impact boundaries alone` | `Protect High-Impact Boundaries` | 행동(혼자 넘지 마라) → 목표(보호하라). 목표는 따를 수 없다 |
| `Think before coding` | `Understand First` | — **제안본 우위**. "think" 는 관측 불가, "understand first" 는 앞 단계를 이름 짓는다 |

이 문서의 기능이 **지도**라면(5장) 제목은 지도의 라벨이고, 본문을 안 읽어도 라벨만으로 행동이
정해지는 편이 낫다. 현행본의 제목 관습이 그 형태였고 제안본이 그것을 놓았다.

**제목 변경이 안전한지 확인함**(내가 바꾸자고 하는 것이므로 먼저 검증): 배포 앵커의 제목 문자열을
무는 게이트는 없다. 탐지기 검증 = 제목을 실제로 무는 게이트가 존재한다는 것부터 확인
(`tests/subagent-file-handoff.test.ts:27` 이 `## Worker lifecycle` 로 슬라이스). 같은 방식으로
`tests/` 를 훑으면 배포 앵커 제목을 읽는 곳은 없고, 유일한 매치
`tests/resident-rule-reference-liveness.test.ts:240` 은 테스트가 스스로 만든 fixture 문자열이다.
번호 재배정도 안전하다 — `templates/` 안에 `Rule N` 형태 참조가 **0건**(grep exit=1, 탐지기는
`tests/resident-rule-reference-liveness.test.ts` 에서 exit 0 으로 검증).

---

## 5. 판정 ⑤ — "인덱스 + 상세는 링크" 패턴이 이 문서에 적용되는가

### 5.1 1차 출처는 이 형태를 공통으로 요구한다

- `primary-openai-harness.md:55` — *"So instead of treating `AGENTS.md` as the encyclopedia, we
  treat it as **the table of contents.**"* · `:82-83` — *"**progressive disclosure**: agents start
  with a small, stable entry point and are taught where to look next."*
- `primary-anthropic-steering.md:81-82` — *"Think of this file as giving Claude an overview of your
  codebase, **or as an index pointing to other files** where Claude can find more information as
  needed."*

### 5.2 제안본에는 나가는 링크가 하나도 없다 (검증된 탐지기)

```
탐지기 검증(알려진 양성): 백틱 자산 이름
$ grep -nE '`[a-z][a-z0-9-]{4,}`' templates/CLAUDE.md
133: `clear-korean-communication`   135: `task-brief`   138: `model-orchestration`     exit=0

본 검사(같은 탐지기, stderr 보존)
$ grep -nE '`[a-z][a-z0-9-]{4,}`' proposal-287.md
(출력 없음)                                                                            exit=1
```

포인터 낱말 전반(`where installed|see |\.md|/|skill|rule|hook`)으로 넓혀도 제안본의 유일한 매치는
**자기 H1 한 줄**이다. **제안본은 목차가 아니라 자기완결 에세이다.**

### 5.3 그런데 이 앵커에는 출처가 안 겪는 제약이 하나 더 있다

S2의 인덱스는 **같은 팀이 소유한 `docs/` 트리**를 가리킨다. 우리 앵커는 **낯선 저장소**로 나가고,
가리킬 수 있는 대상이 셋뿐이다:

| 대상 | 항상 있는가 | 근거 |
|---|---|---|
| 프로젝트 맥락 파일(루트 `CLAUDE.md` / `AGENTS.md` 의 `## Project Context`) | **항상** | `src/project-claude-merge.ts:133-139,158` 이 트랙 무관으로 렌더 · `templates/{codex,opencode,antigravity}/AGENTS.md.template:7` 에 `## Project Context` 절 실재 |
| 상시 적용 스킬 3종 | **설치별로 다름** | 개별 opt-in |
| 집행층(훅·permission·CI) | **설치별로 다름** | 트랙·CLI별 |

→ **패턴은 적용되되, 조건부 포인터 관용구가 필요하다.** 그 관용구를 이 저장소는 이미 만들어 뒀다
— `현행 L133,135,138` 의 `where installed`. 그리고 그것이 **음성 대조로 검증된 장치**다(조건을
떼면 `resident-doc-asset-reachability` 가 red 로 돌아가는 것까지 확인 — 커밋 `6e6079c`).

**제안본은 이 문서에 존재하는 유일한 인덱스 구현체를 삭제한다.** 구조 관점에서 이것이 가장 큰
손실이다 — 문장 3줄이 아니라 **문서의 장르가 바뀐다.**

### 5.4 (반대 판정) 목차 목록은 만들지 않는다

"인덱스"라고 해서 문서 맨 위에 7개 제목을 나열한 목록을 두자는 뜻이 아니다. 이 파일은 전량
로드되므로 제목 자체가 이미 목차이고, 별도 목록은 **같은 사실의 두 번째 사본**이 되어 절이
바뀔 때마다 어긋난다 — 같은 패키지로 나가는 `templates/rules/doc-governance.md:3` 이 금지하는
형태다(*"한 사실은 한 곳에"*). 인덱스성은 **목록이 아니라 나가는 링크**로 확보한다.

---

## 6. **통합 목차** — 현행 6원칙+2절과 제안 7절을 합친 최선 구조

### 6.1 설계 규칙 세 가지

1. **번호 = 일, 무번호 = 그 일을 감싸는 것.** 현행본이 이미 쓰는 관습이다(`현행 L8-117` 번호 ·
   `현행 L119,127` 무번호). 유지한다 — 독자가 제목 하나만 보고 "이건 원칙인가 장치인가"를 안다.
2. **한 절 = 한 실패.** §2를 가르고 §3을 해체하는 근거.
3. **입구는 나가는 링크를 갖는다.** 링크 대상은 셋으로 고정(5.3).

### 6.2 목차

```
# Working Principles                                   ← H1: 파일명·CLI 이름을 쓰지 않는다

[머리말 3문단]
  ¶1 무엇이고 무엇이 우선하는가 + 이 파일을 읽는 법 한 문장
  ¶2 여기 못 담는 것은 어디 있는가 (프로젝트 맥락 파일 — update 가 여기를 덮어쓴다)
  ¶3 이 문서가 보장하지 못하는 것 (판단층 ↔ 집행층)

## 1. Understand before you change
## 2. Define what "done" means, and how it will be checked
## 3. Build the minimum that fully satisfies the request
## 4. Change and delete only what the task requires
## 5. Verify, then have it reviewed by an agent that did not build it
## 6. Get approval before crossing a high-impact boundary
## 7. Report evidence, not confidence

## Presenting a decision                ← 현행 L119-125 복원 + §6으로 가는 뒤돌아보기 한 구절
## What applies continuously            ← 현행 L127-139 복원 (인덱스의 나가는 링크)
## Keeping these instructions true      ← 신설 (유지 루프)
```

**번호 절은 7 그대로다.** 나는 절을 늘리자고 하는 것이 아니라 **같은 7개를 다른 자리에서
자르자**고 한다.

### 6.3 문단 배치표 — 제안의 모든 문단에 목적지가 있다 (소실 0)

| 제안 | 내용 | 목적지 |
|---|---|---|
| L1 | H1 `# AGENTS.md` | `# Working Principles` |
| L3-4 | 머리말 | 머리말 ¶1 (+ 읽는 법 한 문장) |
| L8-10 | 착수 전 조사 | §1 ¶1 |
| L12-15 | 기성 제품 선례 · 외부 사실 확인 | §1 ¶3 |
| L17-21 | 불확실성 · 되묻기 | §1 ¶2 + ¶4 |
| L23-24 | 더 단순한 대안 · 밀어내기 | §1 ¶5 |
| L28-29 | 완료 기준 + 계획 | §2 ¶1 |
| L31-32 | 회귀 테스트 / 대체 검증 | §2 ¶2 |
| L34-37 | 최소 변경(6금지) | §3 ¶1 |
| **L49-51** | **모듈 경계 · 인터페이스 폭** | **§3 ¶2** (§3에서 이동) |
| **L53-56** | **의존성** | **앞절 → §1 ¶1 / 뒷절 → §3 ¶3** (한 문단이 두 행위라 갈린다) |
| **L58-59** | **아키텍처 수명** | **§3 ¶3** |
| L39-42 | 가장 빨리 검증에 닿는 쪽 | §3 ¶4 |
| L44-45 | 가장 작은 E2E 경로 | §3 ¶5 |
| L68-70 | 요구가 시키는 것만 변경 | §4 ¶1 |
| **L61-64** | **하위 호환 대신 미사용 경로 삭제** | **§4 ¶2 — L70 의 중복 절과 병합** |
| L72-73 | 무관한 죽은 코드 | §4 ¶3 |
| L75-76 | 지역 스타일 | §4 ¶4 |
| L78-79 | 사용자 워크트리 | §4 ¶5 |
| L83-85 | 좁게 → 위험 따라 넓게 | §5 ¶1 |
| L87-96 | 독립 리뷰 2지점 | §5 ¶3-4 (문단 스코프 대응 재작성 — 7장) |
| L100-102 | 승인 | §6 ¶1 (§1과의 구분 반 문장 추가) |
| L104-105 | 준비 ≠ 적용 | §6 ¶2 |
| L109-110 | 보고 항목 | §7 ¶1 (+ 공유 상태 구분) |
| L112-114 | 증거 없는 Pass 금지 | §7 ¶2 |
| L116-117 | 정지 + 핸드오프 | §7 ¶3 |
| — | 적대적 패널 + 문턱 | §1 ¶4 ← `현행 L22-24` 복원 |
| — | 기본 검증 티어 | §5 마지막 ¶ ← `현행 L141-142` 복원 |
| — | 빈 결과 ≠ 부재 | §5 ¶2 **신설** |
| — | 리뷰어 범위 제한·상한 | §5 ¶5 **신설** |
| — | 의사결정 제시 형식 | `## Presenting a decision` ← `현행 L119-125` 복원 |
| — | 상시 스킬 3종 | `## What applies continuously` ← `현행 L127-139` 복원 |
| — | 유지 루프 | `## Keeping these instructions true` **신설** |
| — | 프로젝트 사실은 어디에 | 머리말 ¶2 **신설** |
| — | 판단층 ↔ 집행층 | 머리말 ¶3 **신설** |

### 6.4 머리말 (그대로 쓸 문장)

```
These are default working principles for any repository. Project-specific instructions
refine them, and where the two conflict the project's own instructions win. Sections 1
through 7 follow the order of a task; the unnumbered sections at the end cover how to
present work and how this file itself is kept true.

This file is installed and refreshed by the harness — anything written here is replaced on
the next update. Facts about this repository — its stack, commands, layout, red lines, and
the check that proves a change is safe — belong in the project's own context file (the root
`CLAUDE.md` for Claude Code, the `## Project Context` section of `AGENTS.md` for the other
CLIs), which the harness never overwrites. When a fact about this repository is missing
there, write it there, not here.

These principles shape decisions; they do not block actions. Anything that must hold every
time regardless of judgment belongs in the enforcement layer — a hook, a permission rule, or
a CI gate — not in a sentence here. If you find yourself relying on a sentence to prevent an
irreversible action, say so and propose the gate.
```

### 6.5 재작성이 필요한 절 (그대로 쓸 문장)

**§1 — 불확실성 사다리** (제안 L17-21 대체 + `현행 L22-24` 복원을 한 문단으로)

```
State uncertainty plainly, and label which statements are facts, which are assumptions, and
which are judgments. Do not present an assumption or a judgment as evidence.

When an unresolved choice could materially affect behavior, data, security, architecture, or
scope and would be expensive to reverse, escalate in this order: if the evidence favors one
option, take it and say why; if independent lanes disagree or the call is genuinely
uncertain, settle it with an adversarial panel of independent reviewers rather than the
loudest lane; if it is still open, present the options and trade-offs and ask before
proceeding. A panel costs more than a small decision is worth — do not run one for a call
that is cheap to undo.
```

**§5 — 첫 문장 교체 + 목록의 게이트 대응 + 복원·신설** (제안 L83-96 대체)

```
## 5. Verify, then have it reviewed by an agent that did not build it

An unreviewed artifact is not verified. Run targeted checks first and broaden them according
to risk, iterate until the completion criteria pass, and do not weaken or silently drop a
criterion. If you are blocked, stop and say exactly what remains unmet and why.

A check that produced no output has not proved anything. Before reading an empty result as
absence, run the same check against a case you know it should catch; if it stays silent
there too, the check is broken rather than the code. Say which check you validated this way.

Independent review is required at two points:

1. A completed specification, plan, or design — read by an agent other than the one that
   produced it — before anything is built on it.
2. Any completed change, before it is deployed.

Give the reviewer the completion criteria and relevant constraints. A reviewer verifies the
work itself rather than trusting the author's report, so independent review supplements
direct verification and does not replace it. If no reviewer is available, say so and do not
present self-review as independent review.

Tell the reviewer to flag only what affects correctness or the stated completion criteria and
to mark everything else optional; a reviewer asked for gaps will produce gaps. Outside these
two points, do not add verification passes or hand work to another agent to double-check what
you can check yourself.

Unless this repository defines otherwise, a merge is gated on regression tests covering what
changed, and a release additionally runs the full suite and the end-to-end flows.
```

**§6 — 두 승인 게이트의 구분** (제안 L100 앞에 반 문장)

```
Section 1 covers a choice you are about to make; this covers an action you are about to run.
Before any destructive, privileged, costly, or shared-state operation, state the exact action
and target and obtain explicit approval. Do not infer approval from a broad objective.
```

**§7 — 로컬 검사와 공유 상태** (제안 L109-110 에 이어 붙임)

```
Keep checks you ran locally separate from the state of anything shared: a green run on your
machine is not a merged branch, a pushed tag, or a released version.
```

**신설 절 — 유지 루프**

```
## Keeping these instructions true

When the same correction is needed a second time, propose adding it to the project's context
file — together with the observable behavior it should produce — rather than repeating it in
chat. When an instruction there describes something you now do correctly without being told,
or names a tool, path, or command that no longer exists, propose removing it and say what you
observed. Review this file the way you review code: it is only worth loading every session
for as long as it is still true.
```

**복원 절 — 의사결정 제시** (`현행 L119-125` + 첫 구절만 추가)

```
## Presenting a decision

When Section 6 requires approval — or whenever you ask the reader to choose — present it as
AS-IS → TO-BE with a recommendation and the trade-off, not as prose. [이하 현행 L121-125 그대로]
```

---

## 7. 구조 결정이 기계 게이트에 걸리는 지점 — 형식은 자유가 아니다

`tests/lane-principle-anchor-parity.test.ts` 는 **문단 단위**로 채점한다:
`:57-62` 가 `\n\s*\n` 로 문단을 쪼개고, `:219-227` 이 축의 두 성분(산출물 명사 + 만든 레인이 아닌
쪽을 가리키는 술어)이 **같은 문단에** 있는지 본다. `:279-295` 에 "성분이 다른 문단에 흩어져 있으면
통과하지 않는다"는 canary 가 따로 있다.

**따라서 문단을 나누는 것 자체가 판정에 영향을 준다.** 제안 §5가 red 가 되는 이유는 문장을 지워서만이
아니라 **형식을 바꿔서**이기도 하다:

```
제안 L87   Independent review by another agent is required:      ← 문단 A: 술어 후보만 (그나마 정규식 불일치)
제안 L88   (빈 줄)                                                ← 문단 경계
제안 L89-90 1. …specification, plan, or design…                   ← 문단 B: 산출물 명사만
```

산출물 명사와 레인 술어가 **문단 A/B 로 갈라진다.** 6.5의 §5 재작성안은 목록을 유지하면서 술어를
**목록 항목 줄 안으로** 넣어 이 문제를 닫는다(`1. A completed specification, plan, or design — read
by an agent other than the one that produced it — …`).

같은 이유로 6.5의 §1 사다리 문단은 `adversarial … panel` 과 `expensive to reverse` 를 **한 문단**에
둔다.

> **이 장의 일반화**: 이 문서에서 "목록으로 쓸까 문단으로 쓸까"는 취향이 아니다. 짝을 이뤄야 하는
> 두 성분은 같은 문단에 있어야 하고, 그 규약을 모르면 스캔성을 높이려는 편집이 게이트를 깬다.

---

## 8. 현행본 대 제안본 — 구조 항목별 승패

| 구조 항목 | 현행 배포본 | 제안 #287 | 판정 |
|---|---|---|---|
| 절 순서(정의 → 변경 → 검증) | ✗ §3 변경이 §4 정의보다 앞 | ✔ | **제안 승** |
| 정의와 실행의 분리 | ✗ 한 절(§4)에 묶임 | ✔ §2/§5 | **제안 승** |
| 경계·의존성·수명 축의 존재 | ✗ 없음 | ✔ §3에 도입 | **제안 승**(도입은 옳다. 배치가 문제) |
| 절 제목의 어조 | ✔ 지시문 | ✗ 주제 라벨 | **현행 승** |
| 한 절 = 한 실패 | ✔ | ✗ §2·§3 | **현행 승** |
| 나가는 링크(인덱스성) | ✔ 3개 | ✗ 0개 | **현행 승** |
| 승인 사다리 3단 | ✔ | ✗ 중간 단 소실 | **현행 승** |
| 무번호 절 관습(원칙/장치 분리) | ✔ | ✗ 무번호 절 전부 삭제 | **현행 승** |
| H1 | △ `CLAUDE.md` 를 제목에 씀(claude 설치본에서만 보이고 실제 파일명은 다름) | ✗ `AGENTS.md` — 4 CLI 어디서도 참이 아님 | **둘 다 교체** |

---

## 9. 이 문서가 검증하지 않은 것

- **재작성안을 넣은 전체 파일로 `npm run ci` 를 돌리지 않았다** — 리포 무수정 제약. 검증한 것은
  ⓐ 게이트가 문단 단위로 채점한다는 코드 사실 ⓑ 제목 문자열·`Rule N` 참조를 무는 게이트가 없다는
  것(탐지기 검증 포함) ⓒ 나가는 링크 0건(탐지기 검증)까지다.
- **구조 변경이 모델 행동을 바꾸는가** — 미측정. 이 렌즈의 주장은 전부 *찾기·적용 가능성*에 대한
  것이고 행동 실측이 아니다.
- **`## Presenting a decision` 을 §6 안으로 접는 대안** — 구조적으로는 더 타이트하지만(승인 요청
  바로 옆에 그 형식이 온다) 그 절은 사용자가 착수 중 직접 뒤집어 넣게 한 것이라, 위치 변경은
  임의로 정하지 않고 **선택지로만** 남긴다. 이 문서의 권고는 §7 뒤 첫 무번호 절이다.
- **절 개수의 상한** — 어느 출처에도 없다. "7이 맞다"는 내 판정은 개수 근거가 아니라 *한 절 = 한
  실패* 기준의 결과다.
