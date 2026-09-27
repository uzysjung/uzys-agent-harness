# uzys-agent-harness

AI 코딩 도구에 꼭 필요한 룰·훅·스킬만 남기고 나머지는 모두 덜어낸다. 위저드를 한 번 실행하면 내 기술 스택에 맞는 검증된 도구 모음을 프로젝트 환경에 설치할 수 있다.

**Claude Code** · **Codex** · **OpenCode** · **Antigravity** 에서 사용할 수 있다.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/tags)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

![agent-harness 데모 — 검증된 AI 코딩 스킬·플러그인 원커맨드 설치](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

🇺🇸 [English](./README.md)

---

## 빠른 시작

Node 20 이상이 필요하다. 프로젝트 폴더에서 다음 명령을 실행한다:

```bash
npx -y @uzysjung/agent-harness
```

위저드가 다음 여섯 단계를 안내한다:

```
1/6  Tracks          무엇을 만드는지(스택) — 항목을 미리 체크해 줄 뿐이다
2/6  CLI             claude / codex / opencode / antigravity — 여러 개 가능
3/6  Install items   트랙에 맞는 항목이 미리 체크되어 있다. 원치 않는 것은 해제
4/6  Scope           Project(기본값, 이 폴더에만) 또는 Global
5/6  Confirm         요약과 함께, 이 선택이 매 세션에 얹는 컨텍스트 크기를 보여 준다
6/6  Installing
```

그다음 같은 폴더에서 AI 코딩 도구를 실행하면, 첫 세션부터 룰과 스킬이 바로 적용된다:

```bash
claude    # 또는 codex / opencode / agy
```

**처음 할 일.** 설치가 끝나면 *내 프로젝트*에 대한 정보를 채울 수 있는 빈칸이 포함된 `CLAUDE.md`(또는 `AGENTS.md`) 파일이 생긴다. 에이전트에게 `audit-harness-fit` 스킬을 한 번 실행해 달라고 요청하면, 에이전트가 저장소를 분석해 코드에 기반한 내용으로 빈칸을 채워 준다. 나중에 이 스킬을 다시 실행하면 현재 프로젝트 상황에 하네스가 여전히 잘 맞는지 점검해 준다.

위저드를 띄울 수 없는 환경(CI · 컨테이너 · 스크립트 등)이라면 플래그를 사용해 설치할 수 있다. 필수 플래그는 `install --track <name>` 하나뿐이다 — [비대화형 설치](docs/USAGE.md#non-interactive-install). Claude Code 플러그인을 설치하려면 시스템 PATH 에 `claude` 명령이 있어야 한다. 만약 없다면 경고 메시지만 남기고 플러그인 설치를 건너뛴다.

## 무엇이 들어 있나

| 구성 | 무엇인가 | 에이전트가 언제 읽나 |
|---|---|---|
| **룰** | 짧은 파일 6개: git 정책 · 변경 관리 · 문서 · 테스트 · 배포 · CLI 개발. 개발 트랙은 5개를, `tooling` · `full` 은 6개 모두를, 비즈니스 트랙은 어느 프로젝트에나 맞는 3개를 받는다 | 매 세션 |
| **훅** | CLI 가 스스로 실행하는 스크립트. Claude Code 에는 2개가 들어간다: 하나는 세션을 시작할 때 스펙과 변경 기록을 불러오고, 다른 하나는 `.env` · lock 파일 · 인증서 편집을 막는다 — 하네스에서 "안 된다"고 제한하는 유일한 장치이며, 편집을 막을 때마다 로그를 한 줄 남긴다 | 자동으로 — 세션을 시작할 때, 편집하기 직전에 |
| **스킬** | 작업에 필요할 때 에이전트가 열어보는 단계별 절차서. 이 저장소에서 관리하는 방법론 스킬과 트랙에 필요한 기술 스택 스킬이 들어 있다(예: `csr-supabase` 의 React · shadcn · Supabase · Postgres) | 필요할 때만 — 한 줄짜리 설명만 항상 띄워 두고, 본문은 사용할 때만 읽는다 |
| **에이전트** | 메인 에이전트가 작업을 맡기는 조수. 모든 트랙에 독립 검증자 `reviewer` 가 있고, 개발 트랙에는 `implementer` 가 있으며, 그것을 쓰는 트랙에만 `data-analyst` · `strategist` 가 들어간다 | 메인 에이전트가 작업을 위임할 때 |
| **앵커** | CLI 가 매 세션마다 읽는 작업 원칙 파일. 원래 있던 내 `CLAUDE.md` 파일은 그대로 유지된다 — 하네스는 import 구문 한 줄만 추가할 뿐 나머지는 건드리지 않는다([어느 파일이 누구 것인가](docs/CONTEXT-FILES.md)) | 매 세션 |

모든 트랙에 공통으로 들어가는 방법론 스킬은 4가지다: `north-star` · `objective-brief` · `gh-issue-workflow` · `audit-harness-fit`. 번들 스킬은 `--with` 나 `--without` 뒤에 이름을 적어 추가하거나 뺄 수 있다.

어떤 CLI 에 어떤 구성 요소가 들어갈까:

| CLI | 룰 | 스킬 | 훅 | 플러그인 |
|---|---|---|---|---|
| Claude Code | ✓ | ✓ | ✓ | ✓ |
| Codex | ✓ (`AGENTS.md` 안에 포함) | ✓ | 세션 시작할 때만 | — |
| OpenCode | ✓ (`AGENTS.md` 안에 포함) | ✓ | — | — |
| Antigravity | ✓ | ✓ | — | — |

플러그인은 Claude Code 고유의 기능이므로 Claude 전용으로만 제공된다. 스킬과 룰은 같은 원본 파일을 바탕으로 네 가지 CLI 용으로 각각 만들어지므로, 사용하는 도구를 바꿔도 내용은 똑같이 유지된다.

## 트랙 고르기

**트랙**은 프로젝트의 성격에 맞게 구성된 초기 도구 묶음이다. 위저드 3단계에서 필요한 항목을 미리 체크해 주는 역할만 하므로, 원하지 않는 항목은 체크를 해제할 수 있으며 트랙을 여러 개 골라도 괜찮다.

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
| 최신 버전으로 업데이트하기 | `npx -y @uzysjung/agent-harness update` |
| 나중에 다른 CLI 추가하기 | `npx -y @uzysjung/agent-harness install --track <내 트랙> --cli <새 CLI>` |
| 전체 · 특정 CLI · 일부 자산 지우기 | `npx -y @uzysjung/agent-harness uninstall` (`--cli <name>`, `--only <id>`, `--dry-run` 옵션으로 미리 볼 수 있다) |

`update` 명령은 하네스가 설치한 파일을 최신으로 갱신하고, 새 버전에 추가된 스킬을 설치하며, 새로운 훅처럼 다시 설치해야 할 항목이 있으면 안내해 준다. 선택하지 않은 CLI 는 새로 설치하지 않는다 — CLI 환경은 설치할 때만 추가되고 `uninstall` 로만 지울 수 있다. `update --only skills` 처럼 특정 묶음만 업데이트할 수도 있다.

**기존 프로젝트에 적용해도 안전하다.** 내가 직접 수정한 파일을 교체해야 할 때는 타임스탬프를 붙여 백업본을 남기고 그 경로를 알려 준다. 내가 작성하거나 수정한 파일은 백업 없이 지우지 않으며, 기존에 있던 `.mcp.json` 서버 설정은 덮어쓰지 않고 내용을 병합한다([기존 프로젝트에 설치하기](docs/USAGE.md#installing-into-an-existing-project)).

**기본적으로 현재 프로젝트에만 설치된다.** 위저드 4단계에서 Global 을 선택하지 않는 한 `~/.codex/` · `~/.opencode/` · `~/.gemini/` 디렉터리나 전역 npm 환경에는 아무것도 설치하지 않는다. 유일한 예외는 Claude Code 플러그인이다 — `claude` CLI 는 범위를 불문하고 플러그인 캐시를 `~/.claude/plugins/` 디렉터리에 저장하며 프로젝트는 메타데이터로 구분하기 때문이다. `.claude/` 디렉터리 밖에는 `.mcp.json`, `.gitignore` 파일에 추가하는 몇 줄(파일이 이미 있을 때), Supabase 트랙의 경우 `.env.example`, 그리고 설치 기록을 남기는 `.uzys-agent-harness/` 디렉터리만 생성한다 — [전체 설치 목록 보기](docs/USAGE.md#what-the-harness-writes).

## 다른 도구를 이미 쓰고 있다면

| 원하는 작업 | 방법 |
|---|---|
| 하네스 전체 설치 — 룰 · 훅 · 에이전트 · 스택에 맞는 스킬 | 위에서 설명한 위저드 사용 |
| 이 저장소에서 제공하는 특정 스킬 하나만 설치 | `npx skills add uzysjung/uzys-agent-harness --skill <id> -a claude-code` |

이 저장소에서 제공하는 스킬은 [skills CLI](https://github.com/vercel-labs/skills) 를 사용해 하나씩 설치할 수도 있다 — 위저드가 복사하는 파일과 똑같은 파일이며, `references/` 폴더의 참고 자료도 함께 다운로드된다. `npx skills add uzysjung/uzys-agent-harness --list` 명령을 실행하면 스킬 id 목록을 볼 수 있다([자세한 설명](docs/USAGE.md#one-skill-without-the-harness)). [skills.sh/uzysjung/uzys-agent-harness](https://skills.sh/uzysjung/uzys-agent-harness) 에도 배포되어 있다.

## 왜 이렇게 만들었나

AI 코딩 도구에 룰과 스킬을 무작정 늘린다고 해서 결과가 좋아지지는 않는다. 항상 읽어 들여야 하는 지시문은 매 세션마다 불필요하게 컨텍스트 용량을 차지하며, 이미 잘 알고 있는 내용을 똑똑한 모델에게 다시 가르치면 오히려 작업 속도만 느려진다. 그래서 하네스는 모델이 실수하기 쉬운 지점에만 원칙을 세우고, 모델의 성능이 개선되면 그 원칙마저 다시 덜어내는 방식을 취한다.

| 흔한 방식 | 이 하네스 |
|---|---|
| "X 하지 마라" · "항상 Y 하라" 같은 룰을 많이 둔다 | 지침은 *최종 결과가 어때야 하는지(무엇이 참이어야 하는가)*만 알려주고 *어떻게* 달성할지는 모델에게 맡긴다. 우리 룰 44문장 중에서 에이전트의 행동을 바꾼 것이 관측된 문장은 0개였다 — 사고를 잡은 것은 안전장치(게이트), 테스트 코드, 그리고 독립적인 검증자였다 |
| 금지 사항을 문장으로 길게 적는다 | 되돌릴 수 없는 치명적인 실수는 시스템 장치로 막는다: 훅이 `.env` 파일이나 인증 키 파일 편집을 차단하고, 하네스가 적용을 돕는 GitHub 룰셋이 기본 브랜치를 안전하게 보호한다 |
| 설정과 자산이 계속 쌓이기만 한다 | "이것이 없으면 에이전트가 느려지거나 실수한다"는 관측이 있는 자산만 남겨둔다. 그렇지 않은 자산은 필요할 때만 불러오는 스킬로 강등되거나 완전히 삭제된다 — 그렇기 때문에 `update` 는 새로 더한 것과 *뺀 것*을 함께 가져온다 |
| 프로젝트에 맞는지 설치할 때 한 번만 확인한다 | `audit-harness-fit` 스킬이 프로젝트 상태를 계속 점검한다: 불필요한 질문, 반복되는 검사, 서로 모순되는 결정, 더 똑똑해진 모델에게는 필요 없어진 절차를 찾아내서 개선안을 제시한다 |
| 코드를 작성할 때마다 매번 꼼꼼히 검증한다 | 사용자에게 보여줄 화면이나 기능이 완성되었을 때, 코드를 직접 작성하지 않은 별도의 에이전트가 코드를 실행하고 테스트해 본다 — 무작정 보호 장치를 늘리는 대신, 핵심을 확실하게 지킬 수 있는 가장 가벼운 방법을 선택한다 |
| 파일 이름이나 함수 단위로 설명을 적는다 | 에이전트가 *내 서비스를 사용할 사용자*의 관점에서 먼저 설명한다(`user-centered-explanation`). 사용자의 승인이 필요한 작업이라면 상황 설명(맥락) → 직면한 문제 → 가능한 선택지 → 에이전트의 추천 순서로 보고한다 |

어떤 자산을 추가할지 혹은 제거할지 결정할 때 던지는 첫 질문은 하나다 — *이 자산이 AI 코딩 도구를 활용해 개발을 더 잘할 수 있도록 돕는가?* 자세한 철학은 [docs/NORTH_STAR.md](docs/NORTH_STAR.md) 에서 확인할 수 있다.

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
