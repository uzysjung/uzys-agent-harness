# 어떤 파일이 내 AI 도구에게 무엇을 말하는가

설치가 끝나면 프로젝트에 컨텍스트 파일이 여러 개 생깁니다. 이름이 비슷해서 헷갈리기 쉬운데,
**소유자가 다르고 갱신 방식이 다릅니다.** 이 문서는 그 구분만 다룹니다.

> 한 줄 요약: **`CLAUDE.md` 는 사용자 소유이고, `CLAUDE-uzys-harness.md` 는 하네스 소유입니다.**
> 앞의 파일에 프로젝트 정보를 쓰고, 뒤의 파일은 건드리지 마세요. `update` 가 덮어씁니다.

## 1. 설치 후 생기는 것

Claude Code 를 골랐을 때 프로젝트 루트와 `.claude/` 에 생기는 것들입니다.

```
your-project/
├── CLAUDE.md                    ← 당신 것.  프로젝트 이야기를 여기 씁니다
│                                   (마지막에 아래 파일을 끌어오는 한 줄만 하네스가 얹습니다)
├── CLAUDE-uzys-harness.md       ← 하네스 것. 작업 원칙. update 가 갱신합니다
├── AGENTS.md                    ← Codex · OpenCode 가 읽는 자리 (아래 §3)
├── .claude/
│   ├── rules/*.md               ← 하네스 것. 룰
│   ├── agents/*.md              ← 하네스 것. 리뷰·구현 레인
│   ├── hooks/*.sh               ← 하네스 것. 결정론적 가드
│   ├── skills/*/                ← 하네스 것. 작업 절차
│   └── settings.json            ← 하네스가 씁니다 (훅 배선). 설치 때 병합하며, 고쳤으면 백업을 남깁니다
├── .uzys-agent-harness/         ← 하네스 것. 설치 기록 · 룰이 부르는 스크립트 3종 · 훅 차단 로그
├── .agents/skills/*/            ← Codex · OpenCode · Antigravity 가 함께 읽는 스킬 (아래 §3)
└── .agents/rules/*.md           ← Antigravity 가 읽는 자리 (아래 §3)
```

## 2. `CLAUDE.md` 와 `CLAUDE-uzys-harness.md` — 왜 두 개인가

한 파일에 둘 다 담으면 **갱신할 때 사용자가 쓴 내용이 지워집니다.** 그래서 소유권을 분리했습니다
(경위는 `docs/decisions/ADR-060`).

| | `CLAUDE.md` | `CLAUDE-uzys-harness.md` |
|---|---|---|
| 소유 | **사용자** | 하네스 |
| 내용 | 프로젝트의 목적, 실행 방법, 주의 사항 | 작업 원칙 6개 (성공의 정의 → 접근 선택 → 집중된 변경 → 비례 검증 → 증거 기반 완료 → 권한 안에서 행동) |
| 설치가 하는 일 | 파일이 없으면 **빈칸 채우기 템플릿**을 만들고, 이미 있으면 **마지막에 한 줄만** 추가합니다 | 통째로 새로 씁니다 |
| `update` 가 하는 일 | 사용자 본문은 건드리지 않습니다 | 최신 내용으로 갱신합니다 |
| 고쳐도 되나 | 네, 그러라고 있는 파일입니다 | 고치면 다음 `update` 에 덮어써집니다 |
| `uninstall` | 추가했던 한 줄만 잘라냅니다 | 제거합니다 |

하네스는 파일 **맨 끝에 아래 블록을 추가합니다.** Claude Code 는 `@` 로 시작하는 줄을 보고 앵커 파일을
함께 읽습니다.

```markdown
<!-- uzys-harness:import:start -->
@CLAUDE-uzys-harness.md
<!-- uzys-harness:import:end -->
```

