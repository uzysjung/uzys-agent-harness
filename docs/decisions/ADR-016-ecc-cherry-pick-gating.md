# ADR-016: ECC cherry-pick 항목을 withEcc opt-in 으로 분리

- **Status**: Accepted
- **Date**: 2026-05-16
- **PR**: (pending v26.55.0)

## Context

`templates/agents/` 와 `templates/skills/` 에 ECC (everything-claude-code) 마켓플레이스에서 cherry-pick 한 항목들이 포함되어 있다. 이 항목들이 manifest 의 CORE_AGENTS / DEV_AGENTS / COMMON_SKILL_DIRS / DEV_SKILL_DIRS / UI_SKILL_DIRS / python-* skill 매핑에 모두 default 로 들어가서, 사용자가 ECC 옵션을 토글하지 않아도 fresh install 시 ECC 의존 항목이 baseline 에 깔리는 상태였다.

사용자 피드백 (2026-05-16): "Phase 1 중에 Skill, Command, Rule 중에 ECC 것들은 덜어내자". 

문제:
- 사용자가 `withEcc=false` (default) 로 install 해도 ECC 컨텐츠 (16+ 항목) 가 .claude/ 에 설치됨
- ECC plugin 자산 (Phase 2 의 ecc-plugin) 과 별개로 baseline 매핑이 ECC 출처 항목을 포함 → 사용자 의식 없는 종속

## Decision

ECC marketplace (`/Users/uzysjung/.claude/plugins/marketplaces/everything-claude-code/`) 의 agents/skills 와 본 repo `templates/` 의 항목을 매칭한 결과:

| 분류 | 본 프로젝트 | ECC cherry-pick (withEcc 필요) |
|---|---|---|
| Core agents | reviewer, data-analyst, strategist | code-reviewer, security-reviewer |
| Dev agents | plan-checker | silent-failure-hunter, build-error-resolver |
| Common skills | north-star, gh-issue-workflow | continuous-learning-v2, strategic-compact, deep-research |
| Dev skills | (없음) | eval-harness, verification-loop, agent-introspection-debugging |
| UI skills | ui-visual-review | e2e-testing |
| Python skills | (없음) | python-patterns, python-testing |
| Commands | uzys/ (withUzysHarness 매핑) | ecc/ |

ECC 항목 모두 `AssetSpec.withEcc === true` 일 때만 manifest 포함. python-* 와 e2e-testing 등은 기존 track 조건 + withEcc 둘 다 만족 시.

## Alternatives

| 안 | 거부 사유 |
|---|---|
| 그대로 두기 (사용자 unaware) | 사용자 명시 요청 위배. ECC 의존 transparency 부족 |
| `withEcc=true` 를 default 로 (BREAKING 회피) | 사용자 의도는 default 빠지는 것. opt-in 강제 |
| ECC 자산 별도 옵션 (`--with-ecc-agents`, `--with-ecc-skills`) 세분화 | 옵션 폭증. 1 토글로 충분 |

## Consequences

### Positive
- Fresh install 시 ECC 의존성 0 (withEcc=true 명시 후에만 설치)
- agents/skills 디렉토리에 무엇이 본 프로젝트 vs cherry-pick 인지 manifest 로 명시
- ECC plugin 자산 (Phase 2) 토글 시 baseline 컨텐츠와 일관성 확보

### Negative
- BREAKING — 기존 install 사용자가 v26.55.0 update 시 ECC agents/skills 16 항목이 빠짐. Update mode 의 prune 가 이전 install 항목 정리. 의도된 동작
- code-reviewer / security-reviewer 가 빠지는 default 는 README/CLAUDE.md 의 agents 표에 영향 → 후속 cycle 에서 문서 정정

### Migration
- v26.55.0 이후 ECC 의존 작업은 `--with-ecc` 명시 또는 interactive 옵션 토글
- 본 repo 의 templates/ 디렉토리에 ECC cherry-pick 항목은 그대로 유지 (옵션 켰을 때 install)
