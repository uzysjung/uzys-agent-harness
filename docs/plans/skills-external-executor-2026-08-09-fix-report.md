# F286 — 구현 레인 수정 보고 (검증 레인 P1-1 · P2-1 · P2-2)

수정 2026-08-10 · 브랜치 `feat/external-executor-lane` · 착수 시 HEAD `34f574d`
· 입력 = `docs/plans/skills-external-executor-2026-08-09-verify-report.md`

**나는 검증 레인이 아니다.** 아래 숫자는 전부 내가 이 세션에서 다시 낸 것이고, 판정은 다음
레인 몫이다. git 상태는 바꾸지 않았다(status/diff/log 읽기만 — add·commit·checkout·stash 0회).

---

## 요약

| 항목 | 결과 |
|---|---|
| **P1-1** 앵커 범위 좁히기 | **닫힘** — 생존 변이 3건(M1b·M2b·M10)이 전부 red. 기존 36개 단언 green 유지 |
| **P2-1** mpr 안의 3~4중 서술 | **부분** — 3곳 축약. **`SKILL.md:149` 는 손대지 않았다**(§3.3 에 사유) |
| **P2-2** ADR 예외 조항 | **본문 반영** — 다만 **이 한 줄을 무는 게이트는 없다**(§4.2) |
| `npm run ci` | **EXIT=0** · 1338 passed · Branches 88.8% |
| 두 사본 1:1 | 4/4 identical |
| 건드린 파일 | 5개(스킬 2종 × 두 사본 + 테스트 1) — 예상 범위 안 |

---

## 1. 【P1-1】 검사 단위를 절 슬라이스 → 문장으로 좁혔다

### 1.1 무엇이 문제였나

`unmet()` 이 `a.re.test(text)` 로 **절 슬라이스 전체**를 훑었다. 그래서 "P5 행에 셸 조건이 있다"를
검사하는 앵커가 같은 절 다른 줄의 `from the shell` 로 만족돼, 정작 P5 행의 셸 조건을 지워도
초록이었다. A4·A3 도 같은 방식으로 샜다.

**고친 쪽은 `tests/` 다. 본문은 이 항목에서 한 글자도 바꾸지 않았다.**

### 1.2 어떻게 좁혔나 — `together` 태그 + `units()`

함께 참이어야 하는 앵커를 `together` 태그로 묶고, **한 단위(문장) 안에서** 센다.

```diff
+function units(text: string): string[] {
+  return text
+    .split(/\n(?=[ \t]*(?:[-*+|>#]|\d+\.[ \t]))|\n[ \t]*\n/)
+    .flatMap((block) => block.split(/(?<=[.?!][*_"'”’)\]]{0,4})\s+/))
+    .map((unit) => unit.replace(/\s+/g, " ").trim())
+    .filter((unit) => unit !== "");
+}

-type Anchor = { id: string; why: string; re: RegExp };
+type Anchor = { id: string; why: string; re: RegExp; together?: string };
```

```diff
 function unmet(group: string, text: string): string[] {
-  return ANCHORS.filter((a) => a.id.startsWith(`${group}·`) && !a.re.test(text)).map(
-    (a) => `${a.id} — ${a.why}`,
-  );
+  const ours = ANCHORS.filter((a) => a.id.startsWith(`${group}·`));
+  const missing = ours
+    .filter((a) => !a.together && !a.re.test(text))
+    .map((a) => `${a.id} — ${a.why}`);
+
+  const slices = units(text);
+  for (const tag of new Set(ours.flatMap((a) => (a.together ? [a.together] : [])))) {
+    const tagged = ours.filter((a) => a.together === tag);
+    if (slices.some((slice) => tagged.every((a) => a.re.test(slice)))) continue;
+    missing.push(...tagged.map((a) => `${a.id} — ${a.why}  [「${tag}」 = 한 문장이 함께 진다]`));
+  }
+  return missing;
 }
```

**단위 = 블록(빈 줄 · 표 행 · 목록 항목 경계) 안의 한 문장.** 줄바꿈은 단위 안에서 공백으로
접는다 — 손으로 감싼 마크다운을 다시 감기만 해도 앵커가 빗나가면 그건 계약이 아니라 함정이다.

### 1.3 어떤 태그를 붙였나 (11개 태그 · 앵커 34개 중 25개)

