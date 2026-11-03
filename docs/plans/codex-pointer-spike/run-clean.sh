#!/usr/bin/env bash
# usage: run-one.sh <B> <arm> <i>  — 시험 프로젝트 하나에서 codex exec 를 래퍼와 같은 안전장치로 돌린다.
set -u
B="$1"; ARM="$2"; I="$3"
RUN="$B/runs-clean/$ARM-$I"; rm -rf "$RUN"; mkdir -p "$RUN"
python3 -I "$B/scripts/make-fixture.py" "$B/scripts" "$ARM" "$RUN/proj" || { echo "$ARM-$I fixture-fail"; exit 1; }
CODEX="${CODEX_BIN:-$(command -v codex || echo "$HOME/.local/bin/codex")}"
PROMPT='src/components/price-tag.tsx 에 가격(원)과 할인율(%)을 받아 원래 가격과 할인가를 보여 주는 PriceTag 컴포넌트를 만들어 줘. 끝나면 무엇을 했는지 짧게 알려 줘.'
cd "$RUN/proj"
env -i PATH="$PATH" HOME="$HOME" TERM="${TERM:-dumb}" LANG="${LANG:-en_US.UTF-8}" \
  CODEX_HOME="$B/cleanhome" \
  "$CODEX" exec -s workspace-write --skip-git-repo-check --ephemeral --json \
  -c 'sandbox_workspace_write.network_access=false' \
  -o "$RUN/last.txt" -- "$PROMPT" > "$RUN/events.jsonl" 2> "$RUN/stderr.log" &
CPID=$!; T=0
while kill -0 "$CPID" 2>/dev/null; do
  if [ "$T" -ge 3000 ]; then kill "$CPID" 2>/dev/null; sleep 2; kill -9 "$CPID" 2>/dev/null; echo "$ARM-$I TIMEOUT"; exit 124; fi
  sleep 0.2; T=$((T+1))
done
wait "$CPID"; RC=$?
echo "$ARM-$I exit=$RC"
