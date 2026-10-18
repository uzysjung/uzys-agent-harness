#!/usr/bin/env bash
# #513 D9 — B 팔의 "초기 정리 3회" (저장소 + 시작 커밋 단위로 한 번). 2단계에서 돌린다 — 유료.
#
#   bash docs/plans/513-eval-evidence/prep-b.sh <env-file> <provider> <task-dir> <out-dir> [track]
#
#   task-dir : Harbor 형식 과제 폴더(task.toml 의 environment.docker_image = 시작 커밋이 /app 에 체크아웃된 이미지)
#   out-dir  : 저장소 밖. 여기에 prep.tar(정리 결과) · session-{1,2,3}.json(usage·비용) · fill-count.txt · prep-git-status.txt 가 남는다
#   provider : glm | anthropic — 그 단계의 실행 모델과 같아야 한다(D9-6). 모델·effort 는 run-pilot.sh 와 같은 값.
#
# 정의(설계 §4.5): 정리 1회 = 설치 화면 FILL 안내("… or ask the audit-harness-fit skill to fill it from repository evidence")를
# 그대로 따른 **한 세션** — 프롬프트는 아래 PREP_PROMPT 문자 그대로. 과제 지시문은 주지 않는다. 3회는 같은 프롬프트를
# 새 세션으로 3번(정리가 누적된다). 결과는 같은 시작 커밋의 모든 과제·반복에 똑같이 적용된다(pier_agent_b.py prep_dir).
set -euo pipefail
cd "$(dirname "$0")/../../.."

ENV_FILE="${1:?env-file}"; PROVIDER="${2:?glm|anthropic}"; TASK_DIR="${3:?task dir}"; OUT="${4:?out dir (저장소 밖)}"; TRACK="${5:-base}"
case "$ENV_FILE" in "$PWD"/*) echo "env-file 은 저장소 밖에 둔다" >&2; exit 3;; esac
case "$OUT" in "$PWD"/*) echo "out-dir 은 저장소 밖에 둔다" >&2; exit 3;; esac
mkdir -p "$OUT"

CLAUDE_CODE_VERSION=2.1.302; HARNESS_VERSION=26.174.0; EFFORT=high; N_SESSIONS=3
PREP_PROMPT='Use the audit-harness-fit skill to fill CLAUDE.md from repository evidence.'   # 결과를 보기 전에 고정. 바꾸면 Change Log
case "$PROVIDER" in
  glm)       PENV=(-e ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic -e API_TIMEOUT_MS=3000000 -e ANTHROPIC_MODEL=glm-5.3 -e ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.3 -e ANTHROPIC_DEFAULT_SONNET_MODEL=glm-5.3 -e ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-5.3 -e CLAUDE_CODE_SUBAGENT_MODEL=glm-5.3) ;;
  anthropic) PENV=(-e ANTHROPIC_MODEL=claude-opus-5-5 -e CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-5-5) ;;
  *) echo "provider: glm|anthropic" >&2; exit 3 ;;
esac
IMAGE=$(grep -E '^docker_image' "$TASK_DIR/task.toml" | head -1 | sed 's/.*= *"//; s/".*//')
[ -n "$IMAGE" ] || { echo "task.toml 에 docker_image 가 없다 (environment/Dockerfile 로 빌드하는 과제는 2단계에서 처리)" >&2; exit 4; }
printf '%s\n' "$PREP_PROMPT" > "$OUT/prep-prompt.txt"

# 컨테이너 안에서 도는 절차 — 토큰은 --env-file 로만 들어오고 어디에도 쓰지 않는다.
cat > "$OUT/prep-inner.sh" <<EOF
set -euo pipefail
cd /app
export PATH="\$HOME/.local/bin:\$HOME/.npm-global/bin:\$PATH"; npm config set prefix "\$HOME/.npm-global" >/dev/null 2>&1 || true
curl -fsSL https://claude.ai/install.sh | bash -s -- $CLAUDE_CODE_VERSION >/dev/null 2>&1
npm install -g --no-fund --no-audit @uzysjung/agent-harness@$HARNESS_VERSION >/dev/null 2>&1
git status --porcelain > /out/status-base.txt
agent-harness install --track $TRACK --cli claude > /out/harness-install.log 2>&1
echo "after-install \$(grep -c '<!-- FILL:' CLAUDE.md || true)" > /out/fill-count.txt
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 DISABLE_AUTOUPDATER=1 IS_SANDBOX=1
mkdir -p /out/sessions
for i in \$(seq 1 $N_SESSIONS); do
  start=\$(date -u +%s)
  claude -p "$PREP_PROMPT" --effort $EFFORT --permission-mode bypassPermissions --permission-prompts none \\
    --max-turns 60 --max-budget-usd 10 --output-format json > /out/sessions/session-\$i.json 2> /out/sessions/session-\$i.stderr || true
  echo "session-\$i wall=\$(( \$(date -u +%s) - start ))s fill=\$(grep -c '<!-- FILL:' CLAUDE.md || true)" >> /out/fill-count.txt
done
# 정리 결과 = 하네스 경로 + 함께 쓰는 파일. 그 밖의 tracked 변경은 '정리가 소스를 건드린 것' — 기록하고 실패로 둔다(과제 양팔 제외).
git status --porcelain > /out/prep-git-status.txt
git status --porcelain | awk '{print \$2}' | grep -vE '^(\\.claude/|\\.uzys-agent-harness/|\\.mcp\\.json|CLAUDE\\.md|CLAUDE-uzys-harness\\.md|\\.github/workflows/ci\\.yml|AGENTS\\.md|\\.agents/|\\.gitignore)' > /out/prep-touched-source.txt || true
tar -cf /out/prep.tar \$(git status --porcelain | awk '{print \$2}' | grep -E '^(\\.claude/|\\.uzys-agent-harness/|\\.mcp\\.json|CLAUDE\\.md|CLAUDE-uzys-harness\\.md|\\.github/workflows/ci\\.yml|AGENTS\\.md|\\.agents/|\\.gitignore)' | tr '\\n' ' ')
EOF
docker run --rm --env-file "$ENV_FILE" "${PENV[@]}" -v "$OUT:/out" --entrypoint bash "$IMAGE" /out/prep-inner.sh
rm -f "$OUT/prep-inner.sh"

echo "fill-count:"; cat "$OUT/fill-count.txt"
if [ -s "$OUT/prep-touched-source.txt" ]; then echo "정리가 소스 파일을 건드렸다 → 이 과제는 양팔 제외:"; cat "$OUT/prep-touched-source.txt"; exit 5; fi
echo "비용(세션별 total_cost_usd · usage):"; for f in "$OUT"/sessions/session-*.json; do jq -c '{cost: .total_cost_usd, turns: .num_turns, dur_ms: .duration_ms, usage: .usage | {input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens}}' "$f" 2>/dev/null || echo "(파싱 실패: $f)"; done
grep -l "$(head -c 8 "$ENV_FILE" | cut -d= -f2)" -r "$OUT" 2>/dev/null && echo "경고: 토큰 조각이 산출물에 있다 — 그 파일은 복사하지 않는다" || true
echo "→ $OUT/prep.tar 를 run-pilot.sh 의 EVAL_PREP_DIR/<task-id>/prep.tar 로 두면 B 가 적용한다"
