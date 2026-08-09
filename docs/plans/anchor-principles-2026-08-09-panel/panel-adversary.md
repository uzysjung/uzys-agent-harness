# 적대적 렌즈 — 이슈 #287 을 배포하면 무엇이 잘못 돌아가는가

작성 2026-08-09 · 리포 무수정(읽기 전용) · 브랜치 `main` @ `2851c34` · package.json `26.144.0`

전제: **7원칙의 정당성은 다투지 않는다.** 이 문서는 채택했을 때 **구체적으로 무엇이 잘못
돌아가는지**만 적는다. 모든 논거에 `입력 → 잘못된 결과` 시나리오를 붙였고, 못 붙인 논거는 버렸다.
글자 수·토큰·"8줄"은 근거로 쓰지 않았다.

---

## 0. 이 렌즈가 직접 측정한 것 (탐지기 검증 포함)

| 측정 | 방법 | 결과 |
|---|---|---|
| 앵커 파리티 게이트 현재 상태 | `npx vitest run tests/lane-principle-anchor-parity.test.ts` | **27 passed** (알려진 양성 = 탐지기 살아 있음) |
| 3축 채점 (현재본 / 제안 / 내 복원안 / 음성 대조) | 게이트의 정규식 + **`normalize()` 공백 정규화까지** 복제 (`scratchpad/axis-adv.mjs`) | 현재본 PASS×3 · **제안 FAIL×3** · 복원안 PASS×3 · 음성 대조 FAIL |
| 자산 지목 수 | 알려진 양성(현재본 3건)으로 탐지기 검증 후 제안 측정 | 현재본 5 → 제안 **2** (게이트 하한 `> 2`) |
| 룰의 CLI 도달 범위 | canary(`AGENTS` 6/1건 검출)로 탐지기 검증 후 `rules` 검색 | Codex `config.toml.template`·`transform.ts` 에 `rules` 참조 **0** · Antigravity 는 앵커 1파일만 · OpenCode 는 `.claude/rules/*.md` 글롭(양성 대조) |

> ⚠ **내 첫 측정은 틀렸다.** 복제 스크립트에 게이트의 `normalize()`(공백 → 단일 스페이스)를
> 빠뜨려, 줄바꿈이 낀 문장을 "술어 없음"으로 오판했다. 위 수치는 정규화를 넣고 **다시 잰 값**이고,
> 그 전후로 알려진 양성·음성 대조를 둘 다 통과시켰다. 이 오류 자체가 §A-9(부재 확인) 논거의
> 실사례다.

---

## P0-1. §5 마지막 문장이 **거짓출하의 합법 경로**를 새로 만든다

**대상**: 제안 §5 — *"If no reviewer is available, disclose that limitation and do not represent
self-review as independent review."*

**입력 → 잘못된 결과**
1. 에이전트가 변경을 끝낸다. 오케스트레이터가 리뷰어를 안 띄웠다.
2. §5 는 "리뷰어가 없으면 그 한계를 밝히라"고 허용한다. 에이전트가
   *"independent review: not available — self-reviewed, disclosed"* 라고 적는다.
3. 제안 §7 은 보고 항목에 *"what independent review found"* 를 **의무**로 넣었다. 위 문장이 그
   칸을 형식적으로 채운다 → **보고서가 규격에 맞는다.**
4. 그대로 머지·배포된다.

**왜 이게 사고인가 (근거)**
- `templates/rules/ship-checklist.md:5` 는 예외 절이 **없다**: *"머지는 그 변경을 만들지 않은
  레인의 리뷰를 거친다. 만든 쪽이 자기 산출물을 판정하면 그건 검증이 아니다."* 같은 npm 패키지로
  나가는 두 문서가 **정반대**를 말한다 — 하나는 절대 금지, 하나는 면제 조건. 상충하는 지시는
  임의로 선택된다.
- 그리고 **룰은 4 CLI 중 2곳에만 도달한다**(§0 실측). Codex·Antigravity 설치본에서는 앵커의
  면제 조항이 **유일한 텍스트**다 — 상충조차 안 하고 그냥 면제만 남는다.
- *"available"* 은 관측 불가능한 술어다. 서브에이전트는 언제나 띄울 수 있으므로 "없다"는 조건이
  아니라 **에이전트 자신의 결정**이다. 현재본 `templates/CLAUDE.md:95` 는 이 구멍이 없다:
  *"At those two points an unreviewed artifact is not verified."* 로 끝난다.

