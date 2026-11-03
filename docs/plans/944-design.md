# #944 설계 — `AGENTS.md` 의 룰 사본을 CLI 집합에 맞춰 배치한다

- 이슈: #944 (마일스톤 v26.181.0) · 방향 확정: 사용자 2026-11-03 ("1+2 방향")
- 근거 조사: #944 본문 §근거 (Antigravity · OpenCode · Codex 공식 문서 · 소스, 2026-11-03)
- 관련 결정: ADR-103(공유 앵커 · 집합 렌더) · ADR-095/097(절 모델 · 함께 쓰는 파일의 하네스 몫) · ADR-071(Codex 32 KiB)

## 0. 판정 기준 (설치자 자리에서)

Antigravity 가 `AGENTS.md` 를 24,000 B 에서 잘라도, **설치자가 쓴 글과 Antigravity 가 다른 곳에서 못 받는 하네스 지시는
잃지 않는다.** Codex 가 없는 설치에서는 Antigravity · OpenCode 가 하네스 룰을 **한 번씩만** 읽는다.

## 1. 지금 (main 1df45dc)

- 템플릿 절 순서: `Project Context` → `Project Rules`(Working Principles, 마커 블록) → `Harness Rules`(인라인 룰 —
  codex 또는 opencode 가 집합에 있을 때만) → `Session Start`(codex 만) → `Protected Files`.
- 설치자가 덧붙인 상위 절(`## My Team Conventions` 등)은 update 병합이 **파일 끝**에 되살린다
  (`src/agents-md-merge.ts` `extraTopLevelSections`).
- 룰 안내문 `RULES_NOTE`(`src/agents-md-render.ts`)가 "이 문서에 이어 쓰라"고 한다.
- Antigravity 는 하네스 룰을 `.agents/rules/<룰>.md`(frontmatter `always_on` · `glob`)로 따로 받는다.
- `opencode.json` 의 하네스 몫은 `mcp.<name>` 키뿐이다. `instructions` 는 파일을 새로 만들 때 템플릿 값
  (`docs/SPEC.md` · `docs/specs/*.md`)으로 깔리고 그 뒤로 설치자 것이다.

→ Antigravity 에서 상한을 넘기는 것은 룰 사본인데, 끝에서 잘리는 것은 설치자 절과 `Protected Files` 다.

## 2. 결정

### D1. `## Harness Rules` 를 맨 끝으로 (모든 집합)

템플릿 순서를 `Project Context` → `Project Rules` → `Session Start` → `Protected Files` → **(설치자 상위 절)** →
`Harness Rules` 로 바꾼다.

- 병합은 설치자 상위 절을 `## Harness Rules` **바로 앞**에 되살린다. 그 절이 렌더에 없으면(인라인 없음) 지금처럼 파일 끝.
- 첫 접촉 블록 모델(설치자 파일에 하네스 블록만 넣는 경우)도 블록 안 순서가 같다 — 블록 안에서 룰이 마지막.
- `RULES_NOTE` 의 "이 문서에 이어 쓰거나" 를 "이 절 **위에** `## ` 절로 쓰거나" 로 바꾼다. 이어 쓴 절은 다음 update 가
  룰 앞으로 옮기지만, 그 사이에는 잘리는 자리에 있다.
- (적대적 리뷰 F1) `## Harness Rules` 의 하네스 몫(안내 · 인라인 룰 · 위치 안내)을 `rules` 마커 블록으로 감싼다. 그 절이 파일
  끝이라 설치자가 끝에 붙인 `## ` 절이 그 절 안에 놓이는데, 룰 제목 집합(`## Testing` · `## Delivery` · `## Git Safety` …)으로
  가르면 같은 제목의 설치자 절이 하네스 것으로 읽혀 라이브에서 빠진다. 블록이 있는 파일에서는 **블록 안 = 하네스 · 블록 끝 뒤의
  `## ` = 제목과 무관하게 설치자**(`headingOwner` — 병합 · uninstall 재렌더 · uninstall 걷기가 같은 판정). 블록이 없는 옛 판 파일
  (`## Harness Rules` 가 중간)은 지금의 제목 판정 그대로. 첫 접촉 블록 안에서는 이 마커를 벗긴다(블록 안에서 블록을 열지 않는다).

