# OpenAI — "Custom instructions with AGENTS.md" (1차 출처)

- **요청 URL**: https://developers.openai.com/codex/guides/agents-md
- **실제 읽은 URL**: `https://developers.openai.com/codex/guides/agents-md.md` (동일 문서의 마크다운
  원본. HTML 은 `https://learn.chatgpt.com/docs/agent-configuration/agents-md` 로 308 리다이렉트)
- **수집일**: 2026-08-09
- **수집 방식**: `curl` 로 마크다운 원본 직접 수신(9,149 bytes / 218줄). 문서 자신이 이 경로를
  안내한다 — *"Markdown versions of documentation pages are available by appending `.md` to the
  page URL."*
- **증거 등급**: **A — 전문 확보.** 요약 모델을 거치지 않은 원본 소스이므로 인용은 축자다.
  누락 구간 없음. (참고: WebFetch 로 같은 URL 을 요청하면 요약본이 돌아온다. 아래 인용은 그
  요약본이 아니라 원본에서 옮긴 것이다.)

**표기 규약**: `>` 인용문은 **원문 영문 그대로**다. 그 밖의 한국어 문장은 전부 우리 해설이며
인용이 아니다.

---

## 1. 무엇을 담고 무엇을 빼라 — **이 문서에는 없다**

이 항목을 먼저 적는 이유는, 2차 자료(`dyld-articles.md`)가 이 문서를 "AGENTS.md 규격 SSOT"로
가리키기 때문이다. 실제로 확인한 결과 **이 문서는 내용 선별 기준(담으라/빼라 목록)을 제시하지
않는다.** 다루는 것은 *발견·병합·상한·검증* 즉 **배선(mechanics)** 뿐이다.

문서 전체에서 내용 선별에 가장 가까운 문장은 코드리뷰 룰 절의 이 한 줄이 유일하다:

> "Keep rules concise, explain the behavior to flag and any safe path or
> exception, and reserve formatting and lint checks for CI."

**해설(인용 아님)**: "포맷·린트 검사는 CI 에 맡기라"는 것은 이 저장소의 기존 판정
(프로즈 ≠ 집행, 기계가 볼 수 있는 것은 기계에)과 **같은 방향**이다. 다만 적용 범위가
`## Code Review Rules` 절로 한정돼 있음을 그대로 적어 둔다 — 일반 지시문 전체에 대한 규범이
아니다.

내용 기준을 찾으려면 이 문서가 마지막에 가리키는 다른 출처로 가야 한다:

> "Visit the official [AGENTS.md](https://agents.md) website for more information."

**미수집**: `https://agents.md` 및 `Project instructions discovery`
(`https://learn.chatgpt.com/docs/config-file/config-advanced#project-instructions-discovery`)
는 이번 범위 밖이라 수집하지 않았다. 부재가 아니라 **미확인**이다.

---

## 2. 분량 — 32 KiB 의 정확한 성격

> "Codex skips empty files and stops adding files once the combined size reaches the limit
> defined by `project_doc_max_bytes` (32 KiB by default). For details on these knobs, see
> Project instructions discovery. Raise the limit or split instructions across nested
> directories when you hit the cap."

트러블슈팅 절에도 같은 사실이 다시 나온다:

> "**Instructions truncated:** Raise `project_doc_max_bytes` or split large files across nested
> directories to keep critical guidance intact."

설정으로 올릴 수 있다는 것도 원문에 예시가 있다:

> ```toml
> # ~/.codex/config.toml
> project_doc_fallback_filenames = ["TEAM_GUIDE.md", ".agents.md"]
> project_doc_max_bytes = 65536
> ```

> "The larger byte limit allows more combined guidance before truncation."

### 해설(인용 아님) — 2차 자료의 프레이밍을 정정한다

`dyld-articles.md` §1 의 분량 표는 32 KiB 를 **CLAUDE.md 200줄과 나란한 "권장 분량 기준"**으로
싣는다. 원문 대조 결과 그 성격이 다르다:

| 축 | Anthropic 200줄 | OpenAI 32 KiB |
|---|---|---|
| 성격 | **권고**(넘어도 전부 로드된다) | **절단 상한**(넘으면 뒤 파일이 **안 실린다**) |
| 조정 | 불가 | `project_doc_max_bytes` 로 조정 가능 |
| 근거 | 준수율 저하 | 프롬프트 크기 방어 |
| 초과 시 | 준수율이 나빠진다 | **경고 없이 잘린다** — 초과분은 침묵으로 사라진다 |

즉 32 KiB 는 "이만큼 쓰라"가 아니라 "여기까지만 들어간다"다. **품질 기준으로 인용하면 틀린
인용이 된다.** 반대로, 잘림이 조용하다는 점은 이 저장소에 실질적 위험 항목이다 — 설치본이
여러 디렉터리에 지시문을 뿌릴수록 합계가 상한에 닿을 수 있고, 그때 실패는 에러가 아니라 **무음**이다.

---

## 3. 파일명·계층·병합 규칙 (원문 전체)

