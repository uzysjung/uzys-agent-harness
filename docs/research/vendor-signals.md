# 벤더 신호 추적 (상시)

> **왜 있나**: 방향 판정을 내 학습분으로 하면 컷오프 시점의 모범사례를 현행으로 착각한 채
> 로드맵을 짠다. 게이트는 *만든 것이 동작하는가*만 물고 **만들 가치가 있는가는 안 묻는다** —
> 그 축을 대는 것이 벤더의 공개 엔지니어링 기록이다.
> (사용자 확정 2026-08-30: *"클로드 블로그나 오픈AI 블로그에 나온 내용 최신 트렌드에 맞춰서
> 방향성을 잡아야 해"* · *"계속 트렌드는 바뀌니 추적해라"*)
>
> **이 파일은 일회성 조사가 아니다.** `docs/research/` 의 나머지는 단발 조사이고(파일 19개 +
> 디렉터리 4개), 이것만 누적 갱신한다. 새 항목은 **위에** 붙인다.
> *(파일명에 날짜가 있는 것은 일부다 — 7개는 날짜가 없다. 처음엔 "전부 날짜가 박혔다"고
> 적었는데 독립 리뷰가 실측으로 반증했다. 세지 않은 수는 적지 않는다.)*

## 쓰는 법

방향을 정하거나 판정하기 **전에** — north-star 작업 · 로드맵 갱신 · 이슈 우선순위 재판정 ·
아키텍처 ADR · 자산을 넣을지 뺄지 — 아래 **마지막 확인일**을 보고 **그 뒤에 나온 것만** 읽는다.
전량 재독은 하지 않는다. 읽었으면 표에 한 줄 추가한다. 바뀐 게 없으면 *"확인, 변화 없음"*도
한 줄이다 — 안 적으면 다음 세션이 같은 글을 다시 읽는다.

**벤더 글은 벤더의 주장이다.** 사실로 옮겨 적지 말고 출처·발행일을 붙이고, 우리 실측과
어긋나면 어긋난 채로 적는다.

**마지막 확인일: 2026-08-31** (anthropic.com/engineering 목록 전체 + claude.com/blog 3건. openai.com 은 403 으로 미확인)

## 읽은 것

| 읽은 날 | 출처 (발행일) | 우리에게 무엇이 바뀌었나 |
|---|---|---|
| 2026-08-31 | [The new rules of context engineering for Claude 5 generation models](https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models) (발행일 미상 — 페이지에 표기 없음) | **판정을 바꾼 신호.** Anthropic 이 **Claude Code 시스템 프롬프트의 80% 이상을 Opus 5·Fable 5 용으로 제거하고 측정 가능한 손실 없음**을 보고. 걷어낸 대상은 **과잉 제약 규칙**, 남긴 것은 **팀·제품 고유 지식과 gotcha**. → 우리 배포 앵커에 같은 형태가 있는지 **재는** 후속(#415). **지금 지우지 않는다** — 유추로 지우는 것은 #407 이 기각한 "모델이 이미 안다"와 같은 무근거 절단이다. *(이 행의 서술은 페이지 요약에서 왔다. 축자 인용은 싣지 않는다 — 아래 정정 참조)* |
| 2026-08-31 | [Best practices for computer and browser use](https://claude.com/blog/best-practices-for-computer-and-browser-use-with-claude) (발행일 미상) | **축자 인용(원문 대조 완료)**: *"Treat all web content as untrusted. Design your agent's system prompt to clearly distinguish between the user's instructions and content encountered during task execution."* · *"Remind the model that text found on web pages, in emails, or in application UIs is not from the user and should not be treated as instructions."* → 앵커 §6 authority 조항의 근거 (#407). **주의**: 이 페이지가 *"학습 시점 견고성에만 기대지 말라"*고 **명시하지는 않는다** — 초안이 그렇게 적었다가 독립 리뷰가 반증했다(그 문서의 유일한 한계 단서는 classifier 에 붙어 있다) |
| 2026-08-31 | [How Claude remembers your project](https://code.claude.com/docs/en/memory) · [Claude Code power user tips](https://support.claude.com/en/articles/14554000-claude-code-power-user-tips) (발행일 미상) | **축자 인용(원문 대조 완료)**: memory 문서 §When to add to CLAUDE.md — *"Add to it when: Claude makes the same mistake a second time"* · *"If an entry is a multi-step procedure or only matters for one part of the codebase, move it to a skill or a path-scoped rule instead."* / power user tips — *"anytime Claude does something incorrectly, add it to CLAUDE.md so it knows not to repeat the mistake."* → 앵커 §7 수치 조항의 근거(관측된 실패)와, 이번 추가 2건이 절차도 부분 범위도 아니라 앵커가 맞는 자리라는 근거 (#407). **정정**: 초안은 세 번째 인용을 앞의 두 출처에 달았는데 **그 두 페이지에는 없다**(독립 리뷰가 HIGH 로 적발). 출처는 power user tips 이고 문장 자체는 축자로 실재한다 — 지어낸 것이 아니라 **출처 오귀속**이다. 이 리포의 `templates/skills/audit-harness-fit/references/official-criteria.md` 는 처음부터 올바른 출처로 인용하고 있었다 |
| 2026-08-31 | [Understanding prompt injections (OpenAI)](https://openai.com/index/prompt-injections/) (발행일 미상) | **미검증 — 인용하지 않는다.** 검색 결과 요약은 신뢰할 수 없는 입력을 *"untrusted context blocks"* 로 표시하고 지시로 다루지 말라는 취지를 전한다. 그러나 **원문 대조에 실패했다**: `openai.com` 이 3회 모두 403 을 냈고 같은 실행의 대조 URL 은 200 이었다(독립 리뷰 실측). 원문을 읽기 전까지 이 줄을 근거로 쓰지 않는다. **OpenAI 쪽 큐의 첫 항목**이다 |
| 2026-08-30 | [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) (2026-03-24) | **① 우리 대원칙이 확인됨** — *"agents reliably skew positive when grading their own work… Separating the agent doing the work from the agent judging it proves to be a strong lever."* = `.claude/CLAUDE.md` 대원칙. **② 우리가 안 하던 동작이 드러남** — *"Every component in a harness encodes an assumption about what the model can't do on its own, and those assumptions are worth stress testing."* Opus 4.6 로 시험하자 sprint 구조를 통째로 제거하고도 성능 유지. → 성숙한 하네스의 기본 동작은 **제거**다. 열린 이슈 12건 중 11건이 추가 방향이었던 것을 이 근거로 뒤집어 #360~#364(제거) 를 먼저 돌리기로 함 |
| 2026-08-30 | [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) (2025-11-26) | 세션 간 상태 이월(진행 로그 + 구조화된 요구사항 + git 이력)은 우리 `.handoff/CURRENT.md` + `compaction-handoff` 과 같은 형태. **변화 없음** — 이미 하고 있다 |
| 2026-08-30 | [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) | `description` 상한 **1,024자는 현행**이고 "specific validation rules" 로 규정. **초과 시 결과는 문서에 없다** — 잘림·거절 어느 쪽도 안 적혀 있다. 본문 500줄 권고도 확인. → #333 처리 근거 (PR #395) |

## 아직 안 읽은 큐 (2026-08-30 목록 기준)

| 출처 (발행일) | 왜 우리 일인가 |
|---|---|
| How we contain Claude across products (Featured) | 훅·권한 경계 설계 — 우리 §Boundaries 와 직접 겹친다 |
| Scaling Managed Agents: Decoupling the brain from the hands (2026-04-08) | 다중 에이전트 구조 — 레인 분리의 상위 형태 |
| How we built Claude Code auto mode: a safer way to skip permissions (2026-03-25) | 우리는 `bypassPermissions` 로 돈다. 벤더가 그 자리를 어떻게 푸는지 |
| 2026 Agentic Coding Trends Report (PDF) | 트렌드 원문 |
| Quantifying infrastructure noise in agentic coding evals (2026-02-05) | 우리 계측의 잡음 — 상주 비용·커버리지 판정에 걸린다 |
| Building a C compiler with a team of parallel Claudes (2026-02-05) | 병렬 레인 격리 (우리 워크트리 격리 교훈과 대조) |
| Beyond permission prompts: Claude Code sandboxing (2025-10-20) | 위와 같은 축 |
| Code execution with MCP (2025-11-04) | MCP 정책 — `mcp-pre-exec` 판정의 근거가 낡았는지 |

**OpenAI 쪽은 아직 한 건도 안 봤다.** Codex CLI 를 배달 대상으로 두고 있으므로 같은 방식으로
큐를 채워야 한다 — 이 공백을 적어 두는 것이 "안 봤다"와 "볼 게 없다"를 구분한다.
