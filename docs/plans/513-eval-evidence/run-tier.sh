#!/usr/bin/env bash
# #513 단계 실행기 — 설계 513-eval-framework-design.md §1(단계 표) · §3(두 팔) · §6(잠금본).
#
#   bash docs/plans/513-eval-evidence/run-tier.sh <superlight|light|medium|heavy> <하네스 판>
#   DRY_RUN=1 bash …/run-tier.sh superlight 26.174.0      # pier 명령만 찍는다(아무것도 쓰지 않는다)
#
# 벤치마크마다 순서 파일의 앞 N 과제(deepswe-hard-v1-order.tsv · swtbench-verified-order.txt) × 반복 × 두 팔.
# 시행 하나 = `pier run` 하나(job = <bench>-<arm>-r<rep>-<task>). 같은 과제·반복의 A·B 를 동시에 돈다(동시 2) —
# 제공자 부하가 짝 안에서 상쇄되고, 과제가 끝나면 그 과제의 이미지를 지운다.
# 재사용: 같은 판·같은 잠금본(ROOT/lock.txt)이면 끝난 시행(trial result.json 있음)은 건너뛴다 — 단계를 올리면 늘어난 과제·반복만 돈다.
# 무효(설계 §5 C6): Z.ai 한도(1113)·결과 없이 끊긴 시행은 ROOT/invalid/ 로 옮기고(ROOT/invalid.tsv 에 한 줄) 다시 돈다(run-full.sh 승계).
# 키: env-file 은 경로만 pier --env-file 로 넘긴다 — 이 스크립트는 파일을 열지 않는다.
#
# 환경변수(기본값) — 리허설·시험 전용 값은 잠금본(lock.txt)에 함께 남는다:
#   EVAL_ENV_FILE (~/eval-513/glm.env) · EVAL_JOBS_ROOT (~/eval-513/jobs-v1/<판>) · EVAL_BENCHES ("deepswe swtbench") · EVAL_ARMS ("A B")
#   EVAL_N_DEEPSWE · EVAL_N_SWT · EVAL_REPS (단계 표 값을 덮는다) · EVAL_EXTRA_AK ("k=v k=v", 리허설: session=script:<경로> normalize=off)
#   EVAL_QUOTA_WAIT (1800) · EVAL_QUOTA_RETRIES (12) · EVAL_INCOMPLETE_RETRIES (2)
set -uo pipefail   # -e 없음 — 시행 하나의 실패가 전체를 멈추지 않게 실패는 자리마다 다룬다
HERE="$(cd "$(dirname "$0")" && pwd)"

TIER="${1:?단계: superlight|light|medium|heavy}"; VER="${2:?하네스 판 (예: 26.174.0)}"
case "$TIER" in
  superlight) N_DS=4;  N_SWT=2;  REPS=1 ;;
  light)      N_DS=8;  N_SWT=6;  REPS=1 ;;
  medium)     N_DS=20; N_SWT=30; REPS=3 ;;
  heavy)      N_DS=31; N_SWT=60; REPS=3 ;;
  *) echo "단계: superlight|light|medium|heavy" >&2; exit 3 ;;
esac
N_DS=${EVAL_N_DEEPSWE:-$N_DS}; N_SWT=${EVAL_N_SWT:-$N_SWT}; REPS=${EVAL_REPS:-$REPS}

# ── 결과를 보기 전에 고정하는 값(설계 §3 · invariants) ─────────────────────────────
BUNDLE=deepswe-swt-v1
CLAUDE_CODE_VERSION=2.1.302
MODEL=glm-5.3
EFFORT=max
MAX_TURNS=300
MAX_BUDGET_USD=1000          # Claude 가격표로 GLM 토큰을 환산한 금액이라 상한이 아니다(사실상 무제한)
BASE_URL=https://api.z.ai/api/anthropic
MULT_deepswe=1.0             # 10800s → 3h (공식값)
MULT_swtbench=3.0            # 1200s → 60분 (설계 B4)

ENV_FILE="${EVAL_ENV_FILE:-$HOME/eval-513/glm.env}"
DS_TASKS="${DEEPSWE_TASKS:-$HOME/eval-513/deep-swe/tasks}"
SWT_TASKS="${SWT_TASKS:-$HOME/eval-513/swtbench/tasks/swtbench-verified}"
ROOT="${EVAL_JOBS_ROOT:-$HOME/eval-513/jobs-v1/$VER}"
BENCHES="${EVAL_BENCHES:-deepswe swtbench}"
ARMS="${EVAL_ARMS:-A B}"
EXTRA_AK="${EVAL_EXTRA_AK:-}"
WAIT_SECONDS=${EVAL_QUOTA_WAIT:-1800}; MAX_QUOTA_RETRIES=${EVAL_QUOTA_RETRIES:-12}; MAX_INCOMPLETE=${EVAL_INCOMPLETE_RETRIES:-2}
DRY=${DRY_RUN:-0}

