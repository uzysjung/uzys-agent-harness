# v26.66.0 — Antigravity 지원 (Phase A+B 통합)

> **Status**: Proposed (2026-05-21, v2 — spec 확인 후 통합)
> **Type**: Feature (BREAKING — CliBase 확장)
> **Predecessor**: v26.65.3
> **북극성**: Multi-Stack Equivalence — 동일 6-Gate 워크플로우를 Claude / Codex / OpenCode / **Antigravity** 4개 CLI 에서 동일하게

---

## 1. Context

### Antigravity CLI 발표 (2026-05-19, Google I/O)

Google 이 [Antigravity 2.0](https://antigravity.google/) 발표. Gemini CLI 의 후속. 핵심:

- **Cross-platform** (macOS / Windows / Linux)
- **Multi-model**: Gemini 3 Pro + Claude Sonnet 4.5 + OpenAI GPT-OSS
- **Multi-Agent Development**: 단일 도구가 아니라 "AI team member" 지향
- **Gemini CLI deprecation**: 2026-06-18 부터 Gemini CLI 가 Google AI Pro/Ultra/Free 요청 거부 → Antigravity CLI 가 후속

uzys-claude-harness 의 multi-CLI 지원 (Claude / Codex / OpenCode) 에 **4번째 CliBase 로 Antigravity** 추가.

### 조사 결과 — Antigravity spec 확인 완료 (codelabs)

Google Codelabs 의 "Getting Started with Google Antigravity" 에서 정확한 spec 확인:

| 항목 | Antigravity native | 우리 현황 |
|---|---|---|
| Binary | `agy` (CLI install 옵션) | 4번째 CliBase |
| Desktop install | https://antigravity.google/releases | (사용자 별 install) |
| **Workspace skills** | `.agents/skills/` | **이미 codex transform 이 생성** (`.agents/skills/uzys-{phase}/SKILL.md` 6개) |
| **Workspace workflows** | `.agents/workflows/` | 신규 — 6-Gate 매핑 (withUzysHarness 시) |
| Workspace rules | `.agents/rules/` | (선택, 본 cycle 외) |
| Global rules | `~/.gemini/GEMINI.md` | D16 영역 — scope=global 시만 |
| Global skills | `~/.gemini/antigravity/skills/` | D16 영역 |
| Skill format | `SKILL.md` (YAML frontmatter + instructions) | **이미 호환** (codex/transform 의 산출과 동일 format) |
| Workflows | saved prompts triggered with `/` prefix | 6-Gate `/uzys:*` 자연 매핑 |

### 자연 정합

- **`.agents/skills/uzys-*`** — codex 가 이미 생성 (Codex 공식 repo-level skill scope, v0.6.4+). Antigravity 가 native 인식 → **자동 공유**.
- **`.agents/workflows/`** — Antigravity 의 6-Gate `/uzys:*` workflow native 매핑 신규.
- **`~/.gemini/`** — D16 영역. scope=global 시에만 write (ADR-020 정합).

### Phase 분기 (재정의)

| Phase | Scope | 본 PRD |
|-------|-------|---------|
| **A (코어 확장)** | `CliBase.antigravity` + skills CLI agent map + selectCli 옵션 | YES |
| **B (.agents/workflows/)** | `/uzys:*` 6-Gate Antigravity native workflow 생성 (withUzysHarness 시) | YES |
| C (~/.gemini/ global opt-in) | `~/.gemini/antigravity/skills/uzys-*` (scope=global) | 별 cycle (사용자 의식적 결정 필요) |

---

## 2. PRD

### Goals (Phase A+B 통합)

1. **`CliBase` 에 `antigravity` 추가** — Step 2 wizard 에서 4번째 옵션
2. **skills CLI agent 매핑** — `SKILLS_CLI_AGENT_MAP.antigravity = "antigravity"`. 모든 skill 자산이 `--cli antigravity` 시 antigravity agent 로도 install
3. **`.agents/skills/uzys-*` 공유** — codex transform 의 산출물 (`.agents/skills/uzys-{phase}/SKILL.md`) 이 Antigravity 에서도 native 인식. 추가 transform 불필요
4. **`.agents/workflows/uzys-{phase}.md` 신규** — withUzysHarness=true + cli.includes("antigravity") 시 6개 workflow 파일 생성. `/uzys:spec` `/uzys:plan` ... 매핑
5. **README / USAGE 갱신** — Antigravity 지원 명시

### Non-Goals (별 cycle / Phase C)

- `~/.gemini/antigravity/skills/uzys-*` (scope=global opt-in) — 별 cycle
- `~/.gemini/GEMINI.md` 매핑 — 별 cycle
- Antigravity desktop app install 자동화 (사용자가 직접 install)
- `agy` binary 의 plugin install 호출 (Antigravity 자체 plugin 시스템은 별도 영역)

### Acceptance Criteria

#### AC1 — `CliBase` 확장

```ts
export const CLI_BASES = ["claude", "codex", "opencode", "antigravity"] as const;
```

#### AC2 — 비대화형 / interactive 둘 다 선택 가능

- `claude-harness install --track tooling --cli antigravity` 작동
- Step 2 wizard 에 4번째 옵션 표시: `Antigravity`

#### AC3 — skills CLI agent 매핑

```ts
const SKILLS_CLI_AGENT_MAP: Record<CliTargets[number], string> = {
  claude: "claude-code",
  codex: "codex",
  opencode: "opencode",
  antigravity: "antigravity",  // 신규
};
```

검증: `--cli antigravity` 시 `npx skills add <src> --agent antigravity` 호출.

#### AC4 — Phase B 미구현 항목 명시 warn

`--cli antigravity` 단독 선택 시 stderr 에 안내:

```
[INFO] Antigravity CLI support is in Phase A (skills only).
       Dispatcher (.antigravity/), AGENTS.md mapping, and /uzys:* slash
       are coming in a future release once the Antigravity CLI spec
       stabilizes.
```

#### AC5 — 회귀 0

- 기존 619 tests pass 유지
- 신규 tests: CliBase antigravity 분기 + skills CLI mapping + wizard step 2 옵션 표시

#### AC6 — 문서

- `README.md` / `README.ko.md` CLI support 테이블에 `Antigravity` row 추가 (Phase A skill 만)
- `docs/USAGE.md` Multi-CLI install 섹션에 antigravity 명시

---

## 3. Plan

### Phase A.1 — 코어 확장 (~1h)

- `src/types.ts` — `CLI_BASES` 에 `"antigravity"` 추가
- `src/cli-targets.ts` — sort order + label
- `src/prompts.ts` — `selectCli` 의 options 에 antigravity 추가
- `src/external-installer.ts` — `SKILLS_CLI_AGENT_MAP.antigravity = "antigravity"`

### Phase A.2 — 비대화형 + interactive 진입 (~30분)

- `src/commands/install.ts` — `--cli antigravity` 파싱 정합
- Phase B 미구현 항목 stderr 안내 (AC4)

### Phase A.3 — Tests (~1h)

- `tests/cli-targets.test.ts` 갱신 (4 base × multi 조합)
- `tests/external-installer.test.ts` — antigravity agent 호출 검증
- `tests/interactive.test.ts` — selectCli 4 option

### Phase A.4 — 문서 (~30분)

- README / README.ko / USAGE 의 Multi-CLI 섹션 갱신

### Phase A.5 — PR + tag v26.66.0

BREAKING (CliBase 타입 확장) — minor bump.

---

## 4. Decision Required

### 옵션

| 옵션 | 내용 | Trade-off |
|------|------|---------|
| **A1. Phase A 만 진행** | skills CLI agent mapping + CliBase 확장. dispatcher Phase B 로 미룸 | 안전 — Antigravity 의 binary/config 미확인 영역 미진입. 가시적 진전 작음 |
| **A2. Phase A + B 한 cycle** | dispatcher (.antigravity/) + AGENTS.md + /uzys:* slash 도 같이 | 큰 risk — 추측 기반 구현, 추후 spec 안정 시 재작성 가능성 |
| **C. 일단 보류** | Antigravity CLI doc 안정화 후 재검토 | 안전. 단 사용자가 Antigravity 환경에서 uzys-claude-harness 사용 의향 시 작업 미진입 |

### 의견

**A1 (Phase A 만) 추천**. 근거:
- `sickn33/antigravity-awesome-skills` 패턴이 이미 `--antigravity` agent 형식 사용 → 우리 skills CLI 매핑이 자연 정합
- Dispatcher (.antigravity/, AGENTS.md) 는 Codex 의 `.codex/` 와 OpenCode 의 `.opencode/` 처럼 ad-hoc 구현 가능 — 단 Antigravity 의 native 인식 여부 미확인이라 추측 기반 작업이 위험
- Phase A 만 ship 하면 사용자가 Antigravity 환경에서 skill 자산 100% 사용 가능. dispatcher 는 사용자가 수동 설정 (현재 가능)

### 사용자 결정 사항

1. A1 / A2 / C 중 선택
2. (A1 선택 시) Phase B 의 trigger 조건 (예: "Antigravity CLI doc 안정화 = 공식 spec 1.0 release")
3. AC4 의 stderr 안내 메시지 톤 (INFO vs WARN vs 없음)

---

## 5. References

- [Google I/O 2026 — Antigravity 2.0 launch](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)
- [Antigravity CLI migration from Gemini CLI](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)
- [google-antigravity/antigravity-cli (official repo)](https://github.com/google-antigravity/antigravity-cli)
- [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) — 1,400+ skills, `--antigravity` flag 패턴

---

## 6. Changelog

- 2026-05-21 v1: 초안. Phase A (skill 만) vs Phase B (dispatcher) 분리. 사용자 결정 대기.
