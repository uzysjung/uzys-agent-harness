# 패널 렌즈: deployable — "npm 으로 방금 이걸 깐 낯선 개발자"

작성 2026-08-09. 전제(사용자 확정): **7원칙은 이미 옳다.** 채택 여부를 묻지 않는다.
판정 대상은 하나뿐이다 — **이 문단이 내 프로젝트에서도 참인가.**

내 프로젝트는 이 저장소가 아니다. Rails 모놀리스일 수도, 데이터 파이프라인일 수도, 공개
SDK 일 수도, 아예 코드가 없는 제안서 트랙일 수도 있다. ADR 도 전례도 모른다. 내가 아는 것은
`npm` 으로 설치한 뒤 디스크에 생긴 파일들뿐이다.

인용 표기: `제안 L##` = 이슈 #287 펜스 블록(118줄, 사본 `scratchpad/prop.md`) ·
`파일:줄` = 이 저장소 소스. 부재 주장은 **알려진 양성으로 탐지기를 먼저 검증한 뒤**에만 적었다.

---

## 0. BLUF — 이 렌즈에서 본 것

제안은 원칙으로서 옳다. 깨지는 것은 **"어느 프로젝트에나 참인가"** 한 축이고, 그 축이 깨지는
자리는 셋이다.

| # | 무엇이 | 누가 다치나 |
|---|---|---|
| ① | §3 ¶4 의 "하위 호환 유지 금지 · 미사용 경로 삭제" | **공개 패키지·SDK·플러그인 API·CLI 를 만드는 프로젝트.** 저장소 안에서 호출자를 찾으면 공개 표면은 전부 0건이다 |
| ② | 머리말이 **"내 프로젝트 사실은 어디에 적나"를 말하지 않는다** | 전원. 이 파일에 적으면 다음 `update` 가 지운다 |
| ③ | 문서 전체가 **소프트웨어 저장소를 전제**한다 | 코드가 없는 3개 트랙 설치자(제안서/PM/그로스) |

셋 다 **원칙을 자르지 않고** 고쳐진다. 아래 10건 전부에 고쳐 쓴 문장을 붙였다.

---

## 1. 설치자가 실제로 받는 것 (판정의 바닥 — 전부 실측)

내가 `install` 을 돌리면 무슨 파일이 생기고, 그중 무엇이 내 것인가:

| 파일 | 소유 | `update` 때 | 근거 |
|---|---|---|---|
| 루트 `CLAUDE.md` | **내 것** | **안 건드린다**(마커 블록 한 줄만 유지) | `src/project-claude-merge.ts:177-178` · `src/update-mode.ts:337` |
| `CLAUDE-uzys-harness.md` (앵커) | 하네스 | **무조건 덮어쓴다** | `src/update-mode.ts:366` `copyFileSync(templateMd, anchor)` |
| `AGENTS.md` (codex·opencode) | 하네스 | **백업 남기고 덮어쓴다** | `src/codex/transform.ts:89` → `src/owned-write.ts:114-117` |
| `.agents/rules/uzys-harness.md` (antigravity) | 하네스 | 같음 | `src/antigravity/transform.ts:109-116` |
| `.claude/rules/*.md` | 하네스 | 갱신 | `src/manifest.ts:96-110` |

**앵커는 전 트랙·전 CLI 로 나간다** — `src/manifest.ts:216-221` 의 `applies: all`,
`all = () => true`(`:56`). 트랙은 11개(`src/types.ts:2-14`)이고 그중 `executive`(제안서/DD/피치),
`project-management`(PM/스크럼/Jira), `growth-marketing`(그로스/마케팅/콘텐츠)은
**코드 트랙이 아니다**(`src/prompts.ts:91,93,94`). 이 셋은 `hasDevTrack` 허용목록
(`csr-*|ssr-*|data|full|tooling`, `src/track-match.ts:12-15`) 밖이라 `test-policy`·`ship-checklist`
룰도 **안 받는다**(`src/manifest.ts:68-69,96-102`).

