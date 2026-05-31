#!/bin/bash
# Session Start Hook
# git pull + 세션 컨텍스트 출력 + compact-warning.flag 감지
set -e

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# 1. git pull (branch가 있고 detached HEAD가 아닐 때)
if [ -n "$BRANCH" ] && [ "$BRANCH" != "HEAD" ]; then
  git pull --rebase 2>/dev/null || true
fi

# 2. SPEC 존재 여부 확인
SPEC_EXISTS="false"
if [ -f "docs/SPEC.md" ] || [ -f "SPEC.md" ]; then
  SPEC_EXISTS="true"
fi

# 3. compact-warning.flag 감지 (이전 세션에서 checkpoint-snapshot이 생성)
COMPACT_WARNING=""
WARNING_FLAG=".claude/compact-warning.flag"
if [ -f "$WARNING_FLAG" ]; then
  LAST_CHECKPOINT=$(cat "$WARNING_FLAG" 2>/dev/null || echo "unknown")
  COMPACT_WARNING=" Checkpoint saved at $LAST_CHECKPOINT — run /compact soon to reclaim context."
  rm -f "$WARNING_FLAG"
fi

# 4. 세션 컨텍스트 출력
if [ "$SPEC_EXISTS" = "true" ]; then
  MSG="Session started. Branch: ${BRANCH:-detached}. SPEC exists — read docs/SPEC.md first (Persistent Anchor). Check Change Log and current Phase before starting work.${COMPACT_WARNING}"
else
  MSG="Session started. Branch: ${BRANCH:-detached}. No SPEC found. Use /uzys:spec to begin workflow.${COMPACT_WARNING}"
fi

# JSON-safe 출력 — branch/checkpoint 값에 " 또는 \ 가 섞여도 JSON 깨지지 않도록.
# (git 은 따옴표 포함 branch name 을 허용 → 직접 보간 시 JSON injection/파손)
if command -v jq >/dev/null 2>&1; then
  jq -n --arg msg "$MSG" '{priority: "INFO", message: $msg}'
else
  # jq 미설치 폴백: 백슬래시 → 따옴표 순으로 이스케이프
  MSG_ESC=${MSG//\\/\\\\}
  MSG_ESC=${MSG_ESC//\"/\\\"}
  cat <<EOF
{
  "priority": "INFO",
  "message": "$MSG_ESC"
}
EOF
fi