**고쳐 쓴 문장** (§5 마지막 문장 대체)
```
Independent review means a separate agent that did not produce the work; starting one is always
available, so "no reviewer" is a decision and not a condition. If you proceed without one anyway,
the artifact stays unverified: say so in the report, do not merge or deploy it as verified, and
never present self-review as independent review.
```
면제가 **차단**으로 바뀐다. 밝히는 것은 여전히 의무지만, 밝힌다고 통과하지는 않는다.

---

## P0-2. 앵커 파리티 게이트 **12 케이스**가 red — 그리고 게이트를 고치면 봉합해 둔 결함이 풀린다

**대상**: 제안 §1(적대적 패널 문장 삭제) · §5(“other than the one that produced …” / “verifies the
work itself rather than trusting …” 삭제)

**실측** (탐지기 검증 완료 — §0)
```
== templates/CLAUDE.md (현재본, paragraphs=40)   ← 알려진 양성
   PASS 설계 리뷰 분리   PASS 검증의 자기 증거   PASS 적대적 패널의 문턱
== proposal-287.md      (제안,   paragraphs=36)
   FAIL 설계 리뷰 분리   [artifact=true  lane=false]
   FAIL 검증의 자기 증거 [artifact=true  lane=false]
   FAIL 적대적 패널의 문턱 [artifact=false lane=true]
```
실패 케이스 = 앵커 4종(claude·codex·opencode·antigravity) × 축 3 = **12**.

**입력 → 잘못된 결과**
- 입력: 제안 본문으로 `templates/CLAUDE.md` 교체 → `npm run ci`.
- 결과 ⓐ: red. `npx vitest related templates/CLAUDE.md` 는 **0건**을 주므로 영향 범위를 도구로
  고르면 이 red 를 못 본다(`.claude/rules/test-policy.md` §영향 범위).
- 결과 ⓑ(더 나쁜 쪽): 다음 세션이 **문안 대신 게이트를 고친다.** 축을 지우는 순간, 이 게이트가
  막던 실패 — *배포 앵커에서 원칙이 비대칭으로 살아 claude 외 3 CLI 에 거짓 문장이 나갔던 사고*
  (`tests/lane-principle-anchor-parity.test.ts:14-19`) — 가 아무 감시 없이 되돌아온다.

**고쳐 쓴 문장** — 아래 3문단을 넣으면 **3축 전부 PASS**(복제 탐지기로 확인, 음성 대조 포함).
동시에 P1-5(머지 시점)도 같이 닫힌다.

§1 끝에 1문단:
```
When independent lanes disagree, or the call is genuinely uncertain and expensive to reverse,
settle it with an adversarial panel of independent reviewers rather than the loudest lane. On
smaller calls take the better-evidenced answer — a panel costs more than the decision is worth.
```
§5 의 번호 목록을 두 문단으로:
```
Independent review is required at two points, and it is done by an agent other than the one that
produced the work: a completed specification, plan, or design before anything is built on it, and
any completed change before it is merged into the default branch or deployed, whichever comes
first.

Give the reviewer the completion criteria and the relevant constraints. A reviewer verifies the
work itself rather than trusting the author's report; independent review supplements direct
verification and does not replace it. At these two points an unreviewed artifact is not verified.
```
> **주의**: 게이트는 문단 스코프이므로 두 성분이 **한 문단 안**에 있어야 한다. 번호 목록으로 두려면
> 각 항목 줄에 술어를 붙여야 한다(`1. A completed specification, plan, or design, reviewed by an
> agent other than the one that produced it, before anything is built on it.`).
> 그리고 게이트는 공백을 정규화하므로 줄바꿈이 껴도 무방하다 — 이건 내가 한 번 오판한 지점이다.

---

## P0-3. 상시 스킬 절 삭제 → **우리가 파는 감사 스킬이 우리 배포본을 결함으로 지목**한다

**대상**: 제안이 통째로 지운 `## Skills that apply continuously`(현재본 L127-139)

**입력 → 잘못된 결과**
1. 사용자가 하네스를 깔고 `clear-korean-communication`·`task-brief`·`model-orchestration` 을 선택.
2. 앵커에 발화 지점이 없다 → 세 스킬은 **디스크립터만 매 세션 얹고 한 번도 안 돈다.**
   승인 요청은 다시 산문 덩어리로 돌아오고(사용자가 명시적으로 고친 형태), 위임은 임의 모델로 간다.