이 저장소는 이 도리를 이미 성문화해 뒀다 — 앵커 파리티 게이트의 주석이
*"배포 앵커는 4 CLI · 전 트랙에 나간다 → 배포판에 쓰면 설치 절반에서 없는 것을 지시하는 거짓
문장이 된다"* 라고 적고, 그 이유로 축 하나를 배포 앵커에서 뺐다
(`tests/lane-principle-anchor-parity.test.ts:89-92`). 아래 ③은 **같은 실패를 CLI 축이 아니라
트랙 축에서** 반복하는 것이다.

---

## 2. Findings

### P0-1 · §3 ¶4 (L61-64) — 공개 API 를 삭제하라고 읽힌다

**원문**
> Do not preserve backward compatibility unless an active contract or persisted data requires it.
> Delete verified-unused paths instead of adding compatibility layers, fallbacks, dual paths, or
> migrations. Breaking active dependencies requires explicit authorization.

**내 프로젝트에서 무슨 일이 일어나나.** 나는 공개 npm 패키지(또는 gem·crate·PyPI·플러그인 API·
공개 CLI)를 만든다. 에이전트가 `grep`·LSP 로 호출자를 찾는다 — **공개 export 는 정의상 저장소 안에
호출자가 0건이다.** 그러니 "verified-unused" 가 내 공개 표면 전체에 대해 참이 된다. 남은 안전장치
`Breaking active dependencies requires explicit authorization` 은 나를 못 지킨다: *dependency* 는
"내가 의존하는 것"으로 읽히지 "나에게 의존하는 남"으로 읽히지 않고, 애초에 그 남은 내 의존성
그래프에 없다.

이 저장소 자신이 그 프로젝트다 — `@uzysjung/agent-harness` 는 게시되는 패키지이고
`src/external-assets.ts` 는 `export const` 로 공개 상수를 낸다. 즉 이 앵커는 **자기 자신에게도**
"저장소 안 호출자가 없으니 지워라"라고 말한다.

**두 번째 문제 — §4 와 서로 다른 방향을 가리킨다.** §3 L62 는 `Delete verified-unused paths`,
§4 L72 는 `Leave unrelated dead code untouched`. 두 문장 다 스코프 낱말이 없어서, "내 변경과
무관한 미사용 경로"를 만난 에이전트는 어느 쪽을 고를지 알 수 없다. 원장이 가장 강하게 경고하는
형태가 정확히 이것이다 — *"if two rules contradict each other, Claude may pick one arbitrarily"*
(`docs/research/rules-hooks-value-audit-2026-08-02/docs-resident-criteria.md` §3 인용,
1차 출처 대조는 `scratchpad/e1-primary-sources.md:40-42`).

**고쳐 쓴 문장 (L61-64 전체 대체)**

```
Delete a path your change makes unnecessary rather than keeping it alive with a compatibility
layer, a fallback, a dual path, or a migration. "Unnecessary" means you found every caller and
all of them are inside this repository. When a caller can be outside it — anything reachable from
a published package's entry point, a documented HTTP, CLI, or plugin interface, a schema, or
stored data — you cannot establish that from here: name what you would remove, say which consumers
you could not check, and get explicit authorization before removing it.
```

무엇이 달라지나: ⓐ `your change makes unnecessary` 가 §4 와의 방향 충돌을 없앤다(무관한 죽은
코드는 §4 대로 그대로 둔다) ⓑ "unused" 의 판별자가 **저장소 경계**로 명시된다 ⓒ 공개 표면의
목록이 생태계 중립으로 나열돼(entry point / HTTP·CLI·plugin interface / schema / stored data)
Rails 든 Go 든 Rust 든 자기 것을 알아본다 ⓓ 원칙(하위 호환 레이어를 덧대지 않는다)은 그대로다.

---

### P0-2 · 머리말 (L3-4) — 내 프로젝트 규칙을 어디에 적어야 하는지 말하지 않는다. 그래서 여기에 적는다

**원문**
> These are default decision principles. Project-specific instructions may refine them.

