#!/usr/bin/env bash
# check-absence.sh — "이 패턴이 없다"를 **증거로** 만드는 명령.
#
# 왜 도구인가: `cli-development.md` §"검증 명령은 실패해도 조용하다" 가 이미 세 가지를 규정하고
# 있는데, 한 세션에서 셋 다 깨졌다 — ⓐ 대소문자 구분 grep 으로 2건을 놓치고 "잔여 0" 선언
# ⓑ `grep | sort || echo` 로 exit code 를 가림(`sort` 는 빈 입력에도 0) ⓒ 탐지기를 검증하지 않고
# 빈 출력을 신뢰. 사람이 매번 기억해야 하는 규약은 규약이 아니므로 도구로 내린다
# (recurrence-prevention 사다리: 기록 → 룰 → 구조).
#
# 하는 일:
#   1. **탐지기 자기검증** — `--canary` 로 받은 알려진 양성이 실제로 잡히는지 먼저 확인한다.
#      안 잡히면 부재 결과를 신뢰할 수 없으므로 exit 2. (빈 결과 ≠ 깨끗함)
#   2. stderr 를 버리지 않는다 — grep 자체가 실패했는지와 "매치 없음"을 구분한다.
#   3. 파이프로 exit code 를 가리지 않는다.
#   4. 매치 건수를 항상 명시 출력한다.
#
# 사용:
#   bash scripts/check-absence.sh --canary '<알려진 양성 문자열>' '<ERE 패턴>' <경로>...
# 예:
#   bash scripts/check-absence.sh --canary 'GoalTrack' 'goaltrack|dyld_vantage' dist src templates
#
# exit: 0 부재 확인 · 1 매치 발견 · 2 탐지기 자기검증 실패 또는 grep 오류(결과 신뢰 불가) · 3 사용법

set -u

usage() {
  echo "usage: $0 --canary <known-positive> [-i] <ERE-pattern> <path>..." >&2
  echo "  --canary 는 필수다. 탐지기가 실제로 무는지 보이지 않으면 '없음'은 증거가 아니다." >&2
  exit 3
}

CANARY=""
# -i 는 자기검증과 실제 검사에 **동시에** 적용된다. 한쪽만 적용하면 자기검증이 통과해도
# 실제 검사가 놓치는 구멍이 생긴다 — 이 도구가 막으려는 바로 그 실패다.
IGNORE_CASE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --canary) [ $# -ge 2 ] || usage; CANARY="$2"; shift 2 ;;
    -i|--ignore-case) IGNORE_CASE="-i"; shift ;;
    --) shift; break ;;
    -*) usage ;;
    *) break ;;
  esac
done

[ -n "$CANARY" ] || usage
[ $# -ge 2 ] || usage
PATTERN="$1"; shift

# --- 1) 탐지기 자기검증 ---------------------------------------------------------
PROBE_DIR="$(mktemp -d)"
trap 'rm -rf "$PROBE_DIR"' EXIT
printf '%s\n' "$CANARY" > "$PROBE_DIR/canary.txt"

if ! grep -rIqE ${IGNORE_CASE:+"$IGNORE_CASE"} "$PATTERN" "$PROBE_DIR" 2>"$PROBE_DIR/probe.err"; then
  echo "FAIL(2): 탐지기 자기검증 실패 — canary '$CANARY' 가 패턴 '$PATTERN' 에 안 잡힌다." >&2
  echo "  이 상태의 '매치 없음'은 부재의 증거가 아니다. 패턴이나 canary 를 고쳐라." >&2
  [ -s "$PROBE_DIR/probe.err" ] && sed 's/^/  grep: /' "$PROBE_DIR/probe.err" >&2
  exit 2
fi

# --- 2) 실제 검사 (stderr 보존, 파이프 없음) -------------------------------------
OUT="$PROBE_DIR/out.txt"; ERR="$PROBE_DIR/err.txt"
EXISTING=""
for p in "$@"; do
  [ -e "$p" ] && EXISTING="${EXISTING} $p"
done
if [ -z "$EXISTING" ]; then
  echo "FAIL(2): 검사 대상 경로가 하나도 존재하지 않는다 — '없음'이 아니라 '안 봤음'이다." >&2
  exit 2
fi

# shellcheck disable=SC2086  # EXISTING 은 위에서 구성한 경로 목록 (의도적 분리)
grep -rInIE ${IGNORE_CASE:+"$IGNORE_CASE"} "$PATTERN" $EXISTING >"$OUT" 2>"$ERR"
GREP_RC=$?

if [ "$GREP_RC" -ge 2 ]; then
  echo "FAIL(2): grep 이 오류로 끝났다(exit $GREP_RC) — 결과를 부재로 읽으면 안 된다." >&2
  [ -s "$ERR" ] && sed 's/^/  grep: /' "$ERR" >&2
  exit 2
fi
[ -s "$ERR" ] && sed 's/^/  warn: /' "$ERR" >&2

COUNT=$(wc -l < "$OUT" | tr -d "[:space:]")
echo "검사 대상:$EXISTING"
echo "패턴: $PATTERN  (canary '$CANARY' 검증 통과)"
echo "매치: ${COUNT}건"

if [ "$COUNT" -gt 0 ]; then
  head -50 "$OUT"
  [ "$COUNT" -gt 50 ] && echo "  … 외 $((COUNT - 50))건"
  exit 1
fi
exit 0
