# 벤더 신호 추적 (상시)

> **왜 있나**: 방향 판정을 내 학습분으로 하면 컷오프 시점의 모범사례를 현행으로 착각한 채
> 로드맵을 짠다. 게이트는 *만든 것이 동작하는가*만 물고 **만들 가치가 있는가는 안 묻는다** —
> 그 축을 대는 것이 벤더의 공개 엔지니어링 기록이다.
> (사용자 확정 2026-08-30: *"클로드 블로그나 오픈AI 블로그에 나온 내용 최신 트렌드에 맞춰서
> 방향성을 잡아야 해"* · *"계속 트렌드는 바뀌니 추적해라"*)
>
> **이 파일은 일회성 조사가 아니다.** `docs/research/` 의 나머지는 날짜가 박힌 단발 조사이고,
> 이것만 누적 갱신한다. 새 항목은 **위에** 붙인다.

## 쓰는 법

방향을 정하거나 판정하기 **전에** — north-star 작업 · 로드맵 갱신 · 이슈 우선순위 재판정 ·
아키텍처 ADR · 자산을 넣을지 뺄지 — 아래 **마지막 확인일**을 보고 **그 뒤에 나온 것만** 읽는다.
전량 재독은 하지 않는다. 읽었으면 표에 한 줄 추가한다. 바뀐 게 없으면 *"확인, 변화 없음"*도
한 줄이다 — 안 적으면 다음 세션이 같은 글을 다시 읽는다.

**벤더 글은 벤더의 주장이다.** 사실로 옮겨 적지 말고 출처·발행일을 붙이고, 우리 실측과
어긋나면 어긋난 채로 적는다.

**마지막 확인일: 2026-08-30** (anthropic.com/engineering 목록 전체)

## 읽은 것

| 읽은 날 | 출처 (발행일) | 우리에게 무엇이 바뀌었나 |
|---|---|---|
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