case "$ENV_FILE" in "$HERE"/*|"$(cd "$HERE/../../.." && pwd)"/*) echo "env-file 은 저장소 밖에 둔다" >&2; exit 3;; esac
[ -f "$ENV_FILE" ] || { echo "env-file 없음: $ENV_FILE" >&2; exit 3; }

tasks_of() { # bench → 순서 파일 앞 N
  case "$1" in
    deepswe)  cut -f1 "$HERE/deepswe-hard-v1-order.tsv" | head -n "$N_DS" ;;
    swtbench) head -n "$N_SWT" "$HERE/swtbench-verified-order.txt" ;;
  esac
}
tasks_dir() { case "$1" in deepswe) echo "$DS_TASKS" ;; swtbench) echo "$SWT_TASKS" ;; esac; }
mult() { case "$1" in deepswe) echo "$MULT_deepswe" ;; swtbench) echo "$MULT_swtbench" ;; esac; }

# 작업 트리 collect(설계 §4-2)가 빠진 DeepSWE 과제로 돌면 묶음 판이 섞인다 — 돌기 전에 막는다
case " $BENCHES " in *" deepswe "*)
  python3 -I "$HERE/add-worktree-collect.py" "$DS_TASKS" "$HERE/deepswe-hard-v1.txt" --check >/dev/null \
    || { echo "DeepSWE task.toml 에 worktree collect 가 없다 — python3 -I $HERE/add-worktree-collect.py $DS_TASKS $HERE/deepswe-hard-v1.txt" >&2; [ "$DRY" = 1 ] || exit 3; } ;;
esac

lock_text() {
  local pier_v; pier_v=$(pier --version 2>&1 | tr -d '\n')
  printf '%s\n' "bundle=$BUNDLE" "harness=$VER" "claude_code=$CLAUDE_CODE_VERSION" "pier=$pier_v" "model=$MODEL" "effort=$EFFORT" \
    "max_turns=$MAX_TURNS" "max_budget_usd=$MAX_BUDGET_USD" "base_url=$BASE_URL" "mult_deepswe=$MULT_deepswe" "mult_swtbench=$MULT_swtbench" \
    "extra_ak=$EXTRA_AK" "env_file=$ENV_FILE"
  (cd "$HERE" && shasum -a 256 eval_agent.py eval_common.py deepswe-hard-v1-order.tsv swtbench-verified-order.txt add-worktree-collect.py) | sed 's/^/sha256 /'
}

if [ "$DRY" != 1 ]; then
  mkdir -p "$ROOT/invalid" || exit 3
  if [ -f "$ROOT/lock.txt" ]; then
    lock_text | diff "$ROOT/lock.txt" - >/dev/null || { echo "잠금본이 다르다 — 앞 시행을 재사용할 수 없다. 새 EVAL_JOBS_ROOT 를 쓴다:" >&2; lock_text | diff "$ROOT/lock.txt" - >&2; exit 4; }
  else
    lock_text > "$ROOT/lock.txt"
  fi
fi
LOG="$ROOT/run.log"
log() { if [ "$DRY" = 1 ]; then printf '# %s\n' "$*"; else printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG"; fi; }
invalid() { # dir reason
  local dst; dst="$ROOT/invalid/$(basename "$1")-$2-$(date -u +%Y%m%dT%H%M%SZ)"
  mv "$1" "$dst" && printf '%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$(basename "$1")" "$2" >> "$ROOT/invalid.tsv"
}

done_ok() { ls "$1"/*/result.json >/dev/null 2>&1; }   # trial result.json = Pier 가 시행을 마쳤다(job result.json 은 시작할 때 생긴다)
quota_hit() { local a; for a in "$1"/*/agent; do [ -d "$a" ] && grep -rqE '\[1113\]|Insufficient balance' "$a" && return 0; done; return 1; }

pier_cmd() { # bench task arm job → 명령 배열을 CMD 에
  local bench="$1" task="$2" arm="$3" job="$4" harness=off kv
  [ "$arm" = B ] && harness="$VER"
  CMD=(pier run -p "$(tasks_dir "$bench")" -i "$task" --agent-import-path eval_agent:EvalClaudeCode -m "$MODEL"
    --ak "version=$CLAUDE_CODE_VERSION" --ak "reasoning_effort=$EFFORT" --ak "max_turns=$MAX_TURNS" --ak "max_budget_usd=$MAX_BUDGET_USD"
    --ak "harness=$harness" --ak "bench=$bench")
  for kv in $EXTRA_AK; do CMD+=(--ak "$kv"); done
  CMD+=(--ae CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 --ae DISABLE_AUTOUPDATER=1 --ae "ANTHROPIC_BASE_URL=$BASE_URL" --ae API_TIMEOUT_MS=3000000
    --env-file "$ENV_FILE" --agent-timeout-multiplier "$(mult "$bench")" -n 1 -y -o "$ROOT" --job-name "$job")
}

run_trial() { # bench task arm rep
  local bench="$1" task="$2" arm="$3" rep="$4" job dir quota=0 incomplete=0 ran=0
  job="$bench-$arm-r$rep-$task"; dir="$ROOT/$job"
  pier_cmd "$bench" "$task" "$arm" "$job"
  if [ "$DRY" = 1 ]; then printf 'PYTHONPATH=%q ' "$HERE"; printf '%q ' "${CMD[@]}"; echo; return 0; fi
  while :; do
    if [ -d "$dir" ]; then
      if done_ok "$dir" && ! quota_hit "$dir"; then [ "$ran" = 1 ] && log "finished $job" || log "skip $job (끝난 시행 재사용)"; return 0; fi
      if quota_hit "$dir"; then
        invalid "$dir" quota1113; quota=$((quota + 1))
        [ "$quota" -le "$MAX_QUOTA_RETRIES" ] || { log "GIVEUP quota $job"; return 1; }
        log "quota(1113) $job — ${WAIT_SECONDS}s 대기 후 재시도 $quota"; sleep "$WAIT_SECONDS"
      else
        invalid "$dir" incomplete; incomplete=$((incomplete + 1))
        [ "$incomplete" -le "$MAX_INCOMPLETE" ] || { log "GIVEUP incomplete $job"; return 1; }
        log "incomplete $job — 다시 돈다 $incomplete"
      fi
    fi
    log "run $job"
    PYTHONPATH="$HERE${PYTHONPATH:+:$PYTHONPATH}" PYTHONDONTWRITEBYTECODE=1 "${CMD[@]}" </dev/null >>"$ROOT/pier-$job.log" 2>&1
    local rc=$?; ran=1; [ "$rc" -eq 0 ] || log "pier exit $rc $job"
    # 끝났는데 trial 결과가 없으면 다음 바퀴에서 incomplete 로 처리된다
  done
}

base_image() { # bench task → 과제 이미지 이름(DeepSWE docker_image · SWT Dockerfile FROM)
  local d; d="$(tasks_dir "$1")/$2"
  case "$1" in
    deepswe)  sed -n 's/^docker_image = "\(.*\)"$/\1/p' "$d/task.toml" | head -1 ;;
    swtbench) sed -n 's/^FROM \([^ ]*\).*/\1/p' "$d/environment/Dockerfile" | head -1 ;;
  esac
}

