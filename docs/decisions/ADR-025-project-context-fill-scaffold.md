# ADR-025: 프로젝트 CLAUDE.md/AGENTS.md = fill-in 스캐폴드 (트랙 fragment 병합 폐기)

- Status: Accepted
- Date: 2026-07-15
- PR: (feat/project-claude-fill-scaffold)
- Supersedes: `docs/specs/project-claude-fragments.md` (v26.40.0 section-fragment 머지 구조)

## Context

설치 시 딸려오던 프로젝트 루트 `CLAUDE.md`(및 codex/opencode/antigravity `AGENTS.md`)가 "의미없는 내용"이라는 사용자 지적(2026-07-15). 실측 근거:

- **`# [Project Name]` 리터럴** — `_base.md` 제목이 치환되지 않고 모든 프로젝트에 그대로 출하 (`mergeProjectClaude`는 track-list·tagline·section 마커만 치환, 제목은 미치환).
- **generic 트랙 본문** — `fragments/<track>/*.md`가 harness 가정을 서술. `tooling/stack.md`는 모든 프로젝트에 Bash/jq/shellcheck를 **단언**(Python·Next.js 프로젝트엔 틀린 사실). `tooling/active-rules.md`는 존재하지 않는 phantom 룰(`commit-policy`/`ecc-git-workflow`/`ecc-testing`) 나열.
- **AGENTS.md는 프로젝트 컨텍스트 0** — codex/opencode/antigravity는 harness 자체 Rule 1–12만 embed, 프로젝트 고유 정보 없음.

핵심 제약: 인스톨러는 순수 Node CLI로 **설치 시점에 LLM/코드 에이전트를 호출할 수 없다**(spawn 검색 0건). 따라서 프로젝트 고유 컨텍스트를 install-time에 "채우는" 것은 불가능하며, 정적 generic 본문을 출하하는 것이 유일한 기존 선택지였다 — 그게 곧 "의미없음"의 원인.

## Decision

**정적 트랙 fragment 병합을 폐기하고, 프로젝트 컨텍스트를 embed된 `<!-- FILL: -->` 프롬프트 스캐폴드로 출하한다.**

- **harness 관점 MUST-HAVE 6섹션** (사용자 결정, 2026-07-15 AskUserQuestion): identity · stack · architecture · installed-assets · boundaries · verify. 에이전트가 왕복 없이 일하는 데 필요한 최소·완전 컨텍스트.
- 각 섹션 = `## 제목` + 자기완결 `<!-- FILL:id — 실 저장소의 무엇을 조사해 무엇을 적어라. 완료 후 주석 삭제. -->` + 정직한 `_(not filled yet — …)_` placeholder. 렌더-마크다운에 보이는 **SCAFFOLD 배너**로 사람에게도 미검증 템플릿임을 고지.
- **채우기 = post-install trigger only** (사용자 결정: 신규 커맨드 없음): 설치 콘솔 안내 라인 + 파일 내 FILL 주석. 사용자가 자기 CLI 에이전트(예: Claude Code)에 주석 프롬프트를 복붙 실행하면 실 저장소를 조사해 채운다. 손으로 채워도 됨. **인스톨러는 LLM을 돌리지 않는다** (no-false-ship — 비협상).
- **단일 소스 `renderFillScaffold()`** — Claude Code `CLAUDE.md`와 3개 AGENTS.md `{PROJECT_CONTEXT}`에 byte-identical 주입. transform이 스캐폴드를 인자로 넘기며, 프로젝트 CLAUDE.md를 디스크에서 되읽지 않는다(존재하지 않는 쓰기순서 가정 회피 — 심사 지적).
- **fragment 완전 교체** (사용자 결정): `templates/project-claude/` 전체 삭제. 스캐폴드는 track-agnostic이고, 선택 트랙은 `> Active track(s):` 메타 노트로 기록. 설치 자산 목록은 install-time generic 본문 대신 fill 시 실제 파일에서 유도(installed-assets FILL).

## Alternatives

- **fragment를 fallback로 유지 + FILL 주석 덧씌움** — 기각(사용자). graceful하지만 틀린 generic 본문(Bash stack·phantom 룰)이 잔존해 no-false-ship 지적을 남긴다.
- **신규 `/uzys:fill-context` 슬래시 커맨드로 채우기** (합성 워크플로 권장안) — 기각(사용자, "복잡하게 만들지 말고"). 콘솔 안내 + 주석 복붙으로 충분. 커맨드 등록·manifest 배선·커맨드↔스캐폴드 derive 테스트를 모두 제거해 표면 최소화.
- **install-time에 에이전트로 자동 채움** — 불가(인스톨러에 LLM 없음). 주장 시 거짓출하.
- **현상 유지** — 기각. `[Project Name]` 리터럴 + 틀린 stack 단언 + AGENTS.md 컨텍스트 0 = North Star(context-engineering, 적은 왕복)와 정면 충돌.

## Consequences

- **긍정**: 출하 파일이 정직해진다(미검증은 placeholder·배너로 명시). 실 프로젝트 고유 컨텍스트를 사용자가 1스텝으로 자가 생성. 4-CLI 모두 동일 스캐폴드를 단일 소스에서 받음(parity). 신규 트랙 추가 시 fragment 디렉토리 불필요 → SCALE-6 마찰 감소. phantom 룰 드리프트가 generic 본문 폐기로 소멸.
- **드리프트 차단(코드 게이트)**: `tests/agents-md-scaffold-parity.test.ts`가 `templates/*/AGENTS.md.template`을 디렉토리 스캔해 전부 `{PROJECT_CONTEXT}` 보유를 강제(미래 4번째 CLI 누락 차단). merge 테스트가 이름치환·배너·FILL 생존·6섹션 exhaustiveness를 강제. (no-false-ship: 주석 경고 ≠ 차단 수단.)
- **부정/리스크**: (a) 재설치 시 채워진 CLAUDE.md/AGENTS.md 위에 스캐폴드 재주입 — `backupFileIfChanged`가 **CLAUDE.md와 3개 AGENTS.md 산출물 모두**에 적용되어 데이터 손실은 막으나(리뷰 Finding #2 반영, `.backup-<ts>` 생성) 콘솔에 backup 경로를 surface하는 건 CLAUDE.md 뿐이라 UX는 개선 여지(후속). (b) AGENTS.md가 `{PROJECT_RULES}` + `{PROJECT_CONTEXT}` 둘 다 embed → codex/opencode 세션 토큰 증가(측정 후 필요 시 trim 변형). (c) 채우기는 사용자 실행 의존 — 안 하면 스캐폴드 상태 유지(정직하나 미완).
- **언어**: FILL 프롬프트·배너·콘솔 안내 = 영어(공개 npm 패키지, `templates/CLAUDE.md`·README·USAGE·콘솔 컨벤션 일치). 한국어 선호 시 `FILL_SPECS`/`SCAFFOLD_BANNER` 상수만 교체.
- **문서 영향**: `docs/specs/project-claude-fragments.md`(Superseded 표기), CONTRIBUTING "Adding a Track" 항목(트랙별 템플릿 생성 스텝 제거), CHANGELOG v26.96.0.
