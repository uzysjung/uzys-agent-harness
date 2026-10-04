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

Node 20.12 이상이 필요하다. 프로젝트 폴더에서 다음 명령을 실행한다:

```bash
npx -y @uzysjung/agent-harness
```

위저드가 다음 다섯 단계를 안내한다:

```
1/5  Tracks          무엇을 만드는지(스택) — 항목을 미리 체크해 줄 뿐이다
2/5  CLI             claude / codex / opencode / antigravity — 여러 개 가능
3/5  Install items   트랙에 맞는 항목이 미리 체크되어 있다. 원치 않는 것은 해제
4/5  Confirm         요약과 함께, 이 선택이 매 세션에 얹는 컨텍스트 크기를 보여 준다
5/5  Installing
```

그다음 같은 폴더에서 AI 코딩 도구를 실행하면, 첫 세션부터 룰과 스킬이 바로 적용된다:

```bash
claude    # 또는 codex / opencode / agy
```

**처음 할 일.** 설치가 끝나면 *내 프로젝트*에 대한 정보를 채울 수 있는 빈칸이 포함된 `CLAUDE.md`(또는 `AGENTS.md`) 파일이 생긴다. 에이전트에게 `audit-harness-fit` 스킬을 한 번 실행해 달라고 요청하면, 에이전트가 저장소를 분석해 코드에 기반한 내용으로 빈칸을 채워 준다. 나중에 이 스킬을 다시 실행하면 현재 프로젝트 상황에 하네스가 여전히 잘 맞는지 점검해 준다.

