#!/usr/bin/env bash
# #513 GLM DeepSWE 전수 A/B — 과제 하나씩, 같은 과제의 두 팔을 붙여서 돈다(설계 §15).
#
#   bash docs/plans/513-eval-evidence/run-full.sh <env-file> <model>     # model = glm-5.3 | glm-5.3-flash
#
# 모델마다 하나씩 따로 띄운다(동시에 둘 = 컨테이너 2개). 다시 실행하면 끝난 팔은 건너뛴다(재개).
# 팔 순서는 과제마다 seed 로 섞는다 — 같은 과제의 A·B 가 비슷한 시각에 돌아 제공자 부하가 짝 안에서 상쇄된다.
# Z.ai 한도(1113)에 걸린 팔은 무효로 옮기고 기다렸다가 그 팔만 다시 돈다(설계 §5.3 — 그 실행 무효 + 한도 회복 뒤 재실행).
# 과제가 끝나면 그 과제의 이미지(과제 컨테이너 · egress 프록시)를 지운다 — 하나에 약 3 GB.
set -uo pipefail   # -e 없음 — 팔 하나의 실패가 전체를 멈추지 않게 실패는 각 자리에서 명시적으로 다룬다
cd "$(dirname "$0")/../../.." || exit 3

ENV_FILE="${1:?env-file (저장소 밖)}"; MODEL="${2:?glm-5.3 | glm-5.3-flash}"
case "$MODEL" in glm-5.3|glm-5.3-flash) ;; *) echo "model: glm-5.3 | glm-5.3-flash" >&2; exit 3 ;; esac
TASKS_DIR="${DEEPSWE_TASKS:-$HOME/eval-513/deep-swe/tasks}"
JOBS="${EVAL_JOBS_DIR:-$HOME/eval-513/jobs}"
LOG="$JOBS/full-$MODEL.log"
WAIT_SECONDS=${EVAL_QUOTA_WAIT:-1800}   # 1113 뒤 다시 시도할 때까지
MAX_QUOTA_RETRIES=${EVAL_QUOTA_RETRIES:-12}
mkdir -p "$JOBS/invalid" || exit 3
log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG"; }

# 과제 목록과 팔 순서 — 정렬한 이름을 seed 513 으로 섞는다(머신마다 같은 순서. Pier 의 iterdir 표본과는 다르다, 설계 §3).
ORDER=$(python3 -I - "$TASKS_DIR" <<'EOF'
import random, sys, pathlib
d = pathlib.Path(sys.argv[1])
ids = sorted(p.name for p in d.iterdir() if (p / "task.toml").is_file() and (p / "instruction.md").is_file())
random.Random(513).shuffle(ids)
for t in ids:
    print(t, "A B" if random.Random(f"513:{t}").random() < 0.5 else "B A")
EOF
)
log "start model=$MODEL tasks=$(printf '%s\n' "$ORDER" | wc -l | tr -d ' ')"

job_dir() { echo "$JOBS/513-deepswe-$MODEL-$2-full-$1"; }   # task arm
done_ok() { [ -f "$1/result.json" ] && ls "$1"/*/result.json >/dev/null 2>&1; }
quota_hit() { local a; for a in "$1"/*/agent; do [ -d "$a" ] && grep -rqE '\[1113\]|Insufficient balance' "$a" && return 0; done; return 1; }   # 과제·정리 세션 기록 전부

run_arm() { # task arm
  local task="$1" arm="$2" dir tries=0
  dir=$(job_dir "$task" "$arm")
  while :; do
    if done_ok "$dir" && ! quota_hit "$dir"; then return 0; fi
    if [ -d "$dir" ]; then
      if quota_hit "$dir"; then
        mv "$dir" "$JOBS/invalid/$(basename "$dir")-$(date -u +%Y%m%dT%H%M%SZ)"
        tries=$((tries + 1))
        [ "$tries" -le "$MAX_QUOTA_RETRIES" ] || { log "GIVEUP quota $task $arm"; return 1; }
        log "quota(1113) $task $arm — ${WAIT_SECONDS}s 대기 후 재시도 $tries"; sleep "$WAIT_SECONDS"
      else
        # 결과 없이 끊긴 job(머신 재시작 등) — 남은 것을 무효로 옮기고 처음부터
        mv "$dir" "$JOBS/invalid/$(basename "$dir")-incomplete-$(date -u +%Y%m%dT%H%M%SZ)"
        log "incomplete $task $arm — 다시 돈다"
      fi
    fi
    log "run $task $arm"
    EVAL_TASKS="$task" EVAL_ARMS="$arm" EVAL_MODEL="$MODEL" EVAL_STAMP="full-$task" EVAL_EFFORT=max \
      EVAL_AGENT_TIMEOUT_MULT=0.67 EVAL_CONCURRENCY=1 EVAL_JOBS_DIR="$JOBS" \
      bash docs/plans/513-eval-evidence/run-pilot.sh "$ENV_FILE" glm deepswe </dev/null >>"$LOG" 2>&1
    local rc=$?; [ "$rc" -eq 0 ] || log "pier exit $rc $task $arm"
  done
}

clean_images() { # task — 이 과제·이 모델의 trial 이 만든 이미지만
  local trial
  for d in "$(job_dir "$1" A)" "$(job_dir "$1" B)"; do
    for t in "$d"/*/; do
      [ -f "$t/result.json" ] || continue
      trial=$(basename "$t" | tr '[:upper:]' '[:lower:]')
      docker rmi "$trial-main:latest" "$trial-pier-egress-proxy:latest" </dev/null >/dev/null 2>&1   # 이미 없으면 실패 — 무시
    done
  done
}

printf '%s\n' "$ORDER" | while read -r task arms; do
  for arm in $arms; do run_arm "$task" "$arm"; done
  clean_images "$task"
  log "done $task"
done
log "finish model=$MODEL"
