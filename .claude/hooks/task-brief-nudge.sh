#!/bin/bash
# ============================================================
# task-brief-nudge.sh — UserPromptSubmit hook
#
# 목적: 긴 요청이 브리프 형태 없이 그대로 실행되는 것을 **한 줄로 상기**시킨다.
#
# 이 훅은 **판단하지 않는다.** 프롬프트를 고쳐 쓰거나, 좋은 요청인지 평가하거나,
# 실행을 막지 않는다 — 그건 전부 모델의 판단이 필요한 일이라 스킬(`task-brief`) 몫이다.
# 훅이 맡는 것은 매번 같은 답이 나오는 결정적 판정 하나뿐이다:
#
#   길다(≥ THRESHOLD 자) && 브리프 표식(`<objective>`)이 없다  →  stdout 1줄
#   그 밖에                                                    →  출력 없음, exit 0
#
# 왜 이 두 조건인가: 짧은 요청은 구조화 이득보다 비용이 크고(스킬 자신의 Do-NOT),
# 이미 `<objective>` 가 있으면 브리프가 이미 있는 것이다. 둘 다 파일 하나 안 읽고
# 판정되는 사실이라 훅이 할 수 있다.
#
# 입력: stdin JSON (prompt, session_id, cwd, hook_event_name, ...)
# 출력: exit 0. UserPromptSubmit 의 stdout 은 그대로 모델 컨텍스트에 덧붙는다.
#       차단하지 않으므로 exit 2 경로가 없고, 따라서 차단 로그도 남기지 않는다.
#
# 길이 판정은 **문자 수**다. UTF-8 continuation byte(0x80-0xBF)를 지우고 남은 바이트를 세면
# 로케일과 무관하게 코드포인트 수가 된다 — `${#var}` 나 `wc -m` 은 로케일에 따라 바이트를
# 세기도 해서 같은 프롬프트가 환경마다 다르게 판정된다(한글은 문자당 3바이트라 차이가 3배).
# 재현 불가능한 판정은 결정적 판정이 아니다.
# ============================================================
set -u

THRESHOLD=400
MARKER="<objective>"

INPUT=$(cat 2>/dev/null || echo "{}")

# 표식 판정은 원문에서 한다. `<`·`>` 는 JSON 이 이스케이프하지 않으므로 파싱 없이 정확하고,
# jq 유무에 따라 결과가 갈리지 않는다.
if printf '%s' "$INPUT" | grep -qF "$MARKER"; then
  exit 0
fi

# prompt 추출 — jq 우선, 없으면 폴백 (cli-development.md §Hook Script 규약).
PROMPT=""
if command -v jq >/dev/null 2>&1; then
  PROMPT=$(printf '%s' "$INPUT" | jq -r '.prompt // ""' 2>/dev/null || echo "")
else
  # 폴백은 이스케이프를 풀지 않는다(`\n` 이 2자로 세어진다) — 길이를 **과대**평가할 수는 있어도
  # 과소평가하지는 않는 방향이다. 넛지는 틀려도 한 줄이므로 이쪽 오차를 택한다.
  PROMPT=$(printf '%s' "$INPUT" |
    sed -e 's/.*"prompt"[[:space:]]*:[[:space:]]*"//' -e 's/"[[:space:]]*[,}].*$//')
fi

[ -n "$PROMPT" ] || exit 0

LEN=$(printf '%s' "$PROMPT" | LC_ALL=C tr -d '\200-\277' | LC_ALL=C wc -c | tr -d '[:space:]')
[ "${LEN:-0}" -ge "$THRESHOLD" ] || exit 0

echo "[task-brief] 긴 요청인데 <objective> 블록이 없다 — 착수·위임 전에 task-brief 스킬로 브리프 정규화를 고려하라 (완료 판정 기준·경계·검증 주체가 아직 미정일 수 있다)."
exit 0
