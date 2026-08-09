# OpenAI — "Unrolling the Codex agent loop" (1차 출처)

- **요청 URL**: https://openai.com/index/unrolling-the-codex-agent-loop/
- **실제 읽은 URL**: 같음 (본문은 `https://r.jina.ai/https://openai.com/index/unrolling-the-codex-agent-loop/`
  경유로 수신)
- **수집일**: 2026-08-09
- **수집 방식**: **직접 접근 실패(HTTP 403 × 2: `curl` 기본 UA · 브라우저 UA) 후 렌더링 프록시
  경유** — `harness-engineering` 과 동일한 차단 양상. 프록시 수신 HTTP 200 · 20,414 bytes · 130줄.
- **증거 등급**: **B+ — 산문 전문 확보, 단 제3자 프록시 렌더링본.** 추가 제약: 이 글은 설명을
  **다이어그램과 JSON 페이로드 그림**에 크게 의존하는데 그 시각 자료가 전부 유실됐다. 원문에서
  "looks like this:" / "as follows:" 뒤에 그림이 오는 자리가 본문에 **빈 채로** 남아 있다(최소
  8곳). 아래 인용은 산문 부분에 한정한다.

**표기 규약**: `>` 인용문은 **원문 영문 그대로**다. 그 밖의 한국어 문장은 전부 우리 해설이며
인용이 아니다.

---

## 1. 왜 이 글이 원장에 필요한가 — 지시문이 "어디서" 읽히는가

이 글은 담으라/빼라를 말하지 않는다. 대신 **상주 지시문이 프롬프트의 어느 위치에 어떤 권한으로
들어가는지**를 구현 수준에서 밝힌다. 그 위치가 우리 판정의 전제를 바꾼다.

### 역할(role) 위계 — 원문

> "In the initial prompt, every item in the list is associated with a role. The `role` indicates
> how much weight the associated content should have and is one of the following values (in
> decreasing order of priority): `system`, `developer`, `user`, `assistant`."

### AGENTS.md 가 들어가는 자리 — 원문

> "3. (Optional) A message with `role=user` whose contents are the "user instructions," which are
> not sourced from a single file but are aggregated across multiple sources. In general, more
> specific instructions appear later:
>
> *   Contents of `AGENTS.override.md` and `AGENTS.md` in `$CODEX_HOME`
> *   Subject to a limit (32 KiB, by default), look in each folder from the Git/project root of the
> `cwd` (if it it exists) up to the `cwd` itself: add the contents of any of `AGENTS.override.md`,
> `AGENTS.md`, or any filename specified by `project_doc_fallback_filenames in config.toml`
> *   If any skills have been configured:"

(마지막 항목의 세부는 원문에서 그림으로 이어져 유실. `[sic]` — `"if it it exists"` 는 원문 오타.)

그 앞 두 자리는 이렇다:

> "1. A message with `role=developer` that describes the sandbox that _applies only to the
> Codex-provided_ `shell` _tool_ defined in the `tools` section. That is, other tools, such as those
> provided from MCP servers, are not sandboxed by Codex and are responsible for enforcing their own
> guardrails."

> "2. (Optional) A message with `role=developer` whose contents are the `developer_instructions`
> value read from the user's `config.toml` file."

### 해설(인용 아님) — 이 저장소에 걸리는 결론 3개

1. **AGENTS.md 는 `role=user` 다 — 위계상 아래에서 두 번째다.** 샌드박스 정책과
   `developer_instructions` 는 `role=developer` 로 **더 위**에 있다. 즉 프로즈로 쓴 금지문은
   구조적으로 낮은 권한이고, 같은 CLI 안에서 더 높은 자리(developer 메시지·샌드박스)가 따로
   존재한다. **"룰로 막는다"가 왜 약한지에 대한 배선 수준의 근거**이며, 이 축은 Anthropic
   문서의 *"context, not enforced configuration"* 서술과 독립적으로 같은 결론에 닿는다.
2. **32 KiB 상한이 여기서 재확인된다** — `agents-md` 가이드와 같은 수치이고, 적용 지점이
   "프롬프트 조립 시점"임이 분명해진다.
3. **"more specific instructions appear later"** 가 병합 규칙의 근거 문장이다 — 뒤가 이기는
   이유는 우선순위 필드가 아니라 **프롬프트 안의 위치**다.

---

## 2. 상주 비용의 기전 — 프롬프트가 접두사로 자란다

> "This means that as the conversation grows, so does the length of the prompt used to sample the
> model. This length matters because every model has a _context window_, which is the maximum
> number of tokens it can use for one inference call. Note this window includes both input _and_
> output tokens."

> "In particular, note how the old prompt _is an exact prefix_ of the new prompt. This is
> intentional, as this makes subsequent requests much more efficient because it enables us to take
> advantage of _prompt caching_"

캐싱 규칙 (원문이 OpenAI 문서에서 재인용한 대목):

