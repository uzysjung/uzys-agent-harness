# ADR-103: `AGENTS.md` 는 비-Claude CLI 전부의 공유 앵커 — 깔린 집합으로 렌더하고, Antigravity 앵커 파일은 은퇴하며, Antigravity 룰은 frontmatter 를 단다

- Status: Proposed
- Date: 2026-10-11
- PR: (머지 직전에 채운다)
- Issue: #631 · #645 · #642
- Amends: ADR-071(Antigravity 행 — 룰 자리는 `.agents/rules/` 그대로, 앵커는 `AGENTS.md`; 파일당 상한 "12,000자" → 24,000 bytes) ·
  ADR-096 D7(씨 뿌리기 출처에 옛 Antigravity 앵커 추가) · ADR-095(절 모델의 템플릿이 하나) · ADR-048/049(Antigravity 산출물 목록)
- 설계 = `docs/plans/v26.165.0-design.md` §2 · §3 · §9(독립 검증 반영) · 검증 = `docs/plans/v26.165.0-design-verify.md`

## Context

- **#631** — Antigravity 는 `.agents/rules/*.md` 마다 YAML frontmatter 의 `trigger` 를 요구하고, 없으면 그 룰을 조용히 버린다
  (https://antigravity.google/docs/rules, 확인 2026-10-11). 하네스가 쓰던 일곱 파일(앵커 + 룰 6) 모두 frontmatter 가 없었다 —
  설치 화면의 "Rules ✓" 는 실체가 없었다. 앵커의 FILL 안내도 Antigravity 단독 설치에는 없는 `.claude/rules/` 를 가리켰다.
- **#645** — 앵커 `.agents/rules/uzys-harness.md` 는 통째로 하네스 파일이라, 설치자가 채운 FILL 을 매 update 가 빈 스캐폴드로
  되돌렸다(편집분은 백업행). codex · opencode 의 `AGENTS.md` 는 절 모델(#503)로 이미 보존한다.
- **#642** — codex · opencode 가 각자 템플릿으로 같은 `AGENTS.md` 를 썼고 한 실행에서 쓰는 쪽은 하나였다(#550). codex 설치본에
  opencode 를 더하면 제목이 `OpenCode Agent Guide` 가 되고 Codex 몫(`## Session Start` · 32 KiB 안내)이 조용히 빠졌다.
  `uninstall --cli` 는 빠진 CLI 의 판을 다음 update 까지 남겼다.
- Antigravity 는 IDE · CLI 모두 워크스페이스 루트의 `AGENTS.md` 를 frontmatter 없이 always_on 으로 읽는다(같은 문서 ·
  context7 `/websites/antigravity_google_cli`). 공식 문서가 "always_on 룰은 `AGENTS.md` 에 두라" 고 권한다.

## Decision

1. **`AGENTS.md` 는 템플릿 하나(`templates/AGENTS.md.template`) · 렌더러 하나(`src/agents-md-render.ts`)가 깔린 비-Claude CLI
   집합으로 렌더한다.** 제목의 CLI 이름 · Codex 의 `## Session Start` · 인라인 룰 `## Harness Rules`(codex 또는 opencode 가 있을
   때만 — Antigravity 는 `.agents/rules/` 로 받는다) · `## Protected Files` 의 1차 방어 줄이 집합에 따라 붙고 빠진다. 빈 절은 헤딩째
   뺀다. 쓰기 주체는 하나(`src/agents-md-transform.ts`) — `runCliTransforms` 가 세 변환 **뒤에** 한 번 부르고, 집합 = 이번 선택 ∪
   기록된 CLI(ADR-096 D2 — install 도 누적).
2. **`uninstall --cli <x>` 는 `AGENTS.md` 를 읽는 CLI 가 남으면 그 집합으로 그 자리에서 다시 렌더한다**(update 와 같은 입력 —
   다음 update 가 같은 바이트를 낸다). 빠지는 CLI 의 몫은 절이 아니라 문장 단위로 섞여 있어 strip 으로 표현되지 않는다 — 남는
   집합으로의 재렌더가 "하네스 몫만 뺀다" 의 가장 단순한 구현이다. 설치자 절은 `mergeAgentsMd` 가 잇는다. 옛 판
   `## Harness Rules` 안의 인라인 룰 제목(h2)은 렌더에서 빠져도 설치자 절(#643 의 "모르는 절")로 되살리지 않는다 — 안 그러면
   Antigravity 만 남은 집합에서 룰이 `AGENTS.md` 에 영영 남는다.
3. **Antigravity 의 앵커는 루트 `AGENTS.md` 다.** 옛 앵커 `.agents/rules/uzys-harness.md` 는 더는 만들지 않는다(사용자 결정
   2026-10-11). 기록에 그 파일이 있으면 install · update(`--reinstall` 포함)가 같은 함수로 **한 번** 은퇴시킨다
   (`src/antigravity/retire-anchor.ts`):
   - **읽기(변환 전)** — 설치자가 채운 `## Project Context` 를 씨로 읽어 `AGENTS.md` 쓰기에 넘긴다. 파일이 없으면 그 씨로 만들고
     (루트 `CLAUDE.md` 씨 다음 순위), 있고 그 절이 손대지 않은 스캐폴드면 그 절을 씨로 바꾼다. 이미 채워져 있으면 합치지 않는다
     (ADR-096 D7). 쓰기는 owned-write 한 번 — 기록 sha = 최종 바이트.
   - **지우기(변환 후)** — `judge(remove)` 규칙 그대로(기록 sha 같으면 지우고, 다르면 그 파일 하나를 백업하고 지운다). 채운 글이
     옮겨지지 않았으면 sha 와 무관하게 백업을 남긴다. 링크 · 프로젝트 밖 실체는 건드리지 않고 알린다(ADR-098).
   - **기록** — `externalFiles` 에서 그 경로를 빼고, 같은 기록 쓰기에서 빼기 **전** `installedClis(log)` 를 `spec.clis` 로 적는다
     (`spec.clis` 없는 옛 로그에서 antigravity 의 유도 근거가 그 경로였다 — update 의 유일한 이행점이다).
4. **Antigravity 룰은 frontmatter 를 단다** — Claude `paths:` 가 있던 룰은 `trigger: glob` + `globs: "<패턴, …>"`, 나머지는
   `trigger: always_on`. `description` 은 넣지 않는다.
5. **스캐폴드의 "채웠는가" 는 하네스가 쓴 줄을 뗀 뒤 판정한다**(`isUnfilledScaffold` — 배너 · FILL 주석 · 상시 스킬 안내를 양쪽에서
   뗀다). FILL 문구를 바꾼 이 릴리즈가 옛 판의 안 채운 스캐폴드를 "채웠다" 로 읽지 않게 하고, 옛 앵커의 마커 없는 안내가 설치자
   글로 옮겨 가지 않게 한다. 씨 뿌리기 · uninstall 의 `AGENTS.md` 걷기 · 앵커 은퇴가 이 함수 하나를 쓴다.

## Alternatives (기각)

- **앵커 파일 유지**(frontmatter `always_on` + 절 모델 병합) — 병합·걷기·블록 판정 기계를 두 번째 파일에 복제하고, codex+antigravity
  설치본에서 Antigravity 가 앵커를 두 번(`AGENTS.md` + 앵커 파일) 읽는 상태가 남는다. 공식 문서가 `AGENTS.md` 를 권한다.
- 앵커를 `trigger: manual` 로 — 원칙은 매 세션 상주해야 하는 층이다(ADR-068 · 071). `@mention` 해야만 읽힌다.
- 룰마다 `description` 을 써 `model_decision` 으로 — 룰은 대원칙이라 상주가 맞고, 룰 본문 변경은 자산별 변경 요청의 몫이다(#345).
- 혼합 설치(codex+antigravity)에서 `.agents/rules/` 를 건너뛰어 중복 상주를 없앤다 — 룰 자리가 옆 CLI 에 따라 달라지고,
  `uninstall --cli codex` 뒤 Antigravity 룰이 비는 창이 생긴다.
- `GEMINI.md` 를 Antigravity 앵커로 — 파일이 하나 늘고 codex · opencode 와 갈라진다.
- 템플릿 둘을 두고 우선순위만 바꾼다 · 집합마다 템플릿 · 템플릿 안 조건문 문법 — 어느 한 판이 이기는 구조가 남거나, 사본이 집합 수
  (7)만큼 늘거나, 미니 템플릿 언어를 들인다. "빈 절 제거 + 자리 치환" 이 같은 결과를 낸다.
- `uninstall --cli` 는 "update 를 돌리라" 고만 안내 — #642-2 가 바로 그 상태를 버그로 본다.

## Consequences

- antigravity 단독 설치본에 전에 없던 루트 `AGENTS.md` 가 생긴다(26.164.0 이하 설치본은 첫 update 에). 화면이 `created` 로 말한다.
- codex(또는 opencode)와 antigravity 를 함께 깐 프로젝트에서 Antigravity 는 룰을 두 번 읽는다 — `AGENTS.md` 의 `## Harness Rules`
  와 `.agents/rules/`. 26.164.0 은 앵커까지 두 번이었으므로 상주는 줄어든다(감수).
- `AGENTS.md` 의 24,000 bytes 상한(Antigravity "any rule file")은 하네스 몫만으로는 넘지 않는다(full 트랙 · 세 CLI · 빈 스캐폴드
  렌더 20,377 B, `tests/agents-md-size-budget.test.ts`). 설치자가 Project Context 를 ~3.6 KB 넘게 채우면 뒤(`## Protected Files`)부터
  잘릴 수 있다 — 실 Antigravity 의 상한 적용 여부는 후속 확인.
- `## Project Context` 를 채운 설치자는, 하네스 절이 바뀌는 실행(이 릴리즈의 첫 update · `uninstall --cli` 재렌더)에서 파일 하나의
  백업을 받는다 — 절 모델 파일의 소유 판정이 파일 단위 sha 라서다(ADR-048, 이 결정이 바꾸지 않는다). 라이브 파일의 설치자 절은
  그대로 이어진다.
- install 의 `AGENTS.md` 집합이 이번 선택 밖의 기록 CLI 를 포함하면 룰은 기록 트랙 ∪ 이번 트랙으로 렌더한다(update 와 같은 식).
- 기록 필드 `templates.opencodeDir` 를 uninstall 이 더는 읽지 않는다(ADR-097 Consequences 의 남은 자리 하나).
- `out-of-track.ts` 의 앵커 예외와 `state.ts` 의 설치 흔적 판정은 옛 이름을 그대로 둔다 — 옛 설치본의 흔적이다.