`Project-specific instructions may refine them` 은 **누가·어디에** 를 말하지 않는다. 낯선
설치자에게 가장 자연스러운 해석은 "이 파일에 내 프로젝트 규칙을 덧붙인다"이다 — 이 파일이
바로 "에이전트가 일하는 법"을 적은 파일이니까.

**그러면 지워진다.** `update` 는 앵커를 조건 없이 덮어쓴다(`src/update-mode.ts:366`
`copyFileSync(templateMd, anchor)`). 반대로 루트 `CLAUDE.md` 는 절대 안 덮어쓴다
(`src/project-claude-merge.ts:177-178` — import 가 이미 있으면 입력과 바이트 동일 반환).
**같은 이름을 가진 두 파일 중 하나는 안전하고 하나는 휘발하는데, 파일 본문은 그 갈림을 말하지
않는다.** 현재 배포본에도 제안에도 없다 (검증된 grep: 알려진 양성 `repository` 3건이 잡히는
것을 먼저 확인한 뒤 `CLAUDE\.md|AGENTS\.md|project context|scaffold|FILL` → H1 1건뿐).

**포인터의 방향이 한쪽뿐이다.** 스캐폴드 → 앵커는 있다(`src/project-claude-merge.ts:124-126`
SCAFFOLD_BANNER *"The working principles live in this project's harness anchor …"*). 앵커 →
스캐폴드는 없다.

**정정 — 다른 CLI 는 "안 덮어쓴다"가 아니다.** codex·opencode 의 `AGENTS.md` 와 antigravity 의
`.agents/rules/uzys-harness.md` 는 owned-writer 를 거친다: 내가 고쳐 놓았으면
`<파일>.backup-<스탬프>` 를 남기고 **최신 생성본으로 자리를 바꾼다**
(`src/owned-write.ts:114-117` · 백업 이름 `src/fs-ops.ts:150-151` · update 는
`refreshOnly: true` 라 **이미 있는 파일은 갱신 대상**, `src/update-mode.ts:450`). 즉 내가 채운
`## Project Context` 는 update 후 **빈 스캐폴드로 되돌아가고 채운 사본은 옆의 백업 파일에**
있다. 포인터 문장을 쓸 때 이 사실을 빼면 그 문장 자체가 거짓말이 된다.

**고쳐 쓴 문장 (L3-4 뒤에 문단 하나 추가)**

```
This file belongs to the harness and is replaced on every update, so do not record anything about
this project in it. Project facts — the stack, the commands, the layout, the red lines, and the
one check that proves a change is safe — go in this project's own context file: the root
`CLAUDE.md` under Claude Code, which the harness never rewrites, or the `## Project Context`
section of the generated agent guide under the other CLIs. If an update has replaced that guide,
the copy you filled in is beside it as a `.backup-` file; merge from it instead of re-deriving.
When a fact about this project is missing there, write it there and say that you did.
```

배포 위생 확인: ADR 번호·`vNN.N.N`·`/Users/`·`docs/research/` **0건**
(`tests/templates-distribution-hygiene.test.ts:110-113` 이 무는 4종). 경로 리터럴 2개는 설치본에
실재한다(`templates/codex/AGENTS.md.template:7` · `templates/opencode/AGENTS.md.template:7` 의
`## Project Context`).

---

### P1-3 · §3 전체(L47-64)와 §2 일부(L31) — 코드가 없는 설치자에게는 참이 아니다

앵커는 11개 트랙 전부에 나가는데(§1 표), 그중 셋은 코드 트랙이 아니다. 제안서를 쓰는
`executive` 설치자는 매 세션 이걸 읽는다:

- L31 `Prefer regression tests at stable contract boundaries` — 테스트가 없다. 그리고 이 트랙은
  `test-policy` 룰조차 안 받는다(`src/track-match.ts:12-15` 허용목록 밖).
- L49-51 모듈 분리 · 인터페이스 폭
- L53-56 설치된 의존성 검사 · 패키지 추가
- L61-64 하위 호환 · 미사용 경로 삭제