record_digest() { # bench task — 과제 이미지의 레지스트리 digest(설계 §6 잠금본). Pier 가 끝에 이미지를 지워 로컬 inspect 로는 못 읽는다 — 시행 전에 레지스트리에서
  local img dig
  [ "$DRY" = 1 ] && return 0
  img=$(base_image "$1" "$2"); [ -n "$img" ] || return 0
  dig=$(docker buildx imagetools inspect "$img" </dev/null 2>&1 | sed -n 's/^Digest: *//p' | head -1)
  printf '%s\t%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$1" "$2" "$img" "${dig:-unknown}" >> "$ROOT/image-digests.tsv"
}

clean_images() { # bench task — 이 과제의 시행이 만든 이미지 + 과제 이미지(다른 프로젝트 이미지는 이름으로 걸러 건드리지 않는다)
  local bench="$1" task="$2" t trial img
  [ "$DRY" = 1 ] && { log "clean images $bench $task"; return 0; }
  img=$(base_image "$bench" "$task")
  for t in "$ROOT/$bench"-?-r*-"$task"/*/; do
    [ -f "$t/result.json" ] || continue
    trial=$(basename "$t" | tr '[:upper:]' '[:lower:]')
    docker rmi "$trial-main:latest" "$trial-pier-egress-proxy:latest" </dev/null >/dev/null 2>&1   # 이미 없으면 실패 — 무시
  done
  docker images --format '{{.Repository}}:{{.Tag}}' </dev/null 2>/dev/null | grep -F "hb__$(printf '%s' "$task" | tr '[:upper:]' '[:lower:]')" \
    | while read -r i; do docker rmi "$i" </dev/null >/dev/null 2>&1; done
  [ -n "$img" ] && docker rmi "$img" </dev/null >/dev/null 2>&1
  return 0
}

log "start tier=$TIER harness=$VER benches=[$BENCHES] arms=[$ARMS] N(deepswe)=$N_DS N(swt)=$N_SWT reps=$REPS root=$ROOT"
for bench in $BENCHES; do
  for task in $(tasks_of "$bench"); do
    record_digest "$bench" "$task"
    rep=1
    while [ "$rep" -le "$REPS" ]; do
      pids=""
      for arm in $ARMS; do
        if [ "$DRY" = 1 ]; then run_trial "$bench" "$task" "$arm" "$rep"; else run_trial "$bench" "$task" "$arm" "$rep" & pids="$pids $!"; fi
      done
      [ -n "$pids" ] && wait $pids
      rep=$((rep + 1))
    done
    clean_images "$bench" "$task"
    log "done $bench $task"
  done
done
log "finish tier=$TIER harness=$VER"
echo "리포트: python3 -I $HERE/report.py $ROOT $TIER $VER"
echo "유출 검사: bash $HERE/check-token-leak.sh $ENV_FILE $ROOT"
