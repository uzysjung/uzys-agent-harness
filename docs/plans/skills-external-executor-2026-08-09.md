# D286 — 이슈 #286 설계안 (세 스킬에 외부 도구 레인을 붙인다)

작성 2026-08-09 · 브랜치 `main` · HEAD `2851c34` · 설계만, 코드·문서 무수정 · git 무쓰기.
근거는 전부 `파일:줄` 또는 실행 출력. 근거 없는 문장은 **[의견]** 으로 표시했다.

---

## 0. 한 문단 요약 — 무엇이 달라지는가

지금 세 스킬은 **Claude 안에서만** 일을 나눈다(`model-orchestration` 본문의 외부 도구 언급 0건,
E4 §2.3). 이 설계는 거기에 **레인 하나와 좌석 하나**를 더한다 — 판단이 남지 않은 기계적 구현이
가는 **외부 실행기 레인**(model-orchestration 소유)과, 상관된 오답을 깨려고 패널의 한 자리를
비-Claude 모델에 주는 **외부 좌석**(multi-persona-review 소유)이다. 외부 CLI 를 *어떻게 부르고
실패를 어떻게 읽는지*는 이미 `external-model-consult` 가 갖고 있으므로 **거기서 옮기지 않고
가리킨다**. 새 스크립트·새 훅·새 룰·description 변경은 없다. 세 본문 합 +약 68줄, 상주 토큰
증가 **0**(frontmatter 미변경).

---

## 1. 먼저 확정한 것: 어느 스킬이 어느 사실의 SSOT 인가

"한 사실은 한 곳에"를 지키려면 경계를 **결정 vs 절차**로 그어야 한다. 세 스킬이 답하는 질문이
다르기 때문이다.

| 사실 | SSOT | 나머지 둘은 |
|---|---|---|
| **어떤 일이 어느 레인으로 가는가** (라우팅 술어, effort floor, 위임 프롬프트 규격, 워커 수명) | `model-orchestration` | 가리킨다 |
| **도구가 없을 때 그 *경로*가 어떻게 되는가** (어느 레인으로 내려가고 무엇을 보고하는가) | `model-orchestration` | — |
| **외부 CLI 를 어떻게 부르고 실패를 어떻게 알아보는가** (설치·인증·exit code·가드레일·untrusted 출력·프롬프트 템플릿) | `external-model-consult` | 가리킨다 |
| **어떤 일에 어느 provider 가 맞는가** (카피=Gemini / 간결·구조=Codex / 이미지) | `external-model-consult` §Which provider (SKILL.md:53-63) | model-orchestration 이 한 줄로 가리킨다 |
| **패널을 어떻게 구성하고 독립성을 어떻게 판정하는가** (좌석·렌즈·상관 통제·합성·커버리지 고지) | `multi-persona-review` (+ `references/reviewer-design.md`) | 가리킨다 |
| **복수 도구 패널의 사용자 확인** | `multi-persona-review` | — |
| **저장소 코드가 제3자에 처음 도달할 때의 사용자 확인** | `model-orchestration` | — |

이 표의 근거: 기존 리포가 이미 같은 형태를 쓴다 — 파일 핸드오프 규칙은 `model-orchestration` 이
소유하고 `multi-persona-review` 는 재서술 없이 참조하며, 그 MECE 자체를 테스트가 문다
(`tests/subagent-file-handoff.test.ts:52-56` "재서술하지 않고 참조한다").

### 1.1 이름 하나가 두 대상인 지점 — 본문에서 반드시 구분해야 한다

`OpenCode` 는 이 리포에서 **설치 대상 CLI**다(`src/opencode/transform.ts`, `src/cli-targets.ts:25`).
#286 이 말하는 것은 **일을 시키는 워커**다. 본문에 그냥 "OpenCode" 라고 쓰면 설치받은 사람은 자기
호스트를 가리키는 줄로 읽는다. 배포 본문에서는 항상 **"당신이 돌고 있는 CLI 가 아닌 다른 CLI"**
라는 술어로 쓴다(§2.1 전제 D). 전례가 이미 있다 —
`templates/skills/external-model-consult/references/direct-calls.md:14-17`
("On Antigravity you already are Gemini; on the Codex CLI you already are codex").

---

## 2. model-orchestration — 무엇을 추가/수정하는가

현재 228줄(`templates/skills/model-orchestration/SKILL.md`). **frontmatter 는 손대지 않는다**(§6.3).

### 2.1 신설: `## External executors — the lane outside the harness` (기존 `## Effort floors` 앞)

기존 `## Routing test` 절(:59-81) 바로 뒤. **예상 +26줄.**

담을 것 — 순서대로:

**(a) 이 레인이 무엇을 사는가 (2줄).** 외부 실행기는 **용량을 사지 품질을 사지 않는다.** 기존
본문의 전제가 quality-over-cost 이고(:26-31) "정책과 비용 본능이 충돌하면 정책이 이긴다"라고
못 박혀 있으므로, 외부 레인을 품질 근거로 고르면 그 전제를 뒤집는다. 그래서 이 레인은 **품질이
기계로 판정되는 일**만 받는다 — 그때만 "싸다"가 "나쁘다"를 뜻하지 않는다.

**(b) 다섯 술어 — 전부 참일 때만 이 레인이 열린다 (7줄).** "필요 시 활용"이 아니라 판정 가능한
질문으로 쓴다. 각 줄은 *지금 답할 수 있는 질문* 형태여야 한다.

