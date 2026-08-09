# OpenAI — "Harness engineering: leveraging Codex in an agent-first world" (1차 출처)

- **요청 URL**: https://openai.com/index/harness-engineering/
- **실제 읽은 URL**: 같음 (본문은 `https://r.jina.ai/https://openai.com/index/harness-engineering/`
  경유로 수신)
- **수집일**: 2026-08-09
- **수집 방식**: **직접 접근 2회 실패 후 렌더링 프록시 경유.** 아래 §0 에 실패 기록.
- **증거 등급**: **B+ — 전문 확보(176줄), 단 제3자 프록시 렌더링본.** 원문 HTML 을 직접 못
  받았으므로 축자성은 프록시 렌더링에 의존한다. 진위는 §0 의 음성/양성 대조로 확인했다.
  다이어그램·이미지 캡션은 텍스트로 치환돼 유실됐다(예: "In-repository knowledge store layout.").

**표기 규약**: `>` 인용문은 **원문 영문 그대로**다. 그 밖의 한국어 문장은 전부 우리 해설이며
인용이 아니다.

---

## 0. 접근 실패 기록 (빈 결과를 부재의 증거로 쓰지 않기 위해)

| 시도 | 방법 | 결과 |
|---|---|---|
| 1 | `curl -L` (기본 UA) | **HTTP 403** — 9,758 bytes 의 봇 차단 페이지 |
| 2 | `curl -L` + 브라우저 UA + Accept 헤더 | **HTTP 403** — 10,077 bytes, 동일 |
| 3 | `curl -L` 트레일링 슬래시 제거 | **HTTP 403** |
| 4 | WebFetch | **HTTP 403 Forbidden** (본문 미수신) |
| 5 | `.md` 접미사 (Codex 문서에서 통한 방식) | 해당 도메인은 미지원 |
| 6 | `https://r.jina.ai/<원 URL>` | **HTTP 200 · 19,487 bytes · 본문 수신** |

**진위 확인(탐지기 검증)**: 프록시 본문의 특징 문구
`"give Codex a map, not a 1,000-page instruction manual"` 로 WebSearch 한 결과, 1순위 결과가
`https://openai.com/index/harness-engineering/` 로 반환됐고 검색 요약도 해당 문구를 이 글의
것으로 귀속했다. 프록시가 반환한 `URL Source:` 헤더도 원 URL 과 일치한다. → **내용 진위 확인,
축자성은 B+ 유지.**

---

## 1. 핵심 명제 — 지시문은 백과사전이 아니라 목차다

> "Context management is one of the biggest challenges in making agents effective at large and
> complex tasks. One of the earliest lessons we learned was simple: **give Codex a map, not a
> 1,000-page instruction manual.**"

거대 지시문이 나쁜 이유를 네 갈래로 명시한다 (**원문 그대로**):

> "*   **Context is a scarce resource.** A giant instruction file crowds out the task, the code,
> and the relevant docs—so the agent either misses key constraints or starts optimizing for the
> wrong ones.
> *   **Too much guidance becomes _non-guidance_.** When everything is "important," nothing is.
> Agents end up pattern-matching locally instead of navigating intentionally.
> *   **It rots instantly.** A monolithic manual turns into a graveyard of stale rules. Agents
> can't tell what's still true, humans stop maintaining it, and the file quietly becomes an
> attractive nuisance.
> *   **It's hard to verify.** A single blob doesn't lend itself to mechanical checks (coverage,
> freshness, ownership, cross-links), so drift is inevitable."

> "So instead of treating `AGENTS.md` as the encyclopedia, we treat it as **the table of contents.**"

**해설(인용 아님)**: 네 갈래 중 **③ rots · ④ hard to verify 는 이 저장소 원장에 없던 축**이다.
기존 근거(Anthropic)는 *길이 → 준수율 저하*라는 한 축만 말했다. 여기서는 길이와 무관하게
**검증 가능성**과 **부패**가 독립적인 실패 원인으로 제시된다 — 즉 "짧게 써라"가 아니라
"기계가 검사할 수 있는 형태로 쪼개라"가 처방이다.

---

