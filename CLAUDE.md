# uzys-agent-harness

> 4개 AI 코딩 CLI(Claude Code · Codex · OpenCode · Antigravity)에 검증된 룰·훅·스킬을 설치하는 CLI.
> **왜·어디로** = `docs/NORTH_STAR.md`. 이 파일은 **이 저장소를 안 읽으면 모를 사실**만 담는다 —
> 모델이 이미 아는 것과 코드에서 유도되는 것은 빼고, 남긴 줄에는 강제 기호와 측정일을 붙인다.

**강제 기호**: ✅ 훅이 차단 · 🧪 테스트가 차단 · ⬜ 프로즈뿐(아무도 안 막는다)

## 판정은 목적에서 시작한다 (사용자 확정 2026-08-13)

자산을 넣을지·남길지·뺄지 정할 때 **첫 질문은 하나다: 이게 사용자가 AI 코딩 도구로 개발을
잘하게 만드는가.** "결정론적인가" · "구현 가능한가" · "보안상 좋은가"는 **그 다음**이고, 첫 질문을
통과 못 한 자산은 나머지를 아무리 잘 만족해도 넣지 않는다. 방향의 SSOT 는 `docs/NORTH_STAR.md`
§1 — 여기 옮겨 적지 않는다.

**기술적 타당성은 목적 적합성의 증거가 아니다.** 이 기준이 실제로 판정을 뒤집은 첫 사례 = ADR-072.

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
| 문서 drift 확인 | `bash templates/scripts/spec-drift-check.sh ship` — 룰이 가리키는 `.uzys-agent-harness/` 경로는 설치받은 프로젝트 전용이다(이 리포는 자기 자신에 미설치) |

`lint` 는 `src tests` 만 본다. `dist/` 는 생성물이라 직접 고치지 않는다(원본은 `src/`).

## Layout

`src/` — 진입 `index.ts`·`cli.ts` / `installer.ts` 설치 파이프라인 /
**`manifest.ts` = 무엇을 어디에 깔지 정하는 배선 SSOT** / `commands/` 명령별 /
`codex`·`opencode`·`antigravity` CLI별 변환 / `external-assets.ts` 카탈로그.

**`templates/` 는 npm 으로 낯선 사람 프로젝트에 나가는 배포물이고 `.claude/` 는 우리 개발용이다.**
같은 이름의 파일이 양쪽에 있고 내용이 다르다 — 하나를 보고 다른 하나를 말하지 않는다.

## 검증 게이트 — 무엇이 무는가 (실측 2026-07-27)

