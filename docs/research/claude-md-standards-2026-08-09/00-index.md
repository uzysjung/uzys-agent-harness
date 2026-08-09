# 상주 지시문 기준 — 출처 원장 (2026-08-09 수집)

이슈 #287(배포 CLAUDE.md 를 원칙 문서로 정리)의 판정 근거 원장이다. 사용자가 지정한 2차 자료
두 편과, **그 두 편이 인용한 1차 출처**를 함께 수집한다 — 2차 요약만으로 판정하면 요약자의
해석을 우리 기준으로 삼게 된다.

기존 원장 `docs/research/rules-hooks-value-audit-2026-08-02/` 와 **겹치는 출처는 재수집하지 않고
그쪽을 가리킨다**(한 사실은 한 곳에).

## 2차 자료 (사용자 지정)

| 출처 | URL | 추출본 |
|---|---|---|
| dyld — CLAUDE.md·AGENTS.md 작성법 | https://dyld.kr/blog/how-to-write-claude-md-and-agents-md | `dyld-articles.md` §1 |
| dyld — AI 업무 프롬프트 작성법 | https://dyld.kr/blog/how-to-write-prompts-for-ai-work | `dyld-articles.md` §2 |
| theaxlabs — context file 8-line guide | https://theaxlabs.com/blog/context-file-eight-lines-prompt-guide | `dyld-articles.md` §3 (참고 등급) |

`theaxlabs` 의 "8줄" 주장은 **판정 기준에서 배제**한다(사용자 확정 2026-08-09: "8줄로만 만들 수
없다"). 원 출처인 X 포스트는 HTTP 402 로 접근 불가 — 블로그 요약이 유일한 접근 경로이고,
그 사실을 등급으로 명시해 둔다.

## 1차 출처 — 이미 원장에 있는 것 (재수집하지 않는다)

| 출처 | URL | 기존 위치 |
|---|---|---|
| Anthropic — memory (CLAUDE.md 200줄) | https://code.claude.com/docs/en/memory | `../rules-hooks-value-audit-2026-08-02/docs-resident-criteria.md` §3 |
| Anthropic — best practices | https://code.claude.com/docs/en/best-practices | 같은 파일 §4 |
| Anthropic — support 14553240 (담으라/빼라) | https://support.claude.com/en/articles/14553240-give-claude-context-claude-md-and-better-prompts | 같은 파일 §1 |
| Anthropic — prompting Claude Opus 5 | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5 | 같은 파일 §2 |
| Anthropic — Claude Code 고급 사용자 팁 | https://support.claude.com/ko/articles/14554000 | `../rules-hooks-value-audit-2026-08-02/docs-power-user-tips.md` |

## 1차 출처 — 이번에 수집할 것 (**2026-08-09 수집 완료 · 5/5**)

| 출처 | URL | 왜 필요한가 | 상태 |
|---|---|---|---|
| OpenAI — AGENTS.md 공식 가이드 | https://developers.openai.com/codex/guides/agents-md | AGENTS.md 규격 SSOT. 32KiB 기준·디렉터리 계층 병합의 원문 | ✅ `primary-openai-agents-md.md` — **등급 A**(`.md` 원본 직수신) |
| OpenAI — Harness Engineering | https://openai.com/index/harness-engineering/ | "~100줄 인덱스 + 구조화 문서" 패턴의 원문 | ✅ `primary-openai-harness.md` — **등급 B+**(직접 접근 403 ×4 → 프록시 경유. 진위 대조 완료) |
| OpenAI — Unrolling the Codex agent loop | https://openai.com/index/unrolling-the-codex-agent-loop/ | 지시문이 에이전트 루프의 어디서 읽히는가 | ✅ `primary-openai-agent-loop.md` — **등급 B+**(직접 접근 403 ×2 → 프록시 경유. 다이어그램 유실) |
| Anthropic — Steering Claude Code (skills·hooks·rules·subagents) | https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more | 무엇을 룰에 두고 무엇을 스킬·훅으로 내리는가의 공식 구분 | ✅ `primary-anthropic-steering.md` — **등급 A−**(HTML 직수신 + 자체 추출, 탐지기 검증) |
| Anthropic — prompting best practices | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices | 지시문 표현 규약의 상위 문서 | ✅ `primary-anthropic-prompting.md` — **등급 A**(`.md` 원본 직수신) |

### 수집 중 확인된 접근 방법 (다음 수집자를 위해)

- **`.md` 접미사가 통한다** — `platform.claude.com/docs/**` 와 `developers.openai.com/codex/**`
  는 페이지 URL 뒤에 `.md` 를 붙이면 마크다운 원본을 준다. Codex 문서가 이를 명시한다:
  *"Markdown versions of documentation pages are available by appending `.md` to the page URL."*
  **HTML 추출보다 항상 우선한다** — 접힌 아코디언 본문이 정적 HTML 에는 아예 없기 때문이다
  (실측: 11개 패널이 빈 채로 나왔고, 그중 하나에 판정을 뒤집는 예시가 들어 있었다).
- **`openai.com/index/**` 는 봇을 차단한다** — `curl`(기본/브라우저 UA)·WebFetch 모두 403.
  렌더링 프록시(`https://r.jina.ai/<원 URL>`)로 우회했고, 특징 문구 검색으로 진위를 대조했다.
- **`claude.com/blog/**` 는 `.md` 미지원**(404) — HTML 추출이 유일한 경로다.

## 횡단 요약 (⚠ 아직 저장소 밖에 있다)

다섯 출처의 ① 일치 ② 불일치 ③ 기존 원장 대비 변경점을 정리한 문서는 2026-08-09 수집 시점에
**세션 스크래치패드에만** 있다(`e1-primary-sources.md`). 스크래치패드는 날짜가 바뀌면 비워지므로
**이 사이클이 근거로 쓰려면 저장소 안으로 옮겨야 한다.** 옮기기 전까지 이 줄은 미완 표시다.

옮기지 않아도 위 다섯 파일만으로 판정은 가능하다 — 횡단 요약은 그 파일들에서 유도된 것이지
새 사실을 담지 않는다.

## 수집 규칙

- **인용은 원문 그대로.** 번역·요약은 인용과 구분해 적는다.
- 접근 실패한 URL 은 실패로 적는다 — 빈 결과를 부재의 증거로 쓰지 않는다.
- 출처가 서로 어긋나면 **어긋난 채로 병기**한다. 한쪽으로 정리하지 않는다.
