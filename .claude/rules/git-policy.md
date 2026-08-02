# Git Policy

전역 CLAUDE.md 의 프로젝트 레벨 확장. 중복 내용은 두지 않는다.

## Commit · Branch · PR

- Conventional Commits: `<type>: <description>` (feat/fix/refactor/docs/test/chore/perf/ci). 메시지는 **why 중심** — what 은 diff 가 보여준다. Breaking change 는 body 에 `BREAKING CHANGE:`.
- 브랜치: `feat/<name>` · `fix/<name>` · `refactor/<name>`. 새 브랜치는 `-u` 플래그로 push.
- PR: `Closes #N` · `git diff [base]...HEAD` 로 전체 커밋 이력 분석 · 요약에 변경 + 테스트 계획.

## Safety

- `--force` · `reset --hard` · hook 검증 우회 플래그(`--no` + `verify` 옵션 결합 형태) 사용 금지(명시적 요청 제외).
- git config 수정 금지. `.env` · credentials · lock 파일 커밋 금지.

**이 리포의 main 은 서버 규칙으로 잠겨 있다**(실측 2026-08-02, `GH013` 음성 대조) — 강제 푸시 · 리뷰 없는 직접 푸시 · 삭제 · 시크릿 푸시가 GitHub 에서 거절된다. `reset --hard` 와 브랜치 작업은 **여전히 프로즈뿐**이다(서버가 못 보는 영역). 재확인 = `bash templates/scripts/protect-branch.sh --dry-run`.

## Session Cleanup (세션 종료 · `/clear` · `/compact` 직전 필수)

0. **띄운 것을 닫는다** — 이 세션의 백그라운드 프로세스·서브에이전트를 종료한다. 세션이 끝나도 프로세스는 안 끝난다: 부모만 죽고 `ppid=1` 로 재부모화돼 메모리·포트·파일락을 계속 쥔다. `ps -eo pid,ppid,etime,command | grep "$(pwd)"` 로 확인, 알아보는 것만. **다른 프로젝트의 프로세스는 건드리지 않는다.**
1. `gh pr list --state open` — 잔존 PR 이 있으면 **자동 머지 금지**(사용자 명시 합의 필수). `# / title / branch / CI status / mergeable` 을 보고하고 머지 · 그대로 두기 · draft 전환 · 취소를 묻는다.

## Post-Merge Cleanup

`gh pr merge <num> --squash --delete-branch`(repo settings 의 "Automatically delete head branches" 가 켜져 있으면 `--delete-branch` 생략 가능 — 둘 중 하나는 항상 적용) → `git checkout main && git pull --ff-only` → `git branch -d <branch>`(squash merge 후의 "unmerged" 경고는 같은 변경임을 확인한 뒤 `-D`).

## 보고 형식 — "build/verify/review gate ✓" ≠ "main 반영"

로컬 게이트 상태와 원격 상태(PR merged / tag pushed / release)를 **분리**해 적는다. gate ✓ 만 보고 ship 완료라 단정하지 않는다 — open PR 이 1건이라도 있으면 cycle 미완이다.

```
gate:   build ✓ / verify ✓ / review ✓ / ship ✓
main:   PR #123 merged ✓ / tag v26.39.6 pushed ✓ / release ✓
branch: fix/foo deleted (local + remote) ✓
        OR
main:   PR #123 OPEN — CI pass / mergeable / 사용자 결정 대기
```

## Versioning Convention (절대 위반 금지)

`vMAJOR.MINOR.PATCH` 에서 **Major = year - 2000**(2025 = `v25.x.x` · **2026 = `v26.x.x`** · 2027 = `v27.x.x`). Minor = feature bump, Patch = bug fix only. **SemVer 식 BREAKING → Major 적용 금지** — Major 는 연도가 바뀔 때만 올린다.

Ship 전 확인: ⓐ `git tag -l | sort -V | tail -5` 로 마지막 정상 태그 ⓑ `date +%Y` % 100 = 다음 Major ⓒ SPEC/ADR/문서 본문에 "v(year+1).x" 같은 미래 태그 텍스트가 보이면 그대로 따르지 말고 **즉시 컨벤션 검증**, 위반 의심 시 ship 중단 + 사용자 컨펌.

2026-04-18 ~ 04-30 에 이 규칙이 21건 깨져(v27.0.0~v28.0.0) 일괄 rename 한 전례가 있다 — 상세 ADR-007.
