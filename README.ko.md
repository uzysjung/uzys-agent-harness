# uzys-agent-harness

AI 코딩 에이전트용 하네스 도구다. 하네스는 에이전트가 일하는 방식을 정해 주는 설정 묶음(룰, 훅, 스킬, 서브에이전트)을 말한다.

이 도구는 **'AI 코딩 도구로 더 잘 개발하는 데 도움이 되는 것만 넣는다'**는 철학에 바탕을 둔다. 규칙을 최소화하고 에이전트에게는 목표와 완료 기준, 넘으면 안 되는 선만 준 뒤 나머지는 스스로 판단하게 한다. AI 모델 성능이 좋아져서 필요 없어진 규칙은 덜어 낸다. 자세한 내용은 [설계 원칙](#설계-원칙)에서 볼 수 있다.

명령어 하나로 프로젝트 기술 스택에 맞는 구성을 설치하고, 업데이트와 삭제도 명령어 하나로 처리한다.

**Claude Code** · **Codex** · **OpenCode** · **Antigravity**를 지원한다.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/tags)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

![agent-harness demo — one-command install of vetted AI-coding skills & plugins](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

🇺🇸 [English](./README.md)

---

## 왜 필요한가

AI 코딩 에이전트로 개발하다 보면 흔히 이런 일을 겪는다.

| 흔히 겪는 일 | 이 하네스가 하는 일 |
|---|---|
| 실수할 때마다 `CLAUDE.md`나 `AGENTS.md`에 한 줄씩 보태다 보니 파일이 길어졌다. 에이전트는 그중 절반을 건너뛰는데, 지우자니 불안하다. | 에이전트가 매 세션 읽는 룰은 짧은 파일 3~6개로 줄인다. 긴 작업 절차는 **스킬**(에이전트가 필요할 때만 꺼내 보는 작업 안내서)로 분리한다. 설치하기 전에 매 세션 토큰이 얼마나 늘어나는지 보여 준다. |
| 단계마다 지시해야 하거나, 맡겨 두면 엉뚱한 것을 만든다. | 작업을 시작하기 전에 에이전트가 프로젝트 목적, 작업 완료 기준, 건드리면 안 되는 것을 먼저 정리하게 한다. 기준이 명확해지면 에이전트가 스스로 결과를 확인하며 더 오래 혼자 일할 수 있다. |
| 에이전트가 `.env`나 lock 파일을 고치거나, 묻지 않고 배포하거나 지운다. | Claude Code 에서는 **훅**(도구가 알아서 실행하는 스크립트)이 에이전트의 `.env`, lock 파일, 인증서 편집을 막는다(패키지 설치로 lock 파일이 바뀌는 것은 허용한다). 동봉된 스크립트를 실행하면 GitHub 기본 브랜치를 보호할 수 있다. 배포나 삭제처럼 되돌리기 어려운 작업은 먼저 사용자에게 묻도록 모든 도구에 지시한다(이 부분은 지시일 뿐 강제 차단은 아니다). |
| 에이전트가 작업이 끝났다고 하는데 실제로는 동작하지 않는다. | Claude Code 에서는 코드를 작성하지 않은 `reviewer` 서브에이전트가 직접 테스트나 앱을 실행해 보고 결과를 판정한다. 메인 에이전트가 작업을 넘기거나 사용자가 직접 호출할 수 있다. |
| AI 도구를 여러 개 쓰거나 도구를 바꿀 계획이 있다. | 하나의 원본으로 네 가지 도구용 룰과 스킬을 생성한다. 훅과 서브에이전트는 각 도구가 지원하는 범위 안에서만 적용한다([도구별 지원](#설치되는-것)). |
| 설정 파일이 쌓여서 파일의 출처를 알기 어렵다. | 설치한 모든 파일을 기록한다. `update` 명령어로 새 버전을 적용하고 릴리스에서 제외된 파일은 지운다. `uninstall` 명령어로 설치 이전 상태로 되돌린다. `.mcp.json` 같은 공용 파일에서는 하네스가 추가한 내용만 빼고, 사용자의 `CLAUDE.md`는 설치 전과 똑같이 복구한다. 사용자가 작성하거나 수정한 파일은 백업 없이 지우지 않는다. |

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

## 설계 원칙

하네스에 무엇을 넣고 뺄지는 한 가지 기준으로 정한다. **'AI 코딩 도구로 더 잘 개발하는 데 도움이 되는가.'** 이 기준에서 네 가지 원칙이 나온다.

1. **AI 모델이 발전하면 하네스는 가벼워진다.** 예전 모델의 단점을 보완하기 위해 추가한 지시 사항은 시간이 지나면 쓸모가 없어진다. 룰은 에이전트의 행동을 실질적으로 개선할 때만 유지하고, 효용이 떨어지면 스킬로 분리하거나 릴리스에서 제거한다. `audit-harness-fit` 스킬을 쓰면 내 프로젝트에서도 동일한 점검을 수행하고 수정할 곳을 찾아 준다.
2. **세세한 절차 대신 목표와 경계를 제공한다.** 목표, 완료 기준, 제약 사항이 명확하면 에이전트는 사람의 지시를 기다리지 않고 실행, 확인, 수정을 반복하며 자율적으로 작업할 수 있다.
3. **하네스를 계속 정리한다.** 에이전트가 매 세션 읽는 내용은 모두 비용(토큰)이다. 매 릴리스마다 제 몫을 못 하는 항목을 덜어 내며, `update` 명령어를 실행하면 이 정리 결과가 사용자 프로젝트에도 반영된다.
4. **여러 관점과 다수 에이전트를 활용한다.** 개발하는 에이전트와 검토하는 에이전트를 분리한다. 선택 스킬을 추가하면 작업 성격에 맞춰 모델과 추론 강도를 조정하거나, Claude가 아닌 다른 AI 모델에 의견을 물어볼 수 있다. 속도, 비용, 품질의 균형을 도구의 기본값에 맡기지 않고 사용자가 직접 정한다.

자세한 배경은 방향 문서 [docs/NORTH_STAR.md](docs/NORTH_STAR.md)에서 읽을 수 있다.

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