| 태그 | 앵커 | 근거가 되는 본문 문장 |
|---|---|---|
| `A1/P1`~`A1/P5` | 라벨 + 그 술어의 내용 | 술어 하나 = 표 한 행 |
| `A2/확인` | 최초사용 + 사용자결정 | "First use in a repository is the user's call, not yours." |
| `A3/전제` | 용량 + 품질 | "This lane buys **capacity, not quality.**" |
| `A4/하향` | 레인하향 + 보고 | "…→ step down a lane and report what you could not use." |
| `A4/대행금지` | 설치금지 + 인증금지 + 교체금지 | "Never install it, never log in for them, and never quietly substitute…" |
| `C1/사전확인` | 복수도구 + 사용자결정 | "A panel that spans more than one tool is the user's call before it runs…" |
| `C2/대체금지` | 네이티브 + 독립성 | "…another native reviewer of the same shape; that keeps the count and loses the independence…" |
| `C2/출처` | 고지위치 + 출처기록 | "…record in the step-6 coverage caveat … and which model answered each." |
| `D1/경계` | 구현위임 + 실행기 | "Handing an external CLI actual implementation work … an executor needs the opposite." |

태그를 안 붙인 9개(`A2·기다린다`·`A2·경계이동`·`C1·기다린다`·`C3·포인터`·`D1·소유이관` 등)는
**각각 다른 문장이 지는 약속**이라 절 스코프로 뒀다. 검증 레인 §2.1 의 계측에서도 이들은 중복
매치가 없었다.

### 1.4 실패 메시지를 "가장 가까운 문장 추측"에서 "태그 전부 나열"로 바꾼 이유

처음엔 가장 많이 채운 단위를 골라 그 단위에서 빠진 앵커만 적게 짰다. M2b 로 돌려보니
**엉뚱한 문장을 지목했다** — 설치·로그인을 지웠는데 `A4·인증금지`·`A4·교체금지` 가 빠졌다고
보고했다(절 앞쪽의 `not every tool installed` 문장이 최소 gap 으로 먼저 뽑혔다). 낱말이 어느
문장에 남아 있는지 추측해 지목하면 다음 사람이 엉뚱한 문장을 고친다. 그래서 **태그가 깨지면 그
태그의 앵커를 전부** 적는다. 계약의 단위는 문장이지 낱말이다가 아니다.

### 1.5 새 탐지기도 자기검증한다 (단언 1개 추가)

`units()` 는 이번에 새로 넣은 탐지기라 이 파일의 규율대로 자기 자신을 검증한다 —
표 행 분리 · `.**` 뒤 끊기 · 줄바꿈 접기 · 빈 줄 문단 분리 4가지. 그래서 단언이 **36 → 37** 이다.

---

## 2. 【P1-1】 음성 대조 — 내가 다시 돌렸다 (8건)

**규율**: 변이 전 백업 → 변이 **하나** → 대상 스위트 → 백업에서 복원 → `shasum -a 256 -c` 대조.
`git checkout`·`git restore` 는 쓰지 않았다. 변이는 `templates/` 와 `.claude/` **양쪽에** 걸었다
(한쪽만 걸면 1:1 게이트가 같이 red 가 되어 "그 단언만 red" 를 못 보인다 — 검증 레인 §2 와 같은 규율).

기준선: `npx vitest run tests/external-tool-routing.test.ts` → **37 passed / EXIT=0**.
아래는 전부 **본문 수정(§3·§4)을 마친 뒤** 상태에 대한 것이다.

| # | 변이 | 좁히기 **전** (검증 레인 실측) | 좁히기 **후** (내 실측) |
|---|---|---|---|
| **M1b** | P5 행에서 셸 조건만 삭제 | **54 passed — 생존** ❌ | **2 failed / 35 passed** — `× A1` ×2 ✅ |
| **M2b** | A4 의 설치·로그인 금지만 삭제(교체 금지 유지) | **54 passed — 생존** ❌ | **2 failed / 35 passed** — `× A4` ×2 ✅ |
| **M10** | `This lane buys **capacity, not quality.**` 삭제 | **54 passed — 생존** ❌ | **2 failed / 35 passed** — `× A3` ×2 ✅ |
| M1a | P5 행 통째 삭제 | `× A1` ×2 ✅ | `× A1` ×2 ✅ (대조군, 유지) |
| M2 | A4 의 대행 금지 문장 통째 삭제 | `× A4` ×2 ✅ | `× A4` ×2 ✅ (대조군, 유지) |
| M3 | Anti-patterns 의 외부 실행기 행 라벨 교체 | `× B1` ×2 ✅ | `× B1` ×2 ✅ (대조군, 유지) |
| M4 | C1 의 사전 확인 문장 삭제 | `× C1` ×2 ✅ | `× C1` ×2 ✅ (대조군, 유지) |
| M9 | 앵커 헤딩 `executors`→`executor` | A0·E0 가 먼저 뜨며 12건 red ✅ | **12 failed / 25 passed**, A0·E0 포함 ✅ (헛통과 차단 유지) |

