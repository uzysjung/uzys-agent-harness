#!/bin/bash
# Session Start Hook
# 세션 컨텍스트 출력 + 고아 프로세스 감지
set -e

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# 1. SPEC 존재 여부 확인
SPEC_EXISTS="false"
if [ -f "docs/SPEC.md" ] || [ -f "SPEC.md" ]; then
  SPEC_EXISTS="true"
fi

# 2. 이전 세션이 남긴 고아 프로세스 감지
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
# **물리 경로도 함께 본다.** macOS 의 `/var` 는 `/private/var` 로의 심링크라 `pwd` 는
# `/var/...`, 커널·`lsof` 는 `/private/var/...` 를 낸다. 논리 경로만 대면 접두사가 어긋나
# 실재하는 고아를 **0건으로** 보고한다 — 실제로 그렇게 짰다가 진짜 고아를 만든 시험에서 잡혔다.
PROJ_DIR_P=$(pwd -P 2>/dev/null || printf '%s' "$PROJ_DIR")

# **한 번만 찍고 그 스냅샷을 읽는다.** `ps | grep <이름>` 은 grep 자신의 커맨드라인을 매치해
# 항상 양성을 낸다 — 이 리포가 실제로 오판한 형태다.
PS_SNAP=$(ps -eo pid,ppid,command 2>/dev/null || true)

# ⓐ 커맨드라인에 프로젝트 경로가 **든** 고아 (`npm run dev /path/...` 처럼 경로를 인자로 받은 것).
ORPHANS=$(printf '%s\n' "$PS_SNAP" | awk -v d="$PROJ_DIR" '$2==1 && index($0,d)>0 {n++} END{print n+0}')

# ⓑ 커맨드라인에 경로가 **없는** 고아. 서브에이전트가 이 모양이다 — 경로는 cwd 에만 있어서
#   ⓐ 는 이 부류를 **구조적으로 0건**으로 보고했다(#326 실측: 살아 있는 서브에이전트 2건 → 0건).
#   0 을 내는 탐지기는 없는 것보다 나쁘다. 거짓 안심을 준다.
#
# **비용 때문에 후보를 먼저 좁힌다.** cwd 를 묻는 것은 macOS 에서 pid 당 약 4 ms 다(실측).
#   ppid=1 전체(이 머신 433개)에 물으면 세션 시작이 배로 느려지고, 그 비용은 설치받은
#   사람이 **매 세션** 낸다. 그래서 ⓐ 가 이미 세지 않은 것 중 **에이전트 부류만** 보고,
#   후보가 0이면 cwd 를 아예 안 묻는다. 상한 40개.
#
#   **비용의 원인을 한 번 잘못 짚었다.** 처음엔 후보 수 탓인 줄 알고 범위를 좁혔는데, 재보니
#   **후보 1개짜리 `lsof` 가 1,444 ms** 였다 — 비싼 것은 후보 수가 아니라 `lsof` 자신이었다.
#   `-b`(블록 가능 호출 회피)를 붙이자 같은 답에 **74 ms** 가 됐고, 그래서 범위를 다시 넓힐 수
#   있었다. 좁힌 채로 뒀으면 경로가 argv 에 없는 비-에이전트 고아(디렉터리 안에서 띄운
#   `node server.js` 등)를 영영 못 봤을 것이다.
CAND=$(printf '%s\n' "$PS_SNAP" | awk -v d="$PROJ_DIR" \
  '$2==1 && index($0,d)==0 && /claude|node|python|bun|deno|--agent-name/ {print $1}' | head -40)