> "Codex builds an instruction chain when it starts (once per run; in the TUI this usually means
> once per launched session). Discovery follows this precedence order:
>
> 1. **Global scope:** In your Codex home directory (defaults to `~/.codex`, unless you set
>    `CODEX_HOME`), Codex reads `AGENTS.override.md` if it exists. Otherwise, Codex reads
>    `AGENTS.md`. Codex uses only the first non-empty file at this level.
> 2. **Project scope:** Starting at the project root (typically the Git root), Codex walks down to
>    your current working directory. If Codex cannot find a project root, it only checks the
>    current directory. In each directory along the path, it checks for `AGENTS.override.md`, then
>    `AGENTS.md`, then any fallback names in `project_doc_fallback_filenames`. Codex includes at
>    most one file per directory.
> 3. **Merge order:** Codex concatenates files from the root down, joining them with blank lines.
>    Files closer to your current directory override earlier guidance because they appear later in
>    the combined prompt."

경계 동작:

> "Codex stops searching once it reaches your current directory, so place overrides as close to
> specialized work as possible."

대체 파일명:

> "Now Codex checks each directory in this order: `AGENTS.override.md`, `AGENTS.md`,
> `TEAM_GUIDE.md`, `.agents.md`. Filenames not on this list are ignored for instruction discovery."

**해설(인용 아님)** — 이 저장소에 직접 걸리는 세 가지:

1. **"덮어쓴다"는 삭제가 아니라 순서다.** `override` 라는 이름과 달리 앞 파일은 프롬프트에
   그대로 남고, 뒤에 놓여서 이길 뿐이다. 상위 지시문의 상주 비용은 하위에서 덮어도 **환불되지
   않는다**.
2. **`AGENTS.override.md` 는 하위가 상위를 무력화하는 유일한 수단**이다(디렉터리당 1파일 규칙
   때문). 우리 설치본이 하위 디렉터리에 `AGENTS.md` 를 깔면 같은 디렉터리의 사용자
   `AGENTS.override.md` 에 밀리고, 반대로 우리가 `override` 를 깔면 **사용자 파일을 조용히
   가린다** — 설치물이 취할 자세가 아니다.
3. **Codex 는 cwd 위쪽만 본다.** Claude Code 는 하위 디렉터리 파일을 *읽을 때* 끌어온다
   (`docs-resident-criteria.md` §3). 방향이 반대다 — 같은 트리가 두 CLI 에서 다르게 병합된다.

---

## 4. 로드 확인·감사 방법 (실측 가능한 절차)

> "- Run `codex --ask-for-approval never "Summarize the current instructions."` from a repository
>   root. Codex should echo guidance from global and project files in precedence order.
> - Use `codex --cd subdir --ask-for-approval never "Show which instruction files are active."` to
>   confirm nested overrides replace broader rules.
> - To audit which instruction files Codex loaded, opt into a plaintext TUI log with
>   `codex -c log_dir=./.codex-log` and check `./.codex-log/codex-tui.log`, or inspect the most
>   recent `session-*.jsonl` file if you enabled session logging.
> - If instructions look stale, restart Codex in the target directory. Codex rebuilds the
>   instruction chain on every run (and at the start of each TUI session), so there is no cache to
>   clear manually."

**해설(인용 아님)**: 세 번째 항목이 **Codex 쪽 `/context` 대응물**이다. 이 저장소가 Codex 설치
경로를 실측할 때 쓸 수 있는 공식 감사 수단이고, 지금까지 원장에 없던 사실이다.

---

## 5. 원문이 보여주는 AGENTS.md 예시 (분량·문체 감각의 기준선)

전역:

> ```md
> # ~/.codex/AGENTS.md
>
> ## Working agreements
>
> - Always run `npm test` after modifying JavaScript files.
> - Prefer `pnpm` when installing dependencies.
> - Ask for confirmation before adding new production dependencies.
> ```

저장소 루트:

> ```md
> # AGENTS.md
>
> ## Repository expectations
>
> - Run `npm run lint` before opening a pull request.
> - Document public utilities in `docs/` when you change behavior.
> ```

하위 디렉터리 오버라이드:

> ```md
> # services/payments/AGENTS.override.md
>
> ## Payments service rules
>
> - Use `make test-payments` instead of `npm test`.
> - Never rotate API keys without notifying the security channel.
> ```

코드리뷰 룰:

> ```md
> ## Code Review Rules
>
> ### Experiment cohorts
>
> - Do not filter treatment comparisons on post-exposure behavior, including conversion or retention.
>   Safe path: build cohorts from assignment or exposure; report conversion as an outcome.
> ```

**해설(인용 아님)**: 공식 예시는 전부 **명령형 한 줄 규칙**이고 원칙 산문이 아니다. 그리고
`Do not filter …` 예시가 보여주듯 **부정형 금지 규칙을 쓰되 곧바로 `Safe path:` 로 대안 행동을
붙이는** 형태다 — "무엇을 하지 마라"와 "대신 무엇을 하라"가 한 항목 안에 같이 있다. 이슈 #287
의 표현 규약을 판정할 때 쓸 수 있는 공식 전례다.

---

## 6. 이 저장소가 판정에 쓸 수 있는 항목 (요약 — 전부 위 인용에서 유도)

| 축 | 이 문서가 주는 것 | 이 문서가 **안 주는** 것 |
|---|---|---|
| 담으라/빼라 | 없음(코드리뷰 룰 절의 1줄 제외) | 내용 선별 기준 전반 |
| 분량 | 32 KiB **절단 상한**(조정 가능) | 권장 줄 수·품질 기준 |
| 파일명 | `AGENTS.override.md` > `AGENTS.md` > fallback | — |
| 병합 | 루트→cwd 연결, 뒤가 이김, 디렉터리당 1파일 | — |
| 룰/스킬/훅 분담 | 없음 | 전부 |
| 표현 규약 | 예시로만(명령형 + `Safe path:`) | 명시적 규범 |