| # | 술어 | 지금 확인하는 법 |
|---|---|---|
| P1 | 판단 잔여가 0이다 | 기존 라우팅 질문 그대로 — *"새 판단이 남아 있는가?"*(:73). 남아 있으면 닫힌다 |
| P2 | 합격이 기계로 판정된다 | **합격 명령을 지금 한 줄로 적을 수 있는가.** 못 적으면 닫힌다 |
| P3 | 산출물이 아무것도 게이트하지 않는다 | in-harness 레인의 교차검증을 통과하기 전까지는 무엇도 막지 않는다 |
| P4 | 저장소가 그 제공자에게 가도 되는 범위다 | 최초 확인(§2.2)이 끝났고, 이번 파일 집합이 승인 범위 안이다 |
| P5 | 그 도구가 **당신이 돌고 있는 CLI 가 아니고**, 셸을 쓸 수 있다 | 자기 자신에게 위임하는 것은 왕복이 아니다. 셸이 없으면 이 레인은 당신에게 없는 것이다 |

**(c) 동점일 때의 기본값 (2줄).** P1~P5 가 전부 참이어도 **기본은 in-harness 레인(Sonnet)** 이다.
밖으로 나가는 것은 판단 레인이 써야 할 용량을 기계적 작업이 잡아먹고 있을 때다. 이슈의
resource limit("최소 도구만")과 같은 방향이다.

**(d) 부재·실패 시의 경로 (4줄).** 도구가 없거나 인증이 끊겼으면 **레인을 하나 내리고, 무엇을
못 썼는지 보고한다.** 설치·로그인은 대신 하지 않는다. **조용히 다른 제공자로 갈아타지 않는다** —
사용자는 A 가 답한 줄 안다. 인식 방법과 정확한 문구는 `external-model-consult` 가 갖고 있으므로
거기를 가리킨다(설치본에 그 스킬이 없으면 결론만 남는다: 멈추고 묻는다).

**(e) 모델은 사용자 설정에서 온다 (2줄).** 이 레인은 모델을 고르지 않는다 — 그 CLI 가 자기
설정으로 고른 것을 쓰고, **무엇이 답했는지 보고한다.** 리포의 기존 원칙과 같은 규칙이다
(`codex-ask.sh` 는 `-m` 을 기본으로 안 붙인다 — SKILL.md:119-123, `tests/consult-model-tier.test.ts:206-210`
이 강제). 실측으로 근거가 있다: OpenCode 는 `-m, --model` 을 생략하면 사용자 config 의 모델을 쓰고
`opencode models` 로 목록을 낼 수 있다(`opencode run --help` / `opencode --help`, 2026-08-09 실행).
**배포 본문에는 구체 모델명을 쓰지 않는다**(§6.1).

**(f) 호출 형태 (3줄).** 그 CLI 의 비대화형 실행 모드를 셸에서 부른다. 서브커맨드는 기억으로
치지 말고 `--help` 로 확인하고, 없으면 멈추고 보고한다. **쓰기는 격리한다** — 기존 본문의
"parallel reads are safe, parallel writes are dangerous"(:78-81)가 그대로 적용되어, 외부 워커의
쓰기는 worktree 등 격리된 자리에서만 일어난다.

**(g) 위임 프롬프트는 기존 규격 그대로 (1줄).** `## Delegation prompt spec`(:117-133)의 5요소와
`### Collect results as a file…`(:152-161)의 파일 수거 계약이 이 레인에도 그대로 적용된다.
**여기서 재서술하지 않는다.**

> ⚠ **테스트에 관한 경계는 (b)의 P1·P2 가 이미 답한다.** #286 은 "가벼운 테스트"를 이 레인에
> 넣자고 하는데, 기존 정책은 Sonnet 에게조차 "테스트·검증 투입 금지"다(:39, :207). 판정이
> 필요한 지점이라 §7 에 따로 뺐다.

### 2.2 신설: 최초 사용 확인 문장 (위 절 안, (d) 앞)

**실제 문장(배포 본문에 그대로 들어갈 초안):**

> **First use in a repository is the user's call, not yours.** Routing implementation to an external
> CLI puts this repository's code into another vendor's session — a disclosure none of the in-harness
> lanes make. Before the first such delegation in a project, say which tool, which provider its own
> config resolves to, which files the worker may touch, and what comes back; then wait. After that one
> approval, routing inside the predicates above is yours. Ask again when the boundary moves — a
> different tool, or files outside what was approved.

