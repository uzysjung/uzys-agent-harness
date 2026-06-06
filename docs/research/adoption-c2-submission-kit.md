# C-2 채택 채널 제출 kit (awesome-list + Show HN + Reddit)

> ADR-021 C-2. **outward-facing — 실 제출은 사용자 계정**(에이전트는 초안만). 발견 채널 등재로 Phase 3(외부 사용자) 진입 chicken-egg 타파.
>
> 정직한 fit: 메타-설치기/큐레이터는 *skill 카탈로그*(VoltAgent/Composio 등)가 아니라 **tooling/landscape 리스트**가 맞다.

## 한 줄 엔트리 (재사용)

```
[claude-harness](https://github.com/uzysjung/uzys-claude-harness) — One command to install vetted skills, plugins, rules & hooks across Claude Code, Codex, OpenCode & Antigravity. Trust-tier curated, Docker-verified install.
```

## 타겟 awesome-list (우선순위)

| 리스트 | ★ | 섹션 | 비고 |
|---|---|---|---|
| `bradAGI/awesome-cli-coding-agents` | — | CLI 에이전트 도구 | 가장 자연스러운 fit (CLI 에이전트 landscape) |
| `hesreallyhim/awesome-claude-code` | 46k | Tooling/Setup | **TOC 재편 중(2026-06)** → 제출 시 현재 섹션 확인 |

> skill 카탈로그(VoltAgent/awesome-agent-skills, ComposioHQ/awesome-claude-skills)·rule 카탈로그(awesome-cursorrules)는 **설치기에 부적합** — 제출 X (거짓 fit 회피).

제출 절차(사용자): fork → 알맞은 섹션에 위 엔트리 추가 → PR. 각 리스트 CONTRIBUTING 의 알파벳/포맷 규칙 준수.

## Show HN 초안

- **제목**: `Show HN: claude-harness – install vetted AI-coding workflows across 4 CLIs`
- **본문**:
  > Picking an AI-coding workflow means comparing GSD vs ECC vs Spec Kit vs BMAD vs OpenSpec vs… across Claude Code, Codex, OpenCode, and Antigravity — each with a different install path. claude-harness curates the vetted ones (trust-tier, star-drift-monitored monthly) and installs them across all 4 CLIs in one command. Install methods are verified by real install in an isolated Docker container, not a static table — and it's honest about what each CLI actually supports (e.g. Codex project-local prompts, BMAD's non-interactive flags). There's a comparison guide so you don't have to evaluate 8 workflows yourself.
- **링크**: repo + `docs/WORKFLOWS.md`(비교) + `docs/COMPATIBILITY.md`(검증)
- **운영**: README + 30초 데모(GIF/asciinema) 준비 후 1회. 게시 후 3시간 내 댓글 응대.

## r/ClaudeCode Showcase 초안

- **톤**: 광고 아닌 before/after 워크플로. "8개 워크플로(GSD/ECC/Superpowers/Spec Kit/BMAD/OpenSpec/wshobson/uzys) 비교에 시간 쓰지 말고 — 큐레이션된 비교표 + 한 줄 설치(4-CLI). 설치는 Docker로 실검증."
- **링크**: `docs/WORKFLOWS.md` + repo.

## 측정 연결

설치 사용자 확보 시 → HITO 측정(#138 `scripts/fresh-dogfood-setup.sh` + protocol)으로 NSM(≤3 prompts/feature) 실측 → Phase 3 신호. C(발견) → 측정 → D(분기) 데이터 확보.