## 2. 분량·구조 — "~100줄 인덱스" 의 원문

> "The repository's knowledge base lives in a structured `docs/` directory treated as the system of
> record. A short `AGENTS.md` (roughly 100 lines) is injected into context and serves primarily as
> a map, with pointers to deeper sources of truth elsewhere."

무엇이 그 `docs/` 에 있는지:

> "Design documentation is catalogued and indexed, including verification status and a set of core
> beliefs that define agent-first operating principles. Architecture documentation provides a
> top-level map of domains and package layering. A quality document grades each product domain and
> architectural layer, tracking gaps over time."

> "Plans are treated as first-class artifacts. Ephemeral lightweight plans are used for small
> changes, while complex work is captured in execution plans with progress and decision logs that
> are checked into the repository. Active plans, completed plans, and known technical debt are all
> versioned and co-located, allowing agents to operate without relying on external context."

> "This enables **progressive disclosure**: agents start with a small, stable entry point and are
> taught where to look next, rather than being overwhelmed up front."

### 해설(인용 아님) — 100줄의 정확한 성격

**이 100줄은 "원칙 문서의 상한"이 아니라 "목차의 분량"이다.** 원문에서 원칙류
("a set of core beliefs that define agent-first operating principles")는 `AGENTS.md` 가 아니라
**`docs/` 안에 목록화돼 있고**, `AGENTS.md` 는 그리로 가는 포인터다. 따라서:

- 이슈 #287 의 7원칙(약 120줄)을 이 100줄 수치와 직접 비교하는 것은 **장르가 다른 비교**다.
  이 글의 100줄짜리 파일에는 원칙 본문이 애초에 들어 있지 않다.
- 이 글이 실제로 요구하는 것은 "짧게"가 아니라 **"입구는 안정적이고 작게, 본문은 찾아갈 수 있게,
  그리고 그 연결을 기계가 검사하게"** 다.

---

## 3. 문서를 기계가 지키게 한다 (프로즈 → 게이트)

> "We enforce this mechanically. Dedicated linters and CI jobs validate that the knowledge base is
> up to date, cross-linked, and structured correctly. A recurring "doc-gardening" agent scans for
> stale or obsolete documentation that does not reflect the real code behavior and opens fix-up
> pull requests."

문서가 못 하는 일은 코드로 승격한다:

> "Human taste is fed back into the system continuously. Review comments, refactoring pull
> requests, and user-facing bugs are captured as documentation updates or encoded directly into
> tooling. When documentation falls short, we promote the rule into code"

불변식은 강제하고 구현은 놔둔다:

> "**By enforcing invariants, not micromanaging implementations, we let agents ship fast without
> undermining the foundation.** For example, we require Codex to parse data shapes at the
> boundary, but are not prescriptive on how that happens (the model seems to like Zod, but we
> didn't specify that specific library)."

> "In practice, we enforce these rules with custom linters and structural tests, plus a small set
> of "taste invariants." For example, we statically enforce structured logging, naming conventions
> for schemas and types, file size limits, and platform-specific reliability requirements with
> custom lints. Because the lints are custom, we write the error messages to inject remediation
> instructions into agent context."

중앙 경계 / 지역 자율:

> "At the same time, we're explicit about where constraints matter and where they do not. This
> resembles leading a large engineering platform organization: enforce boundaries centrally, allow
> autonomy locally. You care deeply about boundaries, correctness, and reproducibility. Within
> those boundaries, you allow teams—or agents—significant freedom in how solutions are expressed."

**해설(인용 아님)**: 마지막 인용은 이 저장소가 이미 채택한 판정
("되돌릴 수 없는 것은 서버 룰셋이, 판단은 프로즈가")과 **같은 형태**이며, 이번에 처음으로
**1차 출처로 뒷받침된다**. 특히 *"we write the error messages to inject remediation instructions
into agent context"* 는 우리 훅의 stderr 메시지 설계에 그대로 적용되는 구체 기법이다 —
차단 사유를 쓰는 자리가 곧 교정 지시를 넣는 자리다.

---

## 4. 에이전트에게 존재하지 않는 것 (상주 지시문의 존재 이유)

> "From the agent's point of view, anything it can't access in-context while running effectively
> doesn't exist. Knowledge that lives in Google Docs, chat threads, or people's heads are not
> accessible to the system. Repository-local, versioned artifacts (e.g., code, markdown, schemas,
> executable plans) are all it can see."

> "Giving Codex more context means organizing and exposing the right information so the agent can
> reason over it, rather than overwhelming it with ad-hoc instructions. In the same way you would
> onboard a new teammate on product principles, engineering norms, and team culture (emoji
> preferences included), giving the agent this information leads to better-aligned output."

**해설(인용 아님)**: 이 두 인용은 **"줄여라"의 반대 방향 압력**이다. 같은 글이 "지도를 줘라"와
"컨텍스트를 저장소로 더 밀어 넣어라"를 동시에 말한다. 모순이 아니라 **분리**다 — 총량은 늘리되
*입구*는 작게 두고, 늘어난 분량은 찾아갈 수 있는 구조로 둔다. 밀도 논변("무조건 짧게")은 이
글을 근거로 삼을 수 없다.

---

## 5. 엔트로피와 정리 — 룰의 사후 관리

> "**Full agent autonomy also introduces novel problems.** Codex replicates patterns that already
> exist in the repository—even uneven or suboptimal ones. Over time, this inevitably leads to
> drift."

> "Initially, humans addressed this manually. Our team used to spend every Friday (20% of the
> week) cleaning up "AI slop." Unsurprisingly, that didn't scale."

