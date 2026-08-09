# D286 테스트 레인 보고 — 외부 실행기 레인의 종료 조건을 실행 가능한 형태로

작성 2026-08-10 · 브랜치 `feat/external-executor-lane` · **테스트만 작성**(스킬 본문 무수정) ·
git 무쓰기. 설계 SSOT = `docs/plans/skills-external-executor-2026-08-09.md` · 결정 = `ADR-069`.

---

## 0. 한 문단 요약 — 지금 무엇이 달라졌나

세 스킬 본문이 **무엇을 담아야 완료인지**가 이제 파일 하나로 실행된다. 새 게이트
`tests/external-tool-routing.test.ts` 는 지금 트리에서 **24개 단언이 red** 다 — 전부 "본문에 아직
그 절이 없다"가 사유다. 같이 넣은 탐지기 자기검증 12개는 green 이고, 그 12개가 "red 인 이유가
탐지기 고장이 아니라 본문 부재"임을 보인다. 기존 게이트 2건은 설계대로 확장했고 둘 다 green 이며,
왜 green 인지와 어떻게 red 로 만들었는지를 §4 에 실행 출력으로 남겼다.

**구현 레인이 읽을 것**: §2 의 앵커표. 그 표에 없는 표현은 계약이 아니고, 그 표에 있는 것은 전부
AND 다.

---

## 1. 만든 것

| 파일 | 무엇 | 상태 |
|---|---|---|
| `tests/external-tool-routing.test.ts` (신규, 540줄) | 설계 §5.2 의 A0·A1·A2·A3·A4·B1·C1·C2·C3·D1·E·E0 + 탐지기 자기검증 | **red 24 / green 12** |
| `tests/subagent-file-handoff.test.ts` (69 → 73줄) | `.claude` ↔ `templates` 1:1 에 `external-model-consult` 추가 (설계 §5.1) | green |
| `tests/templates-distribution-hygiene.test.ts` (271 → 445줄) | **F** — 로컬 CLI 설정에서 **파생한** 모델 id 누출 검사 + 그 파생 로직의 픽스처 검증 4건 | green (파생 동작 확인 완료) |

`tests/consult-model-tier.test.ts` 는 **건드리지 않았다**(설계 §5.1 후단).
`templates/skills/*/SKILL.md` · `.claude/skills/*/SKILL.md` 도 **한 글자도 고치지 않았다**.

### 1.1 단언 ↔ 설계 §5.2 대응

