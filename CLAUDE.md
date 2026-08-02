# uzys-agent-harness

> 4개 AI 코딩 CLI(Claude Code · Codex · OpenCode · Antigravity)에 검증된 룰·훅·스킬을 설치하는 CLI.
> **왜·어디로** = `docs/NORTH_STAR.md`. 이 파일은 **이 저장소를 안 읽으면 모를 사실**만 담는다 —
> 모델이 이미 아는 것과 코드에서 유도되는 것은 빼고, 남긴 줄에는 강제 기호와 측정일을 붙인다.

**강제 기호**: ✅ 훅이 차단 · 🧪 테스트가 차단 · ⬜ 프로즈뿐(아무도 안 막는다)

## 세션 재앵커 (순서대로)

1. `docs/SPEC.md` — 현재 범위·AC. SessionStart 훅이 이것만 안내한다
2. `docs/plans/*-todo.md` — 진행 중 사이클. `docs/todo.md` 는 쉬는 상태 추적기다(main 을 항상 출하
   가능하게 두려고 열린 사이클을 plans 로 분리한다 — 🧪 `spec-drift-backlog-exemption`)
3. 최신 ADR — `docs/decisions/` (번호는 디렉터리에서 확인)
4. `.claude/CLAUDE.md` — 레인 원칙. 누가 만들고 누가 판정하는가

## Stack & 명령 (실측 2026-07-27)

TypeScript + tsup 번들 · Node 20+ · vitest · biome. 배포 = npm `@uzysjung/agent-harness`(CalVer).

| 목적 | 명령 |
|---|---|
| 전체 게이트 | `npm run ci` = typecheck + lint + test:coverage + build. **약 14초** |
| 테스트만 | `npm test` — **coverage gate 를 놓친다**(branches 88 미달이 안 잡힌다) |
| 상주 비용 | `npm run cost:report [track]` · baseline 갱신 `npm run cost:baseline` |
| 실환경 검증 | `bash test/docker/run.sh <시나리오>` — 호스트에서 실 CLI 설치·실행은 ✅ 차단된다 |

`lint` 는 `src tests` 만 본다. `dist/` 는 생성물이라 직접 고치지 않는다(원본은 `src/`).

## Layout

`src/` 46파일 — 진입 `index.ts`·`cli.ts` / `installer.ts` 설치 파이프라인 / **`manifest.ts` = 무엇을
어디에 깔지 정하는 배선 SSOT** / `commands/` 명령별 / `codex`·`opencode`·`antigravity` CLI별 변환 /
`external-assets.ts` 카탈로그.

**`templates/` 는 npm 으로 낯선 사람 프로젝트에 나가는 배포물이고 `.claude/` 는 우리 개발용이다.**
같은 이름의 파일이 양쪽에 있고 내용이 다르다 — 하나를 보고 다른 하나를 말하지 않는다.

## 검증 게이트 — 무엇이 무는가 (실측 2026-07-27)

| 시점 | 판정 주체(누가 막나) | 미충족 시 |
|---|---|---|
| 커밋 | 없음 | 차단 없음 |
| 머지(PR) | 에이전트 자신(로컬 `npm run ci`) + **독립 리뷰 에이전트** | ⬜ **PR 에는 CI 가 없다** — 프로즈가 유일한 방어 |
| 배포(tag `v*`) | 🧪 GitHub Actions `ci` → `publish` 가 `needs: ci` | 배선 확인(v26.140.0) · **red→미게시 발화는 미관측** |

**릴리즈 커밋 후 태그 전 구간의 로컬 CI 는 구조적으로 red 다** — CHANGELOG→태그 역방향 게이트
때문이고, 순서는 `.claude/rules/ship-checklist.md` §릴리즈 커밋과 태그의 순서. red 를 보고 게이트를
고치지 마라.

## Boundaries

**Always (✅ 훅 자동, 실측 2026-07-27)**: SessionStart SPEC 안내 · 보호 파일(`.env*`·lock·인증서)
편집 차단 · MCP allowlist · 호스트 실 CLI 실행 차단.

**Ask First**: PR 머지 · 태그 push · npm 게시 · 되돌리기 어려운 공유 상태 변경.
**커밋·push·PR 생성은 승인 불요** — 되돌리기 비싼 지점은 main 반영이다.

**Never**: main 강제 푸시 · 리뷰 없는 main 직접 푸시 · main 삭제 · 시크릿 포함 푸시
→ **✅ GitHub 룰셋이 서버에서 거절**(실측 2026-08-02, `GH013` 음성 대조 확인). 로컬엔 아무것도
안 생긴다. `reset --hard` 와 브랜치 작업은 **⬜ 여전히 프로즈뿐** — 서버가 볼 수 없는 영역이다.
적용·재확인 = `bash templates/scripts/protect-branch.sh --dry-run`.

## 미해결 · 함정 (착수 전 확인, 2026-07-27)

1. **~~비가역 차단이 0건이다~~ → main 은 2026-08-02 부터 서버 규칙으로 잠겼다.** 남은 문제는
   방향의 나머지 절반이다 — `permissions.defaultMode = bypassPermissions` 이고 `deny`/`ask` 규칙
   0건, Bash 매처 훅은 `docker-only-realcli` 하나뿐인데, **되돌릴 수 있는 것**(문서 동기화·MCP
   조회·`.env` 편집)은 여전히 로컬에서 막는다. 되돌릴 수 없는 쪽은 서버가 맡았으니 **로컬에
   훅을 더 얹지 말고 강등할 것이 남았다**(백로그 A2). 로컬 가드 신설(옛 A1/A3)은 **기각** —
   명령마다 검사하고 `--no`+`verify` 로 넘어가고 클론마다 재설치해야 한다.
2. **훅이 차단 로그를 남기지 않는다**(실측 0줄). 무엇이 실제로 막고 있는지 판정할 데이터가 없어
   "옥죈다"가 느낌 대 느낌으로 남는다.
3. **`spec-drift-check.sh` 는 미배선이고 지금 물지도 않는다** — 미완 체크박스 309개 앞에서 `ship`
   모드가 exit 0 이다. 그런데 현행 룰 4개 사본(`doc-governance`·`ship-checklist` × 이 리포/배포판)이 이것을 차단
   게이트로 적는다.
4. **룰 33개 중 `paths:` frontmatter 0개** — 전부 무조건 상주한다. 지연 로드로 바꾸면 내용을 한 줄도
   안 지우고 상주가 줄어든다.
5. **문서·자산 변경의 영향 범위를 도구로 고르면 0건이 나온다** — 스위트 85개 중 48개가
   `readFileSync` 로 경로를 읽어 import 그래프 밖이다. 애매하면 전체를 돌린다.
6. `package-lock.json` 의 version 이 `26.134.1` 에 멈춰 있다(이후 태그 5개 · 태그 없이 넘어간 v26.138.0 포함 6버전)(게시 계약 밖이라
   무해하나 버전 확인 시 착각을 부른다). GitHub release 는 v26.95.0 이후 45릴리즈 미생성이다 —
   태그·npm 은 정상이고 release 페이지만 없다.

## 보고·의사결정 형식

사용자에게는 **"무엇이 달라지는가"**로 말한다 — 경로·심볼·커밋 해시로 시작하는 초안은 그 자체가
다시 쓰라는 신호다. 승인 요청은 **추천과 이유를 먼저**(BLUF), 대비는 ASIS→TOBE 표로, 수치는
before → after 로 쓴다("빨라짐"은 검증 불가라 미검증 주장과 구분되지 않는다).
실행 형식·예시 = `explain-plainly` · `asis-tobe-decision` 스킬.
