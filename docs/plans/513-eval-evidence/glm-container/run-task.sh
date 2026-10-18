#!/usr/bin/env bash
# 컨테이너 안에서 과제 1개 · 구성 1개(A 또는 B)를 돌리는 골격 (#513 2단계에서 쓴다).
#
#   eval-run-task <A|B> <repo-dir> <instruction-file> <out-dir> [track]
#
# - A: 그대로. B: 같은 저장소에 하네스를 설치한 뒤 같은 지시문으로 돈다.
# - 모델·effort·턴·예산·시간 상한은 환경변수로 받는다 (기본값은 아래). 결과를 보기 전에 고정한다.
# - 결과는 <out-dir>/result.json (Claude Code 의 --output-format json 그대로) + meta.json.
# - 채점은 여기서 하지 않는다 — 에이전트 밖(검증 컨테이너)에서 한다.
set -euo pipefail

ARM="${1:?A|B}"; REPO="${2:?repo dir}"; INSTR="${3:?instruction file}"; OUT="${4:?out dir}"; TRACK="${5:-base}"
MODEL="${EVAL_MODEL:-opus}"                 # GLM 경로: ANTHROPIC_DEFAULT_OPUS_MODEL 이 실제 모델을 정한다
EFFORT="${EVAL_EFFORT:-high}"
MAX_TURNS="${EVAL_MAX_TURNS:-60}"
MAX_BUDGET_USD="${EVAL_MAX_BUDGET_USD:-5}"  # GLM 정액 구독에서는 추정치일 뿐이다. 상한으로만 쓴다
TIMEOUT_SEC="${EVAL_TIMEOUT_SEC:-1800}"

mkdir -p "$OUT"
cd "$REPO"

if [ "$ARM" = "B" ]; then
  # 설치 명령은 설계 문서 §A/B 구성에 고정돼 있다. 결과를 보고 바꾸지 않는다.
  agent-harness install --track "$TRACK" --cli claude > "$OUT/harness-install.log" 2>&1
  # 설치본이 실제로 로드되는지의 증거 ①: 설치 기록
  cp .uzys-agent-harness/.harness-install.json "$OUT/harness-install-record.json" 2>/dev/null || true
fi

START=$(date -u +%s)
# 설치본이 실제로 로드되는지의 증거 ②: stream-json 의 system/init 이벤트가 로드된 훅·스킬·CLAUDE.md 를 보고한다.
# 턴 단위 로그도 같은 파일에 남는다 (verbose). 마지막 줄이 result 다.
set +e
timeout --signal=INT --kill-after=60 "$TIMEOUT_SEC" \
  claude -p "$(cat "$INSTR")" \
    --model "$MODEL" --effort "$EFFORT" \
    --permission-mode bypassPermissions --permission-prompts none \
    --max-turns "$MAX_TURNS" --max-budget-usd "$MAX_BUDGET_USD" \
    --no-session-persistence \
    --output-format stream-json --verbose --include-hook-events \
    > "$OUT/stream.jsonl" 2> "$OUT/stderr.log"
EXIT=$?
set -e
END=$(date -u +%s)

# result 줄만 따로 — usage · total_cost_usd · num_turns · duration_ms 가 여기 있다 (code.claude.com/docs/en/headless).
grep '"type":"result"' "$OUT/stream.jsonl" | tail -1 > "$OUT/result.json" || true
grep '"subtype":"init"' "$OUT/stream.jsonl" | head -1 > "$OUT/init.json" || true

# 산출물 = 커밋된 변경만 (DeepSWE v1.1 과 같은 규약). 커밋 안 한 작업은 채점에 들어가지 않는다.
git add . >/dev/null 2>&1 || true   # 과제 저장소(컨테이너 안 격리 사본) — 채점 대상은 커밋된 변경 전체다
git -c user.name=eval -c user.email=eval@local commit -qm "eval-513 ${ARM}" >/dev/null 2>&1 || true
git diff --binary "${EVAL_BASE_COMMIT:-HEAD~1}" HEAD > "$OUT/model.patch" 2>/dev/null || true

jq -n --arg arm "$ARM" --arg model "$MODEL" --arg effort "$EFFORT" --arg track "$TRACK" \
  --argjson exit "$EXIT" --argjson wall "$((END-START))" --argjson max_turns "$MAX_TURNS" \
  --arg base_url "${ANTHROPIC_BASE_URL:-}" --arg claude "$(claude --version 2>/dev/null | head -1)" \
  '{arm:$arm, model:$model, effort:$effort, track:$track, exit:$exit, wall_sec:$wall, max_turns:$max_turns, base_url:$base_url, claude_code:$claude}' \
  > "$OUT/meta.json"
echo "[eval-run-task] $ARM exit=$EXIT wall=${wall:-$((END-START))}s → $OUT"
