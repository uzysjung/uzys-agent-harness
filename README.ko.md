# uzys-agent-harness

명령 하나로 짧은 위저드가 실행되어 이 프로젝트에 맞게 AI 코딩 에이전트를 설정한다. 짧은 작업 룰, 안전 훅, 그리고 작업에 필요할 때만 열어보는 단계별 플레이북을 스택에 맞춰 골라 주고, 나중에 업데이트하거나 지울 수 있게 기록해 둔다.

**Claude Code** · **Codex** · **OpenCode** · **Antigravity** 와 함께 쓸 수 있다.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/tags)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

![agent-harness demo — one-command install of vetted AI-coding skills & plugins](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

🇺🇸 [English](./README.md)

---

## 왜 필요한가

AI 코딩 에이전트로 개발해 봤다면 이런 경험이 익숙할 것이다:

| 지금 겪는 일 | 이것이 설정해 주는 것 |
|---|---|
| 실수할 때마다 `CLAUDE.md` 나 `AGENTS.md` 가 길어지지만 에이전트는 여전히 절반을 건너뛰고, 그렇다고 한 줄 지우기도 겁난다. | 에이전트가 매 세션 읽는 3~6개의 짧은 룰 파일(git, 변경 관리, 문서화, 테스트, 배포)을 둔다. 더 긴 노하우는 **스킬**로 들어간다 — 에이전트가 작업에 필요할 때만 열어보는 단계별 플레이북이다. 설치를 확정하기 전, 선택한 항목이 매 세션에 얼마나 많은 토큰을 더하는지 보여 준다. |
| 매 단계를 직접 지시해야 하거나, 아니면 에이전트가 엉뚱한 길로 새어 잘못된 것을 만든다. | 시작하기 전, 프로젝트의 목적이 무엇인지, 이번 작업의 "완료" 기준이 무엇인지, 그리고 건드리지 말아야 할 것이 무엇인지 에이전트가 직접 적어 두게 하는 스킬을 제공한다. 이것이 적혀 있으면 에이전트가 자기 작업을 대조할 기준이 생기고, 사람이 필요해지기 전까지 더 많은 일을 스스로 끝낼 수 있다. |
| 에이전트가 `.env` 나 락(lock) 파일을 고치거나, 묻지도 않고 배포하고 지워 버린다. | Claude Code 에서는 **훅** — 도구가 자체적으로 실행하는 스크립트 — 이 에이전트의 파일 편집 도구가 `.env`, 락 파일, 인증서를 바꾸지 못하게 막는다(패키지 설치 시 락 파일이 업데이트되는 것은 평소처럼 된다). 동봉된 스크립트를 실행하면 메인 브랜치에 GitHub 브랜치 보호를 켠다. 모든 도구에서, 설치된 지시문이 배포·삭제처럼 되돌리기 힘든 일은 먼저 물어보라고 에이전트에게 말한다 — 이 부분은 지시이지 차단이 아니다. |
| 에이전트가 "완료"라고 하지만, 실제로는 끝나지 않았다. | Claude Code 에서는 코드를 짜지 않은 별도의 `reviewer` **서브에이전트**가 만든 에이전트의 말만 믿지 않고 테스트나 앱을 직접 실행해 끝난 작업을 검사한다. 메인 에이전트가 검토자에게 작업을 넘길 수도 있고, 직접 이름을 불러 요청할 수도 있다. |
| 여러 AI 도구를 쓰거나 바꿀 계획이 있다. | 한 소스에서 네 가지 도구 모두에 맞는 같은 룰과 스킬이 생성된다. 훅과 서브에이전트는 각 도구가 지원하는 기능에 따라 다르다([도구별 지원 범위](#무엇이-설치되는가)). |
| 설정 파일이 쌓여서 무엇이 어디서 왔는지 알 수 없다. | 인스톨러가 작성하는 모든 파일은 기록된다. `update` 는 새 버전을 가져오고 릴리스에서 빠진 것을 지운다. `uninstall` 은 설치를 되돌린다: `.mcp.json` 같은 공유 파일에서는 인스톨러가 넣은 줄만 빠지고, 기존의 내 `CLAUDE.md` 는 바이트 단위로 똑같이 돌아오며, 직접 쓰거나 수정한 파일은 백업 없이 지워지지 않는다. |

## 빠른 시작

Node 20.12 이상이 필요하다. 프로젝트 폴더에서 다음 명령을 실행한다:

```bash
npx -y @uzysjung/agent-harness
```

위저드가 다음 다섯 단계를 안내한다:

```
1/5  Tracks          무엇을 만드는지(스택) — 항목을 미리 체크해 줄 뿐이다
2/5  CLI             claude / codex / opencode / antigravity — 여러 개 가능
3/5  Install items   트랙에 맞는 항목이 미리 체크되어 있다. 원치 않는 것은 해제
4/5  Confirm         요약과 함께, 이 선택이 매 세션에 얼마나 많은 토큰을 더하는지 보여 준다
5/5  Installing
```

그다음 같은 폴더에서 AI 코딩 도구를 실행하면, 첫 세션부터 룰과 스킬이 바로 적용된다:

```bash
claude    # 또는 codex / opencode / agy
```

**처음 할 일.** 설치가 끝나면 *내 프로젝트*에 대한 정보를 채울 수 있는 빈칸이 포함된 `CLAUDE.md`(또는 `AGENTS.md`) 파일이 생긴다. 에이전트에게 한 번 이렇게 입력한다:

```
audit-harness-fit 스킬을 실행해서 코드로부터 프로젝트 섹션 빈칸을 채워 줘.
```

에이전트가 저장소를 읽고 그 빈칸들을 채워 준다. 나중에 설정을 여전히 내 프로젝트에 쓸 만한지 확인하려면 다시 물어보면 된다.

위저드를 띄울 수 없는 환경(CI, 컨테이너, 스크립트 등)이라면 플래그를 사용해 설치할 수 있다. 필수 플래그는 `install --track <name>` 하나뿐이다 — [비대화형 설치](docs/USAGE.md#non-interactive-install). Claude Code 플러그인을 설치하려면 시스템 PATH 에 `claude` 명령이 있어야 한다. 만약 없다면 경고 메시지만 남기고 플러그인 설치를 건너뛴다.

## 무엇이 설치되는가

개발 트랙에서 Claude Code 를 쓰면 프로젝트에 다음이 생긴다:

```
your-project/
├── CLAUDE.md                 내 것 — 파일 끝에 임포트 블록 하나가 추가된다(없으면 생성됨)
├── CLAUDE-uzys-harness.md    에이전트가 매 세션 읽는 작업 원칙
├── .claude/
│   ├── rules/                짧은 룰 파일들 — 매 세션 읽음
│   ├── skills/               플레이북 — 사용하기 전까지는 한 줄짜리 설명만 로드됨
│   ├── agents/               reviewer, implementer — 메인 에이전트가 작업을 넘기는 서브에이전트
│   ├── hooks/                세션 시작 · 파일 보호 — Claude Code 가 직접 실행함
│   └── settings.json         훅을 등록함(기존 설정과 병합됨)
├── .mcp.json                 MCP 서버 — context7 (현재 라이브러리 문서), github (기존 설정과 병합됨)
└── .uzys-agent-harness/      설치 기록과 헬퍼 스크립트
```

모든 것은 프로젝트 안에 머문다. 다른 파일처럼 커밋하면 되고, 클론하는 팀원들도 같은 설정을 얻게 된다.

모든 트랙은 방향을 잡고 유지하는 네 가지 스킬을 얻는다: `north-star`(프로젝트의 목적과 하지 않을 일), `objective-brief`(한 작업의 목표, 완료 기준, 제한 사항), `gh-issue-workflow`(채팅 로그 대신 GitHub 이슈에 결정 사항 기록), 그리고 `audit-harness-fit` 이다. 선택한 트랙이 스택 스킬을 추가한다 — 예를 들어 `csr-supabase` 에서는 React, shadcn, Supabase, Postgres 가 추가된다 — 그리고 `--with` / `--without` 을 써서 동봉된 스킬을 이름으로 추가하거나 뺄 수 있다. 모든 파일과 경로: [하네스가 작성하는 파일](docs/USAGE.md#what-the-harness-writes).

도구별 지원 범위:

| 도구 | 룰 | 스킬 | 훅 | 서브에이전트 | 플러그인 |
|---|---|---|---|---|---|
| Claude Code | ✓ | ✓ | ✓ | ✓ | ✓ |
| Codex | ✓ (`AGENTS.md` 에 포함) | ✓ | 세션 시작만 | — | — |
| OpenCode | ✓ (`AGENTS.md` 에 포함) | ✓ | — | — | — |
| Antigravity | ✓ | ✓ | — | — | — |

플러그인은 Claude Code 자체 메커니즘이므로 Claude 전용이다. 룰과 스킬은 같은 소스에서 네 가지 도구 모두를 위해 생성되므로, 지시문은 모든 도구에서 같은 말을 한다. 단, 도구가 자체적으로 강제할 수 있는 것은 다르다.

## 트랙 고르기

**트랙**은 만들고자 하는 것을 위한 시작 세트다. 위저드 3단계에서 항목을 미리 체크해 줄 뿐이므로, 원하지 않는 항목은 체크를 해제할 수 있으며 트랙을 여러 개 골라도 괜찮다.

- **스택 미정** — `base`: 기본 원칙 · 방법론 스킬 · 테스트 룰을 제공한다. 특정 기술 스택에 종속된 내용은 없다(다른 모든 개발 트랙에도 기본으로 포함된다).
- **프론트엔드 + 백엔드** — `csr-supabase` · `csr-fastify` · `csr-fastapi` · `ssr-nextjs` · `ssr-htmx`
- **데이터** — `data`
- **비즈니스** — `executive` · `project-management` · `growth-marketing`
- **메타** — `tooling`: 앱 기술 스택이 따로 없는 Bash 나 Markdown 프로젝트용
- **전부** — `full`

[트랙별 설치 항목 확인하기 →](docs/TRACKS.md)

## 매일 쓰는 명령

| 하고 싶은 일 | 실행할 명령 |
|---|---|
| 이 프로젝트에 설치된 항목 확인하기 | `npx -y @uzysjung/agent-harness list` |
| 현재 릴리스로 업데이트하기 | `npx -y @uzysjung/agent-harness update` |
| 나중에 다른 도구 추가하기 | `npx -y @uzysjung/agent-harness install --track <내 트랙> --cli <새 CLI>` |
| 전부, 도구 하나, 혹은 개별 자산 지우기 | `npx -y @uzysjung/agent-harness uninstall` (`--cli <name>` · `--only <id>` · 미리 보기 `--dry-run`) |
| 팀원이 하네스로 설정한 저장소를 클론했을 때 | 아무것도 안 해도 된다 — 파일들과 함께 설치 기록이 커밋되어 있다. `list` 가 이를 보여 주며, `update` 와 `uninstall` 도 그들의 기기에서처럼 작동한다([팀원 및 새 클론](docs/USAGE.md#teammates-and-fresh-clones)) |

`update` 명령은 하네스가 설치한 것을 새로 고치고, 새 릴리스에 도입된 것을 추가하며, 사라진 하네스 파일(훅 스크립트, `.mcp.json` 의 서버, `AGENTS.md` 의 한 섹션 등)을 되돌려 놓는다. `--without` 으로 일부러 뺀 것은 계속 빠진 상태로 남는다. 선택하지 않은 도구는 절대 설치하지 않는다. `update --only skills` 로 한 그룹에만 제한할 수 있다.

터미널에서 `uninstall` 은 세 가지 선택지(도구 하나, 선택한 자산, 또는 전부)를 제공하며, `--dry-run` 은 계획을 먼저 보여 준다. 이 명령은 `.claude/`, `.codex/`, 또는 `.opencode/` 를 절대 지우지 않는다. 각각 `<dir>.backup-<ts>` 로 비켜 두므로, 직접 그곳에 넣은 파일은 백업에 남는다.

**기존 프로젝트에도 안전하다.** 수정한 파일을 교체하기 전에, 하네스는 그 옆에 타임스탬프가 찍힌 백업을 만들고 경로를 출력한다. 직접 쓰거나 수정한 파일은 백업 없이 지워지지 않으며, 기존 `.mcp.json` 서버는 교체되지 않고 병합된다([기존 프로젝트에 설치하기](docs/USAGE.md#installing-into-an-existing-project)).

**내 프로젝트에만 적용된다.** `~/.opencode/`, `~/.gemini/`, 혹은 전역 npm 에는 아무것도 가지 않는다. 프로젝트 밖에 쓰는 옵트인 예외가 두 가지 있다: Claude Code 플러그인(`claude` CLI 는 `~/.claude/plugins/` 아래에 플러그인 캐시를 보관한다), 그리고 Codex 가 프로젝트 설정을 읽도록 `~/.codex/config.toml` 에 trust 항목 하나를 추가하는 `--with-codex-trust` 가 있다([자세히](docs/USAGE.md#scope)).

## 이미 다른 것을 쓰고 있다면?

| 이 도구 없이 이렇게 한다면… | 여기서 다른 점 |
|---|---|
| 나만의 `CLAUDE.md` 나 `AGENTS.md` 를 작성한다 | 그대로 유지하면 된다 — 표시된 블록 하나만 추가되고 나머지는 절대 건드리지 않는다. 파일 하나만으로는 얻을 수 없는 것들이 함께 온다: 실제로 차단하는 훅, 만드는 에이전트와 분리된 검토 에이전트, 그리고 `update` 와 `uninstall` 이 인스톨러가 넣은 것만 건드리게 해 주는 설치 기록이다. |
| 마켓플레이스에서 스킬을 고른다 | 스킬 하나만 필요하다면 그것만 가져오면 된다: `npx skills add uzysjung/uzys-agent-harness --skill <id> -a claude-code` (`--list` 로 id 를 볼 수 있으며, [skills.sh](https://skills.sh/uzysjung/uzys-agent-harness) 에도 있다). 인스톨러는 스킬 목록이 담지 못하는 것 — 기본 룰, 훅, 서브에이전트, 그리고 이것들을 최신으로 유지해 주는 기록 — 을 위한 것이다. |
| 룰이 많은 설정을 쓴다 | 상시 지시문이 더 적으며, 확정하기 전에 매 세션당 비용을 볼 수 있다. 그 위에 고정된 스펙 우선 프로세스를 원한다면 `openspec` 이나 `bmad-method`(서드파티 워크플로 키트)를 추가할 수 있다 — 둘 다 선택 사항이며 [WORKFLOWS.md](docs/WORKFLOWS.md) 에 비교되어 있다. |

## 이 프로젝트에 담긴 생각

모든 요소는 단 하나의 질문으로 평가된다: *이것이 AI 코딩 도구로 더 잘 개발하는 데 도움이 되는가?* 여기서 네 가지 설계 선택이 나온다.

1. **모델이 발전할수록 더 가벼워진다.** 옛 모델의 약점을 메우기 위해 쓴 지시문은 낡아 버린다. 룰은 에이전트의 행동을 실질적으로 바꿀 때만 남고, 나머지는 필요할 때 부르는 스킬이 되거나 릴리스에서 제거된다. `audit-harness-fit` 은 내 프로젝트에도 같은 검사를 실행하고 수정을 제안한다.
2. **단계별 프롬프트 대신, 목적지와 한계를 준다.** 목표, 완료 기준, 확실한 제한 사항이 적혀 있으면 에이전트는 매 단계 사람을 기다리는 대신 '시도 → 확인 → 수정' 루프 속에서 일할 수 있다.
3. **계속해서 정리한다.** 매 세션 로드되는 것은 매 세션 컨텍스트 비용을 발생시킨다. 그래서 각 릴리스는 더 이상 제 역할을 못 하는 것을 제거하며, `update` 는 그 제거 사항을 프로젝트에 반영한다.
4. **다른 관점과 다른 에이전트를 쓴다.** 개발하는 에이전트와 검사하는 에이전트는 다르다. 선택 사항인 스킬을 쓰면 작업마다 모델과 추론 강도를 고르거나, Claude 가 아닌 모델에게 두 번째 의견을 물어볼 수 있다 — 그래서 속도, 비용, 품질을 기본값이 아니라 의도적으로 교환할 수 있다.

이 생각들의 배경 글(한국어): [모델이 바뀌면 옛 모델을 메우던 지시를 다시 잰다](https://dyld.kr/blog/astra-trim-agent-instructions) · [북극성 · 완료 기준 · 가드레일](https://dyld.kr/blog/north-star-for-autonomous-ai-coding) · [Prompt 에서 Loop, Graph 까지](https://dyld.kr/blog/from-prompt-to-loop-and-graph)

자세한 내용은 프로젝트의 방향 문서 [docs/NORTH_STAR.md](docs/NORTH_STAR.md) 에 있다.

### 지금까지의 근거

지금까지 측정된 것은 이 저장소에서 나온 결과이며, 이 저장소는 스스로에게 하네스를 사용한다. 마지막 감사(audit)에서 우리 자체 룰의 44개 문장 중 어느 것도 에이전트의 행동을 바꾼 사례가 관찰되지 않았다 — 기록된 사고들은 테스트, CI 게이트, 독립적인 검토자가 잡아냈다 — 그래서 되돌릴 수 없는 피해를 막는 보호막은 이제 문장이 아니라 훅과 브랜치 룰에 있으며, 뒷받침할 관찰 기록이 없는 4개의 스킬과 3개의 에이전트는 은퇴시켰다([ADR-090](docs/decisions/ADR-090-retire-unobserved-assets-and-demote-domain-agents.md)). 이것은 단일 프로젝트의 증거일 뿐 벤치마크는 아니다: 다른 프로젝트에서도 개발이 더 빠르고, 모델 비용이 낮으며, 결과가 더 좋다는 것을 아직 보여 주지는 않는다.

## 검증

외부 자산을 **검증된 항목**으로 등록하려면 세 가지 조건을 만족해야 한다: GitHub 스타 1,000개 이상일 것, 보관 처리된(archived) 저장소가 아닐 것, 격리된 환경에서 설치 명령을 실제로 실행해 정상 동작을 확인했을 것. 매달 실행되는 두 개의 CI 작업이 저장소의 스타 수와 설치 경로 유효성을 다시 점검한다. 이 검증은 코드를 한 줄 한 줄 분석하는 보안 감사가 **아니며**, 자산 내용에 포함된 프롬프트 인젝션 공격 여부까지 검사하지는 않는다. npm 과 npx 자산은 버전을 고정해서 사용하고, 플러그인과 스킬 자산은 원본 저장소의 최신 커밋(upstream HEAD)을 가져온다.

위저드 3단계에서 보이는 `★ official` 태그는 Anthropic 공식 마켓플레이스 자산과 하네스에서 자체 제공하는 자산을 의미하며, `⚠ experimental` 태그는 스타가 1,000개 미만인 자산을 뜻한다 — 이 항목들은 기본적으로 체크되어 있지 않으므로 직접 선택해야 설치할 수 있다. 검증을 통과한 자산에는 따로 태그가 붙지 않는다. 이러한 등급은 상태를 알려 주기 위한 용도일 뿐 설치를 막지는 않는다. 설치된 자산은 다른 서드파티 의존성 패키지와 동일한 기준으로 취급한다: [SECURITY.md](SECURITY.md).

## 문서

- [사용 안내](docs/USAGE.md) — 설치 플래그 · 설치 범위 · update · uninstall · CLI 환경별 세부 사항 · 생성되는 파일의 용도와 위치
- [트랙](docs/TRACKS.md) — 트랙을 선택할 때 미리 체크되는 항목들
- [호환성 표](docs/COMPATIBILITY.md) — 각 자산의 설치 방식 · 지원하는 CLI · 검증 방법
- [어느 파일이 누구 것인가](docs/CONTEXT-FILES.md) — `CLAUDE.md` · 앵커 · `AGENTS.md` 등 컨텍스트 관련 파일 설명
- [워크플로 안내](docs/WORKFLOWS.md) — 선택해서 사용할 수 있는 워크플로 묶음 비교와, 굳이 사용하지 않아도 되는 상황 안내
- [보안](SECURITY.md) — 검증 과정에서 확인하는 것과 확인하지 않는 것, 취약점 신고 방법
- [North Star](docs/NORTH_STAR.md) · [결정 기록](docs/decisions/) — 하네스가 왜 이런 철학과 구조를 가지게 되었는지에 대한 배경

## License

MIT.