| 설계 §5.2 | 테스트 이름 | 어디를 보는가 |
|---|---|---|
| **A0** | `A0 — model-orchestration 이 외부 실행기 절을 소유한다 (라우팅 판단 자리에서)` | `## External executors — the lane outside the harness` 슬라이스 비어있지 않음 **+ 절의 위치**(Routing test 뒤 · Effort floors 앞) |
| **A1** | `A1 — 다섯 술어가 전부 있다 (AND …)` | 그 슬라이스. 라벨 `P1`~`P5` **와** 각 술어의 내용 — 총 12개 앵커 AND |
| **A2** | `A2 — 저장소의 최초 외부 도달은 사용자 결정이라는 확인 문장이 있다` | 그 슬라이스. `first use` · `user's call` · `wait` · `boundar` (4 AND) |
| **A3** | `A3 — 이 레인이 사는 것은 용량이지 품질이 아니다` | 그 슬라이스. `capacity\|용량` · `quality\|품질` (2 AND) |
| **A4** | `A4 — 부재·인증 만료: 레인을 내리고 보고 · 대신 설치/인증/교체하지 않음 (AND)` | 그 슬라이스. 레인하향 · `report` · `install` · `auth\|log in` · `substitut\|swap\|reroute\|갈아타` (5 AND) |
| **B1** | `B1 — Anti-patterns 가 '외부 실행기에 테스트·검증' 을 한 행에서 금지한다` | `## Anti-patterns` 표. **한 행 안에서** 외부 ∧ 테스트 ∧ 검증 |
| **C1** | `C1 — multi-persona-review 가 복수 도구 패널의 사전 확인을 소유한다` | `#### Seats an outside tool can fill` 슬라이스. 복수도구 · `user's call` · `wait` (3 AND) |
| **C2** | `C2 — 좌석을 못 채우면 네이티브로 내리되 출처를 기록한다` | 같은 슬라이스. `native` · `independen` · `coverage caveat` · `model answered` (4 AND) |
| **C3** | `C3 — … 재서술하지 않고 가리키기만 한다 (MECE)` | 양성=슬라이스가 `external-model-consult` 를 가리킨다 / **음성=파일 전체(SKILL.md + reviewer-design.md)에 래퍼 호출 표식 0건** |
| **D1** | `D1 — external-model-consult 가 '실행 위임은 내 일이 아니다' 를 명시한다` | `## When NOT to use` 슬라이스. `implementation` · `executor` · `model-orchestration` (3 AND) |
| **E0** | `E0 — 모델 슬러그 검사의 슬라이스가 전부 비어 있지 않다` | 아래 5개 슬라이스가 **각각** 비어있지 않음 |
| **E** | `E — 라우팅·도구 절 안에 구체 모델 슬러그가 0건` | mo `External executors` · mo `Routing test` · mpr `Seats…` · emc `Which provider` · emc `Prerequisite` |
| **F** | `로컬 CLI 설정의 모델 id 가 배포물에 새지 않는다 (로컬 한정)` | 배포 대상 `templates/` 전체(`distributedFiles()`) |

**두 사본을 같은 계약으로 검사한다** — `templates/skills` 와 `.claude/skills` 각각에 대해 A0~E 를
한 번씩 돌린다(그래서 12 × 2 = 24). 추가로 `reviewer-design.md` 1:1 단언을 새로 넣었다(§6-③).

---

## 2. 구현 레인이 받아야 할 앵커표 (이 표가 계약이다)

테스트 파일의 `ANCHORS` 배열이 SSOT 다. 여기 옮긴 것은 같은 내용이고, 하나라도 빠지면 그 단언이
red 로 남는다. 앵커는 전부 **정규식이고 슬라이스 안에서만** 찾는다.

### 2.1 `model-orchestration` — `## External executors — the lane outside the harness`

> 헤딩 문자열이 정확히 이것이어야 한다(em dash `—`). 위치는 `## Routing test` **뒤**,
> `## Effort floors` **앞**.

| 앵커 id | 찾는 것 | 근거 |
|---|---|---|
| `A1·P1-라벨` / `A1·P1-질문` | `P1` · `새 판단이 남아 있는가` | §2.1b — 기존 라우팅 질문 그대로, 새 판별자 금지 |
| `A1·P2-라벨` / `A1·P2-합격명령` | `P2` · `(pass\|acceptance\|합격) … (command\|명령)` | §2.1b — 합격 명령을 지금 한 줄로 적을 수 있는가 |
| `A1·P3-라벨` / `A1·P3-교차검증` / `A1·P3-게이트` | `P3` · `cross-verif` · `gate` | §2.1b + ADR-069 가드레일 4 |
| `A1·P4-라벨` / `A1·P4-승인범위` | `P4` · `approv` | §2.1b — 최초 확인 완료 + 이번 파일 집합이 그 범위 안 |
| `A1·P5-라벨` / `A1·P5-다른CLI` / `A1·P5-셸` | `P5` · `running on\|돌고 있는` · `shell\|셸` | §2.1b + **§6.4** — P5 는 두 조각 AND 여야 셸 없는 설치본에서 no-op 이 안 된다 |
| `A2·최초사용` / `A2·사용자결정` / `A2·기다린다` / `A2·경계이동` | `first use` · `user's call` · `wait` · `boundar` | §2.2 초안 문장의 네 조각 |
| `A3·용량` / `A3·품질` | `capacity\|용량` · `quality\|품질` | §2.1a |
| `A4·레인하향` | `(down\|lower\|drop\|back) … lane` 또는 `레인을 … 내리` | §2.1d |
| `A4·보고` / `A4·설치금지` / `A4·인증금지` / `A4·교체금지` | `report` · `install` · `auth\|log in` · `substitut\|swap\|reroute\|갈아타` | §2.1d |

