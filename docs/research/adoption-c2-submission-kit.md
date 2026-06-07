# C-2 채택 채널 제출 kit (awesome-list + Show HN + Reddit)

> ADR-021 C-2. **outward-facing — 실 제출은 사용자 계정**(에이전트는 초안만). 발견 채널 등재로 Phase 3(외부 사용자) 진입 chicken-egg 타파.
>
> 정직한 fit: 메타-설치기/큐레이터는 *skill 카탈로그*(VoltAgent/Composio 등)가 아니라 **tooling/landscape 리스트**가 맞다.
>
> 사실 확인일 2026-06-07 (star·섹션·제출방식 실측). 재제출 전 재확인 권장.

## 0. 제출 순서 (chicken-egg 해소)

0★ 신규 repo다. 순서가 채택률을 좌우한다.

```
1) Show HN  +  r/ClaudeCode   ← 신규 프로젝트 환영 채널. 초기 star·사용자·피드백 확보
        ↓ (며칠 내 star 몇 개라도 붙으면)
2) bradAGI awesome-list        ← star 임계값 없음(즉시 가능하나, 정렬 최하단 + "너무 새 repo" optics)
2) hesreallyhim issue form      ← 46k 리스트. traction 있을수록 채택 ↑
```

bradAGI는 임계값이 없어 **지금 바로** 제출해도 규칙 위반은 아니다. 다만 0★ 단독 제출보다 1)로 traction을 먼저 만든 뒤가 채택·노출 모두 유리.

## 1. repo description 먼저 정렬 (제출 전 필수 · 사용자 실행)

**문제**: 현재 GitHub repo description이 재포지셔닝(ADR-021) 이전 문구다. awesome-list에서 링크 클릭 시 보이는 첫 문장이 큐레이터 포지셔닝·엔트리와 모순된다.

| | 내용 |
|---|---|
| **ASIS** | `A Claude Code agent harness — 6-gate workflow + Ralph loop + 9 stack tracks. Lean by design.` (단일 CLI·옛 포지셔닝) |
| **TOBE** | `One-command installer & curator of vetted, Docker-verified AI-coding workflows (skills, plugins, rules, hooks) across Claude Code, Codex, OpenCode & Antigravity.` |

실행(사용자 계정 = outward, 에이전트 대행 X):
```bash
gh repo edit uzysjung/uzys-claude-harness \
  --description "One-command installer & curator of vetted, Docker-verified AI-coding workflows (skills, plugins, rules, hooks) across Claude Code, Codex, OpenCode & Antigravity."
```
> repo topics 도 함께 권장: `claude-code`, `codex`, `opencode`, `ai-coding`, `cli`, `installer`, `agent-skills`.

## 2. 타겟 awesome-list (우선순위·실측)

| 리스트 | ★(2026-06-07) | fit | 제출 방식 | 위치 |
|---|---|---|---|---|
| `bradAGI/awesome-cli-coding-agents` | **515** | **최적** — "harnesses that orchestrate them + agent infrastructure" landscape | **README PR** (fork→edit→PR) | `## Harnesses & orchestration` → `### Agent infrastructure` **최하단**(★ 정렬, 현재 0★) |
| `hesreallyhim/awesome-claude-code` | **45,853** | 보조 — Claude Code 단독. 4-CLI 큐레이터엔 부분 fit | **issue form** (`recommend-resource.yml`, PR 아님) | 폼이 섹션 안내 |

> skill 카탈로그(VoltAgent/awesome-agent-skills, ComposioHQ/awesome-claude-skills)·rule 카탈로그(awesome-cursorrules)는 **설치기에 부적합** — 제출 X (거짓 fit 회피).

### bradAGI inclusion 요건 대조 (사전 점검)

- ✅ CLI/terminal 인터페이스 (`npx @uzysjung/claude-harness`)
- ✅ 명령 실행 (설치 시 `claude plugin install` / `npx skills add` / npm install 실행)
- ✅ 활성 repo (npm 라이브 + CI green)
- ⚠️ "read/write code autonomously" — 설치기 자체는 코드를 짜지 않고 *harness/워크플로를 설치*한다. → "Agent infrastructure(환경/셋업 도구)"로 포지셔닝 시 fit (기존 `kasetto`·`AgentLint`·`claude-northstar`와 동일 성격). 메인테이너가 "installer-only"로 볼 여지는 정직히 인지.

### bradAGI 엔트리 (그들 포맷에 맞춤 — 그대로 복붙)

```markdown
- **[claude-harness](https://github.com/uzysjung/uzys-claude-harness)** `⭐ 0` — One-command installer/curator that sets up vetted skills, plugins, rules, hooks, and agent workflows (GSD, ECC, BMAD, OpenSpec, Superpowers, wshobson, …) across Claude Code, Codex, OpenCode, and Antigravity. Trust-tier curation with monthly star-drift monitoring; every install method is verified by real install in an isolated Docker container, not a static table. `npx @uzysjung/claude-harness`. MIT.
```

### hesreallyhim issue form 입력값

- **Resource URL**: `https://github.com/uzysjung/uzys-claude-harness`
- **Category**: Tooling / Setup (폼 옵션 중 설치·셋업 도구에 해당하는 항목 선택)
- **Description**: 아래 "한 줄 엔트리" 사용

## 한 줄 엔트리 (Reddit·폼 등 재사용)

```
claude-harness — One command to install vetted skills, plugins, rules, hooks & agent workflows across Claude Code, Codex, OpenCode & Antigravity. Trust-tier curated, Docker-verified install. https://github.com/uzysjung/uzys-claude-harness
```

## 3. Show HN 초안

- **제목**: `Show HN: claude-harness – install vetted AI-coding workflows across 4 CLIs`
- **본문**:
  > Picking an AI-coding workflow means comparing GSD vs ECC vs Spec Kit vs BMAD vs OpenSpec vs… across Claude Code, Codex, OpenCode, and Antigravity — each with a different install path. claude-harness curates the vetted ones (trust-tier, star-drift-monitored monthly) and installs them across all 4 CLIs in one command. Install methods are verified by real install in an isolated Docker container, not a static table — and it's honest about what each CLI actually supports (e.g. Codex project-local prompts, BMAD's non-interactive flags). There's a comparison guide so you don't have to evaluate 8 workflows yourself.
- **링크**: repo + `docs/WORKFLOWS.md`(비교) + `docs/COMPATIBILITY.md`(검증)
- **운영**: README + 30초 데모(GIF/asciinema) 준비 후 1회. 게시 후 3시간 내 댓글 응대.

## 4. r/ClaudeCode Showcase 초안

- **톤**: 광고 아닌 before/after 워크플로. "8개 워크플로(GSD/ECC/Superpowers/Spec Kit/BMAD/OpenSpec/wshobson/uzys) 비교에 시간 쓰지 말고 — 큐레이션된 비교표 + 한 줄 설치(4-CLI). 설치는 Docker로 실검증."
- **링크**: `docs/WORKFLOWS.md` + repo.

## 5. 측정 연결

설치 사용자 확보 시 → HITO 측정(#138 `scripts/fresh-dogfood-setup.sh` + protocol)으로 NSM(≤3 prompts/feature) 실측 → Phase 3 신호. C(발견) → 측정 → D(분기) 데이터 확보.