원장의 ❌ 목록에 *"Aspirational rules the team does not actually follow"* 가 있다
(`docs/research/rules-hooks-value-audit-2026-08-02/docs-resident-criteria.md` 담지 마라 표).
**따르지 않을 규칙을 매 세션 읽히는 것**이 정확히 그 항목이고, 원장의 다른 축
(*"the more instructions … the less strictly Claude will follow them"*, `scratchpad/e1-primary-sources.md:40-41`)
이 그 비용을 말한다 — 안 지키는 절이 옆에 있으면 지켜야 할 절의 준수율이 같이 내려간다.

**자를 일이 아니다.** §3 은 코드 트랙에서 값을 한다. 필요한 것은 **매핑 규칙 한 문단**이고,
그것 하나가 §1·§2·§4 의 `code`·`tests` 낱말까지 동시에 참으로 만든다.

**고쳐 쓴 문장 (머리말, P0-2 문단 앞에 배치)**

```
These principles describe how to change a system — its code, its tests, and whatever ships with
it. When the work produces documents, analyses, or plans instead, read "code" as the artifact you
are changing and "tests" as the check that would catch it being wrong. A paragraph with no
counterpart in this project does not apply; say so once rather than inventing one.
```

마지막 절(`say so once rather than inventing one`)이 행동을 바꾸는 자리다 — 없으면 에이전트가
제안서 저장소에 "회귀 테스트"를 만들어내려 든다.

---

### P1-4 · §3 ¶2 (L53-56) — 생태계 중립이 아니고, 판별자가 없다

**원문**
> Before implementing or adding a package, inspect installed dependencies and verify their
> versions, documentation, types, and capabilities. Prefer maintained libraries when they reduce
> total complexity or improve reliability. Do not reimplement common functionality without a
> concrete reason.

세 군데가 걸린다.

1. **`types`** — TS 의 `.d.ts` 를 가리키는 낱말로 읽힌다. Ruby·Python(무주석)·Elixir 프로젝트에는
   대응물이 없고, Go·Rust 에서는 "타입"이 아니라 소스 그 자체를 읽는 일이다.
2. **`inspect installed dependencies`** — 행동이 없다. 무엇을 열어야 하나? **이 하네스 자신의
   스캐폴드는 이 자리를 훨씬 잘 쓴다**: *"Inspect package.json / pyproject.toml / go.mod /
   Cargo.toml / Gemfile + lockfiles"*(`src/project-claude-merge.ts:90`). 같은 패키지 안에서
   앵커가 자기 스캐폴드보다 덜 중립적이다.
