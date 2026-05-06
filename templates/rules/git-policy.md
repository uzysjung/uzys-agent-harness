# Git Policy

CLAUDE.md Git Policy의 프로젝트 레벨 확장. 중복 내용 제거.

## Commit 메시지

Conventional Commits: `<type>: <description>`
Types: feat, fix, refactor, docs, test, chore, perf, ci

커밋 메시지는 **why 중심**. what은 diff가 보여준다. Breaking change는 body에 `BREAKING CHANGE:` 표기.

## Branch 명명

`feat/<name>`, `fix/<name>`, `refactor/<name>`.

## PR

- Issue 링크: `Closes #N`
- 전체 커밋 이력 분석 (`git diff [base]...HEAD`)
- 요약에 변경 + 테스트 계획 포함
- 새 branch는 `-u` 플래그로 push

## Safety

- `--force`, `reset --hard`, hook 검증 우회 플래그 (`--no` + `verify` 옵션 결합 형태) 사용 금지 (명시적 요청 제외)
- git config 수정 금지
- `.env`, credentials, lock 파일 커밋 금지

## Session Cleanup (필수)

세션 종료 / `/clear` / `/compact` **직전** 다음 절차 강제:

1. `gh pr list --state open` 실행 — open PR 잔존 여부 확인
2. 잔존 PR 발견 시:
   - 자동 머지 금지 — **사용자 명시 합의 필수**
   - 각 PR 상태 보고: `# / title / branch / CI status / mergeable`
   - 다음 행동 옵션 제시: 머지 / 그대로 두기 / draft 전환 / 취소

### "build/verify/review gate ✓" ≠ "main 반영"

ship 보고 시 두 상태를 **반드시 분리**해서 보여줄 것:

- **Local gate 상태**: build/verify/review checkbox completed (`.claude/gate-status.json`)
- **Remote 상태**: PR merged into main + tag pushed + release 게시

gate ✓ 만 보고 ship 완료라 단정하지 않는다. open PR 1건이라도 있으면 cycle 미완.

### 보고 형식 예

```
gate:  build ✓ / verify ✓ / review ✓ / ship ✓  (local gate-status)
main:  PR #123 merged ✓ / tag v26.39.3 pushed ✓ / release ✓
       OR
       PR #123 OPEN — CI pass / mergeable / 사용자 결정 대기
```

## Post-Merge Cleanup (필수)

PR 머지 직후 stale branch 누적 방지. Session Cleanup 의 "open PR 점검" 과 보완 관계.

1. **머지 시 remote branch 자동 삭제** — `gh pr merge <num> --squash --delete-branch`
   - GitHub repo settings 의 "Automatically delete head branches" 토글이 켜져 있으면 `--delete-branch` 생략 가능. 둘 중 1개는 항상 적용
2. **local main 동기화** — `git checkout main && git pull --ff-only`
3. **local feature branch 삭제** — `git branch -d <branch>`
   - squash merge 후엔 git 가 "unmerged" 경고 → 같은 변경 내용 확인 후 `-D` 사용 가능
4. **정기 stale 점검** (선택) — `git branch --merged main | grep -v '^\*\| main$'` 으로 잔존 확인

### 보고 형식 보강

ship 보고에 branch cleanup 상태 한 줄 추가:

```
gate:  build ✓ / verify ✓ / review ✓ / ship ✓
main:  PR #123 merged ✓ / tag v26.39.6 ✓ / release ✓
branch: fix/foo deleted (local + remote) ✓
       OR
branch: fix/foo OPEN — 삭제 필요
```

## Versioning Convention (절대 위반 금지)

**형식**: `vMAJOR.MINOR.PATCH`

- **Major = `year - 2000`** (CalVer-like)
  - 2025 = `v25.x.x`
  - **2026 = `v26.x.x`**
  - 2027 = `v27.x.x`
- **Minor**: feature bump (BREAKING change여도 같은 year 내에서는 Minor만 bump)
- **Patch**: bug fix only

**Year 변경 시점에만 Major bump**. SemVer-식 BREAKING → Major 적용 **금지**.

### Pre-tag checklist (모든 ship 전)

1. `git tag -l | sort -V | tail -5` 마지막 정상 태그 확인
2. 당해년도 매핑 검증 — `date +%Y` % 100 = 다음 Major
3. SPEC/ADR/문서 본문에 "v(year+1).x" 같은 미래 태그 텍스트 보이면 **즉시 컨벤션 검증** — 그대로 따르지 말 것
4. 위반 의심 시 ship 중단 + 사용자 컨펌

### Drift Period (사후 정리)

2026-04-18 ~ 2026-04-30: v27.0.0 ~ v28.0.0 (21건) 컨벤션 위반 누적 → 2026-04-30 일괄 rename to v26.18.0 ~ v26.38.0. 상세 ADR-007 참조.
