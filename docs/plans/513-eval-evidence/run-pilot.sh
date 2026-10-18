#!/usr/bin/env bash
# #513 예비 실험 실행 골격 — 2단계에서 돌린다. 1단계(이 커밋)에서는 DRY_RUN=1 로 명령만 찍는다.
#
#   DRY_RUN=1 bash docs/plans/513-eval-evidence/run-pilot.sh <env-file> <provider> <bench>
#
#   env-file  : 저장소 밖 파일. GLM 이면 ANTHROPIC_AUTH_TOKEN=…, Anthropic 이면 ANTHROPIC_API_KEY=… 한 줄.
#               이 스크립트는 파일을 열지 않는다 — 경로를 pier --env-file 로 넘길 뿐이다 (값은 pier 가 에이전트 컨테이너 env 로).
#   provider  : glm | anthropic
#   bench     : deepswe | tbench(본실험용 — 예비 범위 밖, 재검증 B2)
#   과제 선택 : EVAL_TASKS='<id> <id> …' (필수) — 이름으로 고정한다. seed 표본 추출은 Pier 가 iterdir 순서를 섞는 것이라 머신마다 달라질 수 있어
#               (models/job/config.py:136·159) **목록을 문서에 적고 -i 로 넘긴다**(설계 §3 · 재검증 B6).
#
# 두 팔을 같은 과제 목록 · 같은 플래그로 돈다. 차이는 -a (claude-code vs pier_agent_b:HarnessedClaudeCode) 하나다.
# B 는 trial 안에서 정리 3회(설계 §4.4) → 과제 세션. 정리 산출물 = <trial>/agent/prep/{session-1..3.json, prep-timing.txt, prep-git-status.txt}.
# 결과: jobs/<job-name>/<trial>/{config.json, result.json, agent/claude-code.txt, agent/sessions/…, verifier/reward.json|reward.txt, artifacts/model.patch}
#       result.json 의 agent_result.{n_input_tokens,n_output_tokens,cost_usd,n_agent_steps} 는 agent/sessions/projects/*/ 의 jsonl 전부에서 Pier 가 합산한다 —
#       정리 세션은 CLAUDE_CONFIG_DIR=agent/prep/sessions 로 분리돼 거기 없으므로(3차 검증 B1) 이 값은 **과제 세션만**이다. 정리 비용은 agent/prep/session-*.json 의 modelUsage.
#       (GLM 에서는 cost_usd 가 비거나 0 — Claude Code 가 모델을 모른다. 토큰 수와 Z.ai 콘솔 크레딧으로 센다).
set -euo pipefail
cd "$(dirname "$0")/../../.."

ENV_FILE="${1:?env-file (저장소 밖)}"; PROVIDER="${2:?glm|anthropic}"; BENCH="${3:?deepswe|tbench}"
case "$ENV_FILE" in "$PWD"/*) echo "env-file 은 저장소 밖에 둔다: $ENV_FILE" >&2; exit 3;; esac
[ -f "$ENV_FILE" ] || { echo "env-file 없음: $ENV_FILE" >&2; exit 3; }
[ -n "${EVAL_TASKS:-}" ] || { echo "EVAL_TASKS='<task-id> …' 를 준다 — 설계 §3 의 고정 목록" >&2; exit 3; }

# ── 결과를 보기 전에 고정하는 값 ─────────────────────────────────────────────
CLAUDE_CODE_VERSION=2.1.302          # A/B 동일
EFFORT=${EVAL_EFFORT:-high}                           # Anthropic: Opus 5.5 기본 medium → high 로 고정. GLM: 적용 여부 불명(설계 §1.6) — 같은 값을 넘긴다. 정리 세션도 같은 값
MAX_TURNS=${EVAL_MAX_TURNS:-300}       # 안전망일 뿐 상한이 아니다 — 백그라운드 알림이 멈춘 세션을 다시 깨워 넘긴다(설계 §5.1). 상한은 벽시계
MAX_BUDGET_USD=${EVAL_MAX_BUDGET_USD:-20}   # Anthropic 종량 상한(과제 세션). GLM 에서는 추정 불가라 사실상 무효 — 시간·턴 상한이 맡는다
AGENT_TIMEOUT_MULT=${EVAL_AGENT_TIMEOUT_MULT:-0.67}  # DeepSWE 10800s × 0.67 ≈ 2h. B 는 정리 3회(세션당 턴 60)가 이 안에 포함된다
CONCURRENCY=${EVAL_CONCURRENCY:-2}     # Docker Desktop 6 CPU · 8GB — 과제가 2 CPU/8GB 를 요구하니 2 가 상한
case "$PROVIDER" in
  # Pier 의 claude-code 에이전트는 BASE_URL 이 있으면 -m 값을 ANTHROPIC_MODEL 과 DEFAULT_{OPUS,SONNET,HAIKU}_MODEL · SUBAGENT_MODEL 전부에 넣는다
  # (claude_code.py:1272-1290, 0.3.1) — 서브에이전트까지 한 모델로 묶인다. Anthropic 쪽은 §4.5 대로 SUBAGENT_MODEL 을 명시해 두 팔을 같은 모델로.
  glm)       AE=(--ae ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic --ae API_TIMEOUT_MS=3000000); MODEL=glm-5.3 ;;
  anthropic) AE=(--ae CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-5-5); MODEL=claude-opus-5-5 ;;
  *) echo "provider: glm|anthropic" >&2; exit 3 ;;
esac
case "$BENCH" in
  deepswe) TASKS=(-p "${DEEPSWE_TASKS:-$HOME/eval-513/deep-swe/tasks}") ;;
  # 본실험용. /app 이 git 저장소가 아니라 B 의 git 처리는 건너뛴다(pier_agent_b.py _git_guard) — "B 설치 전에 git 초기화가 필요한가" 는 본실험 결정(설계 §3).
  tbench)  TASKS=(-p "${TBENCH_TASKS:-$HOME/eval-513/terminal-bench/tasks}" -x fp8-rmsnorm-gemm -x jax-speedrun-gpu -x math-eval-grader --override-gpus 0) ;;
  *) echo "bench: deepswe|tbench" >&2; exit 3 ;;
esac
INCLUDE=(); for t in $EVAL_TASKS; do INCLUDE+=(-i "$t"); done
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
JOBS="${EVAL_JOBS_DIR:-$HOME/eval-513/jobs}"

run() { # arm agent...
  local arm="$1"; shift
  local cmd=(pier run "${TASKS[@]}" "${INCLUDE[@]}" "$@" -m "$MODEL"
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

# 집계(summarize.sh, 2단계): 두 job 의 result.json 을 과제로 맞춘 짝 표 · ①②②′③ · B 빌드 실패(exception.txt 'exit 97')·prep-infra-error 과제의 양팔 제외 목록 ·
# prep-failed.txt 는 B 실패로 집계(제외 아님) · 정리 비용 = agent/prep/session-*.json 의 modelUsage, 정리 벽시계 = prep-timing.txt.
echo "집계: bash docs/plans/513-eval-evidence/summarize.sh $JOBS 513-${BENCH}-${PROVIDER}-*-${STAMP}   (2단계에서 작성)"
echo "유출 검사: bash docs/plans/513-eval-evidence/check-token-leak.sh $ENV_FILE $JOBS"
