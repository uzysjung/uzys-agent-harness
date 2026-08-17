#!/usr/bin/env bash
# check-absence.sh — 부정 결론("없다" · "안 된다")을 **증거로** 만드는 명령.
#
# 왜 도구인가: `cli-development.md` 가 규약으로 적고 있는데도 같은 실수가 계속 났다.
#   · 대소문자 구분 grep 으로 2건을 놓치고 "잔여 0" 선언
#   · `grep | sort || echo` 로 exit code 를 가림 (`sort` 는 빈 입력에도 0)
#   · 탐지기를 검증하지 않고 빈 출력을 신뢰
#   · Docker 로 설치를 돌려 exit 1 을 보고 "설치 불가" 결론 — **대조군도 함께 실패**했고
#     원인은 컨테이너에 git 이 없던 것이었다 (실험이 무효였지 대상이 안 되는 게 아니었다)
# 사람이 매번 기억해야 하는 규약은 규약이 아니므로 도구로 내린다.
#
# 하나의 원리: **대조군이 통과해야 부정 결론이 증거다.**
#   빈 결과도, 실패한 명령도, 그 자체로는 "대상이 없다"와 "내 탐지기가 틀렸다"를 구분해 주지 않는다.
#
# 두 모드가 그 원리를 각각의 재료에 적용한다.
#
#   ┌ pattern 모드 — "이 패턴이 없다"
#   │   대조군 = 합성한 알려진 양성(canary). 패턴이 그것을 물어야 부재 결과를 신뢰한다.
#   │
#   │   check-absence.sh --canary '<알려진 양성>' [-i] '<ERE 패턴>' <경로>...
#   │   예: ... --canary 'OldName' 'oldname|legacy_prefix' dist src templates
#   │
#   └ command 모드 — "이 명령이 안 된다 / 이 기능이 없다"
#       대조군 = **되는 줄 아는 대상**에 같은 절차를 돌린 명령. 그게 실패하면 실험이 무효다.
#
#       check-absence.sh --control '<되는 줄 아는 명령>' \
#                                     --subject '<판정할 명령>' [--control-exit N]
#       예: ... --control '<이미 되는 대상으로 같은 절차>' --subject '<판정할 대상으로 같은 절차>'
#
# 공통 규율: stderr 를 버리지 않는다 · 파이프로 exit code 를 가리지 않는다 · 건수/코드를 명시 출력한다.
#
# exit:
#   0  부재 확인 (대조군 통과 상태에서 매치 0 또는 대상 실패)
#   1  발견 — 부정 결론이 틀렸다 (매치 있음 또는 대상 성공)
#   2  결과 신뢰 불가 — 대조군 실패 · 탐지기 자기검증 실패 · grep 오류 · 대상 경로 부재
#   3  사용법 오류

set -u

usage() {
  cat >&2 <<'USAGE'
usage:
  pattern 모드:  check-absence.sh --canary <알려진-양성> [-i] <ERE-패턴> <경로>...
  command 모드:  check-absence.sh --control <대조-명령> --subject <대상-명령> [--control-exit N]

  두 모드 모두 대조군이 필수다. 탐지기(또는 절차)가 실제로 무는지 보이지 않으면
  "없음"·"안 됨"은 증거가 아니라 추측이다.
USAGE
  exit 3
}

CANARY=""
CONTROL=""
SUBJECT=""
CONTROL_EXIT=0
# -i 는 자기검증과 실제 검사에 **동시에** 적용된다. 한쪽만 적용하면 자기검증이 통과해도
# 실제 검사가 놓치는 구멍이 생긴다 — 이 도구가 막으려는 바로 그 실패다.
IGNORE_CASE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --canary) [ $# -ge 2 ] || usage; CANARY="$2"; shift 2 ;;
    --control) [ $# -ge 2 ] || usage; CONTROL="$2"; shift 2 ;;
    --subject) [ $# -ge 2 ] || usage; SUBJECT="$2"; shift 2 ;;
    --control-exit) [ $# -ge 2 ] || usage; CONTROL_EXIT="$2"; shift 2 ;;
    -i|--ignore-case) IGNORE_CASE="-i"; shift ;;
    --) shift; break ;;
    -*) usage ;;
    *) break ;;
  esac