효과: Codex 가 섞인 집합에서 Antigravity 가 잘라도 잘리는 것은 룰 본문의 뒷부분 — `.agents/rules/` 에 있는 사본 — 뿐이다.
Codex 가 32 KiB 에서 멈출 때도 설치자 절 대신 룰 뒷부분이 빠진다.

인라인 룰은 **상시 룰 → 경로 룰(`paths:`) 순**으로 잇는다. Codex 가 32 KiB 에서 멈추면 잘리는 것은 Codex 의 유일한
사본이므로, 잘려도 Claude Code 가 지연 로드하는 것과 같은 경로 룰이 빠지게 한다(검증 N1).

### D2. 포인터는 "이번 실행이 OpenCode 의 도달을 보장할 때"만 — 아니면 인라인

`AGENTS.md` 의 룰 본문을 위치 안내로 바꾸는 조건(`rulesViaInstructions`)은 **집합이 아니라 이번 실행에서 실제로 쓴 결과**로
정한다(검증 B1). 다섯 가지가 모두 참이어야 한다:

1. codex ∉ `AGENTS.md` 집합(선택 ∪ 기록)
2. opencode ∈ 이번 선택(`cli`) — `opencode.json` 을 이번 실행이 썼다
3. antigravity 변환이 이번 실행에서 **이번 룰 전부를 실제로 썼다**(`harnessRuleFiles` 가 이번 `rules` 를 모두 덮는다 — 링크·남의
   슬롯이라 건너뛴 파일이 있으면 거짓, 재검증 N1). 옛 트랙 룰 파일은 `reclaimOutOfTrack` 이 누적 트랙으로 판정해 남기므로
   디스크의 룰 합집합은 인라인과 같거나 크다(재검증 N8)
4. 그 쓰기 뒤 디스크의 `opencode.json` 을 **다시 읽어** `instructions` 에 `.agents/rules/*.md` 원소가 **있다**(하네스 것이든
   설치자 것이든 — `kept ∪ portions` 로 판정하지 않는다. 설치자 `instructions` 가 배열이 아니면 키가 `kept` 로 간다, 재검증 N5)
5. (적대적 재검증 R2-B1) `AGENTS.md` 가 **절 모델**이다(`agentsMdModelFor` — `writeAgentsMd` 와 같은 판정). 첫 접촉 블록(설치 전부터
   있던 설치자 `AGENTS.md` 끝의 하네스 블록)은 늘 인라인이다 — 설치자가 블록 안을 고치면 블록이 `kept` 로 굳는데, 굳은 위치 안내는
   CLI 집합이 바뀐 뒤(Antigravity 가 빠지거나 Codex 가 들어오면) 가리킬 룰이 없어 Codex · OpenCode 가 update 를 거듭해도 0번이다.
   절 모델은 매 실행 다시 렌더되므로 조건이 깨지면 다음 실행이 인라인으로 되돌린다

하나라도 거짓이면 지금 규칙(codex 또는 opencode 가 집합에 있으면 인라인)을 따른다. 인라인은 D1 로 맨 끝이라 Antigravity 에서
잘리는 것은 사본뿐이다. **OpenCode 가 룰을 0번 받는 실행은 없다** — 넘어가는 실행은 인라인(오늘과 같음)이거나 인라인 + 글롭
(두 번, 다음 update 에서 한 번으로 수렴)이다. update 는 기록된 CLI 전부를 선택으로 돌므로(`update-mode.ts` `installedCliTargets`)
조건이 맞는 설치본은 다음 update 에 포인터로 수렴한다.

