# 게시 글 초안 (M2 — 반자동 게시, 사용자 제출)

> 작성 2026-06-13 · 1인칭 동기 = 사용자 실제 경험 입력 · SSOT: `docs/plans/service-audit-roadmap.md` M2
> 정직성 원칙(전부 본문 명시): vetted ≠ 보안 감사 / 단일 메인테이너 / 4-CLI 비대칭(Claude first-class) / npm pin·plugin·skill HEAD 한계.
> star 수치 = 2026-06-13 실측(`docs/WORKFLOWS.md` 동기화).

## 포지셔닝 한 문장 (차별점)

> **검증된 AI 코딩 워크플로 중, 내 기술 스택에 꼭 필요한 것만 한 명령으로.**
> "무엇이든 설치"도 "거대한 awesome 디렉토리"도 아닌 — **스택 기반 최소 큐레이션**.

동기(사용자 1인칭): ① 워크플로 발견 자체가 어려움 ② 순정 에이전트는 강해지는데 불필요한 skill·MCP 과설치 = 컨텍스트만 무거움 ③ awesome-list는 선택 과부하(디렉토리지 큐레이션 아님) ④ 진짜 큐레이션 = 스택 기준 꼭 필요한 것만.

---

## Show HN

**제목**: `Show HN: agent-harness – curate AI-coding workflows by tech stack, install only what you need`

```
I couldn't even tell what coding-agent workflows were out there, let alone which were
worth using. The awesome-lists had hundreds of entries — that's a directory, not curation.

Meanwhile Claude Code and Codex keep getting stronger out of the box. I didn't want to
bury that under skills and MCP servers I'd never actually call — each one just eats context.

What I wanted was curation by tech stack: of the vetted options, install only what *this*
project needs. I couldn't find it, so I built it.

agent-harness:
- Pick your stack (a "track"). It pre-checks a vetted set — you review and uncheck anything.
- "Vetted" = >=1000 stars + active maintenance + a Docker install-verification run, re-checked
  by CI. It is NOT a security audit or a content scan — I'm explicit about that in the README.
- Installs across Claude Code (first-class), Codex, OpenCode, Antigravity. Project scope by
  default — no global pollution unless you ask.
- npm/npx assets are version-pinned; plugin/skill assets resolve to upstream HEAD (can't be
  commit-pinned yet — documented). It backs up your existing .claude/settings.json and
  CLAUDE.md before touching them.

One command:  npx -y @uzysjung/agent-harness

It's early and I'm a solo maintainer — the COMPATIBILITY matrix is honest about what's
verified vs not. Feedback welcome, especially on the curation calls.
```

---

## r/ClaudeCode

**제목**: `A tech-stack-based curator for AI-coding workflows — install only what you need, not a kitchen sink`

본문 = Show HN 동기 압축 + 아래 비교표 **직접 게재**(링크 유도형 광고 회피):

| 워크플로 | ★ (2026-06-13) | 한 줄 정체 |
|---|---|---|
| Superpowers | 226k | agentic skills 프레임워크 |
| ECC | 214k | 60 agents·230 skills 종합(kitchen-sink) |
| GSD | 64k | get-shit-done 오케스트레이터 |
| addy agent-skills | 57k | 경량 general dev |
| OpenSpec | 55k | spec-driven brownfield delta |
| BMAD-METHOD | 49k | 멀티-에이전트 애자일 |
| wshobson agents | 37k | 멀티-에이전트 오케스트레이션 |
| uzys-harness | (내장) | 6-Gate `/uzys:spec…ship` |

> Claude Code first-class; Codex/OpenCode/Antigravity 는 skills+rules 수준. vetted ≠ 보안 감사. 단일 메인테이너. 피드백 환영.

---

## 게시 순서 (M2)
1. 데모 GIF README 반영 확인 (신 브랜드 ✓)
2. Show HN + r/ClaudeCode (반자동: 폼 채움=에이전트 / 제출 클릭=사용자)
3. 첫 24~48h 댓글 모니터링 + 응답 초안 → 사용자 승인 후 게시
4. star 두 자리 후 awesome-list (bradAGI README PR + hesreallyhim issue form)