### 2.2 `model-orchestration` — `## Anti-patterns`

**한 행 안에** `external`(또는 `외부`) ∧ `test`(또는 `테스트`) ∧ `verif`(또는 `검증`).
두 행으로 쪼개면 red 다 — 그 둘은 다른 규칙이 되기 때문이다.

### 2.3 `multi-persona-review` — `#### Seats an outside tool can fill`

> 헤딩 문자열 정확히 이것. `### 3.` 안의 하위 절이어도 되고, 슬라이스는 다음 `####`/`###`/`##`
> 에서 끊는다.

`more than one tool`(또는 `multiple tools`/`복수 도구`/`여러 도구`) · `user's call` · `wait` ·
`native` · `independen` · `coverage caveat` · `model answered` · `external-model-consult`.

**그리고 금지**: 이 스킬 파일(및 `references/reviewer-design.md`) 어디에도
`gemini-ask.sh` · `codex-ask.sh` · `codex exec` · `agy -p` · `*_CONSULT_TIMEOUT` ·
`<untrusted-…>` · `--dangerously-skip-permissions` · `exit 2/3/4/5/124` 를 쓰지 마라.

### 2.4 `external-model-consult` — `## When NOT to use`

`implementation` · `executor` · `model-orchestration` (3 AND).

### 2.5 위생 — 세 스킬 공통

라우팅·도구 절 안에 **구체 모델 슬러그 0건**. 탐지 형태는
`알파벳접두사 + [-_공백] + 숫자.숫자` 또는 `알파벳접두사-숫자-티어` 다.
→ `Fable 5` · `Sonnet 5` 는 통과, `codex 0.144.5` · `glm-5.2` · `gemini-3.1-pro-high` 는 걸린다.

---

## 3. 지금 트리에서의 실행 출력 (본문 미수정 상태)

### 3.1 신규 게이트 — red 여야 정상

```
$ npx vitest run tests/external-tool-routing.test.ts
 Test Files  1 failed (1)
      Tests  24 failed | 12 passed (36)
```

실패 사유(중복 제거, `templates/skills`·`.claude/skills` 양쪽 동일):

```
AssertionError: 헤딩 "## External executors — the lane outside the harness" 이 없다 — 이름 자체가 계약이다(설계 §2.1)
AssertionError: A0 을 먼저 봐라 — 슬라이스가 비었다            ← A1·A2·A3·A4 (4건)
AssertionError: 외부 실행기를 다루는 anti-pattern 행이 없다 — 정책 충돌이 문서상 미해결로 남는다(설계 §2.4)
AssertionError: 헤딩 "#### Seats an outside tool can fill" 이 없다 — 헛통과 차단(설계 §3.2)
AssertionError: C1 을 먼저 봐라 — 슬라이스가 비었다            ← C2·C3 (2건)
AssertionError: 두 스킬의 경계가 본문 안에서 자기모순이 되지 않게 한다(설계 §4.2):
  D1·구현위임 — 실제 구현(implementation) 위임
  D1·실행기 — 실행기(executor)는 저장소 미노출 약속의 정반대를 요구한다
  D1·소유이관 — 그 레인·술어·최초 승인은 model-orchestration 소관이라고 가리킨다
AssertionError: 앵커가 어긋나 슬라이스가 비었다 — E 가 헛통과한다:
  model-orchestration ## External executors — the lane outside the harness
  multi-persona-review #### Seats an outside tool can fill
AssertionError: 배포 본문은 모델을 고르지 않는다 …
  external-model-consult ## Prerequisite +15  codex 0.144.5 with an empty `CODEX_HOME`; codex retries "Reconnecting… n/5"
```

