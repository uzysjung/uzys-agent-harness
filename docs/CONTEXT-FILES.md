# 어떤 파일이 내 AI 도구에게 무엇을 말하는가

설치가 끝나면 프로젝트에 컨텍스트 파일이 여러 개 생깁니다. 이름이 비슷해서 헷갈리기 쉬운데,
**소유자가 다르고 갱신 방식이 다릅니다.** 이 문서는 그 구분만 다룹니다.

> 한 줄 요약: **`CLAUDE.md` 는 당신 것이고, `CLAUDE-uzys-harness.md` 는 하네스 것입니다.**
> 앞의 것에 프로젝트 이야기를 쓰고, 뒤의 것은 건드리지 마세요 — `update` 가 덮어씁니다.

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
│   ├── agents/*.md              ← 하네스 것. 리뷰·검증 레인
│   ├── hooks/*.sh               ← 하네스 것. 결정론적 가드
│   ├── skills/*/                ← 하네스 것. 작업 절차
│   └── settings.json            ← 하네스가 씁니다 (훅 배선). 고치면 백업 후 갱신됩니다
└── .agents/rules/*.md           ← Antigravity 가 읽는 자리 (아래 §3)
```

## 2. `CLAUDE.md` 와 `CLAUDE-uzys-harness.md` — 왜 두 개인가

한 파일에 둘 다 담으면 **갱신할 때 당신이 쓴 내용이 날아갑니다.** 실제로 v26.140.0 이전에는
재설치할 때마다 당신이 채운 프로젝트 맥락이 빈 템플릿으로 되돌아갔습니다. 그래서 소유를
갈랐습니다.

| | `CLAUDE.md` | `CLAUDE-uzys-harness.md` |
|---|---|---|
| 소유 | **당신** | 하네스 |
| 내용 | 이 프로젝트가 무엇이고, 어떻게 돌리고, 무엇을 조심하는가 | 작업 원칙 7개 (이해→성공기준→경계→검증→증거→고위험→보고) |
| 설치가 하는 일 | 파일이 없으면 **빈칸 채우기 틀**을 만들고, 이미 있으면 **마지막에 한 줄만** 얹습니다 | 통째로 새로 씁니다 |
| `update` 가 하는 일 | 당신 본문은 안 건드립니다 | 최신 내용으로 갱신합니다 |
| 고쳐도 되나 | 네, 그러라고 있는 파일입니다 | 고치면 다음 `update` 에 덮어써집니다 |
| `uninstall` | 얹었던 한 줄만 도려냅니다 | 회수합니다 |

하네스가 얹는 것은 파일 **맨 끝의 이 블록**입니다 — Claude Code 가 `@` 줄을 보고 앵커 파일을
함께 읽습니다.

```markdown
<!-- uzys-harness:import:start -->
@CLAUDE-uzys-harness.md
<!-- uzys-harness:import:end -->
```

마커로 감싼 이유는 **회수할 자리를 표시**하기 위해서입니다. `uninstall` 은 이 블록만 지우고
당신 본문은 그대로 둡니다 — 설치 전 내용이 그대로였다면 결과는 설치 전과 바이트 단위로 같습니다.

### 빈칸 채우기 틀은 자동으로 안 채워집니다

`CLAUDE.md` 가 없던 프로젝트라면 설치가 6개 절짜리 틀을 만듭니다. 한 절은 이렇게 생겼습니다.

```markdown
## Identity & Purpose

<!-- FILL:identity — Replace the H1 title above with this project's real name, then
     state in 1-2 plain sentences what it does, who uses it, and why it exists.
     Sources: README.md, the package.json / pyproject.toml "description", docs/.
     Do NOT describe the harness itself. Delete this comment when done. -->

_(not filled yet — what this project is, who it is for, and why it exists)_
```

`<!-- FILL:... -->` 는 **당신의 코딩 에이전트에게 줄 지시문**입니다. 그 주석을 복사해 프롬프트로
넣으면 에이전트가 저장소를 직접 보고 절을 채웁니다. 손으로 써도 됩니다.

**하네스가 알아서 채우지는 않습니다** — 확인하지 않은 사실을 당신 저장소에 적지 않기 위해서고,
그래서 `_(not filled yet — ...)_` 자리표시가 남아 있으면 *"아직 아무도 안 채웠다"* 는 뜻이지
*"확인했더니 없더라"* 가 아닙니다.

## 3. Claude Code 가 아닌 도구를 쓴다면

같은 원칙이 각 도구가 실제로 읽는 자리로 갑니다. **내용은 같고 위치만 다릅니다.**

| 도구 | 원칙을 읽는 자리 | 룰을 읽는 자리 |
|---|---|---|
| Claude Code | `CLAUDE-uzys-harness.md` (루트 `CLAUDE.md` 의 `@import` 로) | `.claude/rules/*.md` |
| Codex | `AGENTS.md` | **같은 `AGENTS.md`** 의 `## Harness Rules` 절 |
| OpenCode | `AGENTS.md` | **같은 `AGENTS.md`** 의 `## Harness Rules` 절 |
| Antigravity | `.agents/rules/uzys-harness.md` | `.agents/rules/*.md` |

Codex 와 OpenCode 는 **같은 `AGENTS.md` 한 파일을 씁니다.** 둘 다 설치했다면 나중에 도는 쪽이
파일을 씁니다 — 룰 내용은 양쪽 렌더러가 동일하게 넣으므로 결과는 같습니다.

`AGENTS.md` 도 `CLAUDE.md` 처럼 **당신이 채우는 절**(`## Project Context`)이 있습니다. 그 절은
`update` 가 건드리지 않고, 당신이 고쳤으면 덮어쓰기 전에 백업을 남깁니다.

## 4. 헷갈리는 이름 셋

**`.claude/CLAUDE.md` 는 이제 안 씁니다.** v26.140.0 이전 설치본은 원칙을 여기 뒀습니다. 지금은
루트 `CLAUDE-uzys-harness.md` 로 옮겼고, `update` 를 돌리면 *"legacy anchor · no longer updated"*
라고 알려 줍니다. 그 파일은 **지우지 않습니다** — 당신이 거기에 뭔가 적었을 수 있어서, 판단은
당신에게 남깁니다. 필요 없으면 직접 지우세요.

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
- 무엇이 설치되는지 전체 목록 — [REFERENCE.md](REFERENCE.md)
- 왜 이렇게 나눴는지 — `docs/decisions/ADR-060`(앵커 분리) · `ADR-071`(룰이 4 CLI 전부에 도달)
