# E3 — 이슈 #287 배포본 반영 시 **무엇이 사라지고 무엇이 깨지는가** (리포 실측)

측정일 2026-08-09 · 브랜치 `refactor/rules-minimal-judgment` · 리포 무수정(읽기 전용) ·
package.json `26.144.0`

전제: 7원칙 채택 여부는 사용자가 이미 확정했다. 이 문서는 **처분 목록**이다 — 지키자는 게
아니라 의도적으로 버리기 위해 무엇이 사라지는지 세어 둔다.

---

## 0. 한 줄 요약

배선상 `templates/CLAUDE.md` 는 **4개 CLI 앵커 전부의 단일 원본**이라, 이 파일 하나를 바꾸면
설치 산출물 4종이 동시에 바뀐다. 본문 교체 시 **무는 게이트는 3개 파일 · 실패 예상 16 케이스**이고,
**소실되는 절은 2개(도합 24줄)** 다. 소실 2개 모두 사용자가 직접 지시해 넣은 것이고, 그중 하나는
**우리가 같은 npm 패키지로 파는 스킬(`audit-harness-fit`)이 "이 세 줄을 앵커에 두라"고 명시**하는
대상이라 지우면 배포물 안에서 자기모순이 생긴다.

---

## 1. 배선 실측 — `templates/CLAUDE.md` 는 어디로 나가는가

### 1.1 4개 CLI 산출 경로 (전부 이 한 파일에서 나온다)

| CLI | 설치 산출 경로 | 방식 | 코드 근거 |
|---|---|---|---|
| **claude** | 프로젝트 루트 `CLAUDE-uzys-harness.md` | **원문 그대로 복사** (`copyFile`) | `src/manifest.ts:216-221` (`source: "CLAUDE.md"`, `target: HARNESS_ANCHOR_FILE`) → `src/installer.ts:542,558` |
| claude(루트) | 루트 `CLAUDE.md` | 사용자 소유. 마커 블록 안에 `@CLAUDE-uzys-harness.md` **import 한 줄만** 얹음 | `src/project-claude-merge.ts:24,27,34-36,173-182` · `src/installer.ts:799-815` |
| **codex** | 루트 `AGENTS.md` | 템플릿의 `{PROJECT_RULES}` 에 **본문 전문 임베드**(첫 h1 제거 + `/uzys:`→`/uzys-`) | `src/codex/transform.ts:71,78-85` · `src/codex/agents-md.ts:33-41` |
| **opencode** | 루트 `AGENTS.md` (codex 와 **같은 경로**) | 동일 임베드 | `src/opencode/transform.ts:62,72-78` · `src/opencode/agents-md.ts:31-38` |
| **antigravity** | `.agents/rules/uzys-harness.md` | 동일 임베드(codex 렌더러 재사용) | `src/antigravity/transform.ts:102-119` |

- 파일명 상수 SSOT = `src/project-claude-merge.ts:24` `HARNESS_ANCHOR_FILE = "CLAUDE-uzys-harness.md"`.
- **claude 경로만 렌더를 거치지 않는다** — 원문이 그대로 설치된다(`copyFile`, `src/installer.ts:558`).
  → 제안 본문의 H1 이 `# AGENTS.md` 이므로, **Claude Code 설치자는 `CLAUDE-uzys-harness.md` 를
  열었을 때 제목이 `# AGENTS.md` 인 파일을 받는다.** 나머지 3 CLI 는 `renderAgentsMd` 가 첫 h1 을
  지우므로(`src/codex/agents-md.ts:35`) 영향이 없다. → 배포 전 H1 처분 필요.

### 1.2 트랙별 fragment 병합은 **없다**

`templates/project-claude/` 는 **존재하지 않는다**(`ls templates/` — agents·antigravity·CLAUDE.md·
codex·commands·docs·github-workflows·hooks·mcp-allowlist.example·mcp.json·opencode·rules·scripts·
settings.json·skills·track-mcp-map.tsv). 프로젝트 맥락은 트랙 무관 fill 스캐폴드
(`renderFillScaffold()`, `src/project-claude-merge.ts:133-139`) 하나가 4 CLI 에 **바이트 동일**로
간다(`{PROJECT_CONTEXT}`). 즉 앵커 본문에 트랙 분기가 섞일 여지가 없다 — 원칙 문서로 가기에 유리한
현 구조다.