3. **`Prefer maintained libraries`** — `maintained` 는 관측 불가고, **어떤 프로젝트에서는 반대가
   기본값**이다: 무의존성 라이브러리, 벤더링 정책이 있는 저장소, 공급망 심사가 붙는 규제 환경.
   같은 설치에 나가는 룰은 외부 의존성 도입을 **결정 기록 대상**으로 규정한다
   (`templates/rules/change-management.md:6` — *"스펙에 없던 결정 중 아키텍처 · **외부 의존성** …
   는 결정 기록으로 남긴다"*). 앵커만 읽은 에이전트는 그 무게를 모른다.

**고쳐 쓴 문장 (L53-56 전체 대체)**

```
Before you call an API, read the version that is actually installed here — the manifest and
lockfile for the version, the package's own source or type stubs for the signature. Do not call an
API you have not seen in that version. Do not hand-write what a dependency this project already
has does correctly. Adding a NEW dependency changes what this project ships: say what it replaces
and follow this repository's rule for taking one on.
```

`manifest and lockfile` · `source or type stubs` 는 npm·pip·go·cargo·bundler 어디서나 지시대상이
있다. 실패 유형(있지도 않은 API 호출)이 명시되고, 새 의존성은 선호가 아니라 **결정**이 된다.

---

### P1-5 · §5 L87 — "another agent" 는 사람 리뷰어를 문면상 배제한다

**원문**
> Independent review by another agent is required:

내 팀에서 독립 리뷰는 **동료의 PR 리뷰**다. 이 문장은 그걸 세지 않는다. 그래서 매번 L94-96 의
탈출구(*"If no reviewer is available, disclose that limitation"*)가 발동하고, 사람이 리뷰한
변경에 대고 에이전트가 "독립 리뷰 없음"이라고 보고한다 — **참인 리뷰를 미검증으로 보고하는**
방향의 오류다.

배선도 한쪽으로 기운다: 서브에이전트 정의는 `.claude/agents/` 로만 나간다
(`src/manifest.ts:249,257,266,274` — 네 곳 전부 `.claude/agents/` target). codex·opencode·
antigravity transform 은 스킬만 옮긴다(canary 검증: `src/codex/transform.ts` 에 `skill` 15건 매치,
`agents/`·`subagent` 는 스킬 출력 경로 외 0건). 즉 **하네스가 리뷰어를 깔아 주는 경로는 4 CLI 중
하나**다. 사람을 세지 않으면 나머지 셋은 상시 "리뷰어 없음"이 된다.

**고쳐 쓴 문장 (L87 대체)**

```
Independent review by an agent or person other than the one that produced the work is required:
```

앵커 파리티 게이트의 축1 정규식 `other than the (?:one|lane|agent) (?:that|who) produced`
(`tests/lane-principle-anchor-parity.test.ts:86`)를 그대로 만족한다 — 게이트를 건드리지 않는다.

---

### P1-6 · §5 L90 — "before deployment" 가 같은 설치에 깔리는 룰과 어긋난다

**원문**
> 2. For any completed change before deployment.

같은 설치에 나가는 룰이 **그 타이밍을 명시적으로 부정한다**:

> `templates/rules/ship-checklist.md:5` — **"머지는 그 변경을 만들지 않은 레인의 리뷰를 거친다."**
> … **"배포 직전이 아니라 머지 시점이다 — 리뷰 없이 쌓인 변경은 배포 때 형식만 채워진다."**

나는 두 파일을 같은 세션에 상주로 받는다(claude·opencode 경로). 한쪽은 배포 전, 한쪽은 "배포
전이 아니라 머지 시점". 원장이 말하는 임의 선택 조건 그대로다. (codex·antigravity 는 룰을 아예
안 읽으므로 — canary 검증: `templates/codex/config.toml.template` 에 `AGENTS` 1건 매치 대비
`rules` **0건**, exit 1 — 그쪽 설치자에게는 앵커의 이 줄이 유일한 답이 된다. 그래서 **앵커
쪽을 룰에 맞추는 것**이 맞다.)

**고쳐 쓴 문장 (L90 대체)**

```
2. For any completed change before it is merged, and again before it is deployed if the change
   grew after review.
```

---

### P1-7 · L1 `# AGENTS.md` — Claude 설치본에서 거짓 제목이 된다

claude 경로는 **렌더를 거치지 않고 원문이 그대로 복사된다**(`src/manifest.ts:216-221`
`source: "CLAUDE.md"` → `target: HARNESS_ANCHOR_FILE` · `src/installer.ts` copyFile). 나머지 3 CLI 는
첫 h1 을 정규식으로 떼고 임베드한다(`src/codex/agents-md.ts:35`).

결과: 나는 `CLAUDE-uzys-harness.md` 를 열어 제목이 `# AGENTS.md` 인 파일을 본다. 낯선 설치자의
첫 반응은 둘 중 하나다 — 설치가 잘못됐다고 판단하거나, "고쳐 준다며" 파일명을 바꾼다(그러면
루트 `CLAUDE.md` 의 `@` import 가 끊긴다). 제목은 어디서도 참이 아니다: claude 에서는 틀렸고
나머지에서는 버려진다.

**고쳐 쓴 문장 (L1 대체)**

```
# Working Principles
```

파일명·CLI 이름을 제목에 넣지 않는다 — 이름은 설치 경로마다 다르고 본문은 4곳 모두 같다.

---