**전부 "본문에 아직 그 절이 없다"** 가 사유다. 예외 셋을 따로 적는다 —

- **B1** 은 슬라이스가 **있고**(Anti-patterns 표는 이미 존재) "외부 실행기 행이 0개"라서 red 다.
  즉 헛통과가 아니라 내용 부재를 문 것이다.
- **D1** 도 슬라이스가 **있고**(`## When NOT to use` 존재) 세 앵커가 전부 없어서 red 다.
- **E** 는 설계 §4.4 가 예고한 대로 **기존 양성(canary)** 을 물었다 —
  `external-model-consult/SKILL.md:79` 의 `codex 0.144.5`. 즉 이 게이트는 **빨간불로 태어났고**,
  그 red 는 "탐지기가 실제로 문다"의 직접 증거다.

### 3.2 기존 게이트 확장 2건 — 현재 green, 이유까지

```
$ npx vitest run tests/subagent-file-handoff.test.ts tests/templates-distribution-hygiene.test.ts
 Test Files  2 passed (2)
      Tests  18 passed (18)
```

- **1:1 확장(`subagent-file-handoff`)이 green 인 이유**: 지금 세 스킬의 두 사본이 실제로
  byte-identical 이다(`diff -q` 4/4 SAME). 이 단언은 *앞으로* 한쪽만 고치는 것을 막는 게이트라
  현재 green 이 정상이다. **비어 있는 비교가 아니라는 근거**: 두 경로는 서로 다른 inode 이고
  심링크가 아니다 —

  ```
  361953038 .claude/skills/external-model-consult/SKILL.md
  361953119 templates/skills/external-model-consult/SKILL.md
  (symlink 없음)
  ```

- **F 가 green 인 이유**: 로컬 OpenCode 설정에서 파생한 모델 id 가 배포물에 **실제로 0건**이다.
  파생 결과는 `zai-coding-plan/glm-5.2` 계열 · `openai/gpt-5.x` 계열 · `google/gemini-3.x` 계열의
  모델 부분이고, `grep -rInE` 로 별도 확인해도 `templates/` 에 0건이다. **탐지기가 죽어서 나온
  0건이 아니라는 증거는 §4.1 에 있다.**

### 3.3 타입·린트

```
$ npm run typecheck    → exit 0
$ npx biome check tests/   → exit 0 (경고 2건은 이 변경과 무관한 기존 파일)
```

### 3.4 전체 스위트 — 부수 파손 없음

```
$ npx vitest run
 Test Files  1 failed | 91 passed (92)
 실패한 파일: tests/external-tool-routing.test.ts  (오직 이 파일뿐)
```

문서·자산 변경의 영향 범위는 grep 으로 고르지 않는다는 룰(`test-policy` §영향 범위)에 따라
전체를 돌렸다. 내가 만든 red 외에 깨진 것은 없다.

---

## 4. 탐지기 자기검증 — 이 게이트가 **실제로 무는가**

"본문이 생기면 통과한다"와 "본문이 생겨도 아무것도 안 문다"는 지금 트리의 red 만으로는 구분되지
않는다. 그래서 두 방향으로 증명했다.

### 4.1 입력 변이 — 저장소 파일을 건드리지 않고

`.claude/rules/test-policy.md` 가 정의한 **변이 테스트 = 입력 변이**를 그대로 썼다. 합성 절을
만들어 ⓐ 완성본은 통과시키고(canary) ⓑ **앵커를 하나씩 지우면 매번 red** 인지 본다. 설계 §5.3 의
"다섯 술어 중 한 개만 지운다(5회 반복)"를 앵커 34개 전부로 자동화한 것이다.

