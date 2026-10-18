#!/usr/bin/env bash
# 토큰 유출 검사 (재검증 B5) — env-file 의 토큰 **값**으로 산출물 폴더를 grep 한다.
#
#   bash docs/plans/513-eval-evidence/check-token-leak.sh <env-file> <dir>...
#
# 토큰은 env-file 에서 읽어 메모리에서만 쓰고, 출력에는 일치한 **파일 수**만 낸다(값·파일명 미출력 — 파일명이 곧 위치 힌트라 수만).
# 대조군: 토큰을 심은 임시 파일을 같은 검사기로 돌려 1 이 나와야 한다 — 그래야 0 이 "없다"의 증거다(doc-governance: 대조군 없는 부재 결론 금지).
# exit 0 = 유출 0 · 1 = 유출 있음 · 2 = 검사기 신뢰 불가(대조군 실패 · 토큰 8자 미만) · 3 = 사용법
set -u
ENV_FILE="${1:?env-file}"; shift
[ $# -ge 1 ] || { echo "usage: $0 <env-file> <dir>..." >&2; exit 3; }
tok=$(grep -E '^(ANTHROPIC_AUTH_TOKEN|ANTHROPIC_API_KEY)=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"' \r\n')
[ "${#tok}" -ge 8 ] || { echo "토큰이 8자 미만이거나 env-file 에 없다 — 검사 불가" >&2; exit 2; }

# env-file 자체가 검사 대상 안에 있으면 항상 1 이 난다(3차 검증 B2 실측) — 그 호출은 거절한다. 산출물 폴더(jobs/ 등)만 준다.
envabs="$(cd "$(dirname "$ENV_FILE")" && pwd -P)/$(basename "$ENV_FILE")"
for d in "$@"; do
  dabs=$(cd "$d" 2>/dev/null && pwd -P) || continue
  case "$envabs" in "$dabs"/*) echo "env-file 이 검사 대상 안에 있다($d) — 항상 1 이 난다. jobs/ 처럼 산출물 폴더만 준다" >&2; exit 3;; esac
done

# 대조군: 심은 파일에서 정확히 1 이 나와야 한다
ctl=$(mktemp -d); printf 'noise\n%s\nnoise\n' "$tok" > "$ctl/planted.txt"
c=$(grep -rlF -- "$tok" "$ctl" 2>/dev/null | wc -l | tr -d ' ')
rm -rf "$ctl"
[ "$c" = "1" ] || { echo "대조군 실패(기대 1, 실제 $c) — 검사기를 믿을 수 없다" >&2; exit 2; }

n=0
for d in "$@"; do
  [ -e "$d" ] || continue
  k=$(grep -rlF -- "$tok" "$d" 2>/dev/null | wc -l | tr -d ' ')
  n=$((n + k))
done
echo "token-leak files=$n (control=1 ok)"
[ "$n" = "0" ]