done

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# --- command 모드 --------------------------------------------------------------
# 모드는 배타적이다. 섞어 부르면 어느 대조군이 적용됐는지 출력만 보고는 알 수 없다.
if [ -n "$CONTROL" ] || [ -n "$SUBJECT" ]; then
  { [ -n "$CONTROL" ] && [ -n "$SUBJECT" ]; } || usage
  [ -z "$CANARY" ] || usage
  case "$CONTROL_EXIT" in (*[!0-9]*|'') usage ;; esac

  C_OUT="$WORK_DIR/control.out"; C_ERR="$WORK_DIR/control.err"
  sh -c "$CONTROL" >"$C_OUT" 2>"$C_ERR"
  C_RC=$?

  if [ "$C_RC" -ne "$CONTROL_EXIT" ]; then
    echo "FAIL(2): 대조군이 기대(exit $CONTROL_EXIT)와 다르게 끝났다 — exit $C_RC." >&2
    echo "  이 실행에서 대상이 실패해도 '안 된다'의 증거가 아니다. 절차 자체가 틀렸을 수 있다." >&2
    echo "  대조 명령: $CONTROL" >&2
    [ -s "$C_ERR" ] && sed 's/^/  control stderr: /' "$C_ERR" >&2
    [ -s "$C_OUT" ] && tail -20 "$C_OUT" | sed 's/^/  control stdout: /' >&2
    exit 2
  fi

  S_OUT="$WORK_DIR/subject.out"; S_ERR="$WORK_DIR/subject.err"
  sh -c "$SUBJECT" >"$S_OUT" 2>"$S_ERR"
  S_RC=$?

  echo "대조군: $CONTROL"
  echo "  → exit $C_RC (기대 $CONTROL_EXIT) — 절차가 작동한다"
  echo "대상:   $SUBJECT"
  echo "  → exit $S_RC"
  [ -s "$S_ERR" ] && sed 's/^/  stderr: /' "$S_ERR"
  [ -s "$S_OUT" ] && tail -20 "$S_OUT" | sed 's/^/  stdout: /'

  if [ "$S_RC" -eq 0 ]; then
    echo "결과: 대상이 성공했다 — '안 된다'는 결론은 틀렸다."
    exit 1
  fi
  echo "결과: 대조군이 통과한 상태에서 대상이 실패했다 — 부정 결론이 증거를 얻었다."
  exit 0
fi

# --- pattern 모드 --------------------------------------------------------------
[ -n "$CANARY" ] || usage
[ $# -ge 2 ] || usage
PATTERN="$1"; shift

# 1) 탐지기 자기검증
printf '%s\n' "$CANARY" > "$WORK_DIR/canary.txt"

if ! grep -rIqE ${IGNORE_CASE:+"$IGNORE_CASE"} "$PATTERN" "$WORK_DIR/canary.txt" 2>"$WORK_DIR/probe.err"; then
  echo "FAIL(2): 탐지기 자기검증 실패 — canary '$CANARY' 가 패턴 '$PATTERN' 에 안 잡힌다." >&2
  echo "  이 상태의 '매치 없음'은 부재의 증거가 아니다. 패턴이나 canary 를 고쳐라." >&2
  [ -s "$WORK_DIR/probe.err" ] && sed 's/^/  grep: /' "$WORK_DIR/probe.err" >&2
  exit 2
fi

# 2) 실제 검사 (stderr 보존, 파이프 없음)
OUT="$WORK_DIR/out.txt"; ERR="$WORK_DIR/err.txt"
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
