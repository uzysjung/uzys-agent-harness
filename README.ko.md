# uzys-agent-harness

검증된 AI 코딩 스킬·플러그인·룰·훅을 Claude Code, Codex, OpenCode, Antigravity 에 설치한다 — 대화형 위저드 한 번, 프로젝트 범위로.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/releases)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

![agent-harness 데모 — 검증된 AI 코딩 스킬·플러그인 원커맨드 설치](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

🇺🇸 [English](./README.md)

---

## 설치

```bash
npx -y @uzysjung/agent-harness
```

위저드가 6단계로 안내한다:

```
1/6  Tracks          스택 선택
2/6  CLI             claude / codex / opencode / antigravity
3/6  Install items   미리 체크된 추천 항목 검토
4/6  Scope           Project (기본값) 또는 Global
5/6  Confirm
6/6  Installing
```

설치가 끝나면 CLI 를 실행한다 — 스킬·룰·훅이 활성 상태다:

```bash
claude    # 또는 codex / opencode / agy
```

**기본값은 project scope 다.** 4단계에서 Global 을 고르지 않는 한 `~/.claude/`, `~/.codex/`, `~/.opencode/`, `~/.gemini/`, 글로벌 npm 에는 아무것도 쓰지 않는다.

**기존 프로젝트에도 안전하다.** 내용이 다른 편집 가능 파일을 교체하기 전에 타임스탬프 백업을 옆에 만들고, 모든 백업 경로를 설치 요약에 출력한다. 삭제하는 것은 없다.

위저드는 TTY 가 필요하다. CI·컨테이너·온보딩 스크립트용 flag 모드는 [사용 가이드](docs/USAGE.md#non-interactive-install)를 참고한다.

무엇을 설치했는지 기록으로 남는다. 그래서 나중에 확인하고 되돌릴 수 있다:

```bash
npx -y @uzysjung/agent-harness list                    # 이 프로젝트에 깔린 것
npx -y @uzysjung/agent-harness uninstall --only <id>   # 하나만 제거, --only 를 빼면 전부
```

uninstall 은 안전하게 되돌릴 수 있는 것만 되돌리고 나머지는 *출력한다* — 글로벌 자산, 훅 등록,
`.mcp.json` 같은 `.claude/` 밖 파일. 사용자 내용이 섞인 파일을 기계적으로 고치지 않는다.
자세한 내용은 [uninstall](docs/USAGE.md#uninstall-v26640) 참고.

## 왜

코딩 에이전트의 기능은 계속 고도화되고 있다. 하지만 한 번 설치한 skill 과 MCP 는 실제 사용 여부와 상관없이 매 세션 context window 를 차지한다. awesome-list 에 수백 개의 선택지가 있어도 내 기술 스택에 어떤 항목이 맞는지까지는 알려주지 않는다. 결국 모든 항목을 설치해 매 세션 불필요한 비용을 치르거나, 프로젝트를 시작할 때마다 직접 목록을 읽고 골라야 한다.

이 도구는 스택에서 출발한다. 원하는 track 을 고르면 해당 track 이 필요로 하는 자산이 미리 체크된다. 사용자는 설치를 진행하기 전에 선택된 자산을 검토하고 필요 없는 항목을 해제할 수 있다.

## 무엇을 얻는가

- **스택 기반 큐레이션.** 검증된 옵션 가운데 해당 프로젝트에 실제 필요한 자산만 선택적으로 설치한다. `csr-supabase` 를 고르면 React, shadcn, Supabase, Postgres 자산만 미리 체크되며, 나머지 60여 개 항목은 제외된다.

- **규율 레이어.** 실제 프로덕션 프로젝트를 에이전트로 운영하면서 추출한 룰과 훅, CI 스캐폴드로 구성된다. 문서 거버넌스, 검증 게이트, 벤치마크 패리티 루프, 재발 방지 체계를 포함한다. 이 레이어 덕분에 단순한 skill 모음이 아니라 하네스가 된다.

- **4개 CLI, 하나의 어휘.** Claude Code 는 1급 지원 대상으로 모든 자산, 훅, plugin 을 제공받는다. Codex, OpenCode, Antigravity 는 skill 과 rule 레이어를 지원받는다. 프로젝트가 특정 CLI 에 묶이지 않는다.

## 검증

자산이 vetted 등급을 받으려면 GitHub star 1,000개 이상, 활성 유지보수 상태, 격리된 Docker 컨테이너 내 실설치 검증 통과라는 세 가지 조건을 모두 충족해야 한다. CI cron 이 매월 이 세 가지 기준을 다시 검사한다.

vetted 등급이 라인 단위의 보안 감사나 자산 내용에 대한 prompt-injection 스캔을 의미하지는 않는다. npm 과 npx 자산은 버전이 고정되지만, plugin 과 skill 자산은 upstream HEAD 로 해석되어 아직 commit 고정이 이루어지지 않는다. 따라서 설치하는 모든 자산은 일반적인 서드파티 의존성과 동일하게 취급해야 한다 — [SECURITY.md](SECURITY.md) 참고.

모든 자산에는 3단계 중 하나의 등급 배지가 부여된다. Anthropic 공식 마켓플레이스와 하네스 자체 자산은 **★ official**, 검증을 통과한 자산은 **vetted**, GitHub star 1,000개 미만으로 opt-in 이 필요한 자산은 **⚠ experimental** 로 분류된다. 이 등급은 정보 제공을 위한 구분이며 자산 설치를 차단하지는 않는다.

## Tracks

만드는 것에 따라 11개 track 으로 나뉜다:

- **프론트엔드 + 백엔드** — `csr-supabase` · `csr-fastify` · `csr-fastapi` · `ssr-nextjs` · `ssr-htmx`
- **데이터** — `data`
- **비즈니스** — `executive` · `project-management` · `growth-marketing`
- **메타** — `tooling` (앱 스택 없는 Bash·Markdown 프로젝트)
- **전체** — `full`

### [각 track 이 무엇을 설치하는지 보기 →](docs/TRACKS.md)

## 문서

### [사용 가이드 →](docs/USAGE.md)

워크플로 상세, 설치 내부 동작, uninstall, scope, CI flag, CLI 별 설정.

### [호환성 매트릭스 →](docs/COMPATIBILITY.md)

자산별 설치 방식과 검증 상태.

### [트랙 목록 →](docs/TRACKS.md)

각 track 이 미리 체크하는 자산 전체.

### [보안 안내 →](SECURITY.md)

검증이 보장하는 것과 보장하지 않는 것, 그리고 제보 방법.

설치 가능한 워크플로 비교는 [docs/WORKFLOWS.md](docs/WORKFLOWS.md), 설계 원칙은 [docs/NORTH_STAR.md](docs/NORTH_STAR.md), 아키텍처 결정은 [docs/decisions/](docs/decisions/) 에 있다.

## License

MIT.