### P2-8 · §2 ¶5 (L44-45) — 신규 구축 전용 문장이 매 세션 상주한다

**원문**
> Start with the smallest working end-to-end path and add one verified capability at a time. Do
> not trade working code for unfinished complexity.

내 프로젝트는 10년 된 모놀리스다. "가장 작은 동작하는 E2E 경로부터 시작하라"는 **버그 수정
요청에 대고는 의미가 없고**, 나쁘게 읽으면 "처음부터 다시 만들라"가 된다. 뒷문장(동작하는
코드를 미완성 복잡도와 바꾸지 마라)은 어느 프로젝트에나 참이고 실제로 행동을 바꾼다 — 앞문장에
트리거만 붙이면 둘 다 산다.

**고쳐 쓴 문장 (L44-45 대체)**

```
When you are building something that does not exist yet, get the smallest end-to-end path working
first and add one verified capability at a time. At every point, leave the system in a state that
runs: do not trade working behavior for an unfinished refactor.
```

---

### P2-9 · §1 ¶2 (L12-15) — 닿을 수 없는 출처를 지시하면 "확인했다"는 거짓말이 나온다

**원문**
> Before designing, examine how established products solve the same problem. Prefer proven
> patterns. Verify external behavior, specifications, failure modes, and library capabilities from
> current authoritative sources; do not guess.

두 가지가 내 환경에서 성립하지 않는다. ⓐ `established products` / `proven` 은 판별 불가고
트리거·정지 조건이 없어 **매 설계마다** 조사를 유발한다. ⓑ `current authoritative sources` 는
**네트워크를 전제**한다 — 사내망·에어갭·웹 도구 없는 CLI 세션에서는 닿을 수 없고, 닿을 수 없을
때 이 문장이 만드는 행동은 "안 했다고 말하기"가 아니라 **"기억에서 채우고 확인했다고 적기"** 다.
§7 이 막으려는 바로 그 실패를 §1 이 유발한다.

**고쳐 쓴 문장 (L12-15 전체 대체)**

```
When the shape of a design is new to this project and an established product already solves the
same problem, look at how it does before inventing one, and name in the plan what you took from
it. When this project already contains a working precedent, follow the precedent instead of
researching. For external behavior, specifications, and failure modes, read the version installed
here first; when only an outside source can answer and you cannot reach one, say which question is
unanswered instead of filling it in.
```

---

### P2-10 · L39 · L58-59 — 읽고 넘어가는 문장(행동을 안 바꾼다)

**원문**
> (L39) Prefer direct, explicit, reproducible, and testable behavior.
> (L58-59) Make architectural decisions for the system's expected lifetime. Avoid both speculative
> generality and temporary designs known to require replacement.

L39 는 형용사 4개고 판별자가 없다. 바로 뒷문장(`Brevity is not simplicity …`)이 이미 판별자를
갖고 있어 앞문장이 없어도 손실이 없다. L58-59 는 **작성 시점에 판별 불가**다 — 무엇이
speculative 였는지는 나중에야 안다. 원장의 담지 마라 목록 중 *"'조심하세요' 류의 주의 환기 —
행동과 승인 조건으로 적습니다"*(`docs/research/claude-md-standards-2026-08-09/dyld-articles.md:29`)
에 걸린다.

**고쳐 쓴 문장**

```
(L39 앞문장 삭제, 뒷문장만 유지)
If equally sufficient approaches exist, choose the simplest one that reaches a verified result
soonest. Brevity is not simplicity when it makes behavior harder to state or to check.

(L58-59 대체)
Design for the requirements that are already written down. When a structural choice would be
expensive to reverse and the requirement driving it is written down nowhere, name the two options
and ask before committing to one.
```

L58-59 대체문의 판별자는 **"적혀 있는가"** 라서 저장소 안에서 확인된다.

---

## 3. 읽는 사람이 에이전트다 — 행동을 바꾸는 문장 vs 읽고 넘어가는 문장