마커로 감싼 이유는 **제거할 영역을 표시**하기 위해서입니다. `uninstall` 은 이 블록만 지우고
사용자가 쓴 본문은 그대로 두므로, 설치 전 내용을 바꾸지 않았다면 파일은 설치 전과 바이트 단위로 같습니다.

### 빈칸 채우기 템플릿은 자동으로 채워지지 않습니다

`CLAUDE.md` 가 없던 프로젝트에 설치하면 6개 절로 된 템플릿이 생깁니다. 한 절은 이렇게 생겼습니다.

```markdown
## Identity & Purpose

<!-- FILL:identity — Replace the H1 title above with this project's real name, then
     state in 1-2 plain sentences what it does, who uses it, and why it exists.
     Sources: README.md, the package.json / pyproject.toml "description", docs/.
     Do NOT describe the harness itself. Delete this comment when done. -->

_(not filled yet — what this project is, who it is for, and why it exists)_
```

`<!-- FILL:... -->` 는 **코딩 에이전트에게 줄 지시문**입니다. 가장 빠른 방법은 에이전트에게
`audit-harness-fit` 스킬을 한 번 실행하라고 하는 것입니다. 에이전트가 저장소를 읽고 각 절을 근거로
채웁니다. 주석을 하나씩 복사해 프롬프트로 넣어도 되고, 손으로 써도 됩니다.

**하네스가 알아서 채우지는 않습니다.** 검증하지 않은 사실을 저장소에 적지 않기 위해서입니다.
그래서 `_(not filled yet — ...)_` 자리표시가 남아 있으면 *"아직 아무도 채우지 않았다"* 는 뜻이지
*"확인해 보니 내용이 없다"* 는 뜻이 아닙니다.

## 3. Claude Code 가 아닌 도구를 쓴다면

도구에 따라 같은 원칙이 놓이는 위치가 달라집니다. **내용은 같고 위치만 다릅니다.**

| 도구 | 원칙을 읽는 자리 | 룰을 읽는 자리 |
|---|---|---|
| Claude Code | `CLAUDE-uzys-harness.md` (루트 `CLAUDE.md` 의 `@import` 로) | `.claude/rules/*.md` |
| Codex | `AGENTS.md` | **같은 `AGENTS.md`** 의 `## Harness Rules` 절 |
| OpenCode | `AGENTS.md` | **같은 `AGENTS.md`** 의 `## Harness Rules` 절 |
| Antigravity | `.agents/rules/uzys-harness.md` | `.agents/rules/*.md` |

Codex 와 OpenCode 는 **같은 `AGENTS.md` 한 파일을 씁니다.** 두 도구를 모두 설치했다면 나중에 실행된
쪽의 판이 남습니다. 어느 쪽이든 같은 룰 절(`## Harness Rules`)을 담습니다.

**공유 파일은 마지막 도구가 나갈 때까지 남습니다.** `uninstall --cli <이름>` 으로 도구 하나를 뺄 때,
그 도구만 쓰는 자리는 함께 사라지지만 아래 자리는 쓰는 도구가 하나라도 남아 있으면 그대로입니다.

| 공유 자리 | 함께 쓰는 도구 | 언제 사라지나 |
|---|---|---|
| `AGENTS.md` | Codex · OpenCode | 둘 다 빠질 때. 그때도 여러분이 채운 두 절은 파일에 남습니다 |
| `.agents/skills/` | Codex · OpenCode · Antigravity | 셋 다 빠질 때 |
| `.mcp.json` · `.uzys-agent-harness/` | 네 도구 전부 | 도구 하나를 빼는 것으로는 안 사라집니다 — 전량 `uninstall` 의 몫입니다 |