> "Instead, we started encoding what we call "golden principles" directly into the repository and
> built a recurring cleanup process. These principles are opinionated, mechanical rules that keep
> the codebase legible and consistent for future agent runs. For example: (1) we prefer shared
> utility packages over hand-rolled helpers to keep invariants centralized, and (2) we don't probe
> data "YOLO-style"—we validate boundaries or rely on typed SDKs so the agent can't accidentally
> build on guessed shapes. On a regular cadence, we have a set of background Codex tasks that scan
> for deviations, update quality grades, and open targeted refactoring pull requests."

**해설(인용 아님)**: `"golden principles"` 는 이슈 #287 의 7원칙과 **같은 장르**다 — 의견이 담긴
(opinionated), 기계적으로 판정 가능한(mechanical) 규칙. 이 글은 그런 원칙을 저장소에 두는 것을
**권장**하며, 다만 그 원칙들이 *배경 작업으로 주기 점검된다*는 조건을 붙인다. 즉 원칙 문서의
정당성은 길이가 아니라 **점검 루프의 존재**에서 나온다.

---

## 6. 일반화 경고 — 이 글을 배포물 근거로 쓸 때의 제약

> "This behavior depends heavily on the specific structure and tooling of this repository and
> should not be assumed to generalize without similar investment—at least, not yet."

레짐 조건(**원문 그대로**):

> "every line of code—application logic, tests, CI configuration, documentation, observability,
> and internal tooling—has been written by Codex"

> "roughly 1,500 pull requests have been opened and merged with a small team of just three
> engineers driving Codex"

> "The repository operates with minimal blocking merge gates. Pull requests are short-lived. Test
> flakes are often addressed with follow-up runs rather than blocking progress indefinitely. In a
> system where agent throughput far exceeds human attention, corrections are cheap, and waiting is
> expensive."

> "This would be irresponsible in a low-throughput environment. Here, it's often the right
> tradeoff."

**해설(인용 아님)** — 배포물 관점에서 중요한 경계:

이 글의 처방 일부는 **저자 스스로 조건부라고 못 박은 것**이다. 특히 "머지 게이트를 최소화하라"는
`"This would be irresponsible in a low-throughput environment"` 라는 자기 부정이 붙어 있다.
우리 배포물은 낯선 사람의 **저처리량 저장소**에 설치되므로, 이 글에서 가져올 수 있는 것은
**게이트 최소화가 아니라** ⓐ 목차/본문 분리 ⓑ 불변식은 기계가, 판단은 문서가 ⓒ 원칙에는
점검 루프를 붙인다 — 세 가지다. 나머지는 레짐 전제가 다르다.
