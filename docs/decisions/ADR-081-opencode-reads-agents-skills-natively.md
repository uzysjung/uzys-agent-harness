# ADR-081: OpenCode 번들 스킬을 `.agents/skills/` 로 보낸다 (커맨드 변환 폐지)

- Status: Accepted
- Date: 2026-08-29
- PR: #382
- Supersedes: 없음 (v26.87.0 #182 의 구현 판단을 갱신)

## Context

우리는 번들 dev-method 스킬을 OpenCode 에게만 다른 형식으로 보냈다 — 스킬 본문을 슬래시
커맨드(`.opencode/commands/<id>.md`)로 변환했다. 근거는 `src/opencode/commands.ts` 의 주석
한 줄이었다:

> OpenCode 는 native skill 개념이 없어 skill 을 커맨드로 surface.

**그 전제는 더는 사실이 아니다.** 그리고 애초에 닫힌 결정도 아니었다 —
`docs/specs/opencode-compat.md` 의 **OQ6 이 Open** 인 채로 남아 있었다("1차 자체 구현,
의존은 후속 검토"). ADR 도 없었다.

그 사이 제품 안에 반대 전제 둘이 공존했다: 외부 스킬(`npx skills add`)은 opencode 가
`.agents/skills/` 를 읽는다고 보내면서, 번들 스킬은 못 읽는다고 변환했다.

## 실측 (2026-08-29 · 컨테이너 · `opencode 1.18.23`)

`opencode serve` 를 띄우고 `/skill`·`/command` 를 직접 물었다. **대조군을 같이 심었다** —
OpenCode 자신의 문서에 예시로 나오는 `.opencode/skills/` 를 알려진 양성으로 썼다.

프로젝트 스코프에 세 자리를 심고 조회한 결과:

| 심은 자리 | `/skill` 에 뜨는가 |
|---|---|
| `.opencode/skills/probe-opencode/SKILL.md` (대조군) | ✅ |
| `.claude/skills/probe-claude/SKILL.md` | ✅ |
| **`.agents/skills/probe-agents/SKILL.md`** | **✅** |

그리고 `.agents/skills/` 에 실린 스킬은 `/command` 목록에도 `source: "skill"` 로 함께 뜬다
(frontmatter 에 `slash` 를 안 써도 뜬다). **슬래시 호출을 잃지 않는다.**

## Decision

**번들 dev-method 스킬을 `.agents/skills/<id>/SKILL.md` 로 보낸다** — codex·antigravity 와
**같은 파일**이다. `renderCommandFromSkill` 과 `src/opencode/commands.ts` 는 폐지한다.

**옛 `.opencode/commands/<id>.md` 는 백업하고 지운다.** 안 지우면 같은 이름이 커맨드 목록에
두 줄로 뜬다(옛 `source: "command"` + 새 `source: "skill"`) — 그게 #340 의 형태다. 대상은
`templates/skills/<이름>/SKILL.md` 가 존재하는 이름만이라 사용자가 직접 쓴 커맨드는 안 걸린다.
판정 대신 **무조건 백업**한다(`retireMcpAllowlist` 와 같은 이유 — 편집분을 되살릴 수단이
없으면 지우기 전에 남긴다). 파일이 다시 생기지 않으므로 프로젝트당 한 번뿐이다.

## Alternatives

- **현행 유지** — 기각. 전제가 죽었고, 모델이 스킬을 스스로 못 부른다(사용자가 슬래시를
  외워 쳐야 한다). 같은 스킬이 CLI 조합에 따라 두 판본으로 깔린다.
- **둘 다 쓴다(커맨드 + 스킬)** — 기각. 커맨드 목록에 같은 이름이 두 줄로 뜬다.
- **`.opencode/skills/` 로 보낸다** — 기각. 로드는 되지만(실측) opencode 전용 사본이 하나 더
  생긴다. `.agents/` 는 codex·antigravity 와 한 벌을 공유한다.

## 잃는 것 — 재보고 무해함을 확인했다

- `agent: plan|build` frontmatter: `scripts/` 사이드카가 있는 번들 스킬은
  `continuous-learning-v2`·`external-model-consult` 뿐이고 **둘 다 배달 대상 6종에 없다** →
  실제로는 항상 `plan` 이었다.
- `/uzys:` → `/uzys-` 슬래시 변환: 번들 스킬 본문에 그 슬래시가 **0건**(양성 대조로 검증).
- `CLAUDE_PROJECT_DIR` → `CODEX_PROJECT_DIR` 변환이 이제 적용된다: 그 변수를 쓰는 번들
  스킬은 `continuous-learning-v2`·`strategic-compact` 뿐이고 **둘 다 배달 대상이 아니다**.

## Consequences

- opencode 만 고른 설치에서도 번들 스킬이 `.agents/skills/` 에 생긴다. 컨테이너 게이트
  `single-cli`(ADR-080)가 그 도달을 계속 본다 — 자리를 표로 안 적었기 때문에 이 변경으로
  게이트를 고칠 필요가 없었다.
- 기존 설치본은 **다음 install/update 에서** 옛 커맨드 파일이 백업되고 사라진다. 화면에
  `retired` 로 표기된다.
- `docs/specs/opencode-compat.md` 의 OQ6 을 닫는다.
- **미검증**: 실제 OpenCode 세션에서 모델이 이 스킬을 호출하는 것까지는 안 봤다(인증 필요).
  본 ADR 이 단언하는 것은 **탐색·노출**까지다.