```
✓ A1 — 완성 입력은 통과하고, 앵커를 하나 지우면 매번 red 다
✓ A2 / ✓ A3 / ✓ A4 / ✓ C1 / ✓ C2 / ✓ C3 / ✓ D1   (같은 형태)
✓ 모델 슬러그 탐지기 — 알려진 양성을 먼저 물고, 세대 번호·날짜는 안 문다
✓ 재서술 표식 — 호출 예시는 물고, 가리키는 문장은 안 문다
✓ 절 슬라이서 — 양끝을 막는다 (뒷 절의 낱말로 통과하지 않는다)
```

- 슬러그 탐지기의 **양성**: `codex 0.144.5`(지금 트리의 실제 양성) · `glm-5.2` ·
  `gemini-3.1-pro-high` · `gpt-5.5` · `GLM-5.2`(대소문자 무관).
  **음성**: `Fable 5, Sonnet 5 …` · `(2026-08-02 사용자 결정)` · `opencode run --help` ·
  `Sonnet-tier` · `P1~P5` · `Opus @ xhigh+`.
- 재서술 표식의 **양성**: `codex-ask.sh` 호출 예시 · `codex exec -s read-only` · `exit 4` ·
  `CODEX_CONSULT_TIMEOUT` · `<untrusted-…>`. **음성**: "그 스킬이 소유한다"는 식의 가리키는 문장.
  → 설계 §5.3 의 **추가형 변이**(C3)를 이 자리가 담당한다.

### 4.2 F — 실제 배포 스캔까지 red 를 확인

설정 파일을 바꿔 끼워 게이트 전 구간(파생 → 패턴 → 배포 파일 스캔)을 돌렸다. **저장소 파일은
건드리지 않았다** — 이미 `templates/` 안에 있는 토큰(`gemini-3.1-pro-high`)을 가짜 설정에 심어
"설정에 있으면 잡힌다"를 보였다.

```
$ T=$(mktemp -d); mkdir -p "$T/opencode"
$ echo '{"provider":{"fake-plan":{"models":{"gemini-3.1-pro-high":{"name":"X"}}}}}' > "$T/opencode/opencode.json"
$ XDG_CONFIG_HOME="$T" npx vitest run tests/templates-distribution-hygiene.test.ts -t "로컬 CLI 설정의 모델 id"

 × 로컬 CLI 설정의 모델 id 가 배포물에 새지 않는다 (로컬 한정)
AssertionError: 이 머신 설정에만 있는 모델 id 가 배포물에 있다 (gemini-3.1-pro-high):
skills/external-model-consult/SKILL.md:187  Measured 2026-07-26: `gemini-3.1-pro-high`, …
skills/external-model-consult/scripts/gemini-ask.sh:131  # shapes rank alike — `gemini-3.1-pro-high` …
```

강등 경로(설계 §5.3 "F(강등)")도 눈으로 봤다 — **조용한 통과가 아니다**:

```
$ T=$(mktemp -d); XDG_CONFIG_HOME="$T" npx vitest run … -t "로컬 CLI 설정의 모델 id"
stderr | [배포 위생] 로컬 CLI 설정(/var/folders/…/opencode) 이 없다 — 이 검사 미수행.
 ✓ (1 passed | 12 skipped)
```

파생 로직 자체도 픽스처로 검증했다(선례 = 같은 파일의 `workspaceSiblings` 블록. 그 함수가 검증
없이 CI 를 네 릴리스 red 로 만든 전례가 있어 같은 실수를 반복하지 않는다):

```
✓ 설정 디렉터리가 없으면 null — 조용히 통과시키지 않는다
✓ 설정은 있는데 모델 id 가 0개여도 null — 빈 결과를 부재의 증거로 쓰지 않는다
✓ `provider.<id>.models.<id>` 키와 `model: "prov/id"` 값 둘 다에서 파생한다
✓ 파생한 토큰이 실제로 문다 — 알려진 양성 먼저, 그 다음 음성
```

