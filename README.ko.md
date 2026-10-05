# uzys-agent-harness

AI 코딩 에이전트(Claude Code, Codex, OpenCode, Antigravity)용 하네스를 프로젝트에 설치하는 도구다. 하네스는 에이전트가 일할 때 기준으로 삼는 파일 묶음이다. 매 세션 읽는 작업 원칙(판단 기준을 담은 파일 하나)과 짧은 룰(git, 테스트, 배포 같은 영역별 기준), 필요할 때만 여는 스킬(작업 안내서), 도구가 알아서 실행하는 훅, reviewer 같은 서브에이전트로 이뤄진다.

이 하네스에는 "이건 해라, 저건 하지 마라" 식의 목록이 거의 없다. 대신 어떻게 판단할지, 어떤 결과가 좋은 결과인지, 넘으면 안 되는 선이 어디이고 왜 그런지를 설명하고, 그 안의 결정은 모델에게 맡긴다. 모델이 똑똑해질수록 같은 룰과 스킬로 더 좋은 결과를 내는 것, 이것이 이 하네스가 추구하는 방향이다.

설치, 업데이트, 삭제는 각각 명령 하나로 한다.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/tags)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

![agent-harness demo — one-command install of vetted AI-coding skills & plugins](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

🇺🇸 [English](./README.md)

---

## 어떻게 만드는가

### 할 일 목록 대신 판단 기준을 적는다

절차를 정해 두면 모델은 그 절차가 맞지 않는 작업에서도 그대로 따른다. 그래서 이 하네스는 순서를 정하지 않고, 무엇을 따져서 정할지를 적는다. 작업 원칙 파일의 첫 문장도 "고정된 작업 순서가 아니라 함께 쓰는 판단 원칙"이다.

예를 들어 흔한 룰은 이렇게 쓴다.

> 모든 변경에 단위 테스트를 추가하고, 커밋 전에는 반드시 리뷰를 받는다.

이 하네스의 작업 원칙은 이렇게 쓴다.

> 테스트, 리뷰, 릴리즈 점검의 깊이와 시점은 변경의 실제 영향, 불확실성, 되돌리는 비용, 이미 있는 근거에 맞춰 고른다.

앞의 룰을 따르면 오타 하나를 고칠 때도 결제 로직을 바꿀 때와 같은 절차를 밟는다. 뒤의 원칙은 두 작업을 다르게 다룰 근거를 준다. 테스트를 줄이라는 말이 아니라, 필요한 만큼을 모델이 판단하게 하는 것이다.

### 목표와 완료 기준을 먼저 잡는다

방법을 지정하는 대신, 어떤 상태가 되면 끝난 것인지를 알려 준다. `north-star` 스킬은 프로젝트가 무엇을 위해 있고 무엇은 하지 않을지를 정리하고, `objective-brief` 스킬은 작업 하나의 목표와 완료 기준, 경계를 정리한다. 방법은 고정하지 않는다. 같은 결과에 이르는 더 나은 길이 보이면 모델이 그 길을 택하면 된다.

### 경계는 이유와 함께 적고, 기계적으로 막는 것은 최소로 한다

넘으면 안 되는 선은 분명하게 적는다. 되돌리기 어려운 삭제, 배포, 여러 사람이 함께 쓰는 저장소나 데이터베이스에 기록하는 작업은 맡긴 일의 범위를 벗어나면 먼저 묻게 한다. 맡긴 범위 안의 일상적인 진행은 매번 묻지 않고 끝까지 하도록 한다. 강제로 막는 장치는 두 가지뿐이다. Claude Code에서 `.env`, lock 파일, 인증서 편집을 막는 훅이 있고, GitHub 기본 브랜치에 보호 규칙을 거는 스크립트가 있다.

### 모델이 잘하게 된 일은 지시에서 뺀다

매 세션 읽는 지시는 그만큼 컨텍스트를 차지한다. 예전 모델의 약점을 메우려고 넣은 지시가 더 나은 모델에게는 방해가 되기도 한다. 그래서 설치 위저드는 선택한 항목 때문에 매 세션 늘어나는 토큰 수를 설치 전에 보여 주고, `audit-harness-fit` 스킬은 내 프로젝트에서 더는 필요 없어진 지시나 같은 확인을 여러 번 하게 만드는 절차를 찾아 고칠 곳을 제안한다.

### 만드는 에이전트와 검사하는 에이전트를 나눈다

자기가 한 작업을 자기가 검사하면 놓치기 쉽다. Claude Code에서는 코드를 작성하지 않은 `reviewer` 서브에이전트가 테스트나 앱을 직접 실행해 결과를 검사한다. 선택 스킬 `model-orchestration`을 더하면 에이전트가 작업마다 모델과 추론 강도를 고른다. 가벼운 작업은 빠르고 싸게, 판단할 것이 많은 작업은 더 강한 설정으로 맡겨 속도와 비용, 품질 사이의 균형을 맞춘다.

작업 원칙 전문은 [templates/CLAUDE.md](templates/CLAUDE.md)(설치하면 `CLAUDE-uzys-harness.md`로 놓이고 내 `CLAUDE.md`가 한 줄로 불러온다), 방향 문서는 [docs/NORTH_STAR.md](docs/NORTH_STAR.md)에 있다.

## 빠른 시작

Node.js 20.12 이상이 필요하다. 프로젝트 폴더에서 다음 명령어를 실행한다.

```bash
npx -y @uzysjung/agent-harness
```

대화형 마법사가 다섯 단계로 설정을 진행한다.

```
1/5  Tracks          프로젝트 기술 스택을 선택한다(관련 항목을 미리 체크해 주는 역할).
2/5  CLI             claude / codex / opencode / antigravity 중 하나 이상을 고른다.
3/5  Install items   선택한 트랙에 맞춰 항목이 체크되어 있다. 불필요한 항목은 해제한다.
4/5  Confirm         설치 요약과, 이번 설정으로 매 세션 늘어나는 토큰 수를 확인한다.
5/5  Installing
```

설치가 끝나면 같은 폴더에서 AI 코딩 도구를 실행한다. 첫 세션부터 룰과 스킬이 바로 적용된다.

```bash
claude    # 또는 codex / opencode / agy
```

**설치 후 처음 할 일.** `CLAUDE.md`(또는 `AGENTS.md`)에 프로젝트를 설명하는 빈칸이 생성된다. 에이전트에게 다음처럼 지시한다.

```
audit-harness-fit 스킬로 코드를 읽고 프로젝트 설명 빈칸을 채워 줘.
```

에이전트가 저장소를 분석해 빈칸을 채운다. 나중에 이 지시를 다시 내리면, 현재 설정이 프로젝트에 계속 적합한지 점검해 준다.

CI, 컨테이너, 스크립트처럼 대화형 마법사를 쓸 수 없는 환경에서는 플래그로 설치한다. 필수 플래그는 `install --track <name>` 하나다([비대화형 설치](docs/USAGE.md#non-interactive-install)). Claude Code 플러그인은 환경 변수 PATH에 `claude` 명령어가 있어야 설치되며, 없으면 경고를 남기고 건너뛴다.

## 설치되는 것

Claude Code에 개발 트랙으로 설치하면 프로젝트 폴더에 다음 파일이 생긴다.

```
your-project/
├── CLAUDE.md                 내 파일. 끝에 하네스 블록 하나만 추가된다(없으면 새로 만든다).
├── CLAUDE-uzys-harness.md    에이전트가 매 세션 읽는 작업 원칙이다.
├── .claude/
│   ├── rules/                짧은 룰 파일들. 에이전트가 매 세션 읽는다.
│   ├── skills/               작업 안내서. 에이전트는 평소 한 줄 설명만 읽고, 필요할 때 본문을 연다.
│   ├── agents/               메인 에이전트가 작업을 위임하는 서브에이전트(reviewer, implementer 등).
│   ├── hooks/                도구가 자동으로 실행하는 훅 스크립트(세션 시작, 파일 보호).
│   └── settings.json         훅 등록 파일(기존 설정과 병합된다).
├── .mcp.json                 context7(최신 라이브러리 문서), github 등 MCP 서버 설정(기존 설정과 병합된다).
└── .uzys-agent-harness/      설치 기록과 보조 스크립트를 담은 폴더.
```

모든 파일은 프로젝트 내부에만 저장된다. 이를 다른 파일처럼 커밋하면, 저장소를 클론한 팀원도 같은 설정을 공유한다.

어느 트랙을 선택하든 작업 방향을 잡는 기본 스킬 네 가지가 포함된다.

- `north-star`: 프로젝트 목적과 하지 않을 일
- `objective-brief`: 개별 작업의 목표, 완료 기준, 제약 사항
- `gh-issue-workflow`: 결정을 채팅 대신 GitHub 이슈에 기록
- `audit-harness-fit`: 현재 설정이 프로젝트에 맞는지 점검

여기에 선택한 트랙에 따라 기술 스택 스킬이 추가된다. 예를 들어 `csr-supabase` 트랙은 React, shadcn, Supabase, Postgres 스킬을 포함한다. `--with`나 `--without` 플래그에 스킬 이름을 적어 개별적으로 더하거나 뺄 수 있다. 전체 파일 목록은 [하네스가 쓰는 파일](docs/USAGE.md#what-the-harness-writes)에서 확인한다.

도구별 지원 범위는 다음과 같다.

| 도구 | 룰 | 스킬 | 훅 | 서브에이전트 | 플러그인 |
|---|---|---|---|---|---|
| Claude Code | ✓ | ✓ | ✓ | ✓ | ✓ |
| Codex | ✓ (`AGENTS.md` 안에 포함) | ✓ | 세션 시작만 | — | — |
| OpenCode | ✓ (`AGENTS.md` 안에 포함) | ✓ | — | — | — |
| Antigravity | ✓ | ✓ | — | — | — |

플러그인은 Claude Code의 고유 기능이므로 Claude Code에만 설치된다. 룰과 스킬은 동일한 원본을 사용하므로 어떤 도구에서든 내용이 같다. 단, 도구 자체가 지원하는 제어(차단) 기능의 범위는 도구마다 다르다.

## 트랙 고르기

**트랙**은 프로젝트 성격에 맞춰 미리 구성한 기본 설정 묶음이다. 설치 마법사 3단계에서 관련 항목을 자동 체크해 주는 역할만 하므로, 필요 없는 항목은 해제하거나 여러 트랙을 중복 선택해도 된다.

- **스택 미정** — `base`: 기본 원칙, 방법론 스킬, 테스트 룰을 제공한다. 특정 기술 스택에 얽매이지 않는다(다른 모든 개발 트랙에도 기본으로 포함된다).
- **프론트엔드 + 백엔드** — `csr-supabase` · `csr-fastify` · `csr-fastapi` · `ssr-nextjs` · `ssr-htmx`
- **데이터** — `data`
- **비즈니스** — `executive` · `project-management` · `growth-marketing`
- **메타** — `tooling`: 특정 앱 기술 스택이 없는 Bash나 Markdown 프로젝트용
- **전부** — `full`

[트랙별 설치 항목 확인하기 →](docs/TRACKS.md)

## 매일 쓰는 명령

| 하고 싶은 일 | 실행할 명령어 |
|---|---|
| 이 프로젝트에 설치된 항목 확인 | `npx -y @uzysjung/agent-harness list` |
| 최신 릴리스로 업데이트 | `npx -y @uzysjung/agent-harness update` |
| 나중에 다른 도구 추가 | `npx -y @uzysjung/agent-harness install --track <내 트랙> --cli <새 CLI>` |
| 도구 하나, 개별 자산, 또는 전체 삭제 | `npx -y @uzysjung/agent-harness uninstall` (`--cli <name>`, `--only <id>`, 설치 전 미리보기 `--dry-run`) |
| 팀원이 하네스 설정이 포함된 저장소를 클론했을 때 | 추가 작업이 필요 없다. 파일과 설치 기록이 커밋되어 있어 `list`로 확인할 수 있고, 팀원의 기기에서도 `update`와 `uninstall`이 동일하게 작동한다([팀원 및 새 클론](docs/USAGE.md#teammates-and-fresh-clones)). |

`update` 명령어는 하네스가 설치한 항목을 갱신하고, 새 릴리스에 추가된 기능을 반영하며, 유실된 하네스 파일(훅 스크립트, `.mcp.json`의 서버 설정, `AGENTS.md`의 일부 섹션 등)을 복구한다. `--without` 플래그로 제외했던 항목은 계속 제외 상태를 유지하며, 사용자가 선택하지 않은 도구는 절대 설치하지 않는다. `update --only skills`처럼 특정 그룹만 업데이트하도록 제한할 수도 있다.

터미널에서 `uninstall`을 실행하면 삭제 대상(도구 하나, 선택한 자산, 전체)을 선택할 수 있다. `--dry-run`을 쓰면 삭제 계획을 미리 보여 준다. 이 명령어는 `.claude/`, `.codex/`, `.opencode/` 폴더를 직접 지우지 않고 `<dir>.backup-<ts>` 형태로 백업하므로, 사용자가 직접 추가한 파일은 안전하게 보존된다.

**기존 프로젝트에도 안전하다.** 사용자가 고친 파일을 교체할 때는 먼저 같은 폴더에 타임스탬프가 찍힌 백업 파일을 만들고 경로를 안내한다. 사용자가 직접 작성하거나 수정한 파일은 백업 없이 지우지 않으며, 기존 `.mcp.json` 서버 설정도 교체 대신 병합 방식을 따른다([기존 프로젝트에 설치하기](docs/USAGE.md#installing-into-an-existing-project)).

**내 프로젝트에만 적용된다.** `~/.opencode/`, `~/.gemini/` 폴더나 전역 npm에는 어떤 파일도 기록하지 않는다. 단, 명시적으로 동의했을 때 프로젝트 외부에 설정이 쓰이는 예외가 두 가지 있다. 하나는 Claude Code 플러그인(`claude` CLI가 플러그인 캐시를 `~/.claude/plugins/`에 저장함)이고, 다른 하나는 Codex가 프로젝트 설정을 읽도록 허용하기 위해 `~/.codex/config.toml`에 신뢰(trust) 항목을 추가하는 `--with-codex-trust` 옵션이다([자세히](docs/USAGE.md#scope)).

## 이미 다른 방법을 쓰고 있다면

| 지금 이렇게 하고 있다면 | 이 하네스와 다른 점 |
|---|---|
| `CLAUDE.md`나 `AGENTS.md`를 직접 쓴다 | 기존 파일은 유지된다. 하네스는 표시된 블록 하나만 덧붙이고 나머지는 건드리지 않는다. 파일 하나로 불가능한 기능(실제 차단용 훅, 작업과 검토를 분리한 서브에이전트, `update`·`uninstall` 이 하네스가 넣은 것만 건드리게 하는 설치 기록)을 더해 준다. |
| 마켓플레이스에서 스킬을 골라 쓴다 | 스킬 하나만 필요하다면 단건으로 설치하면 된다. `npx skills add uzysjung/uzys-agent-harness --skill <id> -a claude-code` (id 목록은 `--list` 플래그나 [skills.sh](https://skills.sh/uzysjung/uzys-agent-harness)에서 확인한다). 하네스 설치 마법사는 단순 스킬 추가를 넘어 상시 룰, 훅, 서브에이전트, 그리고 이를 최신으로 유지하는 설치 기록 관리를 위해 쓴다. |
| 룰이 많은 다른 하네스를 쓴다 | 상시 지시 사항을 최소화하여, 설치 전에 매 세션 소모되는 토큰 수를 미리 보여 준다. 정해진 순서대로 개발해야 한다면 외부 워크플로 키트인 `openspec`이나 `bmad-method`를 추가로 쓸 수 있다. 둘 다 선택 사항이며 [WORKFLOWS.md](docs/WORKFLOWS.md)에서 비교할 수 있다. |

## 문서

- [사용 안내](docs/USAGE.md) — 설치 플래그, 적용 범위, update, uninstall 명령어, CLI 환경별 세부 사항, 생성되는 파일의 용도와 위치
- [트랙](docs/TRACKS.md) — 트랙 선택 시 자동 체크되는 항목 목록
- [호환성 표](docs/COMPATIBILITY.md) — 자산별 설치 방식, 지원하는 CLI, 검증 방법
- [어느 파일이 누구 것인가](docs/CONTEXT-FILES.md) — `CLAUDE.md`, 앵커, `AGENTS.md` 등 컨텍스트 파일 설명
- [워크플로 안내](docs/WORKFLOWS.md) — 선택해서 추가할 수 있는 외부 워크플로 키트 비교 및 사용 가이드
- [보안](SECURITY.md) — 외부 자산 검증이 확인하는 것과 확인하지 않는 것, 취약점 신고 방법
- [North Star](docs/NORTH_STAR.md) · [결정 기록](docs/decisions/) — 하네스 설계 철학과 아키텍처 결정 배경

## License

MIT.