대조군 5건을 같이 돌린 이유: 좁히기는 **강화**여야 하고 **교체**여서는 안 된다. 원래 잡던 것을
계속 잡는지 보이지 않으면 "닫았다"는 말이 절반만 참이다.

**각 변이가 red 로 만든 앵커 (원문 그대로):**

```
M1b   A1·P5-라벨 — 술어 표지 P5  [「A1/P5」 = 한 문장이 함께 진다]
      A1·P5-다른CLI — …  [「A1/P5」 = 한 문장이 함께 진다]
      A1·P5-셸 — 셸을 쓸 수 없으면 이 레인은 당신에게 없는 것이다 (설계 §6.4)  [「A1/P5」 …]

M2b   A4·설치금지 — 대신 설치하지 않는다  [「A4/대행금지」 = 한 문장이 함께 진다]
      A4·인증금지 — 대신 인증/로그인하지 않는다  [「A4/대행금지」 …]
      A4·교체금지 — 조용히 다른 제공자로 갈아타지 않는다 …  [「A4/대행금지」 …]

M10   A3·용량 — capacity/용량 — 이 레인이 사는 것  [「A3/전제」 = 한 문장이 함께 진다]
      A3·품질 — quality/품질 — 사지 않는 것  [「A3/전제」 …]
```

**매 회 원복 대조:**

```
$ shasum -a 256 -c /tmp/fix-baseline.rtHtXq/SHA256-post.txt | grep -c ": OK"
8
```

8건 전부 실행 후 8/8 일치. 워킹트리에 변이 잔여 없음.

### 2.1 변이 정의 (재현용 — 문자열 치환 1건씩)

| # | 파일 | `찾기` → `바꾸기` |
|---|---|---|
| M1b | `skills/model-orchestration/SKILL.md` | `, and it can use a shell \|` → ` \|` · `round trip; with no shell, this lane` → `round trip; this lane` |
| M2b | 〃 | `Never install it, never log in for them, and never quietly substitute` → `Never quietly substitute` |
| M10 | 〃 | `This lane buys **capacity, not quality.** It is not a fourth rank` → `It is not a fourth rank` |
| M1a | 〃 | P5 표 행 1줄 삭제 |
| M2 | 〃 | `Never install it, … a silent swap makes your report false. ` 삭제 |
| M3 | 〃 | `\| 외부 실행기에 **테스트 작성·검증**·핵심 구현을 넘김 \|` → `\| 외부 실행기 남용 \|` |
| M4 | `skills/multi-persona-review/SKILL.md` | `**A panel that spans more than one tool … not after.** Name the` → `Name the` |
| M9 | `skills/model-orchestration/SKILL.md` | `## External executors — the lane` → `## External executor — the lane` |

실행기 = `/tmp/fix-baseline.rtHtXq/mut-fix.py`(원복이 `finally` 에서 무조건 돈다).
`HARNESS_ROOT=$(pwd) python3 <경로> <M1b|M2b|M10|M1a|M2|M3|M4|M9>`.
**세션 임시 디렉터리라 영구 보관물이 아니다** — 위 표가 재현에 필요한 전부다.

---

## 3. 【P2-1】 `multi-persona-review` 안의 중복 — 3곳 축약, 1곳 미변경

### 3.1 좌석 절의 근거 문장 삭제 (주장 A·B 의 세 번째 사본)

```diff
 coverage caveat which seats were native and which were external, and which model answered each.
-A panel's claim rests on how its members fail; a reader who cannot see who answered cannot audit it.
```

두 절 모두 이미 다른 곳이 소유한다 — 앞절("패널의 주장은 구성원이 어떻게 실패하는가에 달렸다")은
**같은 문단 :147** 의 `which is the only variable this method's value is made of` 가, 뒷절
("본 사람을 모르면 감사할 수 없다")은 **소유자인 step-6 :197** 의 `provenance a reader can't see
is a panel they can't reproduce` 가 이미 말한다. (줄 번호는 수정 후 기준.)