> "_Cache hits are only possible for exact prefix matches within a prompt. To realize caching
> benefits, place static content like instructions and examples at the beginning of your prompt,
> and put variable content, such as user-specific information, at the end. This also applies to
> images and tools, which must be identical between requests._"

캐시 미스를 만드는 것:

> "*   Changing the `tools` available to the model in the middle of the conversation.
> *   Changing the `model` that is the target of the Responses API request (in practice, this
> changes the third item in the original prompt, as it contains model-specific instructions).
> *   Changing the sandbox configuration, approval mode, or current working directory."

> "When possible, we handle configuration changes that happen mid-conversation by appending a _new_
> message to `input` to reflect the change rather than modifying an earlier message"

### 해설(인용 아님) — 상주 지시문 비용에 대한 정정

이 저장소는 상주 비용을 **"세션당 토큰 × 요청 수"**로 계측해 왔다(`cost:report`). 이 글은 그
모델을 부분적으로 정정한다:

- 지시문은 프롬프트 **맨 앞의 정적 접두사**라서 **프롬프트 캐싱의 최적 대상**이다. 즉 상주
  지시문의 한계비용은 대화가 길어질수록 **원가가 아니라 캐시 히트 가격**에 가까워진다.
- 반대로 **지시문을 세션 중간에 바꾸거나, 도구 목록·작업 디렉터리를 바꾸면 캐시가 깨진다** —
  그때 비용은 접두사 전체를 다시 무는 것이다.
- 따라서 "지시문이 길면 비싸다"는 명제는 **처음 한 번**에 대해서만 단순 참이고, 정말 비싼 것은
  **불안정한 지시문**이다. 이는 `harness-engineering` 의 *"a small, stable entry point"* 에서
  **stable** 이 왜 붙어 있는지를 설명한다.

(주의: 위 세 줄은 이 글의 서술로부터의 **우리 추론**이지 원문의 주장이 아니다. 원문은 Codex
구현을 설명할 뿐 CLAUDE.md 분량 정책을 논하지 않는다. 또한 Claude Code 의 캐싱 동작은 이 글의
범위 밖이다 — 별도 확인이 필요하다.)

---

## 3. 컨텍스트 관리 — 컴팩션의 위치

> "As you might imagine, an agent could decide to make hundreds of tool calls in a single turn,
> potentially exhausting the context window. For this reason, _context window management_ is one of
> the agent's many responsibilities."

> "Our general strategy to avoid running out of context window is to _compact_ the conversation
> once the number of tokens exceeds some threshold. Specifically, we replace the `input` with a
> new, smaller list of items that is representative of the conversation, enabling the agent to
> continue with an understanding of what has happened thus far."

> "Since then, the Responses API has evolved to support a special `/responses/compact` endpoint
> that performs compaction more efficiently. It returns a list of items that can be used in place
> of the previous `input` to continue the conversation while freeing up the context window. This
> list includes a special `type=compaction` item with an opaque `encrypted_content` item that
> preserves the model's latent understanding of the original conversation. Now, Codex automatically
> uses this endpoint to compact the conversation when the `auto_compact_limit` is exceeded."

**해설(인용 아님)**: 이 글은 **컴팩션 이후 지시문이 재주입되는지를 말하지 않는다.** Codex 는
`input` 을 "대화를 대표하는 더 작은 목록"으로 **치환**한다고만 쓴다. Anthropic 쪽은 이 축을
명시한다(`primary-anthropic-steering.md` §2 — CLAUDE.md 는 컴팩션 후 재독, 룰은 재주입).
**두 CLI 의 컴팩션 후 지시문 생존이 같다고 가정하면 안 된다** — Codex 쪽은 이 문서 범위에서
미확인이다.

---

## 4. 하네스의 정의 (용어)

> "We hope this post gives you a good view into the role our agent (or "harness") plays in making
> use of an LLM."

> "This post focuses on the Codex _harness_, which provides the core agent loop and execution logic
> that underlies all Codex experiences and is surfaced through the Codex CLI."

**해설(인용 아님)**: 이 저장소가 쓰는 "하네스" 어휘의 OpenAI 측 공식 용례다. 기존 원장
`docs/research/harness-engineering-2026-04-18.md` 는 이 정의를 HumanLayer 등 2차 출처에서 인용해
두었는데, 이제 1차 출처가 생겼다.

---

## 5. 이 문서가 **안 주는** 것 (추론으로 채우지 않음)

- 담으라/빼라 목록 — **없음**
- 권장 분량·줄 수 — **없음** (32 KiB 절단 상한만 재확인)
- 룰 vs 스킬 vs 훅 역할 분담 — **없음** (skills 가 프롬프트에 들어간다는 사실만 언급되고 그
  세부는 그림으로 유실)
- 표현 규약 — **없음**
- Claude Code 에 대한 서술 — **없음** (Codex 전용 문서)
