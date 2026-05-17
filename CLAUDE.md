# [Project Name] - Tooling Track

> Bash 스크립트 + 마크다운 템플릿 + CLI 도구 위주의 메타 프로젝트.

## Stack

- **Shell**: Bash 5+ (macOS, Linux)
- **Templates**: Markdown (`.md`) with YAML frontmatter
- **JSON**: `jq` for parsing/transformation
- **Optional**: Python 3 for CL-v2 scripts
- **Testing**: shellcheck, bats

## Workflow (6-Gate)

```
Define(/uzys:spec) → Plan(/uzys:plan) → Build(/uzys:build) → Verify(/uzys:test) → Review(/uzys:review) → Ship(/uzys:ship)
```

각 단계는 `.claude/hooks/gate-check.sh`로 강제. 이전 단계 미완료 시 다음 단계 실행 차단.

## Active Rules (10개)

| Rule | 적용 |
|------|------|
| git-policy | feature branch, push/PR 의무 |
| change-management | CR 분류, Decision Log, DO NOT CHANGE |
| commit-policy | 즉시 커밋 |
| ship-checklist | 배포 전 체크 (security scan, 의존성 audit) |
| code-style | shellcheck 기준, 명명 규칙 |
| error-handling | exit code, stderr |
| ecc-git-workflow | Conventional Commits |
| ecc-testing | 80% 커버리지, TDD, AAA |
| **cli-development** | Bash 스크립트 표준, cross-platform, hook 컨벤션 |

## Agents

| Agent | Model | 역할 |
|-------|-------|------|
| reviewer (global) | opus, fork | SOD 검증 (5축 리뷰) |
| code-reviewer (ECC) | sonnet | 일상 코드 리뷰 |
| security-reviewer (ECC) | sonnet | 시크릿/취약점 |
