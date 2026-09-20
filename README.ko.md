# uzys-agent-harness

AI 코딩 도구에 꼭 필요한 룰·훅·스킬만 남기고 나머지는 걷어낸다. 위저드 한 번으로 내 스택에 맞게 검증된 묶음을 Claude Code · Codex · OpenCode · Antigravity 에 프로젝트 범위로 설치한다.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/tags)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

![agent-harness 데모 — 검증된 AI 코딩 스킬·플러그인 원커맨드 설치](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

🇺🇸 [English](./README.md)

---

## 설치

Node 20 이상이 필요하다. Claude Code 플러그인을 쓸 거라면 `claude` 명령이 PATH 에 있어야 한다 — 없으면 플러그인 설치는 경고만 남기고 건너뛴다.

```bash
npx -y @uzysjung/agent-harness
```

위저드가 6단계로 안내한다:

```
1/6  Tracks          무엇을 만드는지 고른다
2/6  CLI             claude / codex / opencode / antigravity — 여러 개 가능
3/6  Install items   트랙에 맞는 항목이 미리 체크되어 있다. 원치 않는 것은 해제
4/6  Scope           Project(기본값) 또는 Global
5/6  Confirm         요약과 함께, 이 선택이 매 세션에 얹는 컨텍스트 크기를 보여 준다
6/6  Installing
```

설치가 끝나면 프로젝트에서 CLI 를 연다 — 룰과 스킬, 그리고 Claude Code 에서는 훅까지 바로 적용된다:

```bash
claude    # 또는 codex / opencode / agy
```

**첫 세션에서 할 일.** 설치가 끝나면 *내 프로젝트* 이야기를 채울 빈칸이 있는 `CLAUDE.md`(또는 `AGENTS.md`)가 생긴다. 에이전트에게 `audit-harness-fit` 스킬을 한 번 돌리라고 하면 저장소를 읽고 그 빈칸을 근거로 채운다. 그 뒤로는 하네스가 이 프로젝트에 아직 맞는지 점검할 때 같은 스킬을 쓴다. "내 스택을 인터뷰해 주는" 단계는 따로 없다 — 스택은 1단계에서 이미 골랐고, 나머지는 이 스킬이 코드를 읽어 채운다.

위저드는 터미널이 필요하다. CI·컨테이너·온보딩 스크립트에서는 플래그 형식을 쓴다. 필수 플래그는 `install --track <name>` 하나다 — [비대화형 설치](docs/USAGE.md#non-interactive-install) 참고.

### 설치 경로는 둘이다

| 원하는 것 | 방법 |
|---|---|
| 하네스 전체 — 룰·훅·에이전트와 내 스택에 맞는 스킬을 트랙 단위로 | 위의 위저드 |
| 스킬 하나만 — 하네스도 트랙도 없이 | `npx skills add uzysjung/uzys-agent-harness --skill <id> -a claude-code` |

이 저장소가 배포하는 모든 스킬은 [skills CLI](https://github.com/vercel-labs/skills) 로 하나씩 받을 수 있다. `npx skills add uzysjung/uzys-agent-harness --list` 로 id 목록을 본다. 설치 프로그램이 복사하는 것과 같은 파일(`references/` 포함)을 받고, 같은 명령을 다시 돌리면 갱신된다([자세히](docs/USAGE.md#one-skill-without-the-harness)). [skills.sh/uzysjung/uzys-agent-harness](https://skills.sh/uzysjung/uzys-agent-harness) 에도 올라가 있다.

## 철학 — 필요한 틀만 남겨 AI 의 개발 생산성을 높인다

AI 코딩 도구에 룰과 스킬을 쌓을수록 좋아지는 게 아니다. 항상 읽히는 지시문은 전부 매 세션의 비용이고, 최신 모델이 이미 잘하는 일을 지시하면 속도만 깎인다. 이 하네스는 반대 방향에서 출발한다 — **모델이 실수할 것 같은 곳에만 원칙을 두고, 모델이 좋아지면 그것도 걷어낸다.**

- **"하지 마라 · 반드시 해라"는 최신 모델의 성능을 깎는다.** 금지문과 의무문이 쌓인 지시문은 모델이 판단할 자리를 없앤다. 상황이 지시문과 조금만 달라도 모델은 멈칫하거나 엉뚱하게 우회하고, 가드가 가드를 검사하기 시작하면 개발은 느려지는데 품질은 그대로다. 그래서 이 하네스는 지시를 "무엇이 참이어야 하는가"(완료 조건 · 불변식 · 경계)로 쓰고 "어떻게"는 모델에게 맡긴다. 금지문은 되돌릴 수 없는 손상 — 시크릿과 공유 이력 — 에만 남기고, 그것조차 문장이 아니라 장치가 막는다. `.env` 와 키 파일 편집은 훅이 막고, 기본 브랜치는 하네스가 적용을 도와주는 GitHub 룰셋이 지킨다. 이 방향은 취향이 아니라 실측에서 나왔다. 우리 룰 44문장 가운데 에이전트의 행동을 바꿨다고 관측된 것은 0건이었고, 사고를 실제로 잡은 것은 게이트·테스트·독립 리뷰어였다.

- **모델이 발전하면 스킬도 같이 개선된다.** 자산은 "이게 없으면 에이전트가 실제로 더 느리거나 더 틀린다"는 관측이 있을 때만 남는다. 근거가 없는 지시문은 상시 지시에서 빠져, 필요할 때만 불러오는 스킬이 되거나 아예 없어진다. 그래서 `update` 는 단순히 더 많은 것이 아니라 지금의 판단 — 무엇이 더해지고 무엇이 빠졌는가 — 을 가져온다.

- **`audit-harness-fit` 으로 계속 점검한다.** 설치 직후 한 번 돌리면 저장소를 읽어 프로젝트 맥락을 채운다. 나중에 돌리면 불필요한 질문, 반복되는 검사, 서로 모순되는 결정, 더 좋아진 모델에게는 필요 없는 절차를 찾아 수정안을 낸다. 하네스가 내 프로젝트에 맞는지는 설치할 때 정하는 게 아니라 쓰는 내내 묻는 질문이다.

- **속도와 품질은 맞바꾸는 게 아니다.** 되돌릴 수 없는 손상은 훅이 막고, 반복되는 실수는 짧은 룰이 잡고, 나머지는 모델에게 맡긴다. 검증은 "매번 전부"가 아니다 — 사용자에게 보이는 장면 하나가 완성될 때, 코드를 쓰지 않은 다른 에이전트가 실제로 실행해 본다. 목표는 가드를 늘리는 게 아니라 중요한 것을 가장 가볍게 지키는 방법이다.

- **만드는 서비스의 고객 관점에서 생각하고 설명한다.** 에이전트는 문제·변경·선택지를 파일명과 함수가 아니라 "사용자가 무엇을 하고 무엇을 보게 되는가"로 먼저 말한다(`user-centered-explanation`). 승인이 필요한 순간은 맥락 → 문제 → 선택지 → 추천 순서로 정리되어, 앞의 대화를 다시 읽지 않아도 결정할 수 있다.

이 다섯이 방향이고, 자산을 넣고 뺄 때의 첫 질문은 하나다 — **이게 사람이 AI 코딩 도구로 개발을 더 잘하게 만드는가.** 전문은 [docs/NORTH_STAR.md](docs/NORTH_STAR.md).

## 무엇을 얻는가

- **룰** — git 정책 · 변경 관리 · 문서 · 테스트 · 출하 · CLI 개발에 관한 짧은 파일 6개. 개발 트랙은 5개, `tooling` 과 `full` 은 여섯째까지, 비즈니스 트랙은 어느 프로젝트에나 해당하는 3개를 받는다.
- **훅** — Claude Code 에 2개. 하나는 세션 시작 때 스펙과 변경 이력을 읽어 오고, 하나는 `.env` · lock 파일 · 인증서 편집을 막는다. 이 둘째 훅이 하네스에서 유일하게 "안 된다"고 말하는 것이고, 막을 때마다 로그에 한 줄을 남긴다. Codex 는 세션 시작 훅만 받는다 — Codex 의 훅 API 는 파일 편집을 가로채지 못한다.
- **스킬** — 이 리포에서 직접 쓰고 관리하는 방법론 스킬과, 트랙이 부르는 스택 스킬. 4종은 모든 트랙에 포함된다(`north-star` · `objective-brief` · `gh-issue-workflow` · `audit-harness-fit`). 개발 트랙은 방법론 스킬 5종과 사고 대응 런북 하나를 더 받고, 스택이 있는 트랙에는 `find-skills` · `frontend-design` 과 스택별 스킬(예: `csr-supabase` 면 React · shadcn · Supabase · Postgres)이 설치된다. 번들 스킬 13종은 `--with` / `--without` 으로 이름을 지정할 수 있다.
- **에이전트** — 모든 트랙에 독립 `reviewer`, 개발 트랙에 `implementer`, `data-analyst` 와 `strategist` 는 그것을 쓰는 트랙에만.
- **작업 원칙 앵커** — CLI 가 매 세션 읽는 파일 하나. 내 `CLAUDE.md` 는 내 것으로 남고, 하네스는 import 한 줄만 얹고 나머지는 건드리지 않는다. 어느 파일이 누구 것인지: [docs/CONTEXT-FILES.md](docs/CONTEXT-FILES.md).

CLI 별로 도달하는 것:

| CLI | 룰 | 스킬 | 훅 | 플러그인 |
|---|---|---|---|---|
| Claude Code | ✓ | ✓ | ✓ | ✓ |
| Codex | ✓ (`AGENTS.md` 안에) | ✓ | 세션 시작만 | — |
| OpenCode | ✓ (`AGENTS.md` 안에) | ✓ | — | — |
| Antigravity | ✓ | ✓ | — | — |

플러그인은 Claude Code 자체 메커니즘이라 Claude 전용이다. 스킬과 룰은 같은 원본에서 네 CLI 에 맞게 변환되므로 서로 어긋날 일이 없다.

## 트랙

무엇을 만드느냐에 따라 12개 트랙으로 나눈다:

- **스택 미정** — `base`: 원칙 · 방법론 스킬 · 테스트 룰만, 스택 전용 자산 없음
- **프론트엔드 + 백엔드** — `csr-supabase` · `csr-fastify` · `csr-fastapi` · `ssr-nextjs` · `ssr-htmx`
- **데이터** — `data`
- **비즈니스** — `executive` · `project-management` · `growth-marketing`
- **메타** — `tooling`: 앱 스택 없는 Bash · Markdown 프로젝트
- **전체** — `full`

트랙은 출발점이지 고정이 아니다. 미리 체크된 것은 3단계에서 전부 해제할 수 있고, 트랙을 여러 개 골라도 된다. [각 트랙이 무엇을 설치하는지 →](docs/TRACKS.md)

## 일상 명령

```bash
npx -y @uzysjung/agent-harness list        # 이 프로젝트에 무엇이 깔렸나
npx -y @uzysjung/agent-harness update      # 현재 릴리즈로 갱신
npx -y @uzysjung/agent-harness uninstall   # 골라서 제거하거나 전부 제거
```

`update` 는 하네스가 설치한 파일을 갱신하고, 새 릴리즈에 추가된 스킬을 함께 설치하며, 재설치가 필요한 것(새 훅)은 그렇다고 알려 준다. 고르지 않은 CLI 를 설치하는 일은 없다. `update --only skills` 처럼 한 묶음만 갱신할 수 있다. `uninstall` 은 터미널에서 항목별로 묻고, `--dry-run` 으로 계획만 먼저 볼 수 있다.

**기존 프로젝트에도 안전하다.** 내가 고친 파일을 교체하기 전에 옆에 타임스탬프 백업을 만들고 경로를 출력한다. 내가 쓰거나 고친 것은 백업 없이 지우지 않는다. 기존 `.mcp.json` 서버는 교체가 아니라 병합된다. 자세한 내용: [기존 프로젝트에 설치하기](docs/USAGE.md#installing-into-an-existing-project).

**기본값은 프로젝트 범위다.** 4단계에서 Global 을 고르지 않는 한 `~/.codex/` · `~/.opencode/` · `~/.gemini/` · 전역 npm 에는 아무것도 쓰지 않는다. 예외는 Claude Code 플러그인 하나다 — `claude` CLI 는 어느 범위에서든 플러그인 캐시를 `~/.claude/plugins/` 아래 두고 프로젝트는 메타데이터로 구분한다. `.claude/` 밖에는 `.mcp.json`, `.gitignore` 몇 줄(그 파일이 있을 때), Supabase 트랙이면 `.env.example`, 그리고 설치 기록 `.uzys-agent-harness/` 를 쓴다 — 전체 목록은 [하네스가 쓰는 파일](docs/USAGE.md#what-the-harness-writes).

## 검증

외부 자산은 GitHub star 1,000개 이상, 보관(archived) 처리되지 않음, 설치 명령을 격리 환경에서 실제로 실행해 확인함 — 이 셋을 만족할 때 **vetted** 다. 매월 CI 두 개가 star 와 설치 경로를 다시 검사한다. vetted 는 라인 단위 보안 감사가 **아니고**, 자산 내용의 prompt injection 스캔도 하지 않는다. npm · npx 자산은 버전을 고정하고, plugin · skill 자산은 upstream HEAD 를 따른다.

3단계에서 `★ official` 은 Anthropic 공식 마켓플레이스와 이 하네스 자체 자산, `⚠ experimental` 은 star 1,000 미만 자산이다 — 미리 체크되지 않으며 직접 골라야만 설치된다. vetted 자산은 배지가 없다. 등급은 정보를 줄 뿐 설치를 막지 않는다. 설치한 자산은 다른 서드파티 의존성과 똑같이 다룬다: [SECURITY.md](SECURITY.md).

## 문서

- [사용 가이드](docs/USAGE.md) — 설치 플래그 · 범위 · update · uninstall · CLI 별 상세 · 어디에 무엇을 쓰는가
- [트랙](docs/TRACKS.md) — 트랙별로 미리 체크되는 것
- [호환성 매트릭스](docs/COMPATIBILITY.md) — 자산 전체의 설치 방식 · 지원 CLI · 검증 방법
- [어느 파일이 누구 것인가](docs/CONTEXT-FILES.md) — `CLAUDE.md` · 앵커 · `AGENTS.md` 와 나머지 컨텍스트 파일
- [워크플로 가이드](docs/WORKFLOWS.md) — 선택 설치 워크플로 비교와, 그게 필요 없는 경우
- [보안](SECURITY.md) — 검증이 보장하는 것과 아닌 것, 제보 방법
- [북극성](docs/NORTH_STAR.md) · [결정 기록](docs/decisions/) — 하네스가 왜 이런 모양인가

## License

MIT.