### 4.3 C3 음성 반쪽의 현재 상태

지금 트리에서 `multi-persona-review` 의 SKILL.md·reviewer-design.md 양쪽 사본 **4파일 전부
0건**이다(별도 스캔으로 확인). 즉 C3 의 음성 단언은 구현 레인이 호출 예시를 **추가**하는 순간에만
운다 — 그 방향이 실제로 물린다는 것은 §4.1 의 재서술 표식 canary 가 보였다.

---

## 5. 설계 §5.3 음성 대조 표 — 어디까지 확인했나

| 설계 §5.3 항목 | 이번 레인에서 | 남은 것 |
|---|---|---|
| A0 헤딩 한 글자 변경 → red | **확인**(현재 헤딩 자체가 없어 red) | — |
| A1 다섯 술어 중 하나만 삭제 → 매번 red | **확인** — 합성 입력 변이로 앵커 12개 전부(§4.1) | 실제 본문에서의 재확인은 구현 후 검증 레인 |
| A2/A3/A4/B1/C1/C2 각 문장 삭제 → red | **확인** — 합성 입력 변이(§4.1). B1 은 실제 트리에서 red | 〃 |
| C3 `codex-ask.sh` 예시 **추가** → red | **확인** — 표식 canary(§4.1) | 실제 본문 추가 변이는 구현 후 |
| E 라우팅 표에 `glm-5.2` 추가 → red | **확인** — 슬러그 canary(§4.1) | 〃 |
| E 경계: `:187` 날짜 붙은 관측 문단은 그대로 → green | **확인** — 그 줄은 E 슬라이스 밖(`## Which tier`)이라 E 가 안 문다 | — |
| E0 앵커 헤딩 변경 → E 보다 먼저 red | **확인** — 현재 E0 이 E 앞에서 red(§3.1) | — |
| F 로컬 config 모델 id 를 본문에 추가 → red | **확인**(§4.2, 실제 배포 파일 스캔까지) | — |
| F 강등: 설정 경로를 빈 디렉터리로 → warn + 미수행 | **확인**(§4.2) | — |
| 1:1 `.claude/…/external-model-consult/SKILL.md` 1자 변경 → red | **미실행** — 본문 수정 금지 제약. 대신 두 경로가 다른 inode·비심링크임을 확인(§3.2) | 구현 후 검증 레인이 1자 변이로 확인 |
| §4.4 게이트 E 가 수정 전 코드에서 이미 red | **확인**(§3.1) | — |

---

## 6. 설계와 다르게 만든 것 (전부 확장 방향, 약화 없음)

1. **A0 에 절의 *위치* 단언을 더했다.** 설계 §5.2 의 A0 은 "슬라이스가 비어 있지 않다"까지지만,
   §2.1 이 "`## Routing test` 바로 뒤 · `## Effort floors` 앞"을 이미 고정했다. 절이 파일 끝으로
   밀리면 위임을 결정하는 시점에 안 읽히므로 위치도 계약으로 봤다. **인접(바로 뒤)은 요구하지
   않고 순서만** 본다.
2. **A1 을 라벨 5개 + 내용 7개로 쪼갰다.** 라벨만 세면 빈 줄 다섯 개로도 통과하고, 내용만 보면
   설계가 P1~P5 로 서로를 참조하는 구조(§2.1c·§6.4)가 본문에서 사라져도 안 물린다. 특히 P5 는
   설계 §6.4 가 명시한 대로 **두 조각(다른 CLI ∧ 셸)** 을 각각 요구한다.
3. **`reviewer-design.md` 1:1 단언을 신규 파일에 추가했다.** 설계 §5.1 은
   `subagent-file-handoff` 에 SKILL.md 한 줄만 추가하라고 했는데, §3.6 이 `reviewer-design.md` 도
   양쪽 사본에서 고친다. 그 파일에는 1:1 게이트가 **없었다.** 기존 테스트는 설계대로만 고치고,
   빈 구멍은 새 파일에서 막았다.
