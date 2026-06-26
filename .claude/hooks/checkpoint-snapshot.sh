#!/bin/bash
# ============================================================
# checkpoint-snapshot.sh — PostToolUse hook
#
# 목적: tool call count가 threshold 초과 시 현재 세션 스냅샷을
#       docs/checkpoints/ 에 자동 저장하고 /compact 경고 flag 생성.
#
# 제약: Claude Code hook은 /compact 슬래시 커맨드를 직접 호출할 수
#       없음. 따라서 "자동 compact"는 불가능 — 대신 checkpoint 저장 +
#       session-start 경고로 사용자 수동 /compact 유도.
#
# Exit codes: 항상 0 (async hook, 차단 금지)
# ============================================================
set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
THRESHOLD="${CHECKPOINT_THRESHOLD:-40}"
SESSION_ID="${CLAUDE_SESSION_ID:-${PPID:-default}}"
COUNTER_FILE="/tmp/claude-checkpoint-count-${SESSION_ID}"
CHECKPOINT_DIR="$PROJECT_DIR/docs/checkpoints"
WARNING_FLAG="$PROJECT_DIR/.claude/compact-warning.flag"

# Counter increment
if [ -f "$COUNTER_FILE" ]; then
  count=$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)
  count=$((count + 1))
  echo "$count" > "$COUNTER_FILE"
else
  count=1
  echo "$count" > "$COUNTER_FILE"
fi

# Threshold 미도달이면 종료
if [ "$count" -lt "$THRESHOLD" ]; then
  exit 0
fi

# threshold 초과 → checkpoint 저장
mkdir -p "$CHECKPOINT_DIR" 2>/dev/null || exit 0

TS=$(date +%Y%m%d-%H%M%S)
CHECKPOINT_FILE="$CHECKPOINT_DIR/${TS}.md"

# Git 정보 수집 (git 미존재 환경 안전)
GIT_BRANCH="(unknown)"
GIT_HEAD="(unknown)"
GIT_STATUS="(unknown)"
if command -v git &>/dev/null && [ -d "$PROJECT_DIR/.git" ]; then
  GIT_BRANCH=$(cd "$PROJECT_DIR" && git branch --show-current 2>/dev/null || echo "(detached)")
  GIT_HEAD=$(cd "$PROJECT_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "(no commits)")
  GIT_STATUS=$(cd "$PROJECT_DIR" && git status --short 2>/dev/null | head -20)
fi

# Checkpoint 파일 작성
cat > "$CHECKPOINT_FILE" <<EOF
# Checkpoint — $TS

> 자동 생성 by checkpoint-snapshot.sh (tool count $count >= $THRESHOLD).
> 사용자 수동 \`/compact\` 실행 권장. 이 파일은 compact 후 컨텍스트 복원 힌트로 사용.

## Git

- Branch: $GIT_BRANCH
- HEAD: $GIT_HEAD

### Changed Files
\`\`\`
$GIT_STATUS
\`\`\`

## Session ID
- \`$SESSION_ID\`
- Tool count at snapshot: $count

## Recovery Hint

compact 후 다음을 확인:
1. \`git status\` — 변경 사항 복원
2. \`docs/SPEC.md\` + \`docs/todo.md\` — 현재 작업 컨텍스트
3. 최근 checkpoint: \`ls -t docs/checkpoints/ | head -5\`
EOF

# Counter 리셋
echo "0" > "$COUNTER_FILE"

# Warning flag 생성 (session-start hook이 감지해서 경고 재표시)
mkdir -p "$(dirname "$WARNING_FLAG")"
echo "$TS" > "$WARNING_FLAG"

# stderr에 즉시 경고 (async이므로 차단 안 됨)
echo "[checkpoint-snapshot] Tool count $count reached. Saved: $CHECKPOINT_FILE" >&2
echo "[checkpoint-snapshot] Consider running /compact to reclaim context window." >&2

exit 0