### 3.2 Pitfalls 2행을 포인터로 축약

```diff
 - **Buying tools instead of lenses** — the same lens seated twice with a different model behind it
-  is still one reviewer with two names. A second vendor lowers correlation only between lenses that
-  already differ; it is never a substitute for designing them.
-- **Unlabelled provenance** — if the caveat doesn't say which seats answered from outside, the
-  coverage claim can't be audited and the panel can't be reproduced.
+  is still one reviewer with two names
+  ([references/reviewer-design.md](references/reviewer-design.md), "Define independence").
+- **Unlabelled provenance** — a coverage caveat that doesn't say where each seat came from (step 6).
```

- **주장 B**: 메커니즘("두 번째 벤더가 낮추는 것은 이미 다른 렌즈 사이의 상관")은
  `references/reviewer-design.md` `## Define independence` 소유. Pitfalls 는 **무엇이 잘못인지**만
  남기고 그 절을 가리킨다. `SKILL.md:102` 의 한 줄 요약 + 명시적 포인터는 검증 레인 §3.2 판단대로
  정당해서 그대로 뒀다. → 서술 **3곳 → 2곳**(둘 중 하나는 포인터).
- **주장 A**: 고지 요구의 소유자는 step-6 `:195-197`. Pitfalls 는 `(step 6)` 로 가리킨다.
  → 서술 **4곳 → 3곳**(그중 1곳은 포인터).

### 3.3 `SKILL.md:149` 는 **손대지 않았다** — 사유

(§3.1 이 지운 것은 그 **다음** 줄이라 번호는 수정 후에도 `:149` 그대로다.)

지시는 "1번과 같이 손대라(앵커를 좁혀야 지울 수 있다)"였다. 좁히기를 끝낸 뒤 다시 보니
**좁히기만으로는 이 줄이 풀리지 않는다**:

- 좁힌 뒤에도 `C2·고지위치`(`/coverage caveat/`) · `C2·출처기록`(`/model answered/`)은 여전히
  **좌석 절 슬라이스 안**을 요구한다. 좁히기는 "어느 범위에서 세는가"를 절→문장으로 바꿨을 뿐
  "어느 절에서 세는가"는 그대로다.
- 이 줄을 지우려면 C2 의 두 앵커를 **step-6 절 슬라이스로 옮겨야** 한다. 그건 설계 §3.2b 가
  "좌석 절이 출처 기록을 소유한다"고 고정한 **두 레인 공유 계약의 변경**이다. 테스트 파일 머리말도
  *"앵커는 설계가 고정했다 … 계약 변경이지 테스트 수리가 아니다"* 라고 적는다.
- 그리고 이 줄은 순수 중복이 아니다 — **좌석을 못 채웠을 때(실패 경로)** 무엇을 기록하는가이고,
  step-6 은 **정상 경로**의 고지문 작성 자리다. 문맥이 다르다.

그래서 **지우지 않고 남겼다.** 지우는 판단은 계약 소유자(설계·검증 레인) 몫이다.
→ **닫으려면**: "C2 의 출처 앵커를 좌석 절 → step-6 절로 옮긴다"를 계약 변경으로 승인받으면 된다.
그 순간 `:149` 의 뒷부분은 `record the swap where step 6 requires` 정도로 줄어든다.

### 3.4 `reviewer-design.md:26-27` 도 남겼다

`write down which model answered each seat` 는 주장 A 의 4번째 사본이지만, **주장 B 메커니즘
문단의 결론절**이다(그 문단의 소유자가 그 파일이다). 검증 레인 §3.2 의 소유 의견도 잘라내라고
지목한 것은 `:246`(Pitfalls) 뿐이라 그대로 뒀다.

---

## 4. 【P2-2】 ADR 예외 조항을 본문에 한 줄로

### 4.1 넣은 자리 = 오해가 발생하는 바로 그 행

```diff
-| 외부 실행기에 **테스트 작성·검증**·핵심 구현을 넘김 | 이 레인은 판단 잔여 0 인 일만 받는다 — 무엇을 단언할지 정하는 일을 밖으로 내보내면 외부 산출물을 검사할 기준 자체가 밖에 있게 된다 |
+| 외부 실행기에 **테스트 작성·검증**·핵심 구현을 넘김 | 이 레인은 판단 잔여 0 인 일만 받는다 — 무엇을 단언할지 정하는 일을 밖으로 내보내면 외부 산출물을 검사할 기준 자체가 밖에 있게 된다. 형태가 이미 고정된 표에 케이스 한 줄을 복제하는 일은 무엇을 단언할지 정하지 않으므로 여기 해당하지 않는다 |
```

