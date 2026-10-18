#!/usr/bin/env bash
# #513 예비 실험 실행 골격 — 2단계에서 돌린다. 1단계(이 커밋)에서는 DRY_RUN=1 로 명령만 찍는다.
#
#   DRY_RUN=1 bash docs/plans/513-eval-evidence/run-pilot.sh <env-file> <provider> <bench> [n-tasks] [seed]
#
#   env-file  : 저장소 밖 파일. GLM 이면 ANTHROPIC_AUTH_TOKEN=…, Anthropic 이면 ANTHROPIC_API_KEY=… 한 줄.
#               이 스크립트는 파일을 열지 않는다 — 경로를 pier --env-file 로 넘길 뿐이다 (값은 pier 가 에이전트 컨테이너 env 로).
#   provider  : glm | anthropic
#   bench     : deepswe | tbench
#   n-tasks   : 과제 수 (기본 2 — 스모크). seed 는 과제 표본 추출용 (기본 513). 둘 다 결과를 보기 전에 고정한다.
#
# 두 팔을 같은 과제 목록 · 같은 플래그로 돈다. 차이는 -a (claude-code vs pier-agent-b:HarnessedClaudeCode) 하나다.
# 결과: jobs/<job-name>/<trial>/{result.json, agent/claude-code.txt, verifier/reward.json|reward.txt, artifacts/model.patch}
#       result.json 의 agent_result.{n_input_tokens,n_output_tokens,cost_usd} 는 Claude Code 의 result 이벤트에서 Pier 가 채운다
#       (GLM 에서는 cost_usd 가 비거나 0 — Claude Code 가 모델을 모른다. 토큰 수와 Z.ai 콘솔 크레딧으로 센다).
set -euo pipefail
cd "$(dirname "$0")/../../.."

ENV_FILE="${1:?env-file (저장소 밖)}"; PROVIDER="${2:?glm|anthropic}"; BENCH="${3:?deepswe|tbench}"
N_TASKS="${4:-2}"; SEED="${5:-513}"
case "$ENV_FILE" in "$PWD"/*) echo "env-file 은 저장소 밖에 둔다: $ENV_FILE" >&2; exit 3;; esac
[ -f "$ENV_FILE" ] || { echo "env-file 없음: $ENV_FILE" >&2; exit 3; }

# ── 결과를 보기 전에 고정하는 값 ─────────────────────────────────────────────
CLAUDE_CODE_VERSION=2.1.302          # A/B 동일
EFFORT=high                           # Anthropic: Opus 5.5 기본 medium → high 로 고정. GLM: 적용 여부 불명(설계 §1.6) — 같은 값을 넘긴다
MAX_TURNS=${EVAL_MAX_TURNS:-150}
MAX_BUDGET_USD=${EVAL_MAX_BUDGET_USD:-20}   # Anthropic 종량 상한. GLM 에서는 추정 불가라 사실상 무효 — 시간·턴 상한이 맡는다
AGENT_TIMEOUT_MULT=${EVAL_AGENT_TIMEOUT_MULT:-0.67}  # DeepSWE 10800s × 0.67 ≈ 2h · T-Bench 28800s 는 과제별 override 로 2h (아래)
CONCURRENCY=${EVAL_CONCURRENCY:-2}     # Docker Desktop 6 CPU · 8GB — 과제가 2 CPU/8GB 를 요구하니 2 가 상한
case "$PROVIDER" in
  # Pier 의 claude-code 에이전트는 BASE_URL 이 있으면 -m 값을 ANTHROPIC_MODEL 과 DEFAULT_{OPUS,SONNET,HAIKU}_MODEL · SUBAGENT_MODEL 전부에 넣는다
  # (claude_code.py:1272-1290, 0.3.1) — 서브에이전트까지 한 모델로 묶인다. Anthropic 쪽은 서브에이전트가 기본 모델 규칙을 따른다(설계 §4 비대칭 주의).
  glm)       AE=(--ae ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic --ae API_TIMEOUT_MS=3000000); MODEL=glm-5.3 ;;
  anthropic) AE=(); MODEL=claude-opus-5-5 ;;
  *) echo "provider: glm|anthropic" >&2; exit 3 ;;
esac
case "$BENCH" in
  deepswe) TASKS=(-p "${DEEPSWE_TASKS:-$HOME/eval-513/deep-swe/tasks}") ;;
  # Pier 에는 -d(레지스트리) 가 없다(설계 검증 B4). 저장소를 클론해 -p 로 — DeepSWE 와 같은 러너·같은 B 에이전트·같은 env-file.
  #   git clone --depth 1 https://github.com/harbor-framework/terminal-bench ~/eval-513/terminal-bench   (2e29ca91, 2026-10-15)
  # -i/-x 는 과제 폴더 이름을 받는다(접두 `terminal-bench/` 없이 — 2026-10-18 `-i sound-change-cascade` 실측). GPU 3종 제외는 task.toml 전수 실측.
  tbench)  TASKS=(-p "${TBENCH_TASKS:-$HOME/eval-513/terminal-bench/tasks}" -x fp8-rmsnorm-gemm -x jax-speedrun-gpu -x math-eval-grader --override-gpus 0) ;;
  *) echo "bench: deepswe|tbench" >&2; exit 3 ;;
esac
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
JOBS="${EVAL_JOBS_DIR:-$HOME/eval-513/jobs}"

run() { # arm agent...
  local arm="$1"; shift
  local cmd=(pier run "${TASKS[@]}" -l "$N_TASKS" --sample-seed "$SEED" "$@" -m "$MODEL"
    --ak "version=$CLAUDE_CODE_VERSION" --ak "reasoning_effort=$EFFORT" --ak "max_turns=$MAX_TURNS" --ak "max_budget_usd=$MAX_BUDGET_USD"
    --ae CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 --ae DISABLE_AUTOUPDATER=1 ${AE[@]+"${AE[@]}"}
    --env-file "$ENV_FILE" --agent-timeout-multiplier "$AGENT_TIMEOUT_MULT" -n "$CONCURRENCY" -y
    -o "$JOBS" --job-name "513-${BENCH}-${PROVIDER}-${arm}-${STAMP}")
  if [ "${DRY_RUN:-0}" = 1 ]; then printf '%q ' "${cmd[@]}"; echo; else "${cmd[@]}"; fi
}

# 순서는 A→B 고정이 아니라 과제별로 섞는 것이 맞다(설계 §5). 골격에서는 팔 단위로 돈다 — 2단계에서 per-task 인터리브로 바꾼다.
run A -a claude-code
# --agent-import-path 는 모듈 경로(`module:Class`)다 — 파일 경로를 주면 "No module named …" 로 실패한다(2026-10-18 실측). PYTHONPATH 로 폴더를 올린다.
export PYTHONPATH="docs/plans/513-eval-evidence${PYTHONPATH:+:$PYTHONPATH}"
run B --agent-import-path "pier_agent_b:HarnessedClaudeCode" --ak "track=${EVAL_TRACK:-base}"
# B 의 이미지 빌드가 실패한 과제(exit 97 등)는 A 결과에서도 뺀다 — 제외 목록은 집계 단계(summarize.sh)가 두 job 의 result.json 을 맞춰 만든다.

echo "집계: bash docs/plans/513-eval-evidence/summarize.sh $JOBS 513-${BENCH}-${PROVIDER}-*-${STAMP}   (2단계에서 작성)"