이슈 `<autonomy>`("외부 도구의 최초 설정과 … 만 사용자 확인을 받고, 설정 완료 후의 일반적인 작업
위임과 도구 선택은 자율적으로 진행한다")를 그대로 옮긴 것이다. **1회 · 프로젝트 단위 · 경계가
움직이면 재확인**이 세 조건이다.

### 2.3 `## Routing test` 절에 3줄 추가 (:74 뒤)

기존 불릿과 같은 형태로, **재서술 없이 가리키는** 줄만 넣는다.

- 판단 잔여 0 + 기계 판정 가능한 구현 → in-harness 반복 레인 기본, 조건 충족 시 외부 실행기
  (아래 절).
- **사용자가 읽는 한국어** · **더 짧게·구조로** → 외부 자문 왕복. 어느 provider 가 무엇을 맡는지는
  `external-model-consult` 의 provider 표가 SSOT 다 — 여기서 되풀이하지 않는다.
- 관점이 필요한 판정 → `multi-persona-review`(네이티브 패널) / 비-Claude 관점 1개 →
  `external-model-consult` Mode P. 둘을 섞는 패널은 그 스킬이 사용자 확인을 요구한다.

### 2.4 `## Anti-patterns` 표에 3행 추가 (:214 뒤). **예상 +3줄**

| Anti-pattern | Why it's a violation |
|---|---|
| 외부 실행기에 테스트 작성·검증·핵심 구현을 넘김 | 이 레인은 판단 잔여 0 인 일만 받는다. 무엇을 단언할지 정하는 일을 밖으로 내보내면 외부 결과를 검사할 기준 자체가 밖에 있게 된다 |
| 도구가 없어서 조용히 다른 제공자로 바꿔 실행 | 사용자는 A 가 답한 줄 안다 — 대체는 보고 대상이지 판단 대상이 아니다 |
| 외부 실행기를 "품질이 더 낫다"는 이유로 고름 | 이 레인이 사는 것은 용량이다. 품질을 근거로 들면 이 정책의 quality-over-cost 전제를 뒤집는 것이다 |

### 2.5 `## Quick reference` 블록에 2줄 추가 (:225 뒤). **예상 +2줄**

```
판단 잔여 0 + 합격을 명령 하나로 판정 → sonnet 기본 / 조건 충족 시 외부 실행기 — 최초 1회 사용자 확인, 산출물은 in-harness 교차검증
도구 부재·인증 만료               → 레인을 내리고 무엇을 못 썼는지 보고 — 대신 설치/로그인 금지, 조용한 제공자 교체 금지
```

**model-orchestration 합계: 228 → 약 264줄 (+36).**

---

## 3. multi-persona-review — 무엇을 추가/수정하는가

현재 228줄 + `references/reviewer-design.md` 55줄. **frontmatter 미변경**(§6.3).

### 3.1 `### 2. Design 3-5 genuinely disjoint personas` 에 3줄 (:100 뒤)

렌즈를 먼저 설계하고, **그 다음에** 어느 좌석을 외부에 줄지 정한다는 순서만 적고 근거는
reference 로 넘긴다(재서술 금지).

> Model provenance is a **correlation control, not a lens** — designing lenses comes first, choosing
> which seat an outside model fills comes second. The mechanics are in
> [references/reviewer-design.md](references/reviewer-design.md).

### 3.2 신설 하위 절 `#### Seats an outside tool can fill` — `### 3.` 안, 파일 핸드오프 문단 뒤(:113 뒤)

**예상 +14줄.** 담을 것:

**(a) 확인 문장 (실제 문장 초안):**

> **A panel that spans more than one tool is the user's call before it runs, not after.** Name the
> tools that will answer, how many external round-trips that is, and what text leaves the machine;
> then wait. Native reviewers are the default — one outside seat is a considered upgrade, several are
> a bill the user has not seen yet.

**(b) 좌석을 채울 수 없을 때 (실제 문장 초안):**

> If the seat cannot be filled — the consult skill is not installed, its CLI is missing, auth expired,
> or the provider refused — do **not** quietly replace it with another native reviewer of the same
> shape; that keeps the count and loses the independence, which is the only variable this method's
> value is made of. Fill it with a lens that fears a different failure, and record in the step-6
> coverage caveat which seats were native and which were external, and which model answered each.
> A panel's claim rests on how its members fail; a reader who cannot see who answered cannot audit it.

**(c) 어떻게 부르는가 (1줄).** 외부 좌석은 `external-model-consult` 를 통해 나간다 — 호출·가드레일·
실패 처리는 전부 그 스킬 소관이고 **여기서 되풀이하지 않는다**. 설치돼 있지 않으면 좌석은 없는
것이고, 패널은 네이티브로 돈다.

**(d) 언제 값을 하는가 (2줄).** 되돌리기 비싼 판정 · UI/UX 처럼 한 모델의 기본 취향이 그대로 답이
되는 표면 · 이미 한 번 패널을 돌렸는데 전원이 같은 것을 놓쳤다고 의심될 때. 그 밖에는 네이티브가
기본이다.

### 3.3 `### 6.` 커버리지 고지에 2줄 (:168 뒤)

고지 항목에 **좌석 출처**를 추가한다 — 네이티브 몇 석 / 외부 몇 석 / 각 좌석이 어느 모델로
답했는지. 지금 본문은 "티어"만 고지하게 돼 있어(:184-185) 도구가 섞이면 그 표기가 거짓이 된다.

### 3.4 `## Pitfalls to avoid` 에 2행 (:212 뒤)

- **Buying tools instead of lenses** — 같은 렌즈를 모델만 바꿔 두 번 앉히면 이름이 둘인 리뷰어
  하나다. 상관을 줄이는 것은 provider 차이이지 좌석 수가 아니다.
- **Unlabelled provenance** — 어느 좌석이 밖에서 답했는지 안 적으면 커버리지 고지가 감사 불가다.

### 3.5 `## Cross-references` 의 `external-model-consult` 항목 2줄 보강 (:223-226)

지금은 "Mode P 는 한 번의 외부 호출이 여러 페르소나를 연기한다 / 네이티브 병렬 패널은 이 스킬"
까지만 있다. **셋째 조합**(네이티브 패널 + 외부 좌석 1석)이 이제 존재하고 그 확인 게이트가 이
스킬에 있다는 한 줄을 더한다.

### 3.6 `references/reviewer-design.md` — `## Define independence` 뒤에 문단 신설. **예상 +9줄**

5개 판정 기준(surface / goal / feared failure / evidence / decision criterion, :10-14)은 **그대로
둔다** — 모델은 여섯 번째 기준이 아니다. 대신 그 아래에 상관 통제 문단을 붙인다:

> **Model provenance is a correlation control, not a sixth criterion.** Two reviewers with the same
> lens stay one reviewer whichever models run them — the five tests above still decide independence.
> What a second vendor buys is different: two reviewers whose lenses already differ fail *together*
> less often when they do not share a model family, and that joint-failure rate is the quantity
> "Nine Judges, Two Effective Votes" says a panel's information content is made of. So spend an
> outside seat on the lens whose miss would cost the most, not on the panel at large, and write down
> which model answered each seat — a panel whose provenance is unrecorded cannot be replicated.

**multi-persona-review 합계: SKILL.md 228 → 약 251줄 (+23), reviewer-design.md 55 → 64줄 (+9).**

---

## 4. external-model-consult — 무엇을 추가/수정하는가

현재 291줄. **여기가 가장 적게 바뀐다** — #286 success_criteria 4번(카피=Gemini / 간결·구조=Codex)은
이 스킬에 **이미 있다**(SKILL.md:53-63 provider 표의 Mode K / Mode S, E4 §2.4). 없는 것은 나머지 두
스킬이 그 표를 모른다는 점이고, 그건 §2.3 · §3.2 에서 해결된다.

### 4.1 `## Prerequisite: the external CLIs` 절 도입 1줄 일반화 (:65-68). **예상 +2줄**

지금은 "This skill shells out to CLIs that are not bundled here." 로 **이 스킬 한정**으로 읽힌다.
한 문장을 더해 **하네스가 외부 CLI 로 나가는 모든 경로의 규칙**임을 밝힌다 — 그래야
model-orchestration 이 재서술 없이 가리킬 수 있다.

> This is the rule for any external CLI the harness routes to, not only the two below: **the tool's
> installation and login are the user's action.** You report what is missing; you never install,
> authenticate, or substitute another provider on their behalf.

### 4.2 `## When NOT to use` 에 1행 (:280-281 옆). **예상 +3줄**

이 스킬의 중심 약속은 "저장소가 제공자 워크스페이스에 들어가지 않는다"(:280-281, 가드레일 :152-153)
이다. **실행 위임은 그 약속을 못 지키므로 이 스킬의 일이 아니다**를 명시한다 — 안 적으면 다음
세션이 여기에 실행기를 얹는다.

> - Handing an external CLI actual implementation work in your repo — the guarantee that makes this
>   skill safe is that the repo never enters the provider's workspace, and an executor needs the
>   opposite. That lane, its predicates, and its one-time user approval belong to
>   `model-orchestration` where installed.

### 4.3 Mode P 에 1줄 (:224-228)

네이티브 패널의 **한 좌석**으로 불려 나올 수 있다는 사실과, 그 경우 **확인 게이트는
`multi-persona-review` 소유**라는 포인터. 재서술 없음.

### 4.4 노후 사실 1건 수정 (:79) — **이번 변경이 만드는 게이트에 이미 걸린다**

`verified against codex 0.144.5 with an empty CODEX_HOME` — 외부 CLI 의 버전 고정 서술이다.
배포 본문에서 시간이 지나면 거짓이 된다. 버전 없는 형태로 고친다(관측 사실은 유지, 버전 문자열만
제거). 이 한 줄은 §5.2 E 게이트의 **기존 양성(canary)** 이기도 하다 — 즉 새 게이트는 **빨간불로
태어난다**. 실측:

```
$ grep -rInE '\b(gemini|gpt|glm|kimi|...|codex|opencode|agy)[- ]?[0-9]+\.[0-9]+' templates/
templates/skills/external-model-consult/SKILL.md:79:  codex 0.144.5 with an empty `CODEX_HOME`; ...
templates/skills/external-model-consult/SKILL.md:187: Measured 2026-07-26: `gemini-3.1-pro-high`, ...
templates/skills/external-model-consult/scripts/gemini-ask.sh:131: # ... `gemini-3.1-pro-high` and ...
```
:187 과 스크립트 :131 은 **날짜가 붙은 관측 근거·코드 주석**이라 라우팅 지시가 아니다 →
게이트를 절 단위로 좁히는 이유가 이것이다(§5.2 E).

**external-model-consult 합계: 291 → 약 300줄 (+9).**

---

## 5. 검증 계획 — 무엇이 무는가, 무엇을 되돌리면 빨간불인가

### 5.1 기존 게이트 확장 2건

| 파일 | 무엇을 | 왜 |
|---|---|---|
| `tests/subagent-file-handoff.test.ts:65-68` | `.claude` ↔ `templates` 1:1 단언에 **`external-model-consult` 한 줄 추가** | 지금 2종만 단언한다. 이번 사이클은 3종을 동시에 고치므로 한쪽만 고치는 drift 가 실제 위험이다(E4 §3: "한쪽만 고쳐도 아무도 안 막는다") |
| `tests/templates-distribution-hygiene.test.ts` | **로컬 파생 모델 누출 검사** 1건 신설 (§5.2 F) | 이 파일이 이미 *로컬에서만 알 수 있는 것*을 파생으로 막는 패턴을 갖고 있다(`workspaceSiblings`, :224-250) — 같은 자리, 같은 형태 |

`tests/consult-model-tier.test.ts` 는 **건드리지 않는다.** 그 파일의 계약은 *래퍼 스크립트*이고
이번 변경은 본문이다. 스크립트를 안 만들므로 그 훑기(:225-268)에 새로 걸리는 것도 없다.

### 5.2 신규 파일 `tests/external-tool-routing.test.ts`

세 스킬 본문의 **소유·경계·위생** 계약. 슬라이스 방식은 `subagent-file-handoff.test.ts:27-29`
선례를 그대로 쓴다(양끝 앵커로 절을 자르고, 슬라이스가 비면 먼저 실패).

| # | 단언 | 이유 |
|---|---|---|
| A0 | `## External executors` 슬라이스가 **비어 있지 않다** | 헛통과 차단. 헤딩 이름 자체가 계약 |
| A1 | 그 슬라이스가 다섯 술어 표지를 **전부** 포함 (AND, OR 아님) | 한쪽만 남아도 통과하면 가드가 아니라 장식이다 — 같은 실수를 이 리포가 이미 한 번 했다(`subagent-file-handoff.test.ts:41-50` 주석) |
| A2 | 그 슬라이스가 **최초 사용 확인** 문장을 포함 | #286 success_criteria 5 |
| A3 | 그 슬라이스가 **용량이지 품질이 아니다** 취지를 포함 | quality-over-cost 전제(:26-31)와의 정합. 이게 빠지면 다음 세션이 "더 좋아서" 외부로 보낸다 |
| A4 | 그 슬라이스가 **부재 → 레인 하향 + 보고**를 포함하고, **대신 설치/인증하지 않는다**를 포함 | #286 success_criteria 6 |
| B1 | Anti-patterns 표에 **외부 실행기 + 테스트/검증/핵심구현 금지** 행이 있다 | Non-scope(기존 정책 유지) 보증. 이 행이 없으면 정책 충돌이 문서상 미해결로 남는다 |
| C1 | `multi-persona-review` 가 **복수 도구 패널 확인 문장**을 소유한다 | success_criteria 5 |
| C2 | `multi-persona-review` 가 좌석 미충족 시 **네이티브 강등 + 출처 기록**을 명시한다 | 도구 부재 시 행동(배포물 필수) |
| C3 | `multi-persona-review` 가 `external-model-consult` 를 **가리키기만** 한다 — 호출 방법(래퍼 경로·exit code)을 재서술하지 않는다 | MECE. 기존 `subagent-file-handoff.test.ts:52-56` 과 같은 형태 |
| D1 | `external-model-consult` 가 **실행 위임은 자기 일이 아님**을 명시한다 | 두 스킬 경계가 본문 안에서 자기모순되지 않게 |
| **E** | **세 스킬의 라우팅/도구 절 슬라이스 안에 구체 모델 슬러그가 0건** (`provider[-·공백]숫자.숫자` 및 `provider-숫자-티어`) | 배포 위생의 핵심. 슬라이스로 좁혀야 :187·스크립트 주석 같은 **날짜 붙은 관측 근거**를 오탐하지 않는다(§4.4 실측) |
| E0 | E 의 슬라이스 목록이 **0건이 아니다** | 빈 결과를 부재의 증거로 쓰지 않는다 |
| **F** | (`templates-distribution-hygiene.test.ts`) **로컬 OpenCode 설정에서 파생한 모델 id 토큰**이 배포 대상 어디에도 없다. 설정이 없으면 `console.warn` 후 미수행 | 이슈 `<inputs>` 가 "GLM-5.2, Kimi" 를 적었는데 **Kimi 는 이 머신에도 없다**(E4 §5.2 canary 검증). 구현자가 그대로 본문에 옮길 위험이 실재한다. 열거가 아니라 **파생**이라 설정이 바뀌어도 게이트를 안 고친다 |

> **F 의 한계를 정직하게**: CI 에는 그 설정 파일이 없으므로 **F 는 로컬 `npm run ci` 에서만 돈다**
> (기존 형제 프로젝트 검사와 같은 성질 — `templates-distribution-hygiene.test.ts:119-120` 이 이미
> 이 한계를 명시하고 warn 으로 남긴다). CI 에서 상시 무는 것은 **E** 다. 둘 중 하나만 두면
> 각각 구멍이 있어서 둘 다 둔다.

### 5.3 음성 대조 — 초록으로 태어난 테스트는 증거가 아니다

각 항목마다 **무엇을 되돌리면 빨간불인지**를 미리 고정한다. 되돌리기는 `git checkout` 이 아니라
**외과적 편집**으로 하고, 확인 후 원복한다(전례: 변이 복구를 `git checkout` 으로 하다 다른 변경을
날린 사례).

| 대상 | 변이 (무엇을 한다) | 기대 |
|---|---|---|
| A0 | `## External executors` 헤딩 이름을 한 글자 바꾼다 | A0 red (A1~A4 는 A0 뒤에 가려지므로 **A0 를 먼저** 본다) |
| A1 | 다섯 술어 중 **한 개만** 지운다 (5회 반복) | 매번 red — OR 로 새면 통과한다 |
| A2 | 확인 문장 한 문단 삭제 | A2 red |
| A3 | "용량이지 품질이 아니다" 문장 삭제 | A3 red |
| A4 | "대신 설치/인증하지 않는다" 절반만 삭제 | A4 red (AND 확인) |
| B1 | Anti-patterns 새 행 삭제 | B1 red |
| C1·C2 | 각 문장 삭제 | 각각 red |
| C3 | `multi-persona-review` 에 `codex-ask.sh` 호출 예시를 **추가** | C3 red — **추가형 변이**(삭제형만 쓰면 "재서술 금지" 방향을 검증 못 한다) |
| **E** | 세 스킬 중 하나의 라우팅 표에 `glm-5.2` 를 **추가** | E red |
| E (경계) | `external-model-consult:187` 의 날짜 붙은 관측 문단은 **그대로 둔다** | E green — 오탐하지 않음을 같은 실행에서 확인 |
| E0 | 슬라이스 앵커 헤딩을 바꾼다 | E0 red가 **E 보다 먼저** 뜬다 |
| **F** | 로컬 config 의 모델 id 하나를 배포 본문에 **추가** | F red |
| F (강등) | `XDG_CONFIG_HOME` 등으로 설정 경로를 빈 디렉터리로 돌린다 | warn + 미수행 (조용한 통과가 아님을 눈으로) |
| 1:1 | `.claude/skills/external-model-consult/SKILL.md` 를 1자 고친다 | `subagent-file-handoff` red |
| §4.4 | (변이 아님) 새 게이트 E 는 **수정 전 코드에서 이미 red** 여야 한다 | 게이트가 태어날 때부터 무는지의 직접 증거 |

### 5.4 어떻게 돌리는가

- **`npx vitest related <SKILL.md>` 를 쓰지 마라 — 0건이 나온다.** 스위트 다수가 `readFileSync`
  로 경로를 읽어 import 그래프 밖이다(`.claude/rules/test-policy.md` §영향 범위, 실측 전례 2건).
- **`npm run ci` 전체**(typecheck + lint + test:coverage + build)로 판정한다. `npm test` 만으로는
  coverage gate 를 놓친다.
- 신규 테스트 파일은 `src/` 를 늘리지 않으므로 **branches 88 게이트에 영향 없다** [의견 — 실행
  전까지는 미검증].
- **상주 비용 ratchet 은 돌 필요가 없다**: frontmatter 미변경 → `residentCost` 불변 →
  `context-cost-ratchet.test.ts` · `north-star-cost-figures.test.ts` · `DEV_METHOD_DESCRIPTOR_BUDGET_TOKENS`
  전부 무영향. `npm run cost:baseline` 도 불필요. (본문 토큰(`assetBodyTokens`)은 늘지만 예산
  게이트가 없다 — `grep -rn assetBodyTokens tests/` 로 확인, 단언은 계산 정확성뿐.)
- `manifest.ts` · `external-assets.ts` 변경 **불요** — 세 스킬 전부 이미
  `INTERNAL_BUNDLED_SKILL_IDS` 라 본문 변경이 4개 CLI 로 자동 전파된다(E4 §4.5).
- **`templates/` 와 `.claude/` 양쪽을 같은 커밋에** 고친다(3종 전부). 지금은 2종만 게이트가 문다 →
  §5.1 로 3종이 된다.

---

## 6. 배포물 제약 — 지킨 것과 보고할 사실

### 6.1 `templates/` 위생

| 금지 | 이 설계의 처리 |
|---|---|
| ADR 번호 · 릴리스 태그 `vNN.N.N` · 홈 경로 · `docs/research/` | 새로 쓰는 문장에 없음. 기존 3종은 canary 검증상 이미 0건(E4 §4.6). `tests/templates-distribution-hygiene.test.ts:110-115` 가 앞 셋을 상시 문다 |
| 이 머신에만 있는 모델명(GLM-5.2 · Kimi · gpt-5.x · gemini-3.x) | **본문에 안 쓴다.** 모델은 사용자 CLI 설정에서 오고, 게이트 E·F 가 문다 |
| 이 머신에만 있는 경로 | 호출 예시는 `--help` 로 확인하라는 지시로 대체(§2.1 f) |
| **도구 부재 시 행동** | §2.1(d) · §3.2(b) · §4.1 — 세 자리 전부에 있고 각각 테스트가 문다(A4·C2·D1) |

> `docs/research/` 는 현행 위생 정규식(:112)에 **없다.** 한 토큰 추가로 배포 전면을 덮을 수 있으나
> #286 범위 밖이라 §8 에 인접 항목으로 뺐다.

### 6.2 "수단은 모델 자유, 반드시 지켜야 하는 수단만 구체화"

구체화한 수단은 **넷뿐**이다 — ⓐ 최초 1회 사용자 확인(§2.2) ⓑ 복수 도구 패널 확인(§3.2a)
ⓒ 부재 시 대체 금지·보고(§2.1d) ⓓ 좌석 출처 기록(§3.2b·§3.3). 나머지(어떤 프롬프트로 부를지,
worktree 를 쓸지, 몇 개를 배치로 묶을지)는 **모델 자유**로 남겼다. 다섯 술어(§2.1b)는 수단이
아니라 **목표의 판정 기준**이다.

### 6.3 description — **셋 다 손대지 않는다.** 그리고 그 이유가 보고할 사실이다

직접 실측(2026-08-09, folded 기준):

| 스킬 | description 자 수 | 공식 상한 1,024 대비 |
|---|---:|---:|
| `model-orchestration` | 1,316 | **+292 초과** |
| `multi-persona-review` | 803 | −221 (여유) |
| `external-model-consult` | 1,859 | **+835 초과** |

- 두 스킬은 **이미 상한을 넘겨 있다.** 이 리포는 1,024 를 공식 상한으로 인정하고 있으나 게이트는
  `audit-harness-fit` **한 종에만** 걸려 있다(`tests/audit-harness-fit-skill.test.ts:82-91`).
- 따라서 이번 사이클에 **description 에 트리거를 더하지 않는다.** 기존 트리거로 충분하다 —
  `model-orchestration` 은 *"Fire even when the user doesn't name the policy — any delegation
  decision is in scope"*(:18-19)로 이미 전 위임을 덮고, `multi-persona-review` 는 "다면 리뷰 /
  여러 관점"을 덮는다. 도구 이름은 **발화 조건이 아니라 발화 후의 선택**이다.
- 부수 효과: 상주 토큰 증가 **0**, ratchet·NORTH_STAR 수치 무영향(§5.4).
- **초과 2건은 #286 과 별개 결함으로 보고한다** — 고치는 것은 트리거 동작을 바꾸는 일이라 자체
  검증이 필요하고, 이 사이클에 섞으면 #286 의 판정이 오염된다(§8-11).

### 6.4 배선 함정 — 셸 없는 스킬에 셸 지시를 넣으면 조용히 no-op 이 된다

OpenCode 설치본에서 스킬은 커맨드로 렌더되는데, **`scripts/` 사이드카가 있는 스킬만
`agent: build`(bash 가능)** 이고 없으면 `agent: plan`(bash 거부)이다 —
`src/opencode/transform.ts:105` 가 `existsSync(templates/skills/<id>/scripts)` 로 판정하고
`src/opencode/commands.ts:36` 이 `shellDependent ? "build" : "plan"` 으로 찍는다. 실제 거짓출하
전례가 여기서 나왔다(`tests/opencode-shell-agent.test.ts` 헤더: consult 자문이 plan 아래에서
완전한 no-op 이었는데 설치는 "초록"이었다).

| 스킬 | `scripts/` | OpenCode 설치본에서 | 이 설계가 넣는 셸 지시 |
|---|---|---|---|
| `model-orchestration` | 없음 | `agent: plan` — bash **거부** | §2.1(f) 한 줄 |
| `multi-persona-review` | 없음 | `agent: plan` — bash **거부** | 없음(외부 좌석은 consult 를 경유) |
| `external-model-consult` | **있음** | `agent: build` — bash 가능 | 기존 그대로 |

지금은 **우연히 안전하다**: OpenCode 설치본에서는 호스트가 곧 OpenCode 라 §2.1(b) P5 가
그 레인을 이미 닫는다. 하지만 이 정합은 우연이므로 본문이 스스로 닫아야 한다 — **P5 의 후반부
("셸을 쓸 수 없으면 이 레인은 당신에게 없는 것이다")가 그 역할을 하고, 이것이 P5 를 두 조건의
AND 로 쓰는 이유다.** 단언 A1 이 P5 를 **두 조각 모두** 요구해야 하는 근거이기도 하다.

**따라서: 셸이 필요한 새 경로를 `model-orchestration`·`multi-persona-review` 본문에 더 얹지
마라.** 얹으려면 `scripts/` 를 만들어야 하고, 그러면 §8-1 의 이유로 되돌아간다.

---

## 7. 판정이 필요한 지점 — "가벼운 테스트"를 외부 레인에 넣는가

**이 하나만 사용자 결정이 필요하다.** 나머지는 설계 안에서 닫혔다.

- **충돌의 실체**: #286 success_criteria 2 는 "단순 반복 구현과 **가벼운 테스트**는 OpenCode 의
  사전 설정 모델을 활용할 수 있다"라고 쓴다. 현행 정책은 Sonnet 에게조차 **"테스트·검증 투입 금지"**
  다(`SKILL.md:39`, anti-pattern :207). 즉 Claude 한 단계 아래 모델에도 금지된 일을, 검증되지 않은
  외부 모델에 주는 모양이 된다. 이슈 Non-scope 는 기존 정책의 **대체·제거 금지**다.

| | ASIS (현행) | TOBE 안 A **(권장)** | TOBE 안 B |
|---|---|---|---|
| 테스트 **작성**(무엇을 단언할지 결정) | Opus 전속 | **Opus 전속 — 변동 없음** | 외부 레인 허용 |
| 이미 형태가 고정된 표에 케이스 **한 줄 추가** | 규정 없음 | **외부 레인 허용** (P1~P5 충족 시), 산출물은 in-harness 교차검증 전까지 아무것도 게이트하지 않음 | 외부 레인 허용 |
| 기존 스위트 **실행** | 규정 없음 | **모델 위임 대상 아님** — 셸 명령이다(라우팅 0단계 :61-63) | 외부 레인 허용 |
| 기존 정책과의 관계 | — | 레인이 **하나 늘 뿐** 기존 3레인 불변 = Non-scope 준수 | "테스트 금지" 축이 무너짐 = Non-scope 저촉 |

- **권장 = A.** 근거: ⓐ 기존 라우팅 질문(*"새 판단이 남아 있는가?"*)을 그대로 쓰므로 새 판별자를
  안 만든다 ⓑ 완료 기준을 쓰는 일과 이미 쓰인 기준을 복제하는 일은 다른 일이고, 이 리포의 레인
  원칙("완료 기준을 만든 테스트는 구현이 아닌 레인이 쓴다")이 겨냥하는 것은 앞쪽이다 ⓒ "실행"을
  0단계로 빼면 #286 이 원한 비용 절감의 상당 부분이 **모델 없이** 달성된다.
- A 를 택하면 §2.1 의 P1·P2 와 §2.4 의 anti-pattern 행이 그대로 이 결정을 문서화한다. **추가 문구
  불요.**
- **보안 경계 결정이 하나 더 있다 (별건, 반드시 인간 결정)**: 외부 실행기 레인은 **저장소 코드가
  제3자 제공자 세션에 도달하는 새 경로**를 만든다. `change-management` 기준으로 보안 정책 변경 =
  **Major CR** 이고, ADR 대상이다. §2.2 의 1회 확인은 *사용자에게 묻는 절차*이지 *경로를 만들어도
  되는가에 대한 결정*이 아니다. → **ADR 1건 필요**(제목 예: "외부 실행기 레인 — 저장소 코드의
  제3자 도달 경로와 그 승인 지점").

---

## 8. 하지 말아야 할 것 (scope creep 후보)

| # | 하지 말 것 | 왜 |
|---|---|---|
| 1 | `opencode-run.sh` 등 **새 래퍼 스크립트 신설** | 실행기는 저장소 **안에서** 돌아야 해서, 자문 래퍼의 핵심 가드레일(중립 temp cwd)이 **반대로** 뒤집힌다. 같은 스킬 안에 정반대 약속을 넣으면 배포 본문이 자기모순이 된다(SKILL.md:280-281 vs 신설). 부수 비용도 있다 — `model-orchestration` 에 `scripts/` 를 만들면 그 스킬이 OpenCode 에서 `agent: plan`→`build` 로 바뀌고(§6.4) `consult-model-tier` 훑기 단언 13·14 의 대상이 된다. #286 success_criteria 어디에도 래퍼 요구가 없다 |
| 2 | Fable/Opus/Sonnet 역할·effort floor **수정·재배치** | 이슈 Non-scope 명시 |
| 3 | 세 스킬 **description 확장** | 2종이 이미 공식 상한 초과(§6.3). 상주 비용을 늘리면서 게이트도 없다 |
| 4 | `external-model-consult` 에 OpenCode 를 **자문 provider 로 추가** | 그 스킬의 중심 약속(저장소 미노출)을 지킬 수단이 없다. 자문 좌석은 Gemini·Codex 로 이미 2종이고, 네이티브까지 세면 도구 계열 3종 = "복수의 AI 도구" 충족 |
| 5 | 배포 본문에 **구체 모델명·티어명** 쓰기 | 이 머신 한정 사실이다. `<inputs>` 의 Kimi 는 **이 머신에도 없다**(E4 §5.2 canary) |
| 6 | 외부 호출을 막는/확인하는 **훅 신설** | 이 리포 원칙: 되돌릴 수 없는 것만 서버가 막고 **로컬 차단 훅은 더 얹지 않는다**. 확인은 프로즈 게이트 + 테스트로 충분 |
| 7 | `.claude/rules/` 에 새 룰 추가 | 룰은 방금 최소 판단 원칙으로 정리됐고, 이 내용은 발화형 스킬 소관이다 |
| 8 | `src/opencode/*` · `src/external-assets.ts` · `manifest.ts` 수정 | 그 OpenCode 는 **설치 대상 CLI** 이지 워커가 아니다(§1.1). 세 스킬은 이미 등록돼 있어 본문 변경이 자동 전파된다 |
| 9 | 다중 도구 패널을 **기본값**으로 | 이슈 resource limit("최소 도구만") 위반. 기본은 네이티브 |
| 10 | 세 스킬에 같은 서술 **복제** | C3 단언이 문다. 전례: 파일 핸드오프 규칙의 MECE |
| 11 | description 초과 2건 **이번 사이클에 트리밍** | 트리거 동작 변경 = 별도 검증 필요. #286 판정을 오염시킨다 → **별건으로 보고만** |
| 12 | (인접·선택) 위생 정규식에 `docs/research/` 추가 | 한 토큰이면 배포 전면을 덮지만 #286 밖이다. 하려면 **별 커밋**으로 |

---

## 9. 착수 순서 (구현 레인에 넘길 때)

1. **ADR 먼저**(§7 후단) — 보안 경계 결정이라 본문 수정 전에 인간 결정을 받는다.
2. **테스트를 먼저 쓴다 — 본문을 쓴 레인이 아닌 레인이.** 앵커(헤딩 이름·필수 어구)는 이 문서
   §2·§3·§5.2 가 고정했으므로 두 레인이 같은 계약을 본다.
3. 새 게이트 E 가 **수정 전 트리에서 red** 인지 먼저 확인(§4.4) — 초록으로 태어나면 그 게이트는 증거가 아니다.
4. 본문 3종 × 2사본(`templates/` + `.claude/`) 수정.
5. `npm run ci` 전체 → §5.3 음성 대조 전항 → 원복 → 다시 `npm run ci`.
6. 보고: 검증된 것 / 미검증(F 의 CI 미수행, 외부 CLI **실동작·인증은 이번에도 미검증**) 분리.

---

## 10. 예상 증가 요약

| 파일 | 현재 | 예상 | 증가 |
|---|---:|---:|---:|
| `skills/model-orchestration/SKILL.md` | 228 | ~264 | **+36** |
| `skills/multi-persona-review/SKILL.md` | 228 | ~251 | **+23** |
| `skills/multi-persona-review/references/reviewer-design.md` | 55 | ~64 | **+9** |
| `skills/external-model-consult/SKILL.md` | 291 | ~300 | **+9** |
| (×2 사본: `templates/` · `.claude/`) | | | 실제 편집량은 2배 |
| `tests/external-tool-routing.test.ts` (신규) | 0 | ~150 | +150 |
| `tests/templates-distribution-hygiene.test.ts` | 271 | ~299 | +28 |
| `tests/subagent-file-handoff.test.ts` | 69 | 70 | +1 |
| **상주 descriptor 토큰** | 1,053(3종) | **1,053** | **0** |

---

## 11. 이 설계가 #286 success_criteria 를 어떻게 만족시키는가

| # | 기준 | 어디서 | 무는 것 |
|---|---|---|---|
| 1 | 기존 역할 정책 유지 + 필요 시 외부 활용 | §2.1 신설 절(기존 3레인 불변) | A0·A1, B1 |
| 2 | 단순 반복 구현·가벼운 테스트 → OpenCode 사전 설정 모델 | §2.1(b)(e) + §7 안 A | A1 |
| 3 | 복수 AI 도구 다면 리뷰 | §3.2 · §3.6 | C1·C2 |
| 4 | 카피=Gemini Pro / 그룹화·명료화=Codex·GPT | **이미 충족**(`external-model-consult` provider 표) + §2.3 이 라우팅에서 가리킴 | — (기존 본문) |
| 5 | 최초 설정·복수 도구 패널은 사전 확인 | §2.2 · §3.2(a) | A2·C1 |
| 6 | 못 쓰거나 정책 충돌 시 임의 진행 금지·보고 | §2.1(d) · §2.4 · §4.1 | A4·B1·D1 |
| — | 보안정보 외부 전달 금지 | 기존 가드레일(secret-shaped prompt exit 4) 유지 + §2.2 가 저장소 노출을 확인 대상으로 승격 | 기존 `consult-model-tier` |
| — | 생성 결과 검증 후 반영 | §2.1(b) P3(교차검증 전엔 아무것도 게이트 못 함) | A1 |

---

## 부록. 이 설계가 근거로 삼은 실행 출력 (재현 가능, 전부 읽기 전용)

```bash
gh issue view 286                                     # success_criteria 원문
opencode --help          # → `opencode run [message..]` · `opencode models [provider]`
opencode run --help      # → `-m, --model  model to use in the format of provider/model` (생략 시 사용자 config)
grep -rInE '\b(gemini|gpt|glm|kimi|codex|opencode|agy)[- ]?[0-9]+\.[0-9]+' templates/   # 3건 (§4.4)
grep -rn "1024" tests/ src/                           # → audit-harness-fit-skill.test.ts:90 한 곳뿐
grep -rn "assetBodyTokens" tests/ src/                # → 본문 토큰 예산 게이트 없음
python3 …                                             # description folded 자 수 1,316 / 803 / 1,859
```

**미검증으로 남는 것**: 세 외부 CLI 의 실동작·인증 상태(존재와 `--help` 만 확인, 실호출 없음) ·
게이트 E/F 가 실제로 red 를 내는지(구현 단계의 음성 대조에서 확인) · 신규 테스트가
branches 88 커버리지에 미치는 영향.