매 세션 상주하는 지시문이므로, 관측 가능한 트리거와 관측 가능한 행동이 없으면 그 줄은 비용만
낸다. 제안 118줄을 문단 단위로 갈랐다.

### 행동을 바꾼다 (유지 — 손대지 말 것)

| 줄 | 왜 무는가 |
|---|---|
| L8-10 | 트리거(편집 전) + 행동(호출자·워크트리 확인) + 순서(사용자보다 저장소 먼저) |
| L28-29 | 편집 전 완료 기준 선언 — 안 하면 판정 기준 없이 끝난다 |
| L34-37 | 6개 금지에 각각 판별자가 붙어 있다(요청됨 / 계약 / 신뢰 경계 / 보안 요구) |
| L68-70, L72-73 | 무관한 코드 손대지 않기 — 관측 가능하고 자주 깨진다 |
| **L78-79** | **이 문서에서 가장 값이 큰 두 줄.** 사용자 미커밋 변경 보존은 되돌릴 수 없는 손해를 막는다 |
| L83-85 | 기준을 약화시키지 말고 미충족을 그대로 보고 |
| L92-96 | 리뷰어에게 완료 기준을 넘긴다 + 리뷰어 없으면 자기 리뷰를 독립 리뷰로 부르지 않는다 |
| L100-105 | 실행 전 대상 명시 + 승인. **"준비 ≠ 적용"** 은 에이전트가 실제로 혼동하는 경계다 |
| L112-117 | 증거 없는 `Pass` 금지 · 새 증거가 없으면 정지 |

### 읽고 넘어간다 (위 P1-4·P2-8·P2-9·P2-10 이 각각 처방)

| 줄 | 결함 |
|---|---|
| L12-13 | 트리거·정지 조건 없음 (`established` · `proven` 판별 불가) |
| L13-15 | 닿을 수 없을 때의 행동이 없음 |
| L39 | 형용사 4개 |
| L44-45 | 신규 구축 전용 — 기존 시스템에서는 지시대상이 없다 |
| L54-55 | `maintained` · `total complexity` 관측 불가 |
| L58-59 | 작성 시점 판별 불가 |
| L75-76 | `local style` 의 지시대상 미고정(저장소 전체? 모듈? 편집 중인 파일?) — 이 렌즈에서는 추가 처방을 내지 않는다. 폴리글랏 저장소·린터 설정이 없는 저장소에서 특히 빈다 |

### 경계 사례 (유지 판정)

L49-51(모듈 분리)은 형용사처럼 보이지만 판별자가 넷 붙어 있다(responsibilities · trust
boundaries · lifecycle · reasons to change). 설계 리뷰에서 실제로 쓸 수 있다 — **유지.**

---

## 4. 이 렌즈가 검증하지 않은 것

- 위 재작성문을 넣은 전체 파일로 `npm run ci` 를 **돌리지 않았다**(리포 무수정 제약). 확인한
  것은 문장 단위 게이트 적합성 둘뿐이다: P1-5 재작성문이 파리티 축1 정규식
  (`tests/lane-principle-anchor-parity.test.ts:86`)을 만족하고, P0-2·P1-3 재작성문이 배포 위생
  4종(`tests/templates-distribution-hygiene.test.ts:110-113`)에 걸리지 않는다.
- **이 문장들이 실제 모델 행동을 바꾸는지는 측정하지 않았다.** 전부 문면 판정이다.
- 세 CLI(codex·opencode·antigravity)에 실제로 설치해 보지 않았다 — 배선은 소스로만 읽었다.
- 다른 렌즈의 결론을 보지 못한다. P0-1·P0-2·P1-7 은 다른 렌즈와 겹칠 수 있다(겹치면 그 자체가
  독립 수렴 신호다). **P0-2 의 "다른 CLI 는 백업 남기고 덮어쓴다"는 정정은 이 렌즈에서 새로
  나온 것**이므로, 포인터 문장을 쓸 때 "the harness never overwrites" 를 3 CLI 에 적용하면
  거짓이 된다는 점을 합본에서 반드시 반영해야 한다.
