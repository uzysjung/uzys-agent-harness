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

효과: Codex 가 섞인 집합에서 Antigravity 가 잘라도 잘리는 것은 룰 본문의 뒷부분 — `.agents/rules/` 에 있는 사본 — 뿐이다.
Codex 가 32 KiB 에서 멈출 때도 설치자 절 대신 룰 뒷부분이 빠진다.

### D2. Codex 가 없고 Antigravity · OpenCode 가 함께면 인라인하지 않는다

| 집합(비-Claude) | `## Harness Rules` | OpenCode 가 룰을 읽는 곳 |
|---|---|---|
| codex 포함(어느 조합이든) | 인라인(현행) — D1 로 맨 끝 | `AGENTS.md` 인라인 |
| opencode + antigravity (codex 없음) | **본문 없이 위치 안내 한 문단** | **`opencode.json` `instructions` 의 `.agents/rules/*.md`** |
| opencode 만 | 인라인(현행) | `AGENTS.md` 인라인 — `.agents/rules/` 가 없다(#300) |
| antigravity 만 | 절 없음(현행) | — |

위치 안내 문단(초안): "하네스 룰은 `.agents/rules/` 에 있다. Antigravity 는 그 폴더를 직접, OpenCode 는 `opencode.json`
의 `instructions` 로 읽는다. 이 프로젝트만의 규칙은 이 절 위에 `## ` 절로 쓴다."

OpenCode 공식: `instructions` 의 파일 · 글롭은 "combined with your AGENTS.md". 경로가 정해진 룰(`trigger: glob`)도 OpenCode
에서는 늘 읽힌다 — 지금의 인라인과 같다.

### D3. `opencode.json` `instructions` 의 원소 하나를 하네스 몫으로

json-keys 키 문법에 **배열 원소** 형을 더한다: `instructions#.agents/rules/*.md` = `instructions` 배열에서 값이 그 문자열인
원소. 선례 = `hooks.<Event>#<script>`(설치자 배열 안의 핸들러 하나만 하네스 몫).

- 더하기: 배열에 없으면 끝에 붙인다. 배열이 없으면 만들고 `instructions[]` 컨테이너 키도 기록한다(걷을 때 빈 배열 정리).
- 빼기: 기록에 그 키가 있을 때만 그 원소를 뺀다. 설치자 원소는 건드리지 않는다.
- **설치자가 이미 같은 문자열을 갖고 있으면**(기록 없이 배열에 있음) 하네스 몫으로 적지 않는다 — 빼지도 않는다.
  D2 의 "인라인 안 함" 판정은 그 원소가 배열에 있는지(누구 것이든)로 한다.
- 파싱 실패 = 지금 json-keys 와 같이 쓰지 않고 알린다. 그때 D2 는 **인라인으로 돌아간다**(OpenCode 가 룰을 못 받는 것보다
  두 번 받는 쪽이 낫다).

### D4. 집합이 바뀌는 실행 — install · update · `uninstall --cli`

`AGENTS.md` 렌더와 `instructions` 원소는 **같은 실행에서 같은 집합으로** 정한다(ADR-103 결정 2 — `uninstall --cli` 는 남는
집합으로 재렌더).

| 바뀜 | `AGENTS.md` | `instructions` 원소 |
|---|---|---|
| opencode+antigravity 에 codex 추가 | 인라인 생김(맨 끝) | 하네스 몫이면 뺀다(두 벌 방지) |
| `uninstall --cli antigravity` (opencode 남음) | 인라인 생김 | 뺀다 — 폴더가 사라진다 |
| `uninstall --cli codex` (opencode+antigravity 남음) | 인라인 빠짐 · 위치 안내 | 더한다 |
| `uninstall --cli opencode` | (남는 집합대로) | 뺀다 — 파일이 남는 경우만(마지막 사용자면 파일 처리는 현행) |

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
| OpenCode 가 `.agents/rules/*.md` 를 실제로 읽는다 | 실 OpenCode(Docker realcli 이미지)에서 해석된 instructions 를 확인 — 모델 호출 없이 가능한 명령으로. 없으면 "미검증" 으로 보고 |

## 5. 위험 · 확인할 것

- OpenCode 가 `.agents/rules/*.md` 의 YAML frontmatter(`trigger: …`) 줄을 본문으로 함께 읽는다 — 해가 있는지.
- OpenCode 의 `instructions` 글롭이 점으로 시작하는 폴더(`.agents/`)를 매치하는지.
- `instructions` 원소의 상대 경로 기준(프로젝트 루트 vs `opencode.json` 위치).
- 위치 안내 문단이 Codex 가 없는 집합에서만 나가는지(문장이 각 표면에서 참인가).
