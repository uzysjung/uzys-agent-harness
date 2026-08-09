# Anthropic — "Prompting best practices" (1차 출처)

- **요청 URL**: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- **실제 읽은 URL**: 같은 문서의 마크다운 원본
  (`…/claude-prompting-best-practices.md`, HTTP 200 · 59,011 bytes · 1,108줄)
- **수집일**: 2026-08-09
- **증거 등급**: **A — 전문 확보(MDX 원본).**

### 수집 방식과 그 과정에서 드러난 함정 (기록으로 남긴다)

1. 먼저 HTML 을 받아 자체 추출했다. 산문은 다 나왔지만 **`<Accordion>` 11개의 본문이 통째로
   비어 있었다** — 접힌 패널의 내용은 정적 HTML 에 아예 없다(버튼 태그 직후 다음 헤딩이 온다).
2. **이 사실을 "예시가 없는 문서"로 결론내지 않고** 탐지기를 먼저 검증했다: 알려진 양성
   `"Golden rule"`(2회) 로 추출기가 정상 작동함을 확인 → 빈 결과가 추출 실패가 아니라 원본
   부재임을 분리.
3. 그 뒤 `.md` 접미사 엔드포인트를 시도해 **아코디언 본문이 포함된 원본**을 받았다.

**이 함정이 중요한 이유**: 아코디언 본문에 **판정을 뒤집는 예시가 들어 있었다**(아래 §3).
HTML 추출본만 봤다면 정반대 결론을 냈을 것이다. 기존 원장의 WebFetch 요약본들
(`docs-resident-criteria.md` #1, `docs-power-user-tips.md`)도 같은 구조적 위험에 노출돼 있다 —
**두 파일 모두 `.md` 엔드포인트로 재수집할 가치가 있다**(이번 범위 밖).

**표기 규약**: `>` 인용문은 **원문 영문 그대로**다. 그 밖의 한국어 문장은 전부 우리 해설이며
인용이 아니다.

---

## 1. 문서의 성격 (범위 한정)

> "This is the reference for prompt engineering with Claude's latest models, including Claude Fable
> 5, Claude Mythos 5, Claude Opus 5, Claude Opus 4.8, Claude Opus 4.7, Claude Opus 4.6, Claude
> Sonnet 5, Claude Sonnet 4.6, and Claude Haiku 4.5."

**해설(인용 아님)**: 이 문서는 **API 프롬프트 엔지니어링** 문서이지 CLAUDE.md 문서가 아니다.
분량 지침·담으라/빼라 목록은 **없다**. 이 저장소가 여기서 가져갈 수 있는 것은 **표현 규약**과
**행동 교정 지시의 표준 문안**이다. 모델별 세부는 각기 별도 페이지로 위임돼 있고, 그중
Opus 5 편은 기존 원장(`docs-resident-criteria.md` §2)이 이미 소유한다.

---

## 2. 표현 규약 — 명확성·구체성·이유

> "Claude responds well to clear, explicit instructions. Being specific about your desired output
> can help enhance results. If you want "above and beyond" behavior, explicitly request it rather
> than relying on the model to infer this from vague prompts."

> "Think of Claude as a brilliant but new employee who lacks context on your norms and workflows.
> The more precisely you explain what you want, the better the result."

> "**Golden rule:** Show your prompt to a colleague with minimal context on the task and ask them
> to follow it. If they'd be confused, Claude will be too."

> "* Be specific about the desired output format and constraints.
> * Provide instructions as sequential steps using numbered lists or bullet points when the order
> or completeness of steps matters."

### 이유를 붙여라

> "Providing context or motivation behind your instructions, such as explaining to Claude why such
> behavior is important, can help Claude better understand your goals and deliver more targeted
> responses."

> "Claude is smart enough to generalize from the explanation."

---

## 3. **부정형 지시 — 통설을 정정하는 대목**

널리 인용되는 문장은 이것이다:

> "There are a few particularly effective ways to steer output formatting:
>
> 1. **Tell Claude what to do instead of what not to do**
>
>    * Instead of: "Do not use markdown in your response"
>    * Try: "Your response should be composed of smoothly flowing prose paragraphs.""

**해설(인용 아님) — 두 가지를 정정한다.**

**ⓐ 적용 범위가 좁다.** 이 항목은 `### Control the format of responses` 절의 1번이고, 그 절의
도입 문장은 `"ways to steer output formatting"` 이다. 즉 **출력 형식 조종**에 대한 조언이지
지시문 일반의 표현 규범이 아니다.

**ⓑ 같은 문서가 부정형을 유지한 채 개선하는 예시를 싣는다.** `### Add context to improve
performance` 절의 아코디언(HTML 에서는 안 보이던 그 부분)이 정확히 이 형태다:

> **Less effective:**
> ```text
> NEVER use ellipses
> ```
>
> **More effective:**
> ```text
> Your response will be read aloud by a text-to-speech engine, so never use ellipses since the
> text-to-speech engine will not know how to pronounce them.
> ```

개선판에도 **`never use ellipses` 가 그대로 남아 있다.** 바뀐 것은 부정형→긍정형이 아니라
**이유의 유무**다.

그리고 이 문서 자신의 권장 시스템 프롬프트들이 부정형으로 가득하다 — 예: `"DO NOT use ordered
lists (1. ...) or unordered lists (*) unless: …"`, `"Don't add features, refactor code, or make
"improvements" beyond what was asked."`, `"Never speculate about code you have not opened."`,
`"Do not hard-code values…"`.

**→ 결론: "부정형을 쓰지 마라"는 이 출처가 뒷받침하지 않는다.** 뒷받침되는 규범은
**"금지에는 이유나 대체 행동을 붙여라"** 다. (OpenAI `agents-md` 가이드의 `Safe path:` 예시와
같은 결론이다 — `primary-openai-agents-md.md` §5.)

### 강조어(CRITICAL / MUST) — 방향이 바뀌었다

> "Claude Opus 4.5 and Claude Opus 4.6 are also more responsive to the system prompt than previous
> models. If your prompts were designed to reduce undertriggering on tools or skills, these models
> may now overtrigger. The fix is to dial back any aggressive language. Where you might have said
> "CRITICAL: You MUST use this tool when...", you can use more normal prompting like "Use this tool
> when..."."

> "**Tune anti-laziness prompting:** If your prompts previously encouraged the model to be more
> thorough or use tools more aggressively, dial back that guidance. Claude 4.6 models are more
> proactive and may overtrigger on instructions that were needed for previous models."

**해설(인용 아님) — 기존 원장과 정면으로 어긋난다.** `docs-resident-criteria.md` §4 가 인용한
best-practices 문장은 이렇다:

> "You can tune instructions by adding emphasis (e.g., "IMPORTANT" or "YOU MUST") to improve
> adherence."

**같은 회사의 두 공식 문서가 반대 방향을 지시한다.** 원장 규칙("출처가 어긋나면 어긋난 채로
병기")대로 병기하고, 어느 쪽으로도 정리하지 않는다. 다만 이 문서 쪽이 **모델 세대를 명시**하고
(4.5/4.6 이후) 있고 다른 쪽은 세대 조건이 없다는 사실은 그대로 적어 둔다.

---

## 4. 예시·구조

> "Examples are one of the most reliable ways to steer Claude's output format, tone, and structure.
> A few well-crafted examples (known as few-shot or multishot prompting) improve accuracy and
> consistency."

> "When adding examples, make them:
>
> - Relevant: Mirror your actual use case closely.
>
> - Diverse: Cover edge cases and vary enough that Claude doesn't pick up unintended patterns.
>
> - Structured: Wrap examples in `<example>` tags (multiple examples in `<examples>` tags) so
> Claude can distinguish them from instructions."

> "Include 3–5 examples for best results."

> "XML tags help Claude parse complex prompts unambiguously, especially when your prompt mixes
> instructions, context, examples, and variable inputs. Wrapping each type of content in its own
> tag (for example, `<instructions>`, `<context>`, `<input>`) reduces misinterpretation."

> "Put longform data at the top: Place your long documents and inputs near the top of your prompt,
> above your query, instructions, and examples. This improves performance across all models."

> "Queries at the end can improve response quality by up to 30 percent in tests, especially with
> complex, multidocument inputs."

**해설(인용 아님)**: 이 문서가 권장하는 표준 문안은 전부 `<snake_case_tag>` 로 감싼 블록이다
(§5 참조). 이슈 #287 이 쓰는 마크다운 `## 제목` 형태와 다르지만, 이 문서는 CLAUDE.md 를 다루지
않으므로 **직접 위반이 아니다.** Anthropic 의 CLAUDE.md 쪽 지침은 반대로 마크다운 헤더를
권한다 — *"use markdown headers and bullets to group related instructions"*
(`docs-resident-criteria.md` §3).

---

## 5. #287 의 원칙들과 **문면이 겹치는** 표준 문안 (전문 인용)

이 절이 이번 판정에 가장 직접적이다. Anthropic 이 **직접 권장 문안으로 싣는 프롬프트**들이
이슈 #287 의 원칙 2·3·4·6과 같은 내용을 담고 있다.

### 과잉 구현 억제 (#287 원칙 2·3·4 와 대응)

> ```
> Avoid over-engineering. Only make changes that are directly requested or clearly
> necessary. Keep solutions simple and focused:
>
> - Scope: Don't add features, refactor code, or make "improvements" beyond what was
> asked. A bug fix doesn't need surrounding code cleaned up. A simple feature doesn't need
> extra configurability.
>
> - Documentation: Don't add docstrings, comments, or type annotations to code you didn't
> change. Only add comments where the logic isn't self-evident.
>
> - Defensive coding: Don't add error handling, fallbacks, or validation for scenarios
> that can't happen. Trust internal code and framework guarantees. Only validate at system
> boundaries (user input, external APIs).
>
> - Abstractions: Don't create helpers, utilities, or abstractions for one-time
> operations. Don't design for hypothetical future requirements. The right amount of
> complexity is the minimum needed for the current task.
> ```

도입 문장:

> "Claude Opus 4.5 and Claude Opus 4.6 have a tendency to overengineer by creating extra files,
> adding unnecessary abstractions, or building in flexibility that wasn't requested. If you're
> seeing this undesired behavior, add specific guidance to keep solutions minimal."

### 되돌리기 어려운 작업의 승인 (#287 원칙 6 과 대응)

> "Without guidance, Claude Opus 4.6 may take actions that are difficult to reverse or affect
> shared systems, such as deleting files, force-pushing, or posting to external services. If you
> want Claude Opus 4.6 to confirm before taking potentially risky actions, add guidance to your
> prompt:"

> ```
> Consider the reversibility and potential impact of your actions. You are encouraged to
> take local, reversible actions like editing files or running tests, but for actions that
> are hard to reverse, affect shared systems, or could be destructive, ask the user before
> proceeding.
>
> Examples of actions that warrant confirmation:
> - Destructive operations: deleting files or branches, dropping database tables, rm -rf
> - Hard to reverse operations: git push --force, git reset --hard, amending published commits
> - Operations visible to others: pushing code, commenting on PRs/issues, sending
> messages, modifying shared infrastructure
>
> When encountering obstacles, do not use destructive actions as a shortcut. For example,
> don't bypass safety checks (e.g. --no-verify) or discard unfamiliar files that may be
> in-progress work.
> ```

### 근거 없는 단정 억제 (#287 원칙 1·7 과 대응)

> ```
> <investigate_before_answering>
> Never speculate about code you have not opened. If the user references a specific file,
> you MUST read the file before answering. Make sure to investigate and read relevant
> files BEFORE answering questions about the codebase. Never make any claims about code
> before investigating unless you are certain of the correct answer - give grounded and
> hallucination-free answers.
> </investigate_before_answering>
> ```

### 테스트 통과에만 맞추는 것 억제 (#287 원칙 2 와 대응)

> ```
> Please write a high-quality, general-purpose solution using the standard tools
> available. Do not create helper scripts or workarounds to accomplish the task more
> efficiently. Implement a solution that works correctly for all valid inputs, not just
> the test cases. Do not hard-code values or create solutions that only work for specific
> test inputs. Instead, implement the actual logic that solves the problem generally.
>
> Focus on understanding the problem requirements and implementing the correct algorithm.
> Tests are there to verify correctness, not to define the solution. Provide a principled
> implementation that follows best practices and software design principles.
>
> If the task is unreasonable or infeasible, or if any of the tests are incorrect, please
> inform me rather than working around them. The solution should be robust, maintainable,
> and extendable.
> ```

### 서브에이전트 남용 억제 (#287 에는 대응 없음 · 이 저장소 레인 정책과 관련)

> "**Watch for overuse:** Claude Opus 4.6 has a strong predilection for subagents and may spawn
> them in situations where a simpler, direct approach would suffice."

> ```
> Use subagents when tasks can run in parallel, require isolated context, or involve
> independent workstreams that don't need to share state. For simple tasks, sequential
> operations, single-file edits, or tasks where you need to maintain context across steps,
> work directly rather than delegating.
> ```

**해설(인용 아님) — 이 절의 판정 가치**

이슈 #287 의 원칙들은 **Anthropic 자신이 "이 행동 결함에는 이런 지시를 넣으라"고 권장한
내용과 상당 부분 문면이 겹친다.** 즉 "모델이 이미 하니까 빼라"는 반론은 **최소한 이 네 축
(과잉 구현 · 비가역 작업 승인 · 미조사 단정 · 테스트 맞춤 구현)에 대해서는 공식 출처와
어긋난다** — 공식 문서가 지금도 이 지시들을 **쓰라고** 싣고 있다.

**단 반대 방향의 한정 조건도 같은 출처에 있다**(그대로 병기한다):

> "Claude Opus 5 is the exception: it verifies its own work well without explicit instruction, and
> verification instructions carried over from prompts tuned for earlier models can cause
> over-verification, adding tokens and latency. When migrating to Claude Opus 5, remove these
> instructions rather than rewriting them"

→ **검증 지시(원칙 5)에 한해서는 "빼라"가 공식 지침이다.** 과잉 구현·비가역 작업·미조사 단정에
대해서는 그런 예외 문장이 **없다.** 축을 뭉뚱그리면 안 된다.

---

## 6. 자율 작업·상태 관리 (#287 이 다루지 않는 축 — 참고)

> "Use structured formats for state data: When tracking structured information (like test results
> or task status), use JSON or other structured formats to help Claude understand schema
> requirements."

> "Use git for state tracking: Git provides a log of what's been done and checkpoints that can be
> restored."

> "Have the model write tests in a structured format: Ask Claude to create tests before starting
> work and keep track of them in a structured format (for example, tests.json). This leads to
> better long-term ability to iterate. Remind Claude of the importance of tests: "It is
> unacceptable to remove or edit tests because this could lead to missing or buggy functionality.""

> "Provide clear success criteria: Define what constitutes a successful answer to your research
> question."

> "Prefer general instructions over prescriptive steps. A prompt like "think thoroughly" often
> produces better reasoning than a hand-written step-by-step plan. Claude's reasoning frequently
> exceeds what a human would prescribe."

**해설(인용 아님)**: 마지막 인용은 **원칙형 문서를 지지하는 방향의 문장**이다 — 세세한 절차
분해보다 일반 지시가 낫다는 것. 이슈 #287 이 절차가 아니라 원칙으로 쓰여 있다는 점은 이
문장과 정합한다.

---

## 7. 이 문서가 **안 주는** 것

- CLAUDE.md 분량·줄 수 — **없음**
- 담으라/빼라 목록 — **없음**
- 룰 vs 스킬 vs 훅 — **없음** (그 축은 `primary-anthropic-steering.md` 가 소유)
- AGENTS.md·파일 병합 — **없음**