| 집합(비-Claude) · 실행 | `## Harness Rules` | OpenCode 가 룰을 읽는 곳 |
|---|---|---|
| codex 포함(어느 조합이든) | 인라인(현행) — D1 로 맨 끝 | `AGENTS.md` 인라인 |
| opencode + antigravity, 위 1~5 참(하네스가 만든 `AGENTS.md` 의 update · 둘을 함께 고른 install) | **본문 없이 위치 안내 한 문단** | **`opencode.json` `instructions` 의 `.agents/rules/*.md`** |
| opencode + antigravity, 위 2~5 중 하나 거짓(한쪽만 고른 install · `uninstall --cli codex` 재렌더 · `opencode.json` 파싱 실패 · `--without` 로 원소 제외 · 첫 접촉 블록) | 인라인 | `AGENTS.md` 인라인(원소가 남아 있으면 글롭도 — 다음 update 까지 두 번) |
| opencode 만 | 인라인(현행) | `AGENTS.md` 인라인 — `.agents/rules/` 가 없다(#300) |
| antigravity 만 | 절 없음(현행) | — |

위치 안내 문단(초안): "하네스 룰은 `.agents/rules/` 에 있다. Antigravity 는 그 폴더를 직접, OpenCode 는 `opencode.json`
의 `instructions` 로 읽는다. 이 프로젝트만의 규칙은 이 절 위에 `## ` 절로 쓴다."

OpenCode 공식: `instructions` 의 파일 · 글롭은 "combined with your AGENTS.md". 경로가 정해진 룰(`trigger: glob`)도 OpenCode
에서는 늘 읽힌다 — 지금의 인라인과 같다.

### D3. `opencode.json` `instructions` 의 원소 하나를 하네스 몫으로 — 쓰는 곳은 지금의 opencode 변환 하나

**쓰기 주체는 늘리지 않는다**(검증 B1-c — 한 실행에서 같은 파일을 두 번 `writeShared` 하면 앞 몫이 사라진다). opencode 변환
(`runOpencodeTransform`, opencode ∈ 이번 선택일 때만 돈다)이 지금 렌더하는 `mcp.<name>` 옆에 원소 키를 **조건부로** 더한다:
antigravity ∈ `AGENTS.md` 집합(선택 ∪ 기록) ∧ codex ∉ 그 집합 ∧ `AGENTS.md` 가 절 모델(D2 5번과 같은 `agentsMdModelFor`). 집합
기준인 이유(적대적 리뷰 F2): "이번 선택" 으로 두면 antigravity 를 안 고른 부분 실행이 원소를 걷는다 — 그 부분 실행의 `AGENTS.md` 는
D2 3번이 거짓이라 인라인이고, 두 번 읽은 뒤 다음 update 에 한 번으로 모인다. 절 모델 조건인 이유(R2-B1): 첫 접촉 블록은 늘 인라인이라
원소를 두면 OpenCode 가 늘 두 번 읽는다. 모델 판정은 디스크 `AGENTS.md` 와 기록만 읽는다 — 앞의 변환은 그 파일을 쓰지 않으므로
opencode 변환 전에 재도 `writeAgentsMd` 와 같은 답이고, 쓰기 주체는 늘지 않는다. `renderedKeyIds` 는 모델을 보지 않는다(받을 수
있는 id 의 집합이라 넓어도 된다). `runCliTransforms` 가 `AGENTS.md` 집합을 opencode 변환 **전에** 계산해
넘긴다. 변환은 쓰기 뒤 원소가 디스크에 있는지를 보고하고, 그 값이 D2 의 4번이다 — `runAgentsMdTransform` 이 인자로 받는다.
`uninstall --cli` 재렌더는 `opencode.json` 을 쓰지 않으므로 늘 4번이 거짓 → 인라인.

키 문법에 **문자열 동치 배열 원소** kind 를 새로 더한다(예: `instructions[=.agents/rules/*.md]`). `#` 는 훅 핸들러 전용 의미
(`callsScript` · 묶음 소유)라 재사용하지 않는다(검증 N2).

- 더하기: 배열에 없으면 끝에 붙인다. 배열이 없으면 만들고 `instructions[]` 컨테이너 키도 기록한다(걷을 때 빈 배열 정리).
- 빼기: 렌더에서 빠진 기록 키는 지금 `planUpsert` 가 걷는다 — 기록에 있을 때만, 설치자 원소는 건드리지 않는다.
- **설치자가 이미 같은 문자열을 갖고 있으면**(기록 없이 배열에 있음) 하네스 몫으로 적지 않는다 — 빼지도 않는다(ADR-097 ⓑ).
- 파싱 실패 = 지금 json-keys 와 같이 쓰지 않고 알린다 → 원소 부재 → D2 인라인.
- `--without` 로 그 키를 빼면 원소 부재 → D2 인라인. `renderedKeyIds`(`src/key-ids.ts`)가 opencode 몫으로 새 키 id 를
  같은 조건(antigravity ∈ 집합 ∧ codex ∉ 집합)으로 내야 `--without` 이 그 id 를 받는다(재검증 N6).
- 원소는 값이 곧 정체라 "편집" 이 없다 — 문자열을 고치면 하네스 원소 삭제 + 설치자 원소 추가로 읽히고, 다음 실행이 하네스
  원소를 되살린다(ADR-099 R1). 빼는 길은 `--without` 하나다(재검증 N7).

### D4. 집합이 바뀌는 실행 — 새 경로 없음, 다음 update 에 수렴

| 바뀜 | 그 실행의 `AGENTS.md` | `instructions` 원소 | OpenCode 읽기 → 다음 update |
|---|---|---|---|
| opencode 설치본에 `install --cli antigravity` | 인라인(2번 거짓) | 그대로(없음) | 1회 → 포인터 · 원소 생김 |
| antigravity 설치본에 `install --cli opencode --track X` | 인라인(3번 거짓) | **생긴다**(antigravity 가 기록에 있다 — F2) | 2회(X∪Y 인라인 + 글롭) → 포인터 |
| opencode+antigravity 에 `install --cli codex` | 인라인(1번 거짓) | **남는다**(opencode 변환 미실행) | **2회**(인라인 + 글롭) → update 가 원소를 걷어 1회 |
| 포인터 설치본에서 opencode ∉ 선택인 모든 실행(`install --cli claude` · `--reinstall` 의 부분 선택 · `uninstall --track` 재렌더 등, 재검증 N4) | 인라인(2번 거짓) | 남는다 | 2회 → update 가 포인터로 되돌린다 |
| 포인터 설치본에서 opencode ∈ · antigravity ∉ 선택(`install --cli opencode`, F2) | 인라인(3번 거짓) | **남는다**(antigravity 가 기록에 있다) | 2회 → 포인터 |
| 첫 접촉 블록(설치자가 먼저 가진 `AGENTS.md`) — 어느 실행이든 · 블록이 굳어도(R2-B1) | 블록 안 인라인(5번 거짓) | 없음(절 모델 아님) | 1회(인라인) — 굳은 블록도 인라인이라 집합이 바뀌어도 0번이 아니다 |
| `uninstall --cli codex` (oc+ag 남음) | 인라인(재렌더, 4번 거짓) | 그대로(없음) | 1회 → 포인터 |
| `uninstall --cli antigravity` (oc 남음) | 인라인 | 남는다(폴더는 사라져 빈 매치) | 1회 → update 가 원소를 걷는다 |
| `uninstall --cli opencode` | 남는 집합대로 | 기록 몫을 걷는다(현행 `stripSharedFiles`) | — |
| update(기록 CLI 전부 선택) | 조건대로 | 조건대로 | 수렴 |

### D5. 기존 설치본의 첫 update

- 절 위치만 바뀌고 설치자 절 내용은 그대로다. 절 모델의 백업 규칙(파일 단위 sha — ADR-103 Consequences)은 바꾸지 않는다:
  `## Project Context` 를 채운 설치자는 하네스 절이 바뀌는 이 update 에서 `AGENTS.md` 백업 하나를 받는다.
- 옛 판의 `## Harness Rules` 안 인라인 룰 제목(h2)을 설치자 절로 되살리지 않는 규칙(ADR-103 결정 2)은 그대로.

## 3. 바꾸지 않는 것

- Working Principles 는 Codex 에 인라인으로 남긴다(#944 §방향). 늘 적용되는 룰 5종도.
- 경로 룰의 Codex 포인터 · 스킬 전환은 이번 범위 밖(#944 §열린 질문 — 실 Codex 측정 뒤).
- Antigravity `.agents/rules/` 배치 · frontmatter(ADR-103 결정 4).
- 혼합 설치에서 `.agents/rules/` 를 건너뛰는 안(ADR-103 기각 사유 그대로).

## 4. 검증

| 완료 기준 | 증거 |
|---|---|
| D1 — Codex 포함 집합에서 `## Harness Rules` 앞 바이트(하네스 몫 + 빈 스캐폴드)가 24,000 B 미만 | 크기 게이트를 트랙 **두 개 조합 전부** × antigravity 포함 집합으로 넓힌다. 음성 대조: 순서를 되돌리면 red |
| D1 — 설치자 상위 절이 update 뒤 `## Harness Rules` 앞에 있다 | 병합 단위 테스트 + 옛 npm 판(v26.180.0) 실설치 → update 컨테이너 시나리오 |
| D2 · D3 — opencode+antigravity 에서 `AGENTS.md` 에 룰 본문 없음 · `instructions` 에 원소 있음 · 실재 파일 매치 | 설치 테스트 + `resident-reach-4cli` 갱신(OpenCode 도달 = `instructions` 글롭이 실재 `.agents/rules/*.md` 를 가리킴) |
| D3 — 설치자 원소 보존 · 파싱 실패 시 인라인 | 어댑터 단위 테스트(같은 문자열 선점 · 다른 원소 · 깨진 JSON) |
| D4 — 표의 네 바뀜 | uninstall --cli · update 테스트(남는 집합 렌더와 원소 동시 판정) |
| D1(F1) — 파일 끝에 붙인 룰 제목 절(`## Testing` · `## Git Safety`)이 update · `uninstall --cli antigravity` · uninstall 뒤에 남는다 · 옛 판(블록 없음)은 제목 판정 | 실설치 테스트 + 병합 · 걷기 단위 테스트, 음성 대조(마커 무시 → red) |
| OpenCode 가 `.agents/rules/*.md` 를 실제로 읽는다 | 실 OpenCode(Docker realcli 이미지)에서 해석된 instructions 를 확인 — 모델 호출 없이 가능한 명령으로. 없으면 "미검증" 으로 보고 |

### D6. 결정 기록과 함께 고칠 문서 · 테스트

- 새 ADR(`Amends: ADR-103`) — ADR-103 결정 1 의 인라인 조건 · Consequences 2항(oc+ag 이중 읽기)이 바뀌고 `opencode.json` 하네스
  몫이 `mcp.*` ∪ 원소로 넓어진다. #300 시절 "instructions 는 룰을 병합하지 않는다" 의 번복 경위 한 줄. ADR-097 은 개정 불요(모델
  안의 새 키 kind) — `json-keys.ts` 헤더 키 문법 표와 `docs/plans/one-principle-design-2026-09-27.md` §6.2 표를 고친다.
- 같은 사실을 말하는 곳(검증 N6): 루트 `CLAUDE.md` 함정 3 · `src/rules-port.ts` 주석 · `tests/resident-reach-4cli.test.ts`
  (`instructions` 에 `rules/` 금지 단언 → 조건부로) · `RULE_DESTINATION.opencode` · `tests/cli-shared-files.test.ts`
  (`instructions` 는 하네스 몫이 아니다).

## 4.1 OpenCode 사실 확인 (소스 `anomalyco/opencode` dev, `packages/core/src/config/plugin/instruction.ts` · `packages/util/src/fs-util.ts`, 2026-10-26 커밋)

- 상대 경로 `instructions` 는 실행 폴더에서 프로젝트 루트까지 **올라가며** 각 폴더 기준으로 글롭한다(`globUp`).
- 글롭 옵션 `{ absolute: true, include: "file", dot: true }` — 점 폴더(`.agents/`)를 매치한다.
- 파일은 그대로 읽는다(frontmatter 를 떼지 않는다) — `trigger: …` 줄이 본문으로 함께 들어간다.
- 같은 파일이 여러 출처로 잡혀도 해석 경로로 한 번만 넣는다(`watched`).
- npm `opencode-ai` 의 설치 판이 이 소스와 같은지는 실 OpenCode(Docker)에서 확인한다.

## 5. 위험 · 확인할 것

- (감수) `install --cli codex` 를 oc+ag 설치본에 더한 뒤 다음 update 까지 OpenCode 가 룰을 두 번 읽는다(D4 3행).
- (감수, 검증 N3) 포인터가 설치자 원소에 기대는 경우, 설치자가 그 원소를 지우면 다음 update 까지 OpenCode 가 룰을 못 받는다.
  하네스 원소도 설치자가 지우면 같다.
- (검증 N4 → 적대적 리뷰 F1 에서 감수 철회) D1 뒤 파일 끝 = `## Harness Rules` 구역이다. 제목으로 가르면 설치자가 끝에 붙인
  `## Testing` 같은 절이 라이브에서 빠진다(룰 제목 집합이 흔한 제목을 포함한다 — 실측). D1 의 `rules` 마커 블록으로 닫았다 —
  블록 끝 뒤는 제목과 무관하게 설치자 것이다.
- (감수, 적대적 재검증 R2-M1 — 조율자 결정) `rules` 블록 **안**에 설치자가 쓴 `## ` 절(룰 사이 · 끝 마커 바로 앞)은 제목과 무관하게
  하네스 것이라 다음 update 에 라이브에서 빠진다 — main 은 룰 제목이 아닌 절을 남겼다(#735). 하네스 마커 안 편집은 보장 밖이라는
  ADR-095 D2 와 같은 규약이고(앵커 · 스킬 블록도 같다), 내용은 `AGENTS.md.backup-<시각>` 에 남는다. 안내문이 "이 절 위에" 라고 한다.
- (감수, 적대적 재검증 R2-M2 — 조율자 결정) `rules` 마커 줄을 지우거나 고치면(시작 · 끝 · 둘 다 · 이름 변경) 블록이 없는 파일로 읽혀
  옛 제목 판정으로 돌아가 파일 끝의 룰 제목 절이 빠지고, 끝 마커를 설치자 절 아래로 옮기면 그 사이 절이 블록 안으로 들어가 빠진다.
  하네스가 쓴 마커 줄을 고친 것이라 R2-M1 과 같은 ADR-095 D2 부류로 감수한다(다음 update 가 마커를 다시 쓴다 · 내용은 백업에 남는다).
- (검증 N5 · 재검증 N2 → 적대적 재검증 R2-B1 에서 닫음) 첫 접촉 블록 안을 설치자가 고쳐 블록이 `kept` 로 굳으면 그 내용이 굳는다
  (ADR-095 D2 "마커 안 편집은 보장 밖", 복구 = `--with agents-md:agents` 재설치). 위치 안내가 굳으면 Antigravity 가 빠지거나 Codex 가
  들어온 뒤 Codex · OpenCode 가 update 를 거듭해도 0번이었다(main 은 6) — D2 5번으로 블록에는 위치 안내를 쓰지 않으므로 굳는 것은
  늘 인라인이다. 블록 모델에는 원소도 없어(D3) OpenCode 는 인라인으로 한 번 읽는다.
- (감수, main 과 같음) Antigravity 단독일 때 굳은 블록(룰 절 없음)에 OpenCode 를 더하면 OpenCode 가 0번이다 — main 도 같고(적대적
  리뷰 F2 counter-case), 18502c0 판은 원소로 6 을 냈지만 블록 모델에서 원소를 빼면서 main 과 같아졌다. 복구는 위와 같다.
- (재검증 N9) ADR-103 결정 2 의 "`uninstall --cli` 재렌더 = 다음 update 와 같은 바이트" 가 포인터 적격 설치본에서 깨진다(재렌더
  인라인 → update 포인터). 백업은 생기지 않는다(`withRerender` 가 sha 를 잇는다). 새 ADR 에 정정을 싣고, 바이트 동일을 단언하는
  테스트가 있으면 그 경우를 뺀다.
- (출하 전 필수, 재검증 N3) 하위 폴더에서 띄운 실 OpenCode(npm `opencode-ai` 설치 판)가 루트 `.agents/rules/*.md` 를 읽는다 —
  §4.1 소스로는 확인됐고, 설치 판에서 한 번 본다. 모델 호출 없이 볼 길이 없으면 그 사실을 보고하고 사용자 판단을 받는다.
- (감수, 검증 N7) 글롭이 설치자의 Antigravity 전용 룰(`.agents/rules/my-ide.md`)도 OpenCode 로 가져온다.

- OpenCode 가 `.agents/rules/*.md` 의 YAML frontmatter(`trigger: …`) 줄을 본문으로 함께 읽는다 — 해가 있는지.
- OpenCode 의 `instructions` 글롭이 점으로 시작하는 폴더(`.agents/`)를 매치하는지.
- `instructions` 원소의 상대 경로 기준(프로젝트 루트 vs `opencode.json` 위치).
- 위치 안내 문단이 Codex 가 없는 집합에서만 나가는지(문장이 각 표면에서 참인가).
