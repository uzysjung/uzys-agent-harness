# ADR-086: 번들 스킬은 4 CLI 모두에 디렉터리째 나간다

- Status: Accepted
- Date: 2026-09-13
- PR: #TBD
- Supersedes: 없음. ADR-081(OpenCode 도 `.agents/skills/` 로)을 **amend** — "무엇을 보내는가"를
  `SKILL.md` 한 파일에서 스킬 디렉터리 전체로 넓힌다

## Context

Claude Code 쪽은 `manifest.ts` 가 `templates/skills/<id>/` 를 **디렉터리 단위**로 복사한다.
Codex · OpenCode · Antigravity 변환은 v26.87.0 부터 같은 스킬을 `.agents/skills/<id>/SKILL.md`
**한 파일**로만 보냈다 — 그때 번들 스킬은 본문이 `SKILL.md` 안에 다 있었다.

2026-09-13 실측: 번들 스킬 14종이 `references/` · `scripts/` · `evals/` 를 갖는다. 그 파일들은 세
CLI 설치자에게 도달하지 않았고, `SKILL.md` 가 "references/x.md 를 읽어라"고 라우팅하면 그 자리에
파일이 없었다. 티가 덜 났던 이유는 본문 대부분이 아직 `SKILL.md` 에 있어서였다. #425 의
`audit-harness-fit` 2판은 `SKILL.md` 가 71줄 안내판이고 본문이 참조 4개(약 24 KB)라, 이 상태로
나가면 **네 CLI 중 셋에서 빈 껍데기**가 된다(#431).

세 CLI 모두 스킬을 디렉터리로 읽는다 — agentskills 사양이 `scripts/` · `references/` · `assets/`
를 정의하고, ADR-081 실측에서 OpenCode 가 `.agents/skills/<id>/` 를 자동 로드했다.

## Decision

1. 세 transform 이 **한 helper**(`writeBundledSkillDirs`, `src/codex/skills.ts`)로
   `templates/skills/<id>/` 전체를 `.agents/skills/<id>/` 에 쓴다. `SKILL.md` 는 지금처럼
   `renderBundledSkill`(frontmatter 보존 · 본문 포팅), 형제 `.md` · `.sh` 는 같은 포팅
   (`/uzys:` → `/uzys-` · `CLAUDE_PROJECT_DIR` → `CODEX_PROJECT_DIR`), 그 밖의 파일은 그대로.
   이름이 `.` 로 시작하는 파일·디렉터리는 보내지 않는다. `.sh` 는 실행 비트.
2. `update`(refreshOnly): 안 깐 CLI 에는 아무것도 만들지 않는다. **그 CLI 자리에 `SKILL.md` 가
   이미 있는 스킬**에 한해 형제 파일을 `createInRefresh` 로 만든다 — 그 존재가 "이 CLI 가
   설치돼 있고 이 스킬이 선택됐다"는 증거다.
3. 쓴 파일 전부가 `writer` 를 거쳐 install log `externalFiles` 에 실린다. uninstall 은 그 기록으로
   회수하므로 별도 변경이 없다 — 테스트가 형제 파일 회수를 단언한다.
4. 스킬 단위 skip: `SKILL.md` 쓰기가 거절되면(refresh skip · foreign slot) 형제도 전부 건너뛴다.
   반쪽 스킬을 만들지 않는다.

## Alternatives

- 초안 스킬을 한 파일로 합친다 — 기각: 사용자 문안의 구조를 이 리포가 바꾸는 것이고, 나머지
  13종의 같은 구멍은 그대로다.
- 그대로 둔다 — 기각: Claude Code 설치자만 온전한 스킬을 받는다. 고객 기준으로 비대칭이다.

## 적용 범위

`src/codex/skills.ts` · 세 transform · `tests/codex/skills.test.ts`(기대 목록을 `templates/skills/` 에서
유도) · 세 transform 테스트 · `tests/external-cli-update.test.ts`(형제 생성 · 미설치 CLI 무생성) ·
`tests/uninstall-agents-dir.test.ts`(형제 회수) · `test/docker/scenarios/scenario-dev-method-skills.sh`
(컨테이너 안 `templates/` 에서 유도해 형제 도달 1건) · `src/commands/install-render.ts`(설치
화면의 스킬 수는 파일 수가 아니라 `<id>` 디렉터리 수).

## Consequences

- 세 CLI 설치자가 Claude Code 설치자와 같은 스킬을 받는다. 기존 14종의 참조 파일도 같이 살아난다.
- 형제 `.md` · `.sh` 는 포팅을 거치므로 원본과 **바이트 동일이 아니다**(말미 공백 정규화 포함).
  설치 검증은 "복사됐나 · 설치됐나 · 버전 맞나"만 묻는다(scenario 헤더의 규율) — 내용 대조는
  단위 테스트 몫이다.
- 형제 파일에도 소유자 판정·백업이 걸린다(ADR-048) — 사용자가 고친 `references/*.md` 는 재설치
  때 `.backup-<stamp>` 가 남는다.
- 바이너리 파일은 `writer.write` 가 문자열만 받아 utf8 왕복에서 깨진다. 지금 번들에 바이너리는
  없다(실재하지 않는 상태에 방어를 두지 않는다). 들어오는 날 이 줄이 그 조건이다.
- `.py` 의 실행 비트는 원본을 따르지 않는다(`.sh` 만 0o755). Claude 쪽 dir-copy 와의 대칭은 미확인.
