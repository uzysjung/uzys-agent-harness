# Docker Test Environment — v26.64.0

격리된 Docker 컨테이너에서 `agent-harness` 의 install 동작을 검증한다. **사용자 PC 글로벌 (`~/.claude/`, `~/.codex/`, `~/.opencode/`, npm -g) 미오염** — host filesystem mount 없음.

## 용도

v26.64.0 의 AC1/AC2 검증:
- `install --scope project` (default) → 컨테이너 글로벌 fs diff = 0
- `install --scope global` (opt-in) → ADR-020 매트릭스대로 정확 write
- `uninstall` → project 자산 reverse, global 자산 미수정

## 구조

```
test/docker/
├── Dockerfile              # node:20 + mock claude/skills + harness install
├── run.sh                  # build + 시나리오 실행 entry
├── snapshot.sh             # fs/npm snapshot 유틸 (source 하여 사용)
├── mocks/
│   ├── claude              # plugin install stub (~/.claude/plugins/cache/ 생성)
│   └── skills              # skills add stub (~/.claude/skills/ 생성)
└── scenarios/
    ├── scenario-smoke.sh        # build + --help + snapshot 동작 (Phase 0 완료)
    ├── scenario-project.sh      # install --scope project → diff=0 (Phase 2 후)
    ├── scenario-global.sh       # install --scope global → 정확 write (Phase 2 후)
    └── scenario-uninstall.sh    # install + uninstall reverse (Phase 2 후)
```

## 사용법

```bash
./test/docker/run.sh smoke              # build + smoke
./test/docker/run.sh project            # Phase 2 후 작동
./test/docker/run.sh global             # Phase 2 후 작동
./test/docker/run.sh uninstall          # Phase 2 후 작동
./test/docker/run.sh all                # 전체
```

## Mock CLI

`claude` 는 npm registry 미공개 (폐쇄형) → mock 으로 대체. spawn arg 검증 + fs write 시뮬레이션. `npm`, `codex`, `opencode` 관련은 컨테이너 안 실제 동작 (host 무영향).

| Mock 명령 | 동작 |
|----------|------|
| `claude plugin marketplace add <url>` | print only |
| `claude plugin install <id>` | `~/.claude/plugins/cache/test-marketplace/<id>/v0.0.0/.plugin.json` 생성 |
| `skills add <source>` | `~/.claude/skills/<id>/skill.yml` 생성 |

## Snapshot 유틸

```bash
source ./snapshot.sh
snap_take /tmp/before
# ... install 실행
snap_take /tmp/after
snap_diff /tmp/before /tmp/after  # exit 0 = no change, exit 1 = changed
```

`agent-harness` 자기 자신은 npm-g snapshot 에서 제외 (image 안 항상 깔려있음).

## 관련

- `docs/PRD/v26-64-project-scope-only.md`
- `docs/decisions/ADR-020-project-scope-default.md`
- `docs/NORTH_STAR.md` D16
