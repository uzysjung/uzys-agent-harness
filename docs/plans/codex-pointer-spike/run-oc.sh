#!/usr/bin/env bash
# usage: run-oc.sh <OCB> <variant: claude|agents|none> <scene: create|incidental> <i> [model]
# OpenCode 2.x 를 측정 폴더 안에서만 돌린다 — 사용자 전역 설정 · 개인 지시문 · 외부 스킬 제외, 폴더 밖 · 셸 · 웹 · 하위 에이전트 금지,
# 데이터 · 상태는 측정용 폴더(사용자 세션 DB 를 쓰지 않는다), MCP 는 fixture opencode.json 에서 뺐다
set -u
OCB="$1"; V="$2"; SCENE="$3"; I="$4"; MODEL="${5:-openai/gpt-6-astra#xhigh}"
RUN="$OCB/runs/$V-$SCENE-$I"; mkdir -p "$OCB/runs"; [ -e "$RUN" ] && { echo "exists: $RUN"; exit 3; }
mkdir -p "$RUN"; cp -R "$OCB/fx2-$V" "$RUN/proj"
PROMPT='src/components/price-tag.tsx 에 가격(원)과 할인율(%)을 받아 원래 가격과 할인가를 보여 주는 PriceTag 컴포넌트를 만들어 줘. 끝나면 무엇을 했는지 짧게 알려 줘.'
[ "$SCENE" = create ] && rm -f "$RUN/proj/src/components/price-tag.tsx"
[ "$SCENE" = incidental ] && PROMPT='할인가는 원 단위 내림으로 계산해야 한다는 정책이 정해졌다. src/lib/price.ts 를 고치고, 화면에 예전 규칙이 드러나는 곳이 있으면 함께 맞춰 줘. 끝나면 무엇을 했는지 짧게 알려 줘.'
# shellcheck disable=SC1091
source "$OCB/env-oc.sh"
cd "$RUN/proj" || exit 4
perl -e 'alarm 600; exec @ARGV' bash -c "$(declare -f ocenv); ocenv /Users/uzysjung/.opencode/bin/opencode run --standalone --auto --format json -m '$MODEL' \"\$0\" < /dev/null" "$PROMPT" \
  > "$RUN/events.jsonl" 2> "$RUN/stderr.log"
echo "$V-$SCENE-$I exit=$?"
