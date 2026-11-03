#!/usr/bin/env bash
# usage: run-e2e.sh <B> <scene> <i>
set -u
B="$1"; SCENE="$2"; I="$3"; E="$B/e2e"
RUN="$E/runs/$SCENE-$I"; rm -rf "$RUN"; mkdir -p "$RUN"; cp -R "$E/base" "$RUN/proj"
CODEX="$(command -v codex)"
PROMPT='src/components/price-tag.tsx 에 가격(원)과 할인율(%)을 받아 원래 가격과 할인가를 보여 주는 PriceTag 컴포넌트를 만들어 줘. 끝나면 무엇을 했는지 짧게 알려 줘.'
[ "$SCENE" = create ] && rm -f "$RUN/proj/src/components/price-tag.tsx"
[ "$SCENE" = incidental ] && PROMPT='할인가는 원 단위 내림으로 계산해야 한다는 정책이 정해졌다. src/lib/price.ts 를 고치고, 화면에 예전 규칙이 드러나는 곳이 있으면 함께 맞춰 줘. 끝나면 무엇을 했는지 짧게 알려 줘.'
cd "$RUN/proj"
env -i PATH="$PATH" HOME="$HOME" TERM="${TERM:-dumb}" LANG="${LANG:-en_US.UTF-8}" CODEX_HOME="$B/cleanhome" \
  "$CODEX" exec -s workspace-write --skip-git-repo-check --ephemeral --json \
  -c 'sandbox_workspace_write.network_access=false' \
  -o "$RUN/last.txt" -- "$PROMPT" > "$RUN/events.jsonl" 2> "$RUN/stderr.log" &
CPID=$!; T=0
while kill -0 "$CPID" 2>/dev/null; do
  if [ "$T" -ge 3000 ]; then kill "$CPID"; sleep 2; kill -9 "$CPID" 2>/dev/null; echo "$SCENE-$I TIMEOUT"; exit 124; fi
  sleep 0.2; T=$((T+1))
done
wait "$CPID"; echo "$SCENE-$I exit=$?"
