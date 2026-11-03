# ADR-116: `AGENTS.md` 의 룰 사본은 맨 끝에 두고, Codex 가 없으면 OpenCode 는 `instructions` 로 `.agents/rules/` 를 읽는다

- Status: Proposed
- Date: 2026-11-03
- PR: (머지 때 채운다)
- Issue: #944
- Amends: ADR-103 — 결정 1 의 인라인 조건 · 결정 2 의 "다음 update 와 같은 바이트" · Consequences 2항(OpenCode+Antigravity 의 이중
  읽기) · Consequences 3항(넘으면 `## Protected Files` 부터 잘린다)
- 설계 = `docs/plans/944-design.md`(설계 검증 반영본)

## Context

- Antigravity 는 룰 파일 하나에서 24,000 B 를 넘는 부분을 자르고, 하네스 룰은 `.agents/rules/` 에서 따로 읽는다 — `AGENTS.md` 의
  인라인 룰은 Antigravity 에게 사본이다(antigravity.google/docs/rules). v26.180.0 의 절 순서는 룰 본문 → `## Session Start` →
  `## Protected Files` → 설치자가 덧붙인 절(update 가 파일 끝으로 모은다)이라, 상한을 넘기는 것은 사본인데 잘리는 것은 설치자 절과
  `## Protected Files` 였다. htmx 두 트랙 조합은 하네스 몫만으로 넘는다(#944 표). 안내문은 설치자에게 "이 문서에 이어 쓰라" 고 해 그
  자리로 보냈다.
- OpenCode 는 `opencode.json` 의 `instructions`(경로 · 글롭)를 "combined with your AGENTS.md" 로 읽는다(opencode.ai/docs/rules).
  소스(`anomalyco/opencode` `packages/core/src/config/plugin/instruction.ts`)는 상대 경로를 실행 폴더에서 프로젝트 루트까지 올라가며
  점 폴더 포함으로 글롭한다(설계 §4.1). Codex 에는 다른 파일을 끌어오는 길이 없다(#944 §근거).

## Decision

1. **`## Harness Rules` 를 템플릿 맨 끝으로** — `Project Context` → `Project Rules` → `Session Start` → `Protected Files` → (설치자 상위
   절) → `Harness Rules`. update 병합은 설치자 상위 절을 `## Harness Rules` 바로 앞에 되살린다(그 절이 렌더에 없으면 파일 끝). 첫 접촉
   블록도 블록 안 순서가 같다. 안내문은 "이 절 **위에** `## ` 절로" 쓰라고 한다. 인라인 룰은 상시 룰 → 경로 룰(`paths:`) 순이다 —
   Codex 가 32 KiB 에서 멈추면 Claude Code 가 지연 로드하는 것과 같은 경로 룰이 빠진다.
2. **Codex 가 없고 이번 실행이 OpenCode 의 도달을 보장했으면 룰 본문 대신 위치 안내 한 문단.** 조건(`rulesViaInstructions`)은 집합이
   아니라 이번 실행의 쓰기 결과다: ① Codex ∉ `AGENTS.md` 집합 ② opencode ∈ 이번 선택 ③ Antigravity 변환이 이번 룰 전부를
   `.agents/rules/` 에 썼다 ④ 그 뒤 디스크의 `opencode.json` 을 다시 읽어 `instructions` 에 `.agents/rules/*.md` 가 있다(누구 것이든).
   하나라도 거짓이면 인라인. `uninstall --cli` · `--track` 재렌더는 `opencode.json` 을 쓰지 않으므로 늘 인라인이다.
3. **`opencode.json` 의 하네스 몫 = `mcp.<name>` ∪ `instructions` 원소 `.agents/rules/*.md`**(Antigravity ∈ 이번 선택 ∧ Codex ∉
   `AGENTS.md` 집합일 때). 쓰는 곳은 opencode 변환 하나다. 키 문법에 **문자열 동치 배열 원소** `instructions[=<값>]` 를 더한다(`#` 는
   훅 핸들러 전용). 배열을 하네스가 만들었으면 `instructions[]` 컨테이너 키도 기록한다. 설치 전부터 같은 문자열이 있으면 설치자
   것이다(Q3 — 기록하지 않고 빼지도 않는다). `--without opencode:instructions[=.agents/rules/*.md]` 로 뺀다. ADR-097 은 바꾸지 않는다 —
   모델 안의 새 키 종류다.

## Alternatives (기각)

- **집합만으로 포인터를 정한다**(opencode + antigravity 면 포인터) — 한쪽만 고른 install · 재렌더 · 파싱 실패 · `--without` 에서
  OpenCode 가 룰을 0번 받는 실행이 생긴다(설계 검증 B1).
- **`AGENTS.md` 쪽에서 `opencode.json` 을 한 번 더 쓴다** — 한 실행에서 같은 파일을 두 번 `writeShared` 하면 앞 몫이 사라진다(B1-c).
- **원소 키를 `#` 로 쓴다** — `#` 는 스크립트 호출 판정 · 묶음 소유를 뜻한다(N2).
- **인라인 룰을 마커로 감싸 위치 대신 마커로 가른다** — 설치자가 룰 뒤에 같은 제목을 쓰는 경우를 막지만 이번 범위 밖(N4).
- **Codex 의 경로 룰을 포인터 · 스킬로** — 실 Codex 로 재기 전에는 넣지 않는다(#944 §열린 질문).

## Consequences

- Codex 가 섞인 집합에서 Antigravity 가 잘라도 잘리는 것은 룰 사본의 뒷부분뿐이다 — 두 트랙 조합 전부에서 룰 앞 바이트 ≈ 11.0 KB
  (`tests/agents-md-size-budget.test.ts`). OpenCode + Antigravity(포인터)는 파일 전체가 ≈ 11.0 KB 다. ADR-103 Consequences 3항의
  "넘으면 `## Protected Files` 부터 잘린다" 는 이제 "룰 사본부터 잘린다" 다.
- ADR-103 Consequences 2항의 OpenCode + Antigravity 이중 읽기가 없어진다 — 조건이 맞는 설치본은 install 또는 다음 update 에 두 CLI
  모두 룰을 한 번씩 읽는다. Codex 가 섞인 설치의 Antigravity 이중 읽기는 그대로다(감수, ADR-103).
- **ADR-103 결정 2 정정** — "`uninstall --cli` 재렌더 = 다음 update 와 같은 바이트" 는 포인터 적격 설치본에서 깨진다(재렌더는 인라인
  → 다음 update 는 포인터). 백업은 생기지 않는다(재렌더가 기록 sha 를 잇는다).
- **#300 의 "`instructions` 는 룰을 병합하지 않는다" 를 Codex 없는 조합에서만 뒤집는다.** #300 은 없는 폴더를 가리킨 결함이었다 —
  지금 원소는 그 실행이 `.agents/rules/` 를 다 썼을 때만 포인터의 근거가 되고, OpenCode 단독 설치에는 원소가 없다
  (`tests/resident-reach-4cli.test.ts`).
- 집합이 바뀌는 실행은 새 경로 없이 다음 update 에 수렴한다. 그 사이 OpenCode 가 룰을 **두 번** 읽는 창(포인터 설치본에 `install --cli
  codex` · opencode 를 안 고른 실행)이 있다 — 0번인 창은 없다(설계 §2 D4 표 · `tests/agents-md-per-cli-944.test.ts`).
- 기존 설치본의 첫 update 는 절 위치만 바꾼다. 절 모델 백업 규칙(파일 단위 sha)은 그대로라 `## Project Context` 를 채운 설치자는 그
  update 에서 `AGENTS.md` 백업 하나를 받는다.
- (감수) D1 뒤 파일 끝 = `## Harness Rules` 구역이다. 설치자가 룰 **뒤에** 룰 제목과 같은 `## ` 절을 쓰면 하네스 것으로 읽혀 라이브에서
  빠진다(파일 백업에는 남는다). 다른 이름의 절은 다음 update 가 룰 앞으로 옮긴다.
- (감수) 포인터가 설치자 원소에 기대는 경우, 설치자가 그 원소를 지우면 다음 update 까지 OpenCode 가 룰을 못 받는다. 글롭은 설치자의
  Antigravity 전용 룰(`.agents/rules/my-ide.md`)도 OpenCode 로 가져온다. OpenCode 는 `.agents/rules/*.md` 의 frontmatter(`trigger: …`)
  줄을 본문으로 함께 읽는다.
- (감수) 첫 접촉 블록을 설치자가 고쳐 블록이 `kept` 로 굳으면 그 내용이 굳는다 — 옛 인라인과 원소가 함께 남으면 두 번, 포인터가 굳은
  뒤 원소가 걷히면 0번도 가능하다(ADR-095 D2 "마커 안 편집은 보장 밖"). 복구 = `--with agents-md:agents` 재설치.
