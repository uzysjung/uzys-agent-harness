# uzys-agent-harness

AI 코딩 도구에 꼭 필요한 룰·훅·스킬만 남기고 나머지는 걷어낸다. 위저드 한 번으로 내 스택에 맞게 검증된 묶음을 프로젝트 범위로 설치한다.

**Claude Code** · **Codex** · **OpenCode** · **Antigravity** 에서 쓴다.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/tags)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

![agent-harness 데모 — 검증된 AI 코딩 스킬·플러그인 원커맨드 설치](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

🇺🇸 [English](./README.md)

---

## 빠른 시작

Node 20 이상이 필요하다. 프로젝트 폴더에서 실행한다:

```bash
npx -y @uzysjung/agent-harness
```

위저드는 여섯 가지를 묻는다:

```
1/6  Tracks          무엇을 만드는지(스택) — 항목을 미리 체크해 줄 뿐이다
2/6  CLI             claude / codex / opencode / antigravity — 여러 개 가능
3/6  Install items   트랙에 맞는 항목이 미리 체크되어 있다. 원치 않는 것은 해제
4/6  Scope           Project(기본값, 이 폴더에만) 또는 Global
5/6  Confirm         요약과 함께, 이 선택이 매 세션에 얹는 컨텍스트 크기를 보여 준다
6/6  Installing
```

그다음 같은 폴더에서 AI 코딩 도구를 연다. 첫 세션부터 룰과 스킬이 적용된다:

```bash
claude    # 또는 codex / opencode / agy
```

**처음 할 일.** 설치가 끝나면 *내 프로젝트* 이야기를 채울 빈칸이 있는 `CLAUDE.md`(또는 `AGENTS.md`)가 생긴다. 에이전트에게 `audit-harness-fit` 스킬을 한 번 돌리라고 하면 저장소를 읽고 그 빈칸을 코드 근거로 채운다. 나중에 다시 돌리면 하네스가 아직 이 프로젝트에 맞는지 점검한다.

위저드를 띄울 터미널이 없다면(CI · 컨테이너 · 스크립트) 플래그로 설치한다. 필수는 `install --track <name>` 하나다 — [비대화형 설치](docs/USAGE.md#non-interactive-install). Claude Code 플러그인을 쓰려면 `claude` 명령이 PATH 에 있어야 한다. 없으면 플러그인은 경고만 남기고 건너뛴다.

## 무엇이 들어 있나

| 구성 | 무엇인가 | 에이전트가 언제 읽나 |
|---|---|---|
| **룰** | 짧은 파일 6개: git 정책 · 변경 관리 · 문서 · 테스트 · 배포 · CLI 개발. 개발 트랙은 5개, `tooling` · `full` 은 6번째까지, 비즈니스 트랙은 어느 프로젝트에나 맞는 3개를 받는다 | 매 세션 |
| **훅** | CLI 가 스스로 돌리는 스크립트. Claude Code 에 2개: 하나는 세션 시작 때 스펙과 변경 기록을 불러오고, 하나는 `.env` · lock 파일 · 인증서 편집을 막는다 — 하네스에서 "안 된다"고 말하는 유일한 장치이고, 막을 때마다 로그에 한 줄 남긴다 | 자동으로 — 세션 시작 때, 편집 직전에 |
| **스킬** | 작업이 필요로 할 때 에이전트가 여는 단계별 절차서. 이 저장소에서 쓰고 관리하는 방법론 스킬 + 트랙에 필요한 스택 스킬(예: `csr-supabase` 의 React · shadcn · Supabase · Postgres) | 필요할 때만 — 한 줄 설명만 상주하고 본문은 쓸 때 읽힌다 |
| **에이전트** | 메인 에이전트가 일을 넘기는 조수. 모든 트랙에 독립 검증자 `reviewer`, 개발 트랙에 `implementer`, 쓰는 트랙에만 `data-analyst` · `strategist` | 메인 에이전트가 위임할 때 |
| **앵커** | CLI 가 매 세션 읽는 작업 원칙 파일 하나. 내 `CLAUDE.md` 는 내 것으로 남는다 — 하네스는 import 한 줄만 더하고 나머지는 건드리지 않는다([어느 파일이 누구 것인가](docs/CONTEXT-FILES.md)) | 매 세션 |

모든 트랙이 받는 방법론 스킬은 넷이다: `north-star` · `objective-brief` · `gh-issue-workflow` · `audit-harness-fit`. 번들 스킬은 `--with` / `--without` 에 이름을 적어 더하거나 뺄 수 있다.

어느 CLI 에 무엇이 가나:

| CLI | 룰 | 스킬 | 훅 | 플러그인 |
|---|---|---|---|---|
| Claude Code | ✓ | ✓ | ✓ | ✓ |
| Codex | ✓ (`AGENTS.md` 안) | ✓ | 세션 시작만 | — |
| OpenCode | ✓ (`AGENTS.md` 안) | ✓ | — | — |
| Antigravity | ✓ | ✓ | — | — |

플러그인은 Claude Code 고유의 방식이라 Claude 전용이다. 스킬과 룰은 같은 원본에서 네 CLI 용으로 만들어지므로 도구를 바꿔도 내용이 같다.

## 트랙 고르기

**트랙**은 무엇을 만드는지에 맞춘 시작 묶음이다. 3단계에서 항목을 미리 체크해 줄 뿐이라 무엇이든 해제할 수 있고, 트랙을 여러 개 골라도 된다.

- **스택 미정** — `base`: 원칙 · 방법론 스킬 · 테스트 룰. 스택 전용은 없다(모든 개발 트랙에 이미 들어 있다)
- **프론트엔드 + 백엔드** — `csr-supabase` · `csr-fastify` · `csr-fastapi` · `ssr-nextjs` · `ssr-htmx`
- **데이터** — `data`
- **비즈니스** — `executive` · `project-management` · `growth-marketing`
- **메타** — `tooling`: 앱 스택이 없는 Bash · Markdown 프로젝트
- **전부** — `full`

[트랙별로 무엇을 까는지 →](docs/TRACKS.md)

## 매일 쓰는 명령

| 하고 싶은 일 | 실행 |
|---|---|
| 이 프로젝트에 무엇이 깔렸나 보기 | `npx -y @uzysjung/agent-harness list` |
| 최신 릴리즈로 맞추기 | `npx -y @uzysjung/agent-harness update` |
| 나중에 CLI 하나 더하기 | `npx -y @uzysjung/agent-harness install --track <내 트랙> --cli <새 CLI>` |
| 전부 · CLI 하나 · 자산 몇 개 지우기 | `npx -y @uzysjung/agent-harness uninstall` (`--cli <name>` · `--only <id>` · `--dry-run` 으로 미리 보기) |

`update` 는 하네스가 깐 파일을 새로 고치고, 새 릴리즈가 더한 스킬을 깔고, 새 훅처럼 재설치가 필요한 것은 알려 준다. 고르지 않은 CLI 는 깔지 않는다 — CLI 는 설치로 더해지고 `uninstall` 로만 빠진다. `update --only skills` 처럼 한 묶음만 고칠 수도 있다.

**기존 프로젝트에도 안전하다.** 내가 고친 파일을 교체하기 전에 옆에 타임스탬프 백업을 만들고 경로를 출력한다. 내가 쓰거나 고친 것은 백업 없이 지우지 않고, 기존 `.mcp.json` 서버는 교체가 아니라 병합된다([기존 프로젝트에 설치하기](docs/USAGE.md#installing-into-an-existing-project)).

**기본값은 이 프로젝트뿐이다.** 4단계에서 Global 을 고르지 않는 한 `~/.codex/` · `~/.opencode/` · `~/.gemini/` · 전역 npm 에는 아무것도 쓰지 않는다. 예외는 Claude Code 플러그인 하나다 — `claude` CLI 는 어느 범위에서든 플러그인 캐시를 `~/.claude/plugins/` 아래 두고 프로젝트는 메타데이터로 구분한다. `.claude/` 밖에는 `.mcp.json`, `.gitignore` 몇 줄(그 파일이 있을 때), Supabase 트랙이면 `.env.example`, 그리고 설치 기록 `.uzys-agent-harness/` 를 쓴다 — [전체 목록](docs/USAGE.md#what-the-harness-writes).

## 다른 도구를 이미 쓰고 있다면

| 원하는 것 | 방법 |
|---|---|
| 하네스 전체 — 룰 · 훅 · 에이전트 · 스택에 맞는 스킬 | 위의 위저드 |
| 이 저장소의 스킬 하나만 | `npx skills add uzysjung/uzys-agent-harness --skill <id> -a claude-code` |

이 저장소가 내는 스킬은 [skills CLI](https://github.com/vercel-labs/skills) 로 하나씩 받을 수 있다 — 설치기가 복사하는 것과 같은 파일이고 `references/` 도 함께 온다. `npx skills add uzysjung/uzys-agent-harness --list` 로 id 를 본다([자세히](docs/USAGE.md#one-skill-without-the-harness)). [skills.sh/uzysjung/uzys-agent-harness](https://skills.sh/uzysjung/uzys-agent-harness) 에도 올라 있다.

## 왜 이렇게 만들었나

AI 코딩 도구에 룰과 스킬을 쌓는다고 나아지지 않는다. 항상 읽히는 지시문은 매 세션 컨텍스트를 쓰고, 뛰어난 모델에게 이미 잘하는 일의 방법을 알려 주면 느려지기만 한다. 그래서 하네스는 모델이 실수할 만한 곳에만 원칙을 두고, 모델이 좋아지면 다시 걷어낸다.

| 흔한 방식 | 이 하네스 |
|---|---|
| "X 하지 마라" · "항상 Y 하라" 룰을 많이 둔다 | 지침은 *무엇이 참이어야 하는가*를 말하고 *어떻게*는 모델에 맡긴다. 우리 룰 44문장 중 에이전트 행동을 바꾼 것이 관측된 문장은 0개였다 — 사고를 잡은 것은 게이트 · 테스트 · 독립 검증자였다 |
| 금지를 문장으로 적는다 | 되돌릴 수 없는 손상은 장치가 막는다: 훅이 `.env` · 키 파일 편집을 막고, 하네스가 적용을 돕는 GitHub 룰셋이 기본 브랜치를 지킨다 |
| 자산이 쌓이기만 한다 | "이것이 없으면 에이전트가 느리거나 틀린다"는 관측이 있는 자산만 남는다. 없으면 필요할 때만 읽히는 스킬로 내려가거나 은퇴한다 — 그래서 `update` 는 더한 것과 *뺀 것*을 함께 가져온다 |
| 맞는지는 설치 때 한 번 정한다 | `audit-harness-fit` 이 계속 점검한다: 불필요한 질문 · 반복 검사 · 서로 모순되는 결정 · 더 좋은 모델에게는 필요 없어진 절차를 찾아 수정안을 낸다 |
| 매번 전부 검증한다 | 사용자에게 보이는 장면이 완성됐을 때, 코드를 쓰지 않은 별도 에이전트가 실제로 돌려 본다 — 보호를 늘리는 것이 아니라 중요한 것을 확실히 지키는 가장 가벼운 방법을 고른다 |
| 파일 이름과 함수로 설명한다 | 에이전트가 먼저 *내 서비스 사용자* 입장에서 설명한다(`user-centered-explanation`). 승인이 필요하면 맥락 → 문제 → 선택지 → 추천 순으로 온다 |

자산을 넣을지 뺄지 정하는 첫 질문은 하나다 — *이것이 AI 코딩 도구로 더 잘 만들게 돕는가?* 자세한 내용은 [docs/NORTH_STAR.md](docs/NORTH_STAR.md).

## 검증

외부 자산이 **검증됨**이려면 GitHub 스타 1,000 이상 · 보관(archived) 아님 · 격리 환경에서 설치 명령을 실제로 돌려 확인했을 것, 세 가지를 만족해야 한다. 매달 CI 작업 두 개가 스타와 설치 경로를 다시 확인한다. 검증은 한 줄 한 줄 보는 보안 감사가 **아니며**, 자산 내용의 프롬프트 인젝션을 검사하지 않는다. npm · npx 자산은 버전을 고정하고, 플러그인 · 스킬 자산은 upstream HEAD 를 받는다.

3단계에서 `★ official` 은 Anthropic 공식 마켓플레이스와 이 하네스 자체 자산, `⚠ experimental` 은 스타 1,000 미만 자산이다 — 미리 체크되지 않고 내가 직접 골라야 들어간다. 검증된 자산에는 표시가 없다. 등급은 알려 줄 뿐 막지 않는다. 설치한 자산은 다른 서드파티 의존성처럼 다룬다: [SECURITY.md](SECURITY.md).

## 문서

- [사용 안내](docs/USAGE.md) — 설치 플래그 · 범위 · update · uninstall · CLI 별 세부 · 무엇을 어디에 쓰나
- [트랙](docs/TRACKS.md) — 트랙별로 미리 체크되는 것
- [호환 표](docs/COMPATIBILITY.md) — 모든 자산의 설치 방식 · 닿는 CLI · 검증 방법
- [어느 파일이 누구 것인가](docs/CONTEXT-FILES.md) — `CLAUDE.md` · 앵커 · `AGENTS.md` 등 컨텍스트 파일
- [워크플로 안내](docs/WORKFLOWS.md) — 선택형 워크플로 묶음 비교, 그리고 필요 없는 경우
- [보안](SECURITY.md) — 검증이 다루는 것과 다루지 않는 것, 신고 방법
- [North Star](docs/NORTH_STAR.md) · [결정 기록](docs/decisions/) — 하네스가 왜 이런 모양인가

## License

MIT.