| 시점 | 판정 주체(누가 막나) | 미충족 시 |
|---|---|---|
| 커밋 | 없음 | 차단 없음 |
| 머지(PR) | 에이전트 자신(로컬 `npm run ci`) + **독립 리뷰 에이전트**(문턱 = `.claude/rules/test-policy.md` §시점별 검증 — 그 밖은 리그레션만) | ⬜ **PR 에는 CI 가 없다** — 프로즈가 유일한 방어 |
| 배포(tag `v*`) | 🧪 GitHub Actions `ci` + **`docker-e2e`(컨테이너 실설치 3종)** → `publish` 가 `needs: [ci, docker-e2e]` | 배선 확인(v26.140.0 · docker-e2e 는 2026-08-28 #369·#370) · **red→미게시 발화는 미관측** |
| 배포(tag `v*`) · 신호만 | ⬜ `docker-scenarios.yml` — 나머지 시나리오 15종 + 실 CLI 3종 | **게시를 막지 않는다**(ADR-079). red 를 사람이 봐야 한다 |

**릴리즈 커밋 후 태그 전 구간의 로컬 CI 는 구조적으로 red 다** — CHANGELOG→태그 역방향 게이트
때문이고, 순서는 `.claude/rules/ship-checklist.md` §릴리즈 커밋과 태그의 순서. red 를 보고 게이트를
고치지 마라.

## Boundaries

**Always (✅ 훅 자동, 실측 2026-09-13)**: `.claude/settings.json` 에 등록된 훅 명령 **3개** =
`.claude/hooks/` 의 실파일 3개 — SessionStart SPEC 안내 · 보호 파일(`.env*`·lock·인증서) 편집
차단 · 호스트 실 CLI 실행 차단. (배포판 `templates/hooks/` 는 2개 — `docker-only-realcli` 는 이
리포 전용이다.) **차단하는 훅 2개는 차단할 때마다 `.uzys-agent-harness/hook-blocks.log` 에 1줄
남긴다**(ADR-061).

**Ask First**: PR 머지 · 태그 push · npm 게시 · 되돌리기 어려운 공유 상태 변경.
**커밋·push·PR 생성은 승인 불요** — 되돌리기 비싼 지점은 main 반영이다.

**Never**: main 강제 푸시 · 리뷰 없는 main 직접 푸시 · main 삭제 · 시크릿 포함 푸시
→ **✅ GitHub 룰셋이 서버에서 거절**(실측 2026-08-02, `GH013` 음성 대조 확인). 로컬엔 아무것도
안 생긴다. `reset --hard` 와 브랜치 작업은 **⬜ 여전히 프로즈뿐** — 서버가 볼 수 없는 영역이다.
적용·재확인 = `bash templates/scripts/protect-branch.sh --dry-run`.

## 함정 (착수 전 확인 — 원칙형)

1. **로컬에 차단 훅을 더 얹지 마라.** 되돌릴 수 없는 것(main 보호)은 GitHub 룰셋이 서버에서
   맡는다(§Boundaries). 로컬 가드 신설은 기각 — 명령마다 검사하고 우회 플래그로 새고 클론마다
   재설치해야 한다. 남은 방향은 반대쪽이다: **되돌릴 수 있는 것을 막는 로컬 차단**(문서 동기화·
   `.env` 편집)의 강등이 백로그다(A2). `permissions` 는 `bypassPermissions` · deny/ask 0.
2. **차단 로그는 발화의 증거이지 옳음의 증거가 아니다.** 차단하는 훅 2개가
   `.uzys-agent-harness/hook-blocks.log` 에 탭 구분 `날짜·훅·대상` 1줄을 남긴다(ADR-061). 감사
   때는 차단 수가 아니라 **오탐부터** 대조한다 — 표본 현황·판정은 최신 감사 문서
   (`docs/plans/harness-fit-audit-2026-08-03.md`). `uninstall` 은 이 로그를 함께 지운다(감수).
3. **룰 6종. 배포판만 `paths:` 하나를 쓴다**(`cli-development` = `**/*.sh`, #284) — 개발 사본
   `.claude/rules/` 는 여전히 전부 무조건 상주다. **지연 로드는 Claude Code 한정 효과**다:
   설치본에 OpenCode 가 섞여 있으면 룰이 `AGENTS.md` **본문에 인라인으로 박혀** 나가므로
   `paths:` 가 없는 것과 같아 매 세션 상주한다(`src/opencode/transform.ts` renderRulesBlock).
   `opencode.json` 의 `instructions` 글롭은 룰을 병합하지 않는다 — 그 글롭은 템플릿 값(`docs/…`)
   그대로이고 `tests/resident-reach-4cli.test.ts` 가 거기 `rules/` 가 들어오면 실패시킨다. 이
   줄의 정정 경위 = #300 · #338.
4. **문서·자산 변경의 영향 범위를 도구·grep 으로 고르지 마라** — 애매하면 전체를 돌린다.
   근거 실측·전례 = `.claude/rules/test-policy.md` §영향 범위.
5. **버전 확인은 `package.json`·`git tag` 로 한다.** `package-lock.json` 은 게시 계약 밖이라
   오래 멈춰 있어 착각을 부른다. GitHub release 는 만들지 않는다 — 태그·npm 이 SSOT 다.
6. **uzys 자작 스킬의 SSOT 는 이 리포 번들(`templates/skills/`)이다**(ADR-062 — 이관 번복 사유는
   거기) — **스킬 본문에 단언하는 게이트가 이 리포에만 있다**. 개수도 이름도 여기 안 적는다 —
   열거는 자산 하나가 지워지는 순간 썩는다(자산 삭제 전례 = ADR-078 Consequences). 기준은 **`SKILL.md` 를
   읽어 그 *내용*에 단언하는가**이고(존재 확인·바이트 동일 대조는 아니다), **grep 한 번으로
   세지 마라** — 한국어 리터럴로 세면 영문으로 단언하는 2종을 놓치고 `templates/skills/`
   문자열로 세면 경로를 조립하는 1종을 놓친다(실측 2026-08-26). 배선 SSOT =
   `src/external-assets.ts` 의 `INTERNAL_BUNDLED_SKILL_IDS` / `DEV_METHOD_SKILL_IDS`
   (개수는 코드가 SSOT).

## 보고·의사결정 형식

**모든 답변**을 `user-centered-explanation` 규율로 쓴다 — 승인 요청 순간만이 아니다(사용자 확정
2026-08-03). 사용자에게는 **"무엇이 달라지는가"**로 말한다 — 경로·심볼·커밋 해시로 시작하는
초안은 그 자체가 다시 쓰라는 신호다. 승인·선택 요청은 스킬의 기본 표(**맥락 · 문제점 · 해결방안 ·
추천방안**, 각각 이유와 함께 — 사용자 확정 2026-09-15, #465)로, 수치는 before → after 로 쓴다
("빨라짐"은 검증 불가라 미검증 주장과 구분되지 않는다).
실행 형식·예시 = `user-centered-explanation` 스킬 — 이 리포 번들이라
`templates/skills/user-centered-explanation/` 에서 바로 읽는다(ADR-062. 설치·네트워크 불요).

**위임·설계·다단계 작업은 착수 전에 `objective-brief` 로 정규화해 보여준다**(사용자 확정
2026-09-13, ADR-088 — 2026-08-03 의 "모든 작업 요청"에서 문턱이 올라갔다). 피처·프로젝트 규모
이상이면 사용자가 채우지 않은 필드(objective 의 판정 기준·success_criteria·boundaries·
verification 등)를 대화 맥락으로 채운 **완성 브리프를 응답에 제시해 사용자가 그대로 프롬프트로
가져갈 수 있게** 한다. 채운 값은 가정임을 표시하고, 정규화는 형태를 입히는 것이지 범위를 늘리는
것이 아니다. 한 줄 질문·조회·단일 수정·루틴 변경은 제외(스킬의 Do-NOT). 템플릿 =
`templates/skills/objective-brief/`(이 리포 번들).
