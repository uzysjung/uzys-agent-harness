# uzys-agent-harness

**AI 코딩 에이전트가 더 똑똑하게 일하도록, 그리고 모델이 좋아질수록 더 잘 일하도록 만드는 하네스.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/tags)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

🇺🇸 [English](./README.md)

---

Claude Code나 Codex에 규칙을 계속 덧붙여 왔다면 한 번쯤 겪어 봤을 것이다. 지시 파일은 점점 길어지는데 에이전트는 그중 상당수를 놓친다. 새 모델이 나와도 예전 모델의 실수를 막으려고 써 둔 규칙이 오히려 발목을 잡는다.

uzys-agent-harness는 에이전트를 규칙 목록으로 묶지 않는다. 대신 네 가지 철학으로 에이전트가 일하는 환경을 만든다.

### 1. 모델이 좋아지면 하네스도 함께 좋아진다

"이건 해라, 저건 하지 마라"를 늘어놓지 않고, 무엇을 기준으로 판단할지와 넘으면 안 되는 선을 알려 준다. 예를 들어 "모든 변경에 테스트를 붙여라" 대신 "변경이 미치는 영향과 되돌리는 비용을 보고 검증 깊이를 정하라"고 알려 준다. 모델이 스스로 잘하게 된 일은 지시에서 뺀다. 그래서 새 모델이 나오면 에이전트는 옛 규칙에 막히지 않고 그 능력을 쓸 수 있다.

### 2. 방향과 경계가 있으면 에이전트는 스스로 더 멀리 간다

일을 맡기기 전에 프로젝트가 가야 할 방향, 이번 작업의 완료 기준, 넘으면 안 되는 선부터 정한다. 기준이 있으니 에이전트는 해 보고, 기준에 비춰 확인하고, 고치는 과정을 스스로 되풀이한다. 단계마다 지시하지 않아도 더 오래 혼자 일할 수 있고, 사람에게는 사람이 정해야 할 것만 묻게 한다.

### 3. 하네스는 늘 가볍게 유지한다

매 세션 에이전트가 읽는 지시는 그만큼 컨텍스트를 차지하고, 쌓일수록 중요한 지시가 묻힌다. 그래서 짧은 룰만 매 세션 읽게 하고, 긴 절차는 필요할 때만 꺼내 보게 한다. 새 버전마다 쓸모가 없어진 것은 빼고, 내 프로젝트에서도 쓸모없어진 지시를 찾아 뺄 수 있다. 에이전트가 꼭 필요한 지시에 집중하게 하려는 것이다.

### 4. 여러 관점과 여러 에이전트로 속도, 비용, 품질을 맞춘다

결과물을 만든 에이전트가 스스로 평가하지 않는다. 검토는 다른 에이전트가 맡고, 필요하면 여러 사용자의 눈으로 결과물을 따져 보거나 다른 회사의 모델에게 의견을 묻는다. 작업마다 어울리는 모델과 추론 강도를 골라, 가벼운 일은 빠르고 싸게, 중요한 일은 꼼꼼하게 처리한다.

이 네 가지를 담은 룰과 스킬, 그리고 프로젝트 스택에 맞는 외부 스킬(공식 저장소이거나 검증 기준을 통과한 것)을 명령 하나로 설치한다. 내 `CLAUDE.md`에는 표시된 블록 하나만 붙고 나머지는 건드리지 않으며, 지울 때는 하네스가 넣은 것만 빠진다. Claude Code, Codex, OpenCode, Antigravity에서 쓸 수 있고, 훅과 검토 에이전트는 Claude Code에서 동작한다.

## 지금 설치하기