CWD_ORPHANS=0
if [ -n "$CAND" ]; then
  if [ -d /proc ]; then
    # Linux: /proc 는 사실상 공짜다.
    for pid in $CAND; do
      cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || true)
      case "$cwd" in
        "$PROJ_DIR" | "$PROJ_DIR"/* | "$PROJ_DIR_P" | "$PROJ_DIR_P"/*) CWD_ORPHANS=$((CWD_ORPHANS + 1)) ;;
      esac
    done
  elif command -v lsof > /dev/null 2>&1; then
    # macOS: /proc 이 없다. 한 번에 묻고, 접두사 일치로 **이 프로젝트 밑**만 센다 —
    # 다른 프로젝트의 고아를 남의 세션이 판단해선 안 된다.
    # `-b` 가 이 검사를 쓸 수 있게 만든다 — 블록 가능한 커널 호출을 피한다. 실측: 후보 1개에
    # `-b` 없이 **1,444 ms**, 있으면 **74 ms**(19배)이고 답은 같다(cwd 28건 동일). `-w` 는 그때
    # 나는 경고를 죽이고, `-n`·`-P` 는 우리가 안 쓰는 이름 해석을 건너뛴다.
    CWD_ORPHANS=$(lsof -b -w -n -P -p "$(printf '%s' "$CAND" | tr '\n' ',' | sed 's/,$//')" -a -d cwd -Fn 2>/dev/null \
      | awk -v d="$PROJ_DIR" -v dp="$PROJ_DIR_P" '
          substr($0,1,1)=="n" {
            p = substr($0,2)
            if (p==d || index(p, d "/")==1 || p==dp || index(p, dp "/")==1) n++
          } END {print n+0}')
  fi
  # lsof 도 /proc 도 없으면 CWD_ORPHANS 는 0 이다. 이 경우는 **못 본 것**이지 없는 것이 아니다.
fi

ORPHAN_TOTAL=$((${ORPHANS:-0} + ${CWD_ORPHANS:-0}))
if [ "$ORPHAN_TOTAL" -gt 0 ]; then
  ORPHAN_NOTE=" WARNING: ${ORPHAN_TOTAL} orphaned process(es) from a previous session still belong to this project (parent died, reparented to init); ${CWD_ORPHANS} of them are only visible by working directory, which is how subagents look. Inspect with: ps -eo pid,ppid,etime,command | grep \$(pwd) | grep -v grep — and for the rest, resolve each candidate's cwd. Then stop what you recognise. Leaving them costs memory and can hold ports or file locks."
fi

# 3. 세션 컨텍스트 출력
#
# **스키마가 계약이다.** CLI 가 읽는 필드가 아니면 **유효 JSON 인 채로 조용히 버려진다** —
# 훅은 돌고 exit 0 이고 로그에도 남지만 모델은 아무것도 못 본다. 실패가 아무 증상을 안 내므로
# 사람이 알아채지 못한다. SessionStart 가 읽는 것은
# `hookSpecificOutput.{additionalContext|initialUserMessage}` 다.
# 조용히 버려지는 출력은 컨텍스트 비용이 0 인 대신 기능도 0 이다.
#
# 전례: 이 리포의 이전 판본이 `{"priority","message"}` 를 뱉어 hook attachment 40건 중 모델이 보는
# `content` 가 채워진 것은 1건뿐이었고, 그 1건조차 당시 `git pull` 출력이 앞에 붙어 JSON 이 **깨진**
# 덕분이었다(그 `git pull` 은 이후 무승인 실행이라는 별도 사유로 제거됐다 — ADR-058). 고아 프로세스
# 경고도 SPEC 앵커도 의도대로 도달한 적이 없다.
if [ "$SPEC_EXISTS" = "true" ]; then
  MSG="Session started. Branch: ${BRANCH:-detached}. SPEC exists — read docs/SPEC.md first (Persistent Anchor). Check Change Log and current Phase before starting work.${ORPHAN_NOTE}"
else
  MSG="Session started. Branch: ${BRANCH:-detached}. No SPEC found.${ORPHAN_NOTE}"
fi

# JSON 문자열 이스케이프 — 백슬래시 먼저, 그 다음 따옴표(순서를 바꾸면 이중 이스케이프된다).
# `jq` 를 쓰지 않는 이유: 훅은 jq 미설치 환경에서도 돌아야 한다 (cli-development.md).
ESCAPED=$(printf '%s' "$MSG" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "$ESCAPED"
  }
}
EOF