3. 사용자가 같은 패키지의 `audit-harness-fit` 스킬을 돌린다 →
   `templates/skills/audit-harness-fit/SKILL.md` §"The reverse move — a skill that never fires" 가
   *"Those need one resident line saying when they apply; without it the skill is installed, costs a
   descriptor every session, and never runs."* 라고 판정하고, **그 세 스킬의 필요한 상주 줄을 표로
   지정**한다. → 제품이 제품 자신을 결함으로 보고한다.

**부수 사실(대체재 없음)**: `templates/hooks/task-brief-nudge.sh` 는 존재하지만 codex 는
`HOOK_NAMES = ["session-start"]` 하나만 배선한다(`src/codex/transform.ts:63`) — 4 CLI 중 3곳에서
**앵커 줄이 유일한 발화 지점**이다.

**게이트도 같이 red**: `tests/resident-doc-asset-reachability.test.ts:188-194` 의 canary
`expect(references).toBeGreaterThan(2)`. 자산 지목은 현재 5건(앵커 3 + `playwright-launch.md` 2)
이고 이 절을 지우면 **2** 가 되어 하한을 깬다. 하한을 내리면 그 게이트는 "위반 0"이 참인지
무의미한지를 못 가른다 — 즉 **죽는다.**

**고쳐 쓴 문장** (절 전체 유지, 문장만 다듬음)
```
## Skills that apply continuously

A skill loads when it looks relevant to the prompt. That is enough for task-shaped skills and not
enough for these, which apply to every response or every delegation — so each one is named here.
Each is selected individually at install time, hence the condition on every line.

- `clear-korean-communication`, where installed — applies to every answer, report, and approval
  request, not only at the moment approval is asked for.
- `task-brief`, where installed — normalize an incoming request into the brief shape before
  starting, fill the fields it left open from context, and show the filled-in brief, marking which
  values were assumed.
- `model-orchestration`, where installed — when work is delegated, it decides which model and
  which effort each lane gets.
```

---

## P0-4. §3 “Delete verified-unused paths” 를 **남의 프로젝트에 파일을 까는 CLI** 가 따르면

**대상**: 제안 §3 — *"Do not preserve backward compatibility unless an active contract or persisted
data requires it. Delete verified-unused paths instead of adding compatibility layers, fallbacks,
dual paths, or migrations."*

이 문장은 저장소 안쪽만 보는 술어인데, 이 저장소의 **소비자는 남의 디스크에 있다.** 세 개의
구체적 사고가 나온다.

### ⓐ 삭제가 **원격 파일 삭제로 전파**된다

`src/update-mode.ts:685-712 pruneOrphans()` — 사용자의 `.claude/rules|agents|commands/uzys|hooks`
안에 있는데 `templates/` 에 더 이상 없는 파일을 `unlinkSync` 한다. 백업은 **사용자가 편집한
경우에만** 뜬다(`isHarnessOwned` false → `backupFile`). 미편집이면 백업 없이 사라진다.

- 입력: "안 쓰는 룰 정리해줘" → 에이전트가 `templates/rules/playwright-launch.md` 를 지운다
  (이 리포는 UI 트랙을 안 쓰므로 "verified-unused" 로 보인다).
- 결과: 다음 `update` 를 도는 **모든 설치본에서** `.claude/rules/playwright-launch.md` 가 백업 없이
  삭제된다. 사용자는 자기가 쓰던 룰이 사라진 것을 릴리스 노트로만 알 수 있다.

### ⓑ "verified-unused" 를 **이 저장소에서 판정할 수 없다**

옛 설치본을 위해 존재하는 코드는 리포 안에 소비자가 없다:
- `src/update-mode.ts:50` `LEGACY_ANCHOR_FILE = ".claude/CLAUDE.md"` — 옛 앵커 안내.
- `src/install-log.ts:448` — `[installLogPath, legacyInstallLogPath].find(...)` **dual path**.
- `src/install-log.ts:433 migrateAwayLegacyLog()` — **migration**.
- `src/state.ts:30 LEGACY_SIGNATURES` — `htmx.md`·`nextjs.md`·`data-analysis.md`·`pyside6.md`.
  **이 네 룰은 현재 `templates/rules/` 에 없다**(현재 7종). 리포 안에서만 보면 전부 죽은 항목이다.