검증 레인 §6.3 이 "본문만 읽는 사람은 테스트 전면 금지로 읽는다"고 지목한 문장이 이 행이라
같은 행 안에 넣었다. 배포물에 존재하지 않는 ADR 번호는 쓰지 않았고, 예외의 **근거**(무엇을
단언할지 정하지 않는다)를 함께 적어 이 행의 원칙과 한 호흡으로 읽히게 했다.

B1 게이트는 그대로 문다 — 이 행은 여전히 `외부` + `테스트` + `검증` 을 **한 행 안에서** 갖는다
(§2 의 M3 대조군이 확인).

### 4.2 이 한 줄을 무는 게이트는 **없다** (미완으로 명시)

이 문장을 지워도 어떤 테스트도 red 가 되지 않는다. **일부러 안 붙였다**:

- 앵커를 하나 더 넣는 것은 `ANCHORS`(= "설계 §2·§3·§4 가 고정한 필수 어구") 에 **구현 레인이
  자기 문장을 추가**하는 것이다. 이 리포의 대원칙은 *"구현자가 자기 종료 테스트를 쓰면 그 테스트는
  코드가 하는 일을 적고 해야 할 일은 안 적는다"* 이고, 그 금지에 정확히 걸린다.
- → **닫으려면**: 검증/테스트 레인이 이 예외를 계약으로 채택하고 앵커(예: B1 행에 예외 어구 요구,
  또는 `A5` 신설)를 **그 레인이** 추가하면 된다. 그때 음성 대조도 그 레인이 낸다.

같은 이유로 §3 의 중복 축약 3곳도 게이트 밖이다 — 이 리포에는 프로즈 중복을 무는 게이트가 없다.
**축약이 과했는지(= 근거가 사라졌는지)** 는 다음 레인이 읽어서 판정해야 한다.

---

## 5. 완료 기준 — 명령과 출력

파이프 뒤 `$?` 를 쓰지 않았다(`cli-development.md` §검증 명령은 실패해도 조용하다).

### ⓐ 대상 스위트 전부 green

```
$ npx vitest run tests/external-tool-routing.test.ts
 ✓ tests/external-tool-routing.test.ts (37 tests)
 Test Files  1 passed (1)
      Tests  37 passed (37)
EXIT=0
```

**단언 수 36 → 37.** 기존 36개는 전부 그대로 green 이고, +1 은 §1.5 의 `units()` 자기검증이다.
(직접 영향권 3종 합산 = `external-tool-routing` + `subagent-file-handoff` +
`templates-distribution-hygiene` → **55 passed**, 검증 레인 기준선 54 + 1.)

### ⓑ M1b·M2b·M10 재변이 → 각각 red

§2 의 표. 셋 다 **해당 단언만** red(2 failed / 35 passed = templates·.claude 각 1건),
원복 후 `shasum -a 256 -c` **8/8 OK**.

### ⓒ `npm run ci` exit 0

```
$ npm run ci > /tmp/fix-ci.log 2>&1; echo "EXIT=$?"
EXIT=0

 Checked 138 files in 704ms. No fixes applied.     ← biome
 Test Files  92 passed (92)
      Tests  1338 passed (1338)
 Statements   : 96.4%  ( 2280/2365 )
 Branches     : 88.8%  ( 1332/1500 )   ← 하한 88
 Functions    : 96.11% ( 396/412 )
 Lines        : 96.9%  ( 2098/2165 )
```

1337 → **1338**(+1 = `units()` 자기검증). 커버리지 4축 모두 검증 레인 기준선과 동일.
부수: 첫 `biome check` 가 포맷으로 exit 1 → `biome check --write src/ tests/external-tool-routing.test.ts`
후 재검사 exit 0. 남은 warning 3건은 이번 변경 이전부터 있던 것이다(`src/` 소관, 손대지 않음).

### ⓓ 두 사본 `diff` 일치

```
$ diff templates/skills/<각> .claude/skills/<각>
model-orchestration      SKILL.md            identical
multi-persona-review     SKILL.md            identical
multi-persona-review     references/reviewer-design.md  identical
external-model-consult   SKILL.md            identical
```

### ⓔ `git diff --stat` — 건드린 파일

