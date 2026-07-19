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

# 4. 이전 세션이 남긴 고아 프로세스 감지
#
# 왜 시작 시점인가: 세션 **종료** 훅은 출력이 유실될 수 있어(세션이 이미 닫히는 중) 경고가
# 사람에게 도달한다는 보장이 없다. 시작 시점은 출력이 반드시 보인다. 한 세션 늦게 잡히지만
# 잡히기는 한다 — 실측 근거: 최근 30일 3,661 세션 중 백그라운드/에이전트를 쓴 30건의 66%가
# 정리 흔적 0이었고, 고아 agent-browser 3개(2개는 18시간 경과)가 실제로 살아 있었다.
#
# 범위: **이 프로젝트 경로를 커맨드라인에 담은** 고아(ppid=1)만 센다. 다른 프로젝트의
# 프로세스를 남의 세션이 판단해선 안 된다(직접 겪은 오판 — 남의 것을 정리 대상으로 올렸다).
# 탐지만 하고 죽이지 않는다. 무엇을 죽일지는 사람이 정한다.
#
# 이식성: `ps -eo pid,ppid,command` 만 쓴다. BSD/GNU 분기가 필요한 것(realpath -m, find -newermt,
# stat -c 등)은 쓰지 않는다 — 조용히 빈 결과를 내고 "이상 없음"으로 오독되는 것이 이 훅의
# 실패 모드이기 때문이다(cli-development.md §Cross-Platform).
ORPHAN_NOTE=""
PROJ_DIR=$(pwd)
ORPHANS=$(ps -eo pid,ppid,command 2>/dev/null | awk -v d="$PROJ_DIR" '$2==1 && index($0,d)>0 {n++} END{print n+0}')
if [ "${ORPHANS:-0}" -gt 0 ]; then
  ORPHAN_NOTE=" WARNING: ${ORPHANS} orphaned process(es) from a previous session still reference this project (parent died, reparented to init). Inspect with: ps -eo pid,ppid,etime,command | grep \$(pwd) | grep -v grep — then stop what you recognise. Leaving them costs memory and can hold ports or file locks."
fi

# 5. 세션 컨텍스트 출력
if [ "$SPEC_EXISTS" = "true" ]; then
  MSG="Session started. Branch: ${BRANCH:-detached}. SPEC exists — read docs/SPEC.md first (Persistent Anchor). Check Change Log and current Phase before starting work.${COMPACT_WARNING}${ORPHAN_NOTE}"
else
  MSG="Session started. Branch: ${BRANCH:-detached}. No SPEC found.${COMPACT_WARNING}${ORPHAN_NOTE}"
fi

cat <<EOF
{
  "priority": "INFO",
  "message": "$MSG"
}
EOF