### 1.3 dyld §1 규격("중복 보관 말고 임포트·심볼릭 링크") 대비 판정

기준 원문(`docs/research/claude-md-standards-2026-08-09/dyld-articles.md:32`):
> ✗ **두 파일에 같은 룰을 중복 보관** — `CLAUDE.md` 에서 `@AGENTS.md` 임포트하거나 심볼릭 링크

| 축 | 우리 배선 | 규격 적합 |
|---|---|---|
| 루트 `CLAUDE.md` ↔ 앵커 파일 | **import 배선** (`@CLAUDE-uzys-harness.md`, 마커 블록) | **적합** |
| 앵커 파일 ↔ `AGENTS.md` / `.agents/rules/uzys-harness.md` | **디스크상 전문 사본**(임베드 렌더) | **부적합 — 문자대로는 위반** |
| 원본(SSOT) 축 | 사본 전부가 `templates/CLAUDE.md` 한 파일에서 install/update 때마다 재생성 | **취지는 충족** |

판정: **"drift 위험"은 없고 "중복 파일"은 있다.** claude + codex 를 함께 깐 프로젝트는 같은 원칙
본문을 담은 파일 2개(`CLAUDE-uzys-harness.md`, `AGENTS.md`)를 디스크에 갖는다. 다만 ⓐ 두 파일은
서로 다른 CLI 가 읽으므로 한 세션에서 두 번 상주하지는 않고, ⓑ 사본은 손으로 유지되지 않고
`update` 가 원본에서 다시 찍는다(`src/update-mode.ts:364-378`, `refreshOnly`). Codex 에 `@import`
가 없다는 것도 같은 원장이 적어 둔 사실이다(`dyld-articles.md:52` — *"공식 임포트 없음 — 디렉터리
계층으로"*). **따라서 현 배선은 규격의 목적(한 원본)은 지키고 수단(한 파일)은 못 지키는 상태이고,
Codex 쪽에 임포트 문법이 없는 한 바꿀 수단이 없다.** — 이 판정은 #287 반영과 독립적이며, 반영해도
그대로다.

*미검증*: Claude Code 가 `AGENTS.md` 도 읽는지는 이 리포에 근거가 없다. 읽는다면 claude+codex 동시
설치에서 **같은 원칙이 한 세션에 2번 상주**하게 되므로 별도 확인이 필요하다. (의견 — 리포 밖 사실)

### 1.4 분량 기준 대비 (기준 원장 `dyld-articles.md:36-40`)

| 대상 | 기준 | AS-IS | TO-BE(#287) |
|---|---|---|---|
| CLAUDE.md(루트) | ~200줄 | 142줄 ✅ | 118줄 ✅ |
| AGENTS.md(병합 누적) | 32 KiB | codex 13,341 B / opencode 12,635 B / antigravity 11,691 B ✅ | 11,707 / 11,001 / 10,057 B ✅ |

(AGENTS.md 값은 `renderAgentsMd` 를 실제 템플릿에 돌려 계산. `{PROJECT_CONTEXT}` 는 실측
스캐폴드 크기 3,845자로 치환.)

---

## 2. 소실분 목록 — AS-IS 142줄 ↔ 제안 118줄 문단 대조

**절 단위로 통째 사라지는 것 2개, 문장 단위로 사라지는 것 3개.** 각각 도입 근거를 붙였다.

### ⓐ `## Decisions and explanations` 절 전체 (AS-IS L119-125, 7줄) — **소실**

AS-IS 본문:
> Present a decision or approval request as AS-IS → TO-BE with a recommendation and the trade-off,
> not as prose. … show the choice the way they will meet it — a comparison table, a sketch, a
> rendered example … When the reader says they don't follow, fix what the words point at before
> rewording; the usual cause is one name meaning two things.

제안본에 **대응 문단 없음**(제안 전문에 "AS-IS", "trade-off 제시", "recommendation" 표현 0건).

**도입 근거** — `docs/decisions/ADR-055-claudemd-role-split.md:31-35` (Decision 삽입 3):
> **삽입 3**(파일 끝, `## Decisions and explanations`) — 옛 `When Requesting Decisions` **5요소를
> 전부** 옮긴다(전후 맥락 상세 · 추천 · UI/UX 형태 · AS-IS→TO-BE · trade-off). 그리고
> *"이름 하나가 두 대상을 가리키는 것"*이 설명 실패의 통상 원인이라는 진단.

같은 ADR `:75` (Consequences 이관표):
> `When Requesting Decisions` **5요소 전부**(ⓐ전후 맥락 상세 · ⓑ추천 · ⓒUI/UX 형태 · ⓓAS-IS/TO-BE ·
> ⓔtrade-off) → **삽입 3 이 전부 대체 — 유실 0.** 착수 후 사용자가 직전 결정을 뒤집었다:
> *"미안 claude.md에 추가해서 넣는 것으로 ⓐⓒ 해줘"*.

즉 이 절은 **사용자가 착수 중 직접 뒤집어서 배포판에 넣게 한 것**이고, 지우면 그 5요소는
배포물 어디에도 남지 않는다(리포 개발용 `.claude/CLAUDE.md` 의 "의사결정 및 컨펌 요청 시" 4줄은
**설치자에게 나가지 않는다**).

### ⓑ `## Skills that apply continuously` 절 전체 + 맨 끝 문장 (AS-IS L127-142, 16줄) — **소실**

3개 스킬의 상시 발화 지점(`clear-korean-communication` / `task-brief` / `model-orchestration`,
각 줄에 `where installed` 조건 부착) + 마지막 문장:
> Unless this repository defines otherwise, a merge is gated on regression tests covering what
> changed, and a release additionally runs the full suite and the end-to-end flows.

제안본에 대응 문단 없음.

**도입 근거** — 커밋 `6e6079c` "feat: 하네스 감사에 모델 세대 리셋(ablation) 규칙 + 상시 스킬 발화
지점 (#281)" 본문:
> ⓑ 상시 적용 스킬은 설치돼 있어도 **발화 지점이 없으면 안 돈다.** 스킬은 프롬프트와 관련 있어
> 보일 때 로드되는데, "모든 답변에 적용" 류는 그 판정에 안 걸린다. 앵커에 한 줄씩 넣었다 …
> 세 스킬의 설치 조건이 각각 다르다 … 각 줄에 `where installed` 를 붙였다 —
> `resident-doc-asset-reachability` 가 정확히 그 상태를 red 로 잡아 줬고, 조건을 다시 떼면 red 로
> 돌아가는 것까지 확인했다(음성 대조).

**⚠ 배포물 자기모순 위험**: 같은 npm 패키지로 나가는 스킬이 이 세 줄을 **규정**한다 —
`templates/skills/audit-harness-fit/SKILL.md:311-330` §"The reverse move — a skill that never fires":
> Those need one resident line saying when they apply; without it the skill is installed, costs a
> descriptor every session, and never runs. … | `clear-korean-communication` | It applies to every
> answer, report, and approval request … | `task-brief` | … | `model-orchestration` | …

즉 절을 지우면 **우리가 파는 감사 스킬이 "없다"고 지적할 상태를 우리 배포 앵커가 갖게 된다.**
지우려면 `audit-harness-fit` SKILL.md 의 이 표도 같은 커밋에서 처분해야 한다.

맨 끝 검증 티어 문장의 근거 = `docs/decisions/ADR-056-verification-tier.md`(제목:
*"검증 실행을 시점별로 나눈다 — 커밋 없음 / 머지 영향 범위 + 독립 리뷰 / 배포 full + CI green 전제"*).
배포 룰 쪽은 ADR-067 로 슬림해져 `templates/rules/test-policy.md:17-18` 이
*"Follow the repository-defined CI gates"* 로만 말한다 — **머지/배포 티어의 기본값을 이름으로
말하는 곳은 현재 앵커의 이 한 문장뿐이다.**

### ⓒ §1 "adversarial panel" 문장 (AS-IS L22-24) — **소실**

> When independent lanes disagree, or the call is genuinely uncertain and expensive to reverse,
> settle it with an adversarial panel of independent reviewers rather than the loudest lane;
> on smaller calls take the better-evidenced answer, since a panel costs more than the decision is worth.

제안 §1 은 `expensive to reverse` 는 유지하나 **패널과 문턱이 없다**("present the options and
trade-offs and ask before proceeding" 으로 대체).

**도입 근거** — `ADR-055:27-28`:
> **삽입 1**(원칙 1 끝) — 적대적 패널을 **문턱과 함께** 규정. 문턱이 없으면 두 방향으로 다
> 실패한다: 안 쓰거나(사용자가 두 번 지시해야 했다), 사소한 것에까지 써서 비용이 판단 가치를 넘는다.

### ⓓ §4 "A reviewer verifies the work itself rather than trusting the author's report." — **소실**

제안 §5 는 *"Independent review supplements direct verification; it does not replace it"* 은
유지하나 **"보고를 믿는 대신 직접 확인한다"는 술어가 없다**.

**도입 근거** — `ADR-055:29-30`:
> **삽입 2**(원칙 4 안) — *"A reviewer verifies the work itself rather than trusting the author's
> report."* 리뷰어가 **보고서를 믿는 대신 자기 증거를 얻는다**.

### ⓔ §4 "an agent other than the one that produced the work" 어구 — **표현 교체**

제안 §5 = "Independent review by another agent is required". 의미는 보존되나 **"만든 쪽이 아닌"**
을 명시하는 어구가 사라진다. → §3 의 게이트가 이 어구를 채점한다(아래).

### 보존/추가된 것 (참고 — 소실 아님)

- 보존: 사전 조사(§1) · 최소 충분해 · 외과적 변경 · 워크트리 보존 · 완료 기준 사전 정의 ·
  미검증≠완료 · 고영향 경계 승인 · 반복 시도 정지+핸드오프. (AS-IS 6원칙 골자는 전부 대응됨)
- **추가**(AS-IS 에 없던 것): 기성 제품 선행 조사, 모듈 경계/인터페이스 폭, 의존성 실측 후 도입,
  아키텍처 수명, **하위 호환 금지·미사용 경로 삭제**, 최소 E2E 경로부터 레이어로 성장,
  그리고 §5 의 *"If no reviewer is available, disclose that limitation and do not represent
  self-review as independent review."* — 마지막 항은 우리 거짓출하 이력에 정면으로 대응하는
  **강화**다.

---

## 3. 무는 게이트 — 깨질 것을 특정한다

후보 수집: `grep -rln "CLAUDE" tests/` → 29개 파일. **전부 열어 확인**한 결과 실제 내용을 무는 것은
아래 3개. 나머지는 합성 fixture(자기 템플릿을 만들어 넣는 테스트) 또는 파일 존재·경로 계약만 단언.

기준선: 이 6개 파일 **현재 전부 green** (106 tests passed, `npx vitest run …` 2.06s) — 이후의
red 는 변경 탓임이 귀속된다.

### 게이트 ①  `tests/lane-principle-anchor-parity.test.ts` — **깨진다 (12 케이스)**

무는 것: 앵커 4종(**렌더 산출물** — claude 원문 + codex/opencode/antigravity 임베드 결과)에 대해
**축 3개 × "2성분이 같은 문단 안에" 동시 존재**.

| 축 (`:80-117`) | 산출물 명사 | 비생산 레인 술어 |
|---|---|---|
| 설계 리뷰 분리 | `spec\|PRD\|plan\|기획서\|계획` | `other than the (one\|lane\|agent) (that\|who) produced\|other than the author\|not (its\|the) author\|작성자가 아닌…` |
| 검증의 자기 증거 | `verification\|verifying\|검증` | `verifies the work itself\|rather than trusting\|its own evidence\|re-?run\|직접 다시 돌려…` |
| 적대적 패널의 문턱 | `adversarial[^.]{0,40}panel\|적대적 다면…` | `expensive to reverse\|hard to reverse\|Major CR\|되돌리기 (어려\|비싼…)` |

**실측**(테스트의 정규식을 그대로 복제해 실행. AS-IS 로 먼저 돌려 **탐지기가 초록을 내는지 확인**한
뒤 제안본을 넣었다):

```
=== AS-IS templates/CLAUDE.md  (문단 40개)
  [설계 리뷰 분리] PASS   [검증의 자기 증거] PASS   [적대적 패널의 문턱] PASS
=== TO-BE issue#287       (문단 35개)
  [설계 리뷰 분리]      FAIL — 비생산 레인 술어 없음
  [검증의 자기 증거]    FAIL — 비생산 레인 술어 없음
  [적대적 패널의 문턱]  FAIL — 산출물 명사 없음
```

- 실패 케이스 수 = 앵커 4종(claude·codex·opencode·antigravity) × 축 3 = **12**.
  (`ALL_ANCHORS.flatMap(...)` `:297-311`, `it.each`)
- 리포 앵커 `.claude/CLAUDE.md` 는 **별도 채점**이고 축 4개 전부 PASS — 배포본을 바꿔도
  이 게이트가 개발용 앵커를 함께 요구하지는 않는다(실측 확인).
- 처분 선택지: ⓐ 제안 §5 에 `other than the one that produced …` / `verifies the work itself
  rather than trusting …` 어구를 되살리고 §1 에 패널 문장을 되살린다 ⓑ 축을 삭제·완화한다
  (그 경우 ADR-054/055 가 봉합한 결함이 **게이트 없이** 남는다는 사실을 ADR 에 명시해야 한다).
- 참고: `embedProbe`(`:154-161`)와 `문단 > 5`(`:270-277`) 단언은 제안본에서도 통과한다(문단 35개).

### 게이트 ②  `tests/resident-doc-asset-reachability.test.ts` — **깨진다 (1 케이스)**

무는 것: `it("지목을 실제로 찾아낸다 (헛통과 차단)")` — `expect(references).toBeGreaterThan(2)`
(`:188-194`, 주석 *"실측 3 — 동일 취지로 실측 근처로 조임"*).

**실측**(테스트의 `referenceRegex` 를 복제해 배송 상주 문서 전체에 실행):

```
templates/CLAUDE.md:133  → clear-korean-communication   «`clear-korean-communication`»
templates/CLAUDE.md:135  → task-brief                   «`task-brief`»
templates/CLAUDE.md:138  → model-orchestration          «`model-orchestration`»
templates/rules/playwright-launch.md:3   → ui-visual-review
templates/rules/playwright-launch.md:14  → ui-visual-review
TOTAL references = 5   (게이트 canary: > 2)
```

**§2ⓑ 를 지우면 5 → 2 가 되어 `> 2` 가 red.** 이 게이트는 "위반 0"이 참인지 무의미한지 가르는
canary 라, 하한을 내리면 게이트가 사실상 죽는다. 처분 선택지: ⓐ 발화 지점 절을 살린다
ⓑ 하한을 내리고 "무는 능력을 잃었다"를 ADR 에 적는다 ⓒ 다른 상주 문서가 자산을 지목하게 한다.

### 게이트 ③  상주 비용 2종 — **깨진다 (5 케이스, baseline·문서 재생성으로 해소)**

`templates/CLAUDE.md` 는 상주 계측에 **포함된다**: `src/context-cost.ts:205`
`const harnessAnchor = fileTokens(join(root, "templates", "CLAUDE.md"))`.

실측(`npm run cost:report tooling`): `CLAUDE.md 2개 ~2647` = **앵커 1,685 + 스캐폴드 962**.
제안본 앵커 = **1,276** → **−409 tok / 전 트랙 동일**(앵커는 `applies: all`).

**③-a `tests/context-cost-ratchet.test.ts`** — "baseline 이 실측보다 부풀려져 있지 않다"
(`:113-124`, 상한 `ceil(실측×1.1)`):

| track | baseline | TO-BE 실측 | 상한 | 판정 |
|---|---|---|---|---|
| executive | 3904 | 3495 | 3845 | **FAIL** |
| project-management | 3650 | 3241 | 3566 | **FAIL** |
| growth-marketing | 3650 | 3241 | 3566 | **FAIL** |
| 나머지 8 트랙 | — | — | — | PASS |

→ 같은 커밋에서 `npm run cost:baseline` 필수(감소 방향이라 정당화 문구는 불필요하나 갱신은 필수).
개수 축(items)은 **불변 23개** — 절을 지워도 파일 수는 그대로다.

**③-b `tests/north-star-cost-figures.test.ts`** — `docs/NORTH_STAR.md` 의 수기 수치와 실측을
tolerance 0 으로 대조(`:49-75`). 현재 문서 표기(`docs/NORTH_STAR.md:112-113`):
> 상주 23개 항목 · ~4,755 tokens/세션 = rules 6개 ~1,092 · **CLAUDE.md 2개 ~2,647** · agent 9개 ~724 · skill 6개 ~292

→ TO-BE 에서 `CLAUDE.md 2개 ~2,238` · 총합 `~4,346` 으로 **같은 커밋에 수기 갱신** 필요.
안 고치면 2 케이스 red.

### 무는 게이트가 **아닌** 것 (열어서 확인함 — 오탐 제거)

| 파일 | 실제로 무는 것 |
|---|---|
| `tests/resident-rule-reference-liveness.test.ts` | 앵커의 `## Rule N` **헤딩**에서 번호 집합을 derive. AS-IS·TO-BE 둘 다 `Rule N` 헤딩 0개 → **영향 없음** |
| `tests/templates-distribution-hygiene.test.ts` | 배포물의 `vNN.N.N`·`ADR-NNN`·`/Users/`·타 프로젝트명. 제안본 **0건**(canary 로 탐지기 무는 것 확인) → 통과 |
| `tests/agents-md-scaffold-parity.test.ts` | AGENTS.md **템플릿**의 `{PROJECT_CONTEXT}` 존재·`git pull` 금지 → 영향 없음 |
| `tests/evidence-templates.test.ts:159-181` | **리포 루트** `CLAUDE.md` 의 `## Active Rules (N개)` 인벤토리(현재 헤더 부재로 무조건 통과) + 스킬 2종 byte-parity → 영향 없음 |
| `tests/doc-governance-baseline-rule.test.ts` | `templates/rules/doc-governance.md` 만 읽음(ADR-067 로 축소) → 영향 없음 |
| `tests/codex/agents-md.test.ts`·`opencode/*`·`antigravity/transform.test.ts` | 합성 fixture(자체 CLAUDE.md 를 만들어 넣음) → 영향 없음 |
| `tests/context-cost.test.ts` | 합성 seed root → 영향 없음 |
| `.github/workflows/test.yml:53-54` · `install-matrix.yml:103,134` | `test -f CLAUDE-uzys-harness.md` **존재만** → 영향 없음 |
| `test/docker/scenarios/scenario-anchor.sh:25` | 존재 + import 1줄 → 영향 없음 |

**전례 경고**: `docs/decisions/ADR-056-verification-tier.md` 실측표 4행 —
> 사고: `templates/CLAUDE.md` 의 `Rule 1~12` 삭제가 **건드리지 않은** `doc-governance-baseline-rule`·
> `resident-doc-asset-reachability` 를 깼다. full 에서만 잡혔다.
> `npx vitest related templates/CLAUDE.md` → **0개** (`No test files found`)

→ 이 파일을 고친 뒤에는 **`npm run ci` 전체**를 돌린다. 도구로 영향 범위를 고르면 0건이 나온다.

---

## 4. 분량·비용 사실 (보고용 — 판정 근거 아님)

| 파일 | 줄 | 문자 | 추정 토큰(trim/4) |
|---|---|---|---|
| `templates/CLAUDE.md` (AS-IS) | 142 | 6,739 | **1,685** |
| 이슈 #287 제안 (TO-BE) | 118 | 5,103 | **1,276** |
| 리포 루트 `CLAUDE.md`(개발용) | 106 | 5,045 | 1,261 |
| 리포 `.claude/CLAUDE.md`(레인 원칙) | 44 | 1,820 | 455 |

- 상주 계측 포함 여부: **포함**(`src/context-cost.ts:205`). tooling 트랙 상주
  **23개 ~4,755 → 23개 ~4,346 tok (−409, −8.6%)**, 항목 수 불변.
- 렌더 산출물: codex AGENTS.md 13,341 B → 11,707 B (32 KiB 한도의 40.7% → 35.7%).
- **감소분의 출처는 전부 삭제된 두 절이다**: `## Decisions and explanations` 498자 ~125 tok +
  `## Skills that apply continuously`(끝 문장 포함) 1,099자 ~275 tok = **~400 tok**.
  전체 감소가 −409 tok 이므로, **7원칙 본문 자체는 6원칙 본문과 사실상 등가 교환(≈ −9 tok)**이다.
  → "제안이 더 짧다"는 원칙 압축의 결과가 아니라 **두 절 삭제의 결과**다. 토큰을 근거로
  삼지 않는다는 전제와도 일치하는 방향이지만, 절 처분을 토큰 절감으로 정당화할 수는 없다.

---

## 5. 루트 `CLAUDE.md` · `.claude/CLAUDE.md`(개발용)와의 관계

| 파일 | 배포본 변경 시 따라가야 하는가 | 근거 |
|---|---|---|
| 리포 루트 `CLAUDE.md` | **아니다** | 배포물이 아니다. 무는 게이트는 `evidence-templates.test.ts:159` 하나이고 `## Active Rules (N개)` 헤더가 있을 때만 발동 — 현재 부재 |
| 리포 `.claude/CLAUDE.md` | **아니다** | `lane-principle-anchor-parity` 가 `origin:"repo"` 로 **별도 채점**(`:200-210`, `axesFor`). 실측: 축 4개(설계 리뷰 분리·구현 위임·검증의 자기 증거·적대적 패널) 전부 자력 PASS. 두 앵커 사이 byte-parity 게이트는 없다 — 실제로 두 파일은 언어(영/한)·길이(142/44줄)가 다른데 6개 게이트가 전부 green 이므로 그런 게이트가 존재할 수 없다 |
| 설치되는 루트 `CLAUDE.md`(사용자 프로젝트) | **아니다** | 하네스는 마커 블록 한 줄만 소유(`upsertHarnessImport`). 본문은 사용자 것 |
| `templates/skills/audit-harness-fit/SKILL.md` | **그렇다 (조건부)** | §2ⓑ 를 지우는 경우에 한해. `:322-326` 표가 그 3줄을 앵커에 두라고 규정 — 앵커에서 빼면 배포물 안에서 서로 모순 |
| `docs/NORTH_STAR.md` · `context-cost-baseline.json` | **그렇다 (무조건)** | §3③ — 각각 tolerance 0 정합 게이트와 ratchet 인플레이션 단언이 문다 |
| `templates/rules/*.md` | 아니다 | 앵커 절 이름을 지목하는 배송 룰 0건(grep 확인) |

---

## 6. 처분 체크리스트 (반영 시 같은 커밋에 담을 것)

1. **H1 처분** — `# AGENTS.md` 를 그대로 두면 Claude Code 설치본 `CLAUDE-uzys-harness.md` 의 제목이
   `AGENTS.md` 가 된다(§1.1). 4 CLI 중립 제목으로.
2. **§2ⓐ~ⓔ 를 살릴지 버릴지 명시 결정** — 버리면 ADR 에 "ADR-055 삽입 1·2·3 과 #281 발화 지점을
   철회한다"를 적고 ADR-055/056 의 Status 를 함께 손본다(`change-management` 룰: 한쪽만 고치면
   어느 것이 현행인지 알 수 없다).
3. **게이트 3종 처분** — ① 축 12케이스 ② reachability canary 1케이스 ③ ratchet 3 + NORTH_STAR 2.
   ①②는 문안 복원 또는 게이트 개정 중 택일, ③은 `npm run cost:baseline` + `docs/NORTH_STAR.md`
   수기 갱신.
4. **`audit-harness-fit` SKILL.md 동기화** — §2ⓑ 를 버리는 경우에 한해 `:311-330` 표 처분.
5. **검증** — `npm run ci` **전체**. `vitest related`는 이 파일에 0건을 준다(ADR-056 실측).
