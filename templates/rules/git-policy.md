# Git Policy

프로젝트 레벨 git 규약. 버전 체계는 프로젝트가 정한다 — 여기서 강제하지 않는다.

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

0. **띄운 것을 닫는다** — 이 세션의 백그라운드 프로세스·서브에이전트를 종료한다. 세션이 끝나도
   프로세스는 안 끝난다: 부모만 죽고 `ppid=1` 로 재부모화돼 메모리·포트·파일락을 계속 쥔다.
   `ps -eo pid,ppid,etime,command | grep "$(pwd)"` 로 확인, 알아보는 것만.
   **다른 프로젝트의 프로세스는 건드리지 않는다.**
1. `gh pr list --state open` 실행 — open PR 잔존 여부 확인
2. 잔존 PR 발견 시:
   - 자동 머지 금지 — **사용자 명시 합의 필수**
   - 각 PR 상태 보고: `# / title / branch / CI status / mergeable`
   - 다음 행동 옵션 제시: 머지 / 그대로 두기 / draft 전환 / 취소

### "build/verify/review gate ✓" ≠ "main 반영"

ship 보고 시 두 상태를 **반드시 분리**해서 보여줄 것:

- **Local gate 상태**: build/verify/review checkbox completed
- **Remote 상태**: PR merged into main + tag pushed + release 게시

gate ✓ 만 보고 ship 완료라 단정하지 않는다. open PR 1건이라도 있으면 cycle 미완.

## Post-Merge Cleanup (필수)

PR 머지 직후 stale branch 누적 방지. Session Cleanup 의 "open PR 점검" 과 보완 관계.

1. **머지 시 remote branch 자동 삭제** — `gh pr merge <num> --squash --delete-branch`
   - GitHub repo settings 의 "Automatically delete head branches" 토글이 켜져 있으면 `--delete-branch` 생략 가능. 둘 중 1개는 항상 적용
2. **local main 동기화** — `git checkout main && git pull --ff-only`
3. **local feature branch 삭제** — `git branch -d <branch>`
   - squash merge 후엔 git 가 "unmerged" 경고 → 같은 변경 내용 확인 후 `-D` 사용 가능
4. **정기 stale 점검** (선택) — `git branch --merged main | grep -v '^\*\| main$'` 으로 잔존 확인

### 보고 형식 (ship 보고 공통)

```
gate:   build ✓ / verify ✓ / review ✓ / ship ✓
main:   PR #123 merged ✓ / tag vX.Y.Z pushed ✓ / release ✓
branch: fix/foo deleted (local + remote) ✓
        OR
main:   PR #123 OPEN — CI pass / mergeable / 사용자 결정 대기
```
