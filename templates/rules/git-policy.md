# Git Policy

프로젝트 레벨 git 규약. 버전 체계는 프로젝트가 정한다 — 여기서 강제하지 않는다.

## Commit · Branch · PR

- Conventional Commits: `<type>: <description>` (feat/fix/refactor/docs/test/chore/perf/ci). 메시지는 **why 중심** — what 은 diff 가 보여준다. Breaking change 는 body 에 `BREAKING CHANGE:`.
- 브랜치: `feat/<name>` · `fix/<name>` · `refactor/<name>`. 새 브랜치는 `-u` 플래그로 push.
- PR: `Closes #N` · `git diff [base]...HEAD` 로 전체 커밋 이력 분석 · 요약에 변경 + 테스트 계획.

## Safety

- `--force` · `reset --hard` · hook 검증 우회 플래그(`--no` + `verify` 옵션 결합 형태) 사용 금지(명시적 요청 제외).
- git config 수정 금지. `.env` · credentials · lock 파일 커밋 금지.

**위 두 줄은 프로즈다 — 아무도 안 막는다.** 되돌릴 수 없는 것은 로컬 훅 말고 **호스트 규칙**으로 건다(우회·재설치가 없다): `bash .uzys-agent-harness/protect-branch.sh --dry-run` 로 먼저 보고 적용한다. 무엇을 걸고 무엇을 못 덮는지는 스크립트가 출력한다.

## Session Cleanup (세션 종료 · `/clear` · `/compact` 직전 필수)

0. **띄운 것을 닫는다** — 이 세션의 백그라운드 프로세스·서브에이전트를 종료한다. 세션이 끝나도 프로세스는 안 끝난다: 부모만 죽고 `ppid=1` 로 재부모화돼 메모리·포트·파일락을 계속 쥔다. `ps -eo pid,ppid,etime,command | grep "$(pwd)"` 로 확인, 알아보는 것만. **다른 프로젝트의 프로세스는 건드리지 않는다.**
1. `gh pr list --state open` — 잔존 PR 이 있으면 **자동 머지 금지**(사용자 명시 합의 필수). `# / title / branch / CI status / mergeable` 을 보고하고 머지 · 그대로 두기 · draft 전환 · 취소를 묻는다.

## Post-Merge Cleanup

`gh pr merge <num> --squash --delete-branch`(repo settings 의 "Automatically delete head branches" 가 켜져 있으면 `--delete-branch` 생략 가능 — 둘 중 하나는 항상 적용) → `git checkout main && git pull --ff-only` → `git branch -d <branch>`(squash merge 후의 "unmerged" 경고는 같은 변경임을 확인한 뒤 `-D`).

## 보고 형식 — "build/verify/review gate ✓" ≠ "main 반영"

로컬 게이트 상태와 원격 상태(PR merged / tag pushed / release)를 **분리**해 적는다. gate ✓ 만 보고 ship 완료라 단정하지 않는다 — open PR 이 1건이라도 있으면 cycle 미완이다.

```
gate:   build ✓ / verify ✓ / review ✓ / ship ✓
main:   PR #123 merged ✓ / tag vX.Y.Z pushed ✓ / release ✓
branch: fix/foo deleted (local + remote) ✓
        OR
main:   PR #123 OPEN — CI pass / mergeable / 사용자 결정 대기
```