위저드를 띄울 수 없는 환경(CI · 컨테이너 · 스크립트 등)이라면 플래그를 사용해 설치할 수 있다. 필수 플래그는 `install --track <name>` 하나뿐이다 — [비대화형 설치](docs/USAGE.md#non-interactive-install). Claude Code 플러그인을 설치하려면 시스템 PATH 에 `claude` 명령이 있어야 한다. 만약 없다면 경고 메시지만 남기고 플러그인 설치를 건너뛴다.

## 왜 uzys-agent-harness 인가

**북극성: AI 코딩 도구로 더 잘 만들게 돕는 틀만 남긴다.** 에이전트에게는 방향, 완료 기준, 넘을 수 없는 경계를 준다. 어떻게 할지 이미 스스로 결정할 수 있는 일에 대본을 주지 않는다. 상주하는 지시는 매 세션 컨텍스트를 차지하므로, 각 지시는 제 몫을 증명해야 한다. 여기서 네 가지 신념이 따른다. 각 신념 아래에는 이를 어떻게 구현했는지 적었다.

**1. 모델이 나아지면 하네스도 같이 나아져야 한다 — 대개는 덜 요구하는 쪽으로.** 예전 모델의 약점을 때우려 쓴 지시는 낡게 마련이다. 반드시 달성해야 할 결과를 명시하고 방법은 모델에 맡기며, 모델이 바뀌면 무엇이 상주하는지 다시 잰다.
*여기서는:* 그 지시가 없으면 에이전트가 더 느리거나 틀린다는 관찰 결과가 있을 때만 상주시킨다. 그렇지 않으면 필요할 때만 읽는 스킬로 내리거나 은퇴시킨다. `audit-harness-fit`은 프로젝트에서 불필요한 질문, 거듭된 확인, 엇갈리는 결정, 더 나은 모델은 이제 쓰지 않는 절차를 찾아내고 수정안을 제안한다.

**2. 에이전트에게 필요한 것은 매 걸음의 프롬프트가 아니라 목적지와 가드레일이다.** 프롬프트는 다음에 무엇을 할지 말하고, 북극성은 프롬프트가 침묵할 때 어느 쪽으로 갈지 말한다. 방향, 완료 기준, 경계가 정해지면 에이전트는 시도하고, 기준에 비춰 확인하고, 조정하는 루프 안에서 일하며 오직 사용자의 몫인 결정만 가져온다.
*여기서는:* 모든 트랙에 세 가지 스킬을 둔다. `north-star`(방향, 할 일과 안 할 일, 결정 게이트), `objective-brief`(위임하거나 여러 단계인 작업의 불변 조건, 성공 기준, 경계), `gh-issue-workflow`(이슈 백로그, 채팅 밖에서도 결정을 남김). Claude Code 와 Codex 에서는 세션 시작 훅이 스펙과 변경 기록을 불러온다. 가드레일은 적고 기계적이다. Claude Code 에서는 훅이 `.env`, lock 파일, 인증서 수정을 막는다. 함께 설치되는 스크립트를 한 번 실행하면 기본 브랜치에 GitHub 룰셋이 걸린다. 앵커(CLI 가 매 세션 읽는 원칙 파일)는 파괴적이거나 권한이 필요한 작업, 배포, 공유 상태 쓰기에 사용자의 승인을 요구한다. 이 선 안에서는 에이전트가 결정한다. 사용자가 필요할 때는 `user-centered-explanation`(개발 트랙)이 맥락 → 문제 → 선택지 → 추천 순서로 가져온다.

**3. 상주하는 컨텍스트는 예산이다 — 그래서 하네스는 스스로를 계속 정리한다.** 몸집만 불리는 하네스는 돕고자 했던 에이전트를 도리어 느리게 한다. 어제 유용했던 우회책이 내일의 영구 지시로 남게 두지 않는다.
*여기서는:* 위저드 4단계는 확인을 누르기 전 선택한 항목이 세션당 컨텍스트를 얼마나 늘리는지 보여준다. `update`는 하네스가 설치한 것을 갱신하고, 새 릴리즈에 더해진 것을 넣으며, 릴리즈가 은퇴시킨 룰과 훅을 걷는다. 디스크에 남은 은퇴 스킬과 에이전트는 지우지 않고 이름을 알린다.

**4. 다양한 관점과 서로 다른 에이전트가 속도 · 비용 · 품질의 더 나은 균형을 만든다.** 무언가를 만든 에이전트가 그것을 심사해서는 안 되며, 대형 모델은 실수의 대가가 클 때만 제값을 한다.
*여기서는:* 하나의 소스에서 Claude Code, Codex, OpenCode, Antigravity 용 룰과 스킬을 렌더링하므로, 도구를 바꿔도 어휘가 유지된다. `implementer`(개발 트랙)가 만들고 `reviewer`가 검증한다. 사용자 대면 씬이 끝나면, 코드를 짜지 않은 에이전트가 이를 실행하고 판정한다. `multi-persona-review`(개발 트랙)는 하나의 산출물을 여러 사용자의 시선에서 병렬로 비평한다. 옵트인: `model-orchestration`(어떤 모델, 얼마나 많은 추론, 언제 위임할지 — `--with model-orchestration`) 및 `external-model-consult`(Claude 가 아닌 두 번째 의견이나 한국어 표현 다듬기. 해당 제공자의 CLI 필요 — `--with external-model-consult`).

### 대안과의 비교

| 이렇게 하려 했다면… | 여기서는 이렇게 다르다 |
|---|---|
| 직접 `CLAUDE.md`나 `AGENTS.md`를 쓴다 | 그대로 쓴다 — 하네스는 표시된 블록 하나만 추가하며 나머지는 건드리지 않는다. 하네스는 파일 하나만으로는 강제하거나 관리할 수 없는 것들을 그 밖에서 묶어준다. 실제로 작업을 막는 훅, 코드를 짠 에이전트와 분리된 `reviewer`, 그리고 `update`와 `uninstall`이 오직 하네스가 둔 것만 만지게 하는 설치 기록이다. |
| 마켓플레이스에서 스킬을 고른다 | 스킬 하나면 족하다면 그것만 챙기면 된다. 여기 있는 각 스킬은 `npx skills add`로 하나씩 설치된다. 위저드는 스킬 목록만으로는 채울 수 없는 상주 룰, 훅, 에이전트, 그리고 릴리즈가 바뀌어도 이들을 최신으로 유지하는 기록을 둔다. |
| 룰이 많은 하네스를 쓴다 | 상주 지시가 적고, 4단계에서 확인 전 세션당 비용을 보여준다. 실제로 막는 것은 `.env`, lock 파일, 인증서에 걸린 훅(Claude Code)과 브랜치 룰셋뿐이다. 나머지는 앵커의 승인 경계 안에서 에이전트가 판단할 몫이다. 정해진 프로세스가 필요하다면 `openspec`이나 `bmad-method`를 더한다. 둘 다 옵트인이며 [WORKFLOWS.md](docs/WORKFLOWS.md)에 비교해 두었다. |

### 근거

지금까지 잰 수치는 이 저장소에서 나왔다. 하네스 스스로의 도그푸드이자 유일한 측정 표본이다. 지난 감사에서 우리 룰의 44개 문장 중 어느 것도 에이전트의 행동을 바꾼 흔적이 없었다. 기록된 사고들은 게이트, 테스트, 독립적인 리뷰어가 잡아냈다. 돌이킬 수 없는 손상에 대한 방어는 문장이 아니라 훅과 룰셋에 산다. 같은 감사에서 관찰 근거가 없는 스킬 4개와 에이전트 3개를 은퇴시켰다([ADR-090](docs/decisions/ADR-090-retire-unobserved-assets-and-demote-domain-agents.md)). 이는 여러 프로젝트를 가로지르는 벤치마크가 아니라 도그푸드 근거로 읽어야 한다. 다른 프로젝트에서도 개발이 빨라지고 모델 비용이 줄며 결과가 더 낫다는 것을 아직 보여주지는 않는다.

[모델이 바뀌면 옛 모델을 메우던 지시를 다시 잰다](https://dyld.kr/blog/astra-trim-agent-instructions) · [북극성 · 완료 기준 · 가드레일](https://dyld.kr/blog/north-star-for-autonomous-ai-coding) · [Prompt 에서 Loop, Graph 까지](https://dyld.kr/blog/from-prompt-to-loop-and-graph) — 방향의 전문은 [docs/NORTH_STAR.md](docs/NORTH_STAR.md).

## 무엇이 들어 있나

| 구성 | 무엇인가 | 에이전트가 언제 읽나 |
|---|---|---|
| **룰** | 짧은 파일 6개: git 정책 · 변경 관리 · 문서 · 테스트 · 배포 · CLI 개발. 개발 트랙은 5개를, `tooling` · `full` 은 6개 모두를, 비즈니스 트랙은 어느 프로젝트에나 맞는 3개를 받는다 | 매 세션 |
| **훅** | CLI 가 스스로 실행하는 스크립트. Claude Code 에는 2개가 들어간다: 하나는 세션을 시작할 때 스펙과 변경 기록을 불러오고, 다른 하나는 `.env` · lock 파일 · 인증서 편집을 막는다 — 하네스에서 "안 된다"고 제한하는 유일한 장치이며, 편집을 막을 때마다 로그를 한 줄 남긴다 | 자동으로 — 세션을 시작할 때, 편집하기 직전에 |
| **스킬** | 작업에 필요할 때 에이전트가 열어보는 단계별 절차서. 이 저장소에서 관리하는 방법론 스킬과 트랙에 필요한 기술 스택 스킬이 들어 있다(예: `csr-supabase` 의 React · shadcn · Supabase · Postgres) | 필요할 때만 — 한 줄짜리 설명만 항상 띄워 두고, 본문은 사용할 때만 읽는다 |
| **에이전트** | 메인 에이전트가 작업을 맡기는 조수. 모든 트랙에 독립 검증자 `reviewer` 가 있고, 개발 트랙에는 `implementer` 가 있으며, 그것을 쓰는 트랙에만 `data-analyst` · `strategist` 가 들어간다 | 메인 에이전트가 작업을 위임할 때 |
| **앵커** | CLI 가 매 세션마다 읽는 작업 원칙 파일. 원래 있던 내 `CLAUDE.md` 파일은 그대로 유지된다 — 하네스는 표식으로 감싼 import 블록(`@CLAUDE-uzys-harness.md` 참조와 그 아래 스킬 안내)만 추가할 뿐 나머지는 건드리지 않는다([어느 파일이 누구 것인가](docs/CONTEXT-FILES.md)) | 매 세션 |

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

`update` 명령은 하네스가 설치한 파일을 최신으로 갱신하고, 새 버전에 더해진 것을 설치하며, 사라진 하네스 몫(훅 스크립트, `.mcp.json` 서버, `AGENTS.md` 의 하네스 절 등)을 되돌린다 — `--without` 으로 뺀 것은 빠진 채로 둔다. 선택하지 않은 CLI 는 새로 설치하지 않는다 — CLI 환경은 설치할 때만 추가되고 `uninstall` 로만 지울 수 있다. `update --only skills` 처럼 특정 묶음만 업데이트할 수도 있다.

`uninstall` 은 터미널에서 CLI 하나 · 고른 자산 · 전부 셋 중에서 고르게 하고, `--dry-run` 으로 계획만 먼저 볼 수 있다. `.claude/` · `.codex/` · `.opencode/` 는 지우지 않고 `<dir>.backup-<ts>` 로 옮기므로, 거기 직접 둔 파일은 백업에 남는다.

**기존 프로젝트에 적용해도 안전하다.** 내가 직접 수정한 파일을 교체해야 할 때는 타임스탬프를 붙여 백업본을 남기고 그 경로를 알려 준다. 내가 작성하거나 수정한 파일은 백업 없이 지우지 않으며, 기존에 있던 `.mcp.json` 서버 설정은 덮어쓰지 않고 내용을 병합한다([기존 프로젝트에 설치하기](docs/USAGE.md#installing-into-an-existing-project)).

**현재 프로젝트에만 설치된다.** `~/.opencode/` · `~/.gemini/` 디렉터리나 전역 npm 환경에는 아무것도 설치하지 않는다. 프로젝트 밖에 쓰는 옵트인 예외는 둘뿐이다 — Claude Code 플러그인(`claude` CLI 가 플러그인 캐시를 `~/.claude/plugins/` 에 저장하며 프로젝트는 메타데이터로 구분), 그리고 `--with-codex-trust`(Codex 가 프로젝트 설정을 읽도록 `~/.codex/config.toml` 에 `[projects]` trust 항목 하나 추가 — [자세히](docs/USAGE.md#scope)). `.claude/` 디렉터리 밖에는 `CLAUDE.md`/`AGENTS.md` 스캐폴드와 하네스 앵커, `.mcp.json`, `.gitignore` 파일에 추가하는 몇 줄(파일이 이미 있을 때), `csr-supabase`(및 `full`) 트랙의 `.env.example`, `--with ci-scaffold` 를 줬을 때만 `.github/workflows/`, 그리고 설치 기록을 남기는 `.uzys-agent-harness/` 디렉터리를 생성한다 — [전체 설치 목록 보기](docs/USAGE.md#what-the-harness-writes).

## 다른 도구를 이미 쓰고 있다면

| 원하는 작업 | 방법 |
|---|---|
| 하네스 전체 설치 — 룰 · 훅 · 에이전트 · 스택에 맞는 스킬 | 위에서 설명한 위저드 사용 |
| 이 저장소에서 제공하는 특정 스킬 하나만 설치 | `npx skills add uzysjung/uzys-agent-harness --skill <id> -a claude-code` |

이 저장소에서 제공하는 스킬은 [skills CLI](https://github.com/vercel-labs/skills) 를 사용해 하나씩 설치할 수도 있다 — 위저드가 복사하는 파일과 똑같은 파일이며, `references/` 폴더의 참고 자료도 함께 다운로드된다. `npx skills add uzysjung/uzys-agent-harness --list` 명령을 실행하면 스킬 id 목록을 볼 수 있다([자세한 설명](docs/USAGE.md#one-skill-without-the-harness)). [skills.sh/uzysjung/uzys-agent-harness](https://skills.sh/uzysjung/uzys-agent-harness) 에도 배포되어 있다.

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