제안 §3 은 이것들을 "compatibility layers, fallbacks, dual paths, or migrations" 로 **이름까지
정확히 지목해** 삭제하라고 말한다.
- 입력: "install-log.ts 정리" → dual read 를 단일 경로로 줄인다.
- 결과: 옛 버전으로 깐 프로젝트에서 `readInstallLog` 가 null → `detectInstallState` 가 "미설치"로
  판정 → 위저드가 **기설치 프로젝트에 신규 설치 흐름**을 태운다(`src/state.ts:55-64` 가 정확히 그
  오판을 막으려고 있는 코드다).

### ⓒ 이 사이클이 **방금 머지한 작업**을 §3 은 금지한다

`src/update-mode.ts:236-250` `installNewAssets()` — 주석이 그대로다:
*"릴리즈가 자산을 추가하면 기존 설치본은 update 를 몇 번 돌려도 그 파일을 영영 못 받는다."*
이것은 정의상 **migration** 이고, 커밋 `2851c34`(#283)로 방금 들어왔다. 제안 §3 이 그때 발효
중이었다면 "migration 대신 삭제하라"가 근거로 인용됐을 것이다.

**고쳐 쓴 문장** (§3 ¶4 대체)
```
Delete a path you have verified is unused instead of wrapping it in a compatibility layer,
fallback, dual path, or migration. A path counts as verified-unused only when every consumer is
inside this repository and you have checked them. When this repository ships something others
install or depend on — a published package, a documented API, a file written into someone else's
project, or persisted data — removal and the migration that carries existing installs forward are
one decision, and it needs explicit authorization. Say which consumers you could not check.
```
원칙(하위호환을 기본값으로 껴안지 않는다)은 그대로 두고, **판별자를 관측 가능하게** 만들고
**바깥 소비자**를 승인 경계로 끌어온다.

---

## P1-5. §4 안에서 **두 문단이 서로를 부정**한다 (삭제 허가 ↔ 죽은 코드 방치)

**대상**: 제안 §4 ¶1 *"Remove only artifacts made obsolete by the change **or paths verified as
unused and safe to remove**."* ↔ §4 ¶2 *"Leave unrelated dead code untouched."*

- 입력: `src/installer.ts` 의 버그 하나를 고치는 중, 호출자 없는 헬퍼를 발견.
- 결과: ¶1 은 지우라 하고 ¶2 는 두라 한다. 에이전트는 둘 중 하나를 임의로 고르고, 리뷰어는
  **반대쪽을 인용해** 반려할 수 있다. diff 는 요청 범위를 넘고, 이는 §4 가 막으려던 바로 그것이다.
- 현재본에는 이 충돌이 없다(`templates/CLAUDE.md:59` *"Remove only artifacts made obsolete by your
  own change."* + L61 *"Leave unrelated dead code untouched."*). **제안이 새로 만든 모순이다.**

**고쳐 쓴 문장** (§4 ¶1 마지막 절 대체)
```
Remove only artifacts made obsolete by the change itself. A path that is merely unused is outside
this change — propose its removal separately.
```
삭제 허가는 §3(P0-4 개정문)이 소유하고, §4 는 "요청 범위만" 이라는 자기 역할로 돌아간다.

---

## P1-6. §5 가 리뷰 시점을 **"배포 전"** 으로 고정해 머지 단 방어를 비운다

**대상**: 제안 §5 목록 2항 — *"For any completed change before deployment."*

- `templates/rules/ship-checklist.md:5` 가 정면으로 반박한다: *"배포 직전이 아니라 **머지 시점**
  이다 — 리뷰 없이 쌓인 변경은 배포 때 형식만 채워진다."*
- 입력: 한 주 동안 PR 6건을 리뷰 없이 머지 → 릴리스 직전에 전체 diff 를 리뷰 1회.
- 결과: ship-checklist 가 이름 붙여 놓은 실패 그대로다. 그리고 **Codex·Antigravity 에는 그 룰이
  도달하지 않으므로**(§0 실측) 그 두 CLI 에서는 "배포 전 1회"가 유일한 규정이 된다.

**고쳐 쓴 문장**: P0-2 의 §5 첫 문단이 이미 담고 있다 —
`… before it is merged into the default branch or deployed, whichever comes first.`

---

## P1-7. 앵커가 **자산·집행층을 한 글자도 안 가리킨다** — 4 CLI 전부에 닿는 유일한 표면인데

**대상**: 제안 전문. 검증된 실측: 제안에 `hook`·`permission`·`skill` 및 자산 이름 **0건**
(알려진 양성 = 현재본 3건이 잡히는 것을 먼저 확인).

- `src/manifest.ts:227-244` — `.uzys-agent-harness/protect-branch.sh` 와 `spec-drift-check.sh` 가
  **`applies: all`** 로 모든 CLI·모든 트랙에 깔린다.
- 같은 파일 `:231-234` 주석: *"호출 지점은 배포판 룰 둘이 적는다: ship-checklist … doc-governance."*
  그런데 그 룰들은 **Claude Code·OpenCode 에만 도달**한다(§0 실측).
- 입력: Codex 단독 설치. 에이전트가 출하 준비를 한다.
- 결과: `.uzys-agent-harness/` 에 실행 가능한 검사기 2개가 깔려 있는데 **에이전트가 그 존재를 알
  방법이 없다.** drift 게이트는 한 번도 안 돌고 브랜치 보호는 적용되지 않는다. 설치 로그에는
  "설치됨"으로 남는다. 배포 룰 3종이 *"스스로는 존재를 알 수 없으므로 여기 적는다"* 라고 쓴 이유가
  바로 이것인데, 그 문장이 닿지 않는 절반에는 대체재가 없다.

**고쳐 쓴 문장** (§6 끝에 1문단)
```
These principles shape decisions; they do not block actions. Whatever must hold every time belongs
in the enforcement layer — a hook, a permission rule, or a CI gate. This harness also installs
runnable checks under `.uzys-agent-harness/`: read that directory before reporting a verification
as unavailable. If a line here can only be honored by a gate that does not exist, say so and
propose the gate instead of relying on the sentence.
```

---

## P1-8. §3 의 **의존성 추가 허가**가 균형추 없이 나간다

**대상**: 제안 §3 ¶2 — *"Prefer maintained libraries when they reduce total complexity or improve
reliability. Do not reimplement common functionality without a concrete reason."*

- 현재본에는 의존성 추가 지시가 **아예 없다.** 제안이 새로 넣는 허가다.
- §6 의 승인 목록(*destructive, privileged, costly, or shared-state*)에 "의존성 추가"는 없다.
- 균형추는 룰에 있고 그 룰은 절반에만 닿는다: `templates/rules/change-management.md:6`
  (*"외부 의존성 … 은 결정 기록으로 남긴다"*) · `templates/rules/git-policy.md:4`(lock 파일).
- 입력: Codex 단독 설치에서 semver 비교가 필요하다.
- 결과: `npm i semver` — 낯선 사람 저장소에 전이 의존성이 늘고 lock 이 흔들리는데 **승인도 기록도
  없다.** "concrete reason" 은 에이전트가 스스로 판정한다.

**고쳐 쓴 문장** (§3 ¶2 끝에 추가)
```
Adding a dependency changes what this project ships and what its users install. Name the
dependency, the alternative you rejected, and the code it removes, and get approval before adding
it.
```

---

## P1-9. §1 의 조사 의무 + 증거 금지문 삭제 = **꾸며낸 벤치마크**

**대상**: 제안 §1 ¶2 *"Before designing, examine how established products solve the same problem.
Prefer proven patterns."* + 제안이 삭제한 현재본 `templates/CLAUDE.md:26`
*"Do not present assumptions or judgments as evidence."*

두 변경이 곱해진다. 조사 의무는 **트리거·정지 조건·출처 명시 요구가 없고**, 그것을 받아 주던
금지문은 사라졌다(제안은 *"State uncertainty plainly and distinguish facts, assumptions, and
judgments"* — 자기 신고이지 금지가 아니다).

- 입력: 네트워크가 없는 샌드박스(도커 검증 환경·오프라인 CI)에서 "`--json` 플래그 추가".
- 결과: 조회할 수 없으므로 에이전트가 기억에서 *"established products typically …"* 를 써 내고
  그것을 **조사 결과로 보고**한다. 금지문이 없으니 형식상 위반이 아니다. 리뷰어는 그 문장을
  근거로 받는다.
- 이 저장소는 같은 형태로 이미 다쳤다 — `.claude/CLAUDE.md` 가 기록한 v26.138.0 거짓출하와
  "CI exit 0" 보고 3릴리즈분이 전부 미검증 주장을 증거로 낸 사례다.

**고쳐 쓴 문장** (§1 ¶2 + ¶3 첫 문장 대체)
```
When a design is new to this repository and an established product already solves the same
problem, look at how it does before inventing a shape, and name the source you took it from. When
the repository already contains a working precedent, follow the precedent instead of researching.

State uncertainty plainly and label which statements are facts, which are assumptions, and which
are judgments. Never present an assumption or a judgment as evidence.
```

---

## P1-10. H1 `# AGENTS.md` — Claude 설치본에서 **거짓 제목**, 그리고 잘못된 파일에 쓰게 만든다

**대상**: 제안 L1 `# AGENTS.md`

**배선 실측(직접 확인)**
- claude 경로만 **원문 그대로 복사**된다: `src/manifest.ts:217-218`(`source: "CLAUDE.md"`,
  `target: HARNESS_ANCHOR_FILE`). 나머지 3 CLI 는 첫 h1 을 정규식으로 떼고 임베드한다
  (`src/codex/agents-md.ts:35` — `params.claudeMd.replace(/^#\s+.*\r?\n/, "")`).
- **`AGENTS.md` 는 non-claude CLI 에만 만들어진다**(`src/commands/install-render.ts:376,386`).
  claude 단독 설치에는 그런 파일이 없다.

**입력 → 잘못된 결과**
1. claude 단독 설치. 루트 `CLAUDE.md` 가 `@CLAUDE-uzys-harness.md` 를 import 하고, 그 파일을 열면
   제목이 `# AGENTS.md` 다.
2. 사용자가 "이 프로젝트 사실은 어디 적어?" 라고 묻는다.
3. 에이전트는 제목이 가리키는 `AGENTS.md` 를 루트에 만들고 거기에 적는다. **아무도 그 파일을 안
   읽는다.** 같은 설치의 스캐폴드 배너는 반대로 말한다 —
   `src/project-claude-merge.ts:124` 가 Claude Code 는 `CLAUDE-uzys-harness.md`, Codex/OpenCode 는
   `AGENTS.md` 라고 CLI 별로 이름을 구분해 적어 두었다. **한 대상에 이름이 둘**이 되고, 그건 이
   저장소가 반복해서 당한 형태다.

**고쳐 쓴 문장** (L1 대체)
```
# Working Principles
```
파일명·CLI 이름을 제목에 넣지 않는다 — 이름은 설치 경로마다 다르고 본문은 4곳 모두 같다.

---

## P2-11. §2 의 “최소 E2E 경로부터” 가 **버그 픽스에도 발화**한다

**대상**: 제안 §2 마지막 문단 — *"Start with the smallest working end-to-end path and add one
verified capability at a time."*

- 입력: "이 off-by-one 고쳐줘" (기존 코드, E2E 경로가 이미 있다).
- 결과: 조건절이 없으므로 에이전트가 "최소 E2E 경로부터"를 착수 절차로 읽고, 한 줄 수정 앞에
  경로 구성 계획을 세운다. §2 의 나머지 절반(*최소 변경*)과 같은 문단 안에서 충돌한다.

**고쳐 쓴 문장**
```
For work that builds something new, start with the smallest working end-to-end path and add one
verified capability at a time.
```

---

## 이 렌즈가 검증하지 않은 것

- 위 재작성문을 **전부 넣은 파일로 `npm run ci` 를 돌리지 않았다**(리포 무수정 제약). 검증한 것은
  ⓐ 현재본이 실제 게이트에서 27/27 green ⓑ 제안이 3축에서 실패 ⓒ 내 복원 3문단이 3축 전부 PASS
  — 셋 다 게이트의 정규식 + `normalize()` 를 복제한 스크립트로, 알려진 양성·음성 대조를 붙여 쟀다.
- 상주 비용 baseline·`docs/NORTH_STAR.md` 수치 갱신 필요분은 이 렌즈의 관심사가 아니다(다른 렌즈).
- **의견(리포 밖 사실)**: Claude Code 가 `AGENTS.md` 도 읽는지는 이 저장소에 근거가 없다. 읽는다면
  P1-10 의 손해가 "안 읽힘"에서 "같은 원칙이 한 세션에 두 번 상주"로 바뀐다 — 별도 확인 필요.