4. **탐지기 자기검증 블록(12건)을 넣었다.** 설계 §5.3 은 이것을 *구현 후* 절차로 뒀지만, 그러면
   지금 red 인 24개가 "물어서 red"인지 "고장나서 red"인지 이 시점에 구분할 수 없다. 저장소 파일을
   건드리지 않는 **입력 변이**로 구현했으므로 §5.3 의 사후 음성 대조를 대체하지 않고 보완한다.
5. **E 의 탐지 정규식에 벤더 이름을 열거하지 않았다.** 설계 §4.4 의 예시 grep 은
   `(gemini|gpt|glm|kimi|codex|opencode|agy)` 를 열거하는데, 그 목록 자체가 "이 머신에만 있는
   모델명"의 두 번째 사본이 되고 다음에 등장할 제공자를 못 잡는다. **형태**(알파벳 접두사 + 숫자
   버전)로 바꿨고, 오탐 음성 대조를 §4.1 에 붙였다.

---

## 7. 못 한 것 · 한계 (미검증은 미검증으로)

1. **실제 본문에 대한 음성 대조는 이 레인이 못 한다.** 본문 수정 금지 제약 때문이다. §5.3 표에서
   "구현 후"로 남긴 항목 — 특히 **1:1 게이트의 1자 변이** — 는 검증 레인이 실행해야 한다.
2. **F 는 CI 에서 돌지 않는다.** CI 에 그 설정 파일이 없어 `console.warn` 후 미수행이다. CI 에서
   상시 무는 것은 **E** 다. 설계 §5.2 각주가 예고한 그대로이고, 테스트 주석에도 적었다.
3. **F 의 검사 범위는 `distributedFiles()`(배포되는 `templates/`)뿐이다.** `src/`·`dist/` 는 안
   본다. 같은 파일의 "게시되는 전 표면" 검사는 *형제 프로젝트 이름* 전용이라 모델 id 는 안 덮는다.
   설계 §5.2 F 의 변이가 "배포 **본문**에 추가"라서 범위를 그렇게 잡았다.
4. **F 에 잠재적 오탐이 하나 있다.** 사용자의 로컬 설정에 언젠가 `gemini-3.1-pro-high` 가 들어오면
   `external-model-consult/SKILL.md:187`(날짜 붙은 관측 근거)과 `gemini-ask.sh:131`(코드 주석)이
   red 가 된다 — §4.2 의 증명이 그대로 그 상황이다. 지금 설정에는 없어서 green 이다. 그때의 옳은
   대응은 게이트 완화가 아니라 그 두 줄의 버전 고정을 푸는 것이다(설계 §4.4 가 :79 에 대해 이미
   그렇게 판단했다).
5. **앵커는 어휘 계약이지 의미 계약이 아니다.** 낱말을 채우고 뜻은 비운 본문은 통과할 수 있다.
   그 축은 독립 리뷰 레인이 맡는다 — 이 게이트는 "빠뜨림"을 막지 "잘못 씀"을 막지 못한다.
6. **외부 CLI 실동작·인증은 이번에도 미검증**이다(설계 §9-6 이 예고한 그대로).

---

## 8. 구현 레인에 넘기는 한 문장

`docs/plans/skills-external-executor-2026-08-09.md` §2·§3·§4 대로 본문을 쓰되, **본 보고서 §2 의
앵커표에 있는 어구를 그 슬라이스 안에 넣어라.** 다 넣으면
`npx vitest run tests/external-tool-routing.test.ts` 가 36/36 green 이 되고, 하나라도 빠지면 어느
앵커가 왜 필요한지가 실패 메시지에 그대로 나온다. `templates/` 와 `.claude/` **양쪽 4파일**을 같은
커밋에 고쳐야 한다(1:1 게이트 3 + 1).
