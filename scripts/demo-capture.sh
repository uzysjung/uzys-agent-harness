#!/usr/bin/env bash
# 컨테이너 내부 — install 비대화형 실행을 asciinema 로 캡처 후 gif 변환.
# 산출물 → /out (호스트 docs/assets 볼륨 마운트). demo.Dockerfile 의 CMD.
set -euo pipefail

OUT=/out
PROJ=/tmp/demo-proj
mkdir -p "$PROJ" "$OUT"

# 터미널 크기 고정 (기존 데모 cols 114 rows 38 재현).
export COLUMNS=114 LINES=38

# install subcommand = non-interactive (src/commands/install.ts:108).
#   외부 자산(skill/plugin)은 external-installer 가 --yes + stdio pipe 로 비대화형 설치.
asciinema rec --cols 114 --rows 38 --overwrite \
  --command "node /app/dist/index.js install --track tooling --cli claude --project-dir $PROJ" \
  "$OUT/agent-harness-demo.cast"

# cast → gif (cols/rows 는 cast 메타에서 자동 적용).
agg "$OUT/agent-harness-demo.cast" "$OUT/agent-harness-demo.gif"

echo "✓ 데모 재생성: $OUT/agent-harness-demo.{cast,gif}"