```
 .claude/settings.json                          |   7 +-      ← 사용자 소유, 미변경
 .claude/skills/.DS_Store                       | Bin         ← 사용자 소유, 미변경
 .claude/skills/model-orchestration/SKILL.md    |   2 +-
 .claude/skills/multi-persona-review/SKILL.md   |   8 +-
 templates/skills/model-orchestration/SKILL.md  |   2 +-
 templates/skills/multi-persona-review/SKILL.md |   8 +-
 tests/external-tool-routing.test.ts            | 182 ++++++++++++------
```

**내가 건드린 것은 5개**다. 앞 2개는 착수 시점부터 modified 였던 사용자 소유 파일이고 열지 않았다.
`external-model-consult` · `reviewer-design.md` · `src/` · `docs/decisions/` · frontmatter ·
훅 · 룰 · 스크립트 = **0건**.

### ⓕ 부가 — 배포 위생 · frontmatter

`scripts/check-absence.sh --canary` 로 4축, 전부 **canary 검증 통과 후 0건**(exit 0):

| 축 | canary | 패턴 | 매치 |
|---|---|---|---:|
| ADR 번호 | `ADR-069` | `ADR-[0-9]{3}` | 0건 |
| 릴리스 태그 | `v26.144.0` | `v[0-9]{2}\.[0-9]+\.[0-9]+` | 0건 |
| 홈 경로 | `/Users/uzysjung/Development` | `/Users/[a-zA-Z]+\|/home/[a-zA-Z]+` | 0건 |
| `docs/research/` | `see docs/research/foo.md` | `docs/research/` | 0건 |

frontmatter 무변경 — hunk 시작 줄 vs frontmatter 끝 줄:
`model-orchestration` 269 vs 20 · `multi-persona-review` 150·244 vs 14. 전부 바깥.

---

## 닫지 못한 것 (추정 아님 — 실측 기준)

1. **`multi-persona-review` 좌석 절 `:148` 의 주장 A 서술** — §3.3. 좁히기만으로는 안 풀리고,
   지우려면 C2 앵커를 step-6 절로 옮기는 **계약 변경**이 필요하다. 승인 대상이라 남겼다.
2. **P2-2 로 넣은 예외 문장에 게이트가 없다** — §4.2. 지워도 red 가 안 난다. 구현 레인이 자기
   종료 테스트를 쓰지 않는다는 원칙 때문에 일부러 안 붙였고, 채택은 테스트/검증 레인 몫이다.
3. **§3 의 중복 축약 3곳도 게이트 밖**이다. 프로즈 중복을 무는 게이트가 이 리포에 없다.
   "축약이 근거를 잘라내지 않았는가"는 사람이 읽어야 한다.
4. **`reviewer-design.md:26-27`** 은 주장 A 의 4번째 사본으로 남아 있다 — §3.4.
5. **미검증 항목은 검증 레인 §「검증하지 못한 것」과 동일**하게 남는다: 외부 CLI 실호출 0회 ·
   문장이 실제 위임 행동을 바꾸는가 미측정 · F 게이트의 CI 동작 · 4개 CLI 실설치 렌더 ·
   PR 단 CI 부재(위 숫자는 전부 로컬) · `npm audit`/`ecc-agentshield` 미실행.
6. **`units()` 의 문장 분리는 마크다운 휴리스틱**이다. 약어 마침표(`e.g.`)가 든 문장을 본문에
   새로 쓰면 단위가 갈라져 같은 문장 안 AND 가 깨질 수 있다. 현재 세 스킬의 대상 절에는 그런
   문자열이 없어서 실측으로는 문제가 없지만, 구조적 한계라 적어 둔다.

---

## 부록 — 재현

```bash
npx vitest run tests/external-tool-routing.test.ts                       # 37 passed
npm run ci > /tmp/ci.log 2>&1; echo "EXIT=$?"                            # 파이프 뒤 $? 금지
HARNESS_ROOT=$(pwd) python3 /tmp/fix-baseline.rtHtXq/mut-fix.py M2b      # 변이 1건 + 무조건 원복
shasum -a 256 -c /tmp/fix-baseline.rtHtXq/SHA256-post.txt                # 8/8 OK
bash scripts/check-absence.sh --canary '<양성>' '<ERE>' <경로 리터럴>
```

변이 정의는 §2.1 의 표가 SSOT 다(임시 디렉터리는 세션과 함께 사라진다).