![agent-harness demo — one-command install of vetted AI-coding skills & plugins](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

Node.js 20.12 이상이 필요하다. 프로젝트 폴더에서 다음 명령을 실행한다.

```bash
npx -y @uzysjung/agent-harness
```

설치 마법사가 다섯 단계로 묻는다.

```
1/5  Tracks          무엇을 만드는지 고른다(스택). 고른 스택에 맞는 항목이 미리 체크된다
2/5  CLI             claude / codex / opencode / antigravity 중 하나 이상을 고른다
3/5  Install items   미리 체크된 항목을 보고 빼거나 더한다
4/5  Confirm         요약과, 이 선택으로 매 세션 늘어나는 토큰 수를 확인한다
5/5  Installing
```

스택을 고르면 그 스택에 맞는 룰과 스킬, 외부 도구가 미리 체크된다. 어디까지나 추천이다. 3단계에서 무엇을 넣고 뺄지는 모두 직접 정하면 되고, 스택을 여러 개 골라도 된다. 마법사 없이 설치할 때도 `--with <id>`와 `--without <id>`로 똑같이 고를 수 있다.

설치가 끝나면 같은 폴더에서 AI 코딩 도구를 연다. 첫 세션부터 룰과 스킬이 적용된다.

```bash
claude    # 또는 codex / opencode / agy
```

**설치 후 처음 할 일.** `CLAUDE.md`(또는 `AGENTS.md`)에 내 프로젝트를 설명하는 빈칸이 생긴다. 에이전트에게 이렇게 한 번 말하면 된다.

```
audit-harness-fit 스킬로 코드를 읽고 프로젝트 설명 빈칸을 채워 줘.
```

에이전트가 저장소를 읽고 빈칸을 채운다. 나중에 같은 말을 다시 하면 지금 설정이 프로젝트에 여전히 맞는지 점검해 준다.

CI, 컨테이너, 스크립트처럼 마법사를 띄울 수 없는 곳에서는 플래그로 설치한다. 꼭 필요한 플래그는 `install --track <name>` 하나다([비대화형 설치](docs/USAGE.md#non-interactive-install)). Claude Code 플러그인은 PATH에 `claude` 명령이 있어야 설치되고, 없으면 경고만 남기고 건너뛴다.

---

## 자세히 알아보기

여기부터는 위의 생각을 실제로 어떻게 담았는지, 무엇이 설치되는지, 어떤 스택을 지원하는지를 자세히 적었다.

## 원칙을 담은 방식

### 목록 대신 판단 기준을 준다

절차를 못 박아 두면 모델은 맞지 않는 일에서도 그 절차를 그대로 따른다. 그래서 이 하네스는 순서를 정하지 않고, 무엇을 따져 보고 정하면 되는지를 적는다.

흔히 보는 룰은 이렇다.

> 모든 변경에 단위 테스트를 추가하고, 커밋 전에는 반드시 리뷰를 받는다.

이 하네스의 작업 원칙은 이렇다.

> 테스트와 리뷰를 언제, 얼마나 깊게 할지는 변경이 미치는 영향, 불확실성, 되돌리는 데 드는 비용, 이미 확보한 근거를 종합해 정한다.

앞의 룰대로라면 오타 하나를 고칠 때도 결제 로직을 바꿀 때와 똑같은 절차를 밟아야 한다. 뒤의 원칙을 따르면 일의 경중에 따라 다르게 다룰 수 있다. 테스트를 생략하라는 뜻이 아니라, 얼마나 필요한지를 모델이 직접 판단하게 하는 것이다.

### 목표와 완료 기준부터 잡는다

일하는 방법을 정해 주는 대신, 어떤 상태가 되면 끝난 것인지부터 정한다. `north-star` 스킬로 프로젝트가 왜 있고 무엇은 하지 않을지를 정리하고, `objective-brief` 스킬로 작업마다 목표와 완료 기준, 경계를 정리한다. 방법은 정해 두지 않는다. 같은 결과에 이르는 더 좋은 길이 있으면 모델이 그 길로 가면 된다.

### 경계는 이유와 함께 알려 주고, 강제로 막는 것은 최소로 한다

넘으면 안 되는 선은 분명히 적는다. 되돌리기 어려운 삭제나 배포, 여러 사람이 함께 쓰는 저장소나 데이터베이스에 기록하는 일은 맡긴 범위를 벗어나면 먼저 묻게 한다. 맡긴 범위 안의 일은 매번 묻지 않고 끝까지 하도록 한다. 강제로 막는 장치는 두 가지뿐이다. 하나는 Claude Code에서 `.env`, lock 파일, 인증서를 고치지 못하게 막는 훅이고, 다른 하나는 GitHub 기본 브랜치에 보호 규칙을 거는 스크립트다.

### 모델이 잘하게 된 일은 지시에서 뺀다

매 세션 읽는 지시는 그만큼 컨텍스트를 차지한다. 예전 모델의 약점을 메우려던 지시는 더 나은 모델에게 방해가 되기도 한다. 그래서 설치할 때는 고른 항목 때문에 매 세션 토큰이 얼마나 늘어나는지 먼저 보여 준다. 설치한 뒤에는 `audit-harness-fit` 스킬이 내 프로젝트에서 더는 필요 없는 지시나 똑같은 확인을 되풀이하게 만드는 절차를 찾아, 고칠 곳을 알려 준다.

### 만드는 에이전트와 검사하는 에이전트를 나눈다

자기가 한 일을 자기가 검사하면 놓치기 쉽다. Claude Code에서는 코드를 짜지 않은 `reviewer` 서브에이전트가 테스트나 앱을 직접 돌려 보고 결과를 검사한다. 선택 스킬인 `model-orchestration`을 더하면 에이전트가 일마다 어떤 모델에게 얼마나 깊이 생각하게 할지 고른다. 가벼운 일은 빠르고 싸게, 판단할 게 많은 일은 더 강한 모델에게 맡겨 속도와 비용, 품질 사이에서 균형을 잡는다.

작업 원칙 전문은 [templates/CLAUDE.md](templates/CLAUDE.md)에서 볼 수 있다. 설치하면 이 파일이 `CLAUDE-uzys-harness.md`라는 이름으로 들어가고, 내 `CLAUDE.md`는 한 줄로 이 파일을 불러온다. 프로젝트의 방향은 [docs/NORTH_STAR.md](docs/NORTH_STAR.md)에 정리해 두었다.

## 설치되는 것

Claude Code에 개발 트랙으로 설치하면 프로젝트 폴더에 다음 파일이 생긴다.

```
your-project/
├── CLAUDE.md                 내 파일. 끝에 하네스 블록 하나만 추가된다(없으면 새로 만든다).
├── CLAUDE-uzys-harness.md    에이전트가 매 세션 읽는 작업 원칙.
├── .claude/
│   ├── rules/                짧은 룰 파일. 매 세션 읽는다.
│   ├── skills/               작업 안내서. 평소에는 한 줄 설명만 읽고, 필요할 때 본문을 연다.
│   ├── agents/               메인 에이전트가 일을 넘기는 서브에이전트(reviewer, implementer 등).
│   ├── hooks/                도구가 자동으로 실행하는 훅 스크립트(세션 시작, 파일 보호).
│   └── settings.json         훅을 등록한다. 기존 설정과 합친다.
├── .mcp.json                 context7(최신 라이브러리 문서), github 등 MCP 서버. 기존 설정과 합친다.
└── .uzys-agent-harness/      설치 기록과 보조 스크립트.
```

파일은 모두 프로젝트 안에만 생긴다. 다른 파일처럼 커밋해 두면 저장소를 클론한 팀원도 같은 설정을 쓴다.

어느 트랙을 고르든 일의 방향을 잡아 주는 기본 스킬 네 개가 들어간다.

- `north-star`: 프로젝트 목적과 하지 않을 일
- `objective-brief`: 개별 작업의 목표, 완료 기준, 제약 사항
- `gh-issue-workflow`: 결정 사항을 채팅이 아니라 GitHub 이슈에 남김
- `audit-harness-fit`: 현재 설정이 프로젝트에 맞는지 점검

여기에 트랙별 스택 스킬이 더해진다(아래 [지원하는 스택](#지원하는-스택과-함께-제공하는-스킬) 참고). 전체 파일 목록은 [하네스가 쓰는 파일](docs/USAGE.md#what-the-harness-writes)에 있다.

도구마다 받는 것은 다음과 같다.

| 도구 | 룰 | 스킬 | 훅 | 서브에이전트 | 플러그인 |
|---|---|---|---|---|---|
| Claude Code | ✓ | ✓ | ✓ | ✓ | ✓ |
| Codex | ✓ (`AGENTS.md` 안에 포함) | ✓ | 세션 시작만 | — | — |
| OpenCode | ✓ (`AGENTS.md` 안에 포함) | ✓ | — | — | — |
| Antigravity | ✓ | ✓ | — | — | — |

플러그인은 Claude Code에만 있는 기능이라 Claude Code에만 설치된다. 룰과 스킬은 같은 원본에서 만들기 때문에 어느 도구에서나 내용이 같다. 다만 도구가 스스로 막아 줄 수 있는 범위는 도구마다 다르다.

## 지원하는 스택과 함께 제공하는 스킬

스택(트랙)을 고르면 아래 외부 스킬과 도구가 미리 체크된다. 미리 체크되는 것은 모두 공식 저장소이거나 이 프로젝트의 검증 기준을 통과한 저장소다([SECURITY.md](SECURITY.md)).

| 트랙 | 스택 | 미리 체크되는 외부 스킬·도구 |
|---|---|---|
| `base` | 스택 미정 | 없음 (공통 룰과 방법론 스킬만) |
| `csr-supabase` | Vite + React + Supabase | `frontend-design`, `react-best-practices`, `shadcn-ui`, `supabase-agent-skills`, `postgres-best-practices` |
| `csr-fastify` | Vite + React + Fastify | `frontend-design`, `react-best-practices`, `shadcn-ui` |
| `csr-fastapi` | Vite + React + FastAPI | `frontend-design`, `react-best-practices`, `shadcn-ui` |
| `ssr-nextjs` | Next.js (App Router) | `frontend-design`, `react-best-practices`, `shadcn-ui` |
| `ssr-htmx` | htmx + FastAPI | `frontend-design` |
| `data` | Python 데이터 작업 (DuckDB, PySide6) | `frontend-design`, `anthropic-data-plugin` |
| `tooling` | 앱 스택 없는 Bash·Markdown 프로젝트 | `frontend-design` |
| `full` | 개발 트랙 전부 | 위 항목 전부 + `anthropic-document-skills` |
| `executive` | 제안서, 실사, 발표 자료, 재무 모델 | `anthropic-document-skills` |
| `project-management` | PM 업무 | 없음 (`product-skills` 선택 가능) |
| `growth-marketing` | 그로스·콘텐츠 마케팅 | 없음 (`marketingskills` 선택 가능) |

MCP 서버도 함께 들어간다. 모든 트랙에 `context7`(최신 라이브러리 문서), `github`, `chrome-devtools`가 들어가고, 웹 앱 트랙(`csr-*`, `ssr-*`)에는 `railway-mcp-server`가, `csr-supabase`에는 `supabase`가 더해진다. `full`은 둘 다 받는다.

미리 체크되지는 않지만 3단계나 `--with <id>`로 더할 수 있는 것도 있다.

- 프론트엔드·디자인: `web-design-guidelines`, `taste-skill`, `jakubkrehel-skills`, `preline`, `scroll-world`
- 배포: `vercel-cli`, `netlify-cli`, `supabase-cli`, `railway-skills`
- 보안 리뷰: `security-guidance`, `trailofbits-skills`
- 제품·마케팅·재무: `product-skills`, `marketingskills`, `finance-skills`
- 발표·영상: `frontend-slides`, `marp-slide`, `revealjs`, `remotion`, `gsap-skills` 등
- 정해진 개발 절차가 필요한 팀: `openspec`, `bmad-method` ([WORKFLOWS.md](docs/WORKFLOWS.md)에서 비교)

트랙별 전체 구성은 [docs/TRACKS.md](docs/TRACKS.md)에, 항목별 출처와 설치 방식, 지원 도구는 [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md)에 있다.

## 주요 명령어

| 하고 싶은 일 | 명령어 |
|---|---|
| 설치된 항목 보기 | `npx -y @uzysjung/agent-harness list` |
| 최신 버전으로 업데이트 | `npx -y @uzysjung/agent-harness update` |
| 다른 도구 추가 | `npx -y @uzysjung/agent-harness install --track <내 트랙> --cli <새 CLI>` |
| 전부, 도구 하나, 항목 일부 지우기 | `npx -y @uzysjung/agent-harness uninstall` (`--cli <name>`, `--only <id>`, 지우기 전에 미리 보기 `--dry-run`) |
| 팀원이 하네스를 설치해 둔 저장소를 클론했을 때 | 따로 할 일이 없다. 설치 기록이 파일과 함께 커밋돼 있어서 `list`로 바로 확인할 수 있고, `update`와 `uninstall`도 팀원 컴퓨터에서와 똑같이 동작한다([팀원과 새 클론](docs/USAGE.md#teammates-and-fresh-clones)). |

`update`는 하네스가 설치한 것을 새 버전으로 바꾸고, 새 버전에 추가된 것을 넣고, 없어진 하네스 파일(훅 스크립트, `.mcp.json`의 서버, `AGENTS.md`의 하네스 절 등)을 되살린다. `--without`으로 일부러 뺀 항목은 계속 빠져 있고, 고르지 않은 도구는 설치하지 않는다. `update --only skills`처럼 한 묶음만 업데이트할 수도 있다.

터미널에서 `uninstall`을 실행하면 무엇을 지울지(도구 하나, 고른 항목, 전부) 고를 수 있고, `--dry-run`을 붙이면 지우기 전에 계획을 먼저 보여 준다. `.claude/`, `.codex/`, `.opencode/` 폴더는 지우지 않고 `<dir>.backup-<ts>`로 옮겨 두기 때문에, 내가 그 안에 넣어 둔 파일도 백업에 남는다.

**이미 진행 중인 프로젝트에 설치해도 된다.** 내가 고친 파일을 바꿔야 할 때는 같은 폴더에 시간이 적힌 백업을 먼저 만들고 그 경로를 알려 준다. 내가 쓰거나 고친 파일은 백업 없이 지우지 않고, 기존 `.mcp.json`의 서버도 덮어쓰지 않고 합친다([기존 프로젝트에 설치하기](docs/USAGE.md#installing-into-an-existing-project)).

**프로젝트 밖은 건드리지 않는다.** `~/.opencode/`, `~/.gemini/`, 전역 npm에는 아무것도 쓰지 않는다. 예외는 직접 고른 경우의 두 가지뿐이다. Claude Code 플러그인을 설치하면 `claude` CLI가 플러그인 캐시를 `~/.claude/plugins/`에 두고, `--with-codex-trust`를 쓰면 Codex가 프로젝트 설정을 읽을 수 있도록 `~/.codex/config.toml`에 신뢰 항목 하나를 추가한다([자세히](docs/USAGE.md#scope)).

## 이미 다른 방법을 쓰고 있다면

| 지금 이렇게 하고 있다면 | 이 하네스와 다른 점 |
|---|---|
| `CLAUDE.md`나 `AGENTS.md`를 직접 쓴다 | 그 파일은 그대로 둔다. 하네스는 표시해 둔 블록 하나만 붙이고 나머지는 건드리지 않는다. 대신 파일 하나로는 할 수 없는 것을 더해 준다. 실제로 막는 훅, 만드는 에이전트와 따로 있는 검사 에이전트, 그리고 업데이트와 삭제가 하네스가 넣은 것만 건드리게 하는 설치 기록이다. |
| 마켓플레이스에서 스킬을 골라 쓴다 | 스킬 하나만 필요하면 그것만 받으면 된다. `npx skills add uzysjung/uzys-agent-harness --skill <id> -a claude-code` (id 목록은 `--list`나 [skills.sh](https://skills.sh/uzysjung/uzys-agent-harness)에서 볼 수 있다). 설치 마법사는 스킬 목록만으로는 채울 수 없는 것, 곧 매 세션 읽는 룰과 훅, 서브에이전트, 그리고 이것들을 최신으로 유지하는 설치 기록을 위한 것이다. |
| 룰이 많은 다른 하네스를 쓴다 | 매 세션 읽는 지시가 적고, 설치 전에 세션마다 드는 토큰 수를 보여 준다. 정해진 순서대로 개발하는 방식이 필요하면 외부 워크플로 키트인 `openspec`이나 `bmad-method`를 더하면 된다. 둘 다 선택이며 [WORKFLOWS.md](docs/WORKFLOWS.md)에 비교해 두었다. |

## 문서

- [사용 안내](docs/USAGE.md) — 설치 플래그, 설치 범위, update와 uninstall, 도구별 세부 사항, 생기는 파일과 위치
- [트랙](docs/TRACKS.md) — 트랙마다 미리 체크되는 항목
- [호환성 표](docs/COMPATIBILITY.md) — 항목별 설치 방식, 지원 도구, 검증 방법
- [어느 파일이 누구 것인가](docs/CONTEXT-FILES.md) — `CLAUDE.md`, 앵커, `AGENTS.md` 등 컨텍스트 파일 설명
- [워크플로 안내](docs/WORKFLOWS.md) — 골라서 더할 수 있는 외부 워크플로 키트 비교, 필요 없는 경우
- [보안](SECURITY.md) — 외부 자산 검증이 확인하는 것과 확인하지 않는 것, 취약점 신고 방법
- [North Star](docs/NORTH_STAR.md) · [결정 기록](docs/decisions/) — 설계 철학과 주요 결정의 배경

## License

MIT.