`AGENTS.md` 에도 `CLAUDE.md` 처럼 **사용자가 채우는 절**(`## Project Context` · `## Project Rules`)이
있습니다. 거기 적은 내용은 `update` 와 재설치를 넘어 **그대로 남습니다.** 하네스가 다시 쓰는 것은 자기
몫뿐입니다 — 제목 줄 · `## Harness Rules` · `## Session Start` · `## Protected Files`, 그리고 사용자
절 안에서는 `<!-- uzys-harness:… -->` 주석 쌍으로 감싼 조각(상시 스킬 안내 · 작업 원칙 본문)입니다.
**그 주석 쌍 사이**에 적은 것은 다음 `update` 가 덮어쓰니 바깥에 적으세요. `uninstall` 도 같은 경계로
움직입니다 — 하네스 몫만 걷어내고 여러분의 두 절은 파일에 남깁니다(두 절에 아무것도 안 적었으면 파일째
지웁니다).

한 번의 예외가 있습니다. 이 주석 쌍이 없던 판(v26.159.0 이하)으로 설치한 프로젝트는 **첫 `update`**
에서 `## Project Rules` 에 덧쓴 줄이 백업(`AGENTS.md.backup-<시각>`)으로 갑니다 — 그 절은 통째로
하네스가 렌더한 원칙 본문이라 어디까지가 여러분의 줄인지 알 수 없기 때문입니다. `## Project Context`
는 첫 `update` 에서도 그대로 남습니다. 두 번째 `update` 부터는 주석 쌍이 있어 두 절 다 남습니다.

절 제목을 지웠거나 이름을 바꾸면 하네스가 **그 절**을 알아볼 수 없어 그 절만 최신판으로 다시 씁니다(다른
절은 그대로) — 그때는 이전 판이 `AGENTS.md.backup-<시각>` 에 남고, 에이전트에게 `audit-harness-fit` 으로 백업의 편집을
새 판에 얹어 달라고 할 수 있습니다.

## 4. 헷갈리는 이름 셋

**`.claude/CLAUDE.md` 는 이제 안 씁니다.** 오래된 설치본은 원칙을 여기 뒀습니다. 지금은
루트 `CLAUDE-uzys-harness.md` 로 옮겼고, 그 파일이 남아 있으면 `update` 가 *"legacy anchor · no longer
updated"* 라고 알려 줍니다. 하네스는 그 파일을 **자동으로 지우지 않습니다.** 사용자가 직접 적은 내용이 있을 수
있으므로 삭제 여부는 사용자에게 맡깁니다. 필요 없으면 직접 지우세요.

**`AGENTS.md` 는 두 도구가 공유합니다** — Codex 전용이 아닙니다(§3).

**이 저장소를 개발하는 사람에게만 해당**: 이 리포 안의 `templates/CLAUDE.md` 는 *배포되는 앵커의
원본*이고, `.claude/CLAUDE.md` 는 *이 리포 개발용 레인 원칙*입니다. 설치받은 프로젝트에서 보는
같은 이름의 파일들과 다른 것들입니다.

## 5. 무엇을 어디에 쓸까

| 쓰고 싶은 것 | 쓸 자리 |
|---|---|
| 빌드·테스트 명령, 디렉터리 구조, 이 프로젝트의 함정 | 루트 `CLAUDE.md` (Codex/OpenCode 면 `AGENTS.md` §Project Context) |
| 이 프로젝트에서만 지킬 규약 | 루트 `CLAUDE.md`. 커지면 `.claude/rules/` 에 파일을 하나 더 만들어도 됩니다 |
| 모든 프로젝트에 적용할 개인 취향 | `~/.claude/CLAUDE.md` (하네스는 여기 안 씁니다) |
| 작업 원칙 자체를 바꾸고 싶다 | 하네스 저장소에 이슈로. 앵커 파일을 고치면 `update` 가 되돌립니다 |

## 참고

- 설치·갱신·제거 명령 — [USAGE.md](USAGE.md)
- 트랙별로 무엇이 설치되는지 — [TRACKS.md](TRACKS.md)
- 왜 이렇게 나눴는지 — `docs/decisions/ADR-060`(앵커 분리) · `ADR-071`(룰이 4 CLI 전부에 도달)
