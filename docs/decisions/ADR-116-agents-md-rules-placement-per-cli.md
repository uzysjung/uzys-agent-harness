# ADR-116: `AGENTS.md` 의 룰 사본은 맨 끝에 두고, Codex 가 없으면 OpenCode 는 `instructions` 로 `.agents/rules/` 를 읽는다

- Status: Accepted
- Date: 2026-11-03
- PR: #946
- Issue: #944
- Amends: ADR-103 — 결정 1 의 인라인 조건 · 결정 2 의 "다음 update 와 같은 바이트" · Consequences 2항(OpenCode+Antigravity 의 이중
  읽기) · Consequences 3항(넘으면 `## Protected Files` 부터 잘린다)
- 설계 = `docs/plans/944-design.md`(설계 검증 반영본)
- Amended by: ADR-117 (#948) — Codex + Antigravity(OpenCode 없음)에서 Antigravity 가 이번에 룰을 다 썼으면 경로 룰은 `.agents/rules/<룰>.md`
  를 가리키는 목록(결정 1 의 "인라인 룰 = 본문 전부" · Consequences 의 Codex 조합 Antigravity 이중 읽기)

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
   Codex 가 32 KiB 에서 멈추면 Claude Code 가 지연 로드하는 것과 같은 경로 룰이 빠진다. 그 절의 하네스 몫(안내 · 인라인 룰 · 위치
   안내)은 `rules` 마커 블록 안이다 — 블록 안은 하네스 것, **블록 끝 뒤의 `## ` 절은 제목과 무관하게 설치자 것**이다(병합 · uninstall
   재렌더 · uninstall 걷기가 한 판정 `headingOwner`). 그 절이 파일 끝이라 설치자가 끝에 붙인 `## Testing` 이 룰 제목과 같아도 다음
   update 가 룰 앞으로 옮긴다(적대적 리뷰 F1). 블록이 없는 옛 판 파일(그 절이 중간)은 전처럼 룰 제목으로 가른다. 첫 접촉 블록
   안에서는 이 마커를 벗긴다.
2. **Codex 가 없고 이번 실행이 OpenCode 의 도달을 보장했으면 룰 본문 대신 위치 안내 한 문단.** 조건(`rulesViaInstructions`)은 집합이
   아니라 이번 실행의 쓰기 결과다: ① Codex ∉ `AGENTS.md` 집합 ② opencode ∈ 이번 선택 ③ Antigravity 변환이 이번 룰 전부를
   `.agents/rules/` 에 썼다 ④ 그 뒤 디스크의 `opencode.json` 을 다시 읽어 `instructions` 에 `.agents/rules/*.md` 가 있다(누구 것이든)
   ⑤ `AGENTS.md` 가 절 모델이다(첫 접촉 블록이 아니다 — 적대적 재검증 R2-B1). 하나라도 거짓이면 인라인. `uninstall --cli` · `--track`
   재렌더는 `opencode.json` 을 쓰지 않으므로 늘 인라인이다. ⑤ 의 이유: 첫 접촉 블록은 설치자가 고치면 `kept` 로 굳는데, 굳은 위치 안내는
   Antigravity 가 빠지거나 Codex 가 들어온 뒤 가리킬 룰이 없어 Codex · OpenCode 가 update 를 거듭해도 0번이었다(main 은 6). 위치 안내는
   매 실행 다시 렌더되는 절 모델에만 두어, 조건이 깨지면 다음 실행이 인라인으로 되돌린다.
3. **`opencode.json` 의 하네스 몫 = `mcp.<name>` ∪ `instructions` 원소 `.agents/rules/*.md`**(Antigravity ∈ `AGENTS.md` 집합(선택 ∪
   기록) ∧ Codex ∉ 그 집합 ∧ `AGENTS.md` 가 절 모델일 때). Antigravity 를 안 고른 부분 실행도 원소를 걷지 않는다(적대적 리뷰 F2) — 그
   실행의 `AGENTS.md` 는 결정 2 ③ 이 거짓이라 인라인이고 다음 update 가 포인터로 모은다. 첫 접촉 블록은 늘 인라인이라(결정 2 ⑤) 원소를
   두지 않는다 — 두면 OpenCode 가 늘 두 번 읽는다. 모델은 `writeAgentsMd` 와 같은 판정(`agentsMdModelFor`)을 opencode 변환 전에 잰다
   (앞의 변환은 `AGENTS.md` 를 쓰지 않는다 — 쓰기 주체는 늘지 않는다). 쓰는 곳은 opencode 변환 하나다. 키 문법에 **문자열 동치 배열 원소** `instructions[=<값>]` 를 더한다(`#` 는
   훅 핸들러 전용). 배열을 하네스가 만들었으면 `instructions[]` 컨테이너 키도 기록한다. 설치 전부터 같은 문자열이 있으면 설치자
   것이다(Q3 — 기록하지 않고 빼지도 않는다). `--without opencode:instructions[=.agents/rules/*.md]` 로 뺀다. ADR-097 은 바꾸지 않는다 —
   모델 안의 새 키 종류다.

## Alternatives (기각)

- **집합만으로 포인터를 정한다**(opencode + antigravity 면 포인터) — 한쪽만 고른 install · 재렌더 · 파싱 실패 · `--without` 에서
  OpenCode 가 룰을 0번 받는 실행이 생긴다(설계 검증 B1).
- **`AGENTS.md` 쪽에서 `opencode.json` 을 한 번 더 쓴다** — 한 실행에서 같은 파일을 두 번 `writeShared` 하면 앞 몫이 사라진다(B1-c).
- **원소 키를 `#` 로 쓴다** — `#` 는 스크립트 호출 판정 · 묶음 소유를 뜻한다(N2).
- **`## Harness Rules` 끝 구역을 룰 제목 집합으로 가른다**(설계 검증 N4 에서 감수했던 판) — 룰 제목 집합에 `## Testing` · `## Delivery`
  · `## Git Safety` 같은 흔한 제목이 있어 설치자가 파일 끝에 붙인 절이 update · `uninstall --cli` 에서 라이브에서 빠졌다(적대적 리뷰
  F1 실측, main 은 남긴다). 제목 목록을 좁히는 것도 같은 경우를 다른 제목으로 남길 뿐이라 마커로 바꿨다(결정 1).
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
  codex` · opencode 를 안 고른 실행 · antigravity 를 안 고른 실행)이 있다 — 하네스가 쓴 파일에서 0번인 창은 없다(설계 §2 D4 표 ·
  `tests/agents-md-per-cli-944.test.ts`). 남는 0번은 아래 감수 항목들이다.
- 기존 설치본의 첫 update 는 절 위치만 바꾼다. 절 모델 백업 규칙(파일 단위 sha)은 그대로라 `## Project Context` 를 채운 설치자는 그
  update 에서 `AGENTS.md` 백업 하나를 받는다.
- (감수, 적대적 재검증 R2-M1) `rules` 블록 **안**에 설치자가 쓴 `## ` 절은 제목과 무관하게 하네스 것이라 다음 update 에 라이브에서
  빠진다 — main 은 룰 제목이 아닌 절을 남겼다(#735). 하네스 마커 안 편집은 보장 밖이라는 ADR-095 D2 와 같은 규약이고(앵커 · 스킬
  블록과 같다), 내용은 `AGENTS.md.backup-<시각>` 에 남는다. 블록 끝 뒤에 쓴 절은 남는다(결정 1).
- (감수, 적대적 재검증 R2-M2) `rules` 마커 줄을 지우거나 고치면(시작 · 끝 · 둘 다 · 이름 변경) 블록 없는 파일로 읽혀 룰 제목 판정으로
  돌아가 파일 끝의 룰 제목 절이 빠지고, 끝 마커를 설치자 절 아래로 옮기면 그 사이 절이 블록 안으로 들어가 빠진다. 하네스가 쓴 마커
  줄을 고친 것이라 R2-M1 과 같은 ADR-095 D2 부류다 — 다음 update 가 마커를 다시 쓰고, 내용은 백업에 남는다.
- (감수) 포인터가 설치자 원소에 기대는 경우, 설치자가 그 원소를 지우면 다음 update 까지 OpenCode 가 룰을 못 받는다. 글롭은 설치자의
  Antigravity 전용 룰(`.agents/rules/my-ide.md`)도 OpenCode 로 가져온다. OpenCode 는 `.agents/rules/*.md` 의 frontmatter(`trigger: …`)
  줄을 본문으로 함께 읽는다.
- 첫 접촉 블록(설치 전부터 있던 설치자 `AGENTS.md`)에서는 Codex 없는 OpenCode + Antigravity 도 인라인이다 — OpenCode 는 한 번,
  Antigravity 는 `.agents/rules/` 와 인라인 사본을 두 번 읽는다(Codex 가 섞인 설치와 같은 감수, ADR-103). 설치자가 블록을 고쳐 `kept`
  로 굳어도 굳는 것은 인라인이라 CLI 집합이 바뀐 뒤 0번이 되지 않는다(결정 2 ⑤).
- (감수, main 과 같음) Antigravity 단독일 때 굳은 블록(룰 절 없음)에 OpenCode 를 더하면 OpenCode 가 0번이다(ADR-095 D2 — 복구 =
  `--with agents-md:agents` 재설치).
- (감수) `AGENTS.md` 가 위치 안내인데 클론에 `.agents/` 가 없으면(설치자가 그 폴더를 VCS 에서 뺀 경우) `update` 전까지 OpenCode 가 룰을
  0번 받고, 그 상태에서는 Antigravity 도 룰이 없다(적대적 리뷰 N-1 — `update` 가 되살린다).
