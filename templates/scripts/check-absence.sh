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
#                        --subject '<판정할 명령>' [--control-exit N]
#       예: ... --control '<이미 되는 대상으로 같은 절차>' --subject '<판정할 대상으로 같은 절차>'
#
#       **대상이 실행조차 안 되면(126/127) 판정이 아니라 무효다** — "대상이 안 된다"와
#       "내가 친 명령이 틀렸다"는 다른 사실이고 exit 1 은 둘을 구분해 주지 않는다.
#       실행기는 `bash -c` 로 고정한다. `sh` 는 macOS 에서 bash, Linux 에서 dash 라
#       같은 입력이 플랫폼마다 반대 판정을 냈다.
#       바이너리 부재를 재려면 `--subject 'command -v <bin>'` 처럼 **1 을 내는 형태**로 쓴다.
#
# 공통 규율: stderr 를 버리지 않는다 · 파이프로 exit code 를 가리지 않는다 · 건수/코드를 명시 출력한다.
#
# exit:
#   0  부재 확인 (대조군 통과 상태에서 매치 0 또는 대상이 실행된 뒤 실패)
#   1  발견 — 부정 결론이 틀렸다 (매치 있음 또는 대상 성공)
#   2  결과 신뢰 불가 — 대조군 실패 · 탐지기 자기검증 실패 · 대상 미실행(126/127) · grep 오류 · 경로 부재
#   3  사용법 오류

set -u

usage() {
  cat >&2 <<'USAGE'
usage:
  pattern 모드:  check-absence.sh --canary <알려진-양성> [-i] <ERE-패턴> <경로>...
  command 모드:  check-absence.sh --control <대조-명령> --subject <대상-명령> [--control-exit N]

  두 모드 모두 대조군이 필수다. 탐지기(또는 절차)가 실제로 무는지 보이지 않으면
  "없음"·"안 됨"은 증거가 아니라 추측이다.

  exit: 0 부재 확인 · 1 발견 · 2 결과 신뢰 불가 · 3 사용법
USAGE
  exit 3
}

CANARY=""
CANARY_SET=0
CONTROL=""
SUBJECT=""
CONTROL_EXIT=0
CONTROL_EXIT_SET=0
# -i 는 자기검증과 실제 검사에 **동시에** 적용된다. 한쪽만 적용하면 자기검증이 통과해도
# 실제 검사가 놓치는 구멍이 생긴다 — 이 도구가 막으려는 바로 그 실패다.
IGNORE_CASE=""
IGNORE_CASE_SET=0
while [ $# -gt 0 ]; do
  case "$1" in
    --canary) [ $# -ge 2 ] || usage; CANARY="$2"; CANARY_SET=1; shift 2 ;;
    --control) [ $# -ge 2 ] || usage; CONTROL="$2"; shift 2 ;;
    --subject) [ $# -ge 2 ] || usage; SUBJECT="$2"; shift 2 ;;
    --control-exit) [ $# -ge 2 ] || usage; CONTROL_EXIT="$2"; CONTROL_EXIT_SET=1; shift 2 ;;
    -i|--ignore-case) IGNORE_CASE="-i"; IGNORE_CASE_SET=1; shift ;;
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
  [ "$CANARY_SET" -eq 0 ] || usage
  # 남는 위치 인자를 조용히 버리지 않는다 — 조용한 무시가 이 도구의 성격과 반대다.
  [ $# -eq 0 ] || usage
  [ "$IGNORE_CASE_SET" -eq 0 ] || usage
  # 형태와 **범위**를 함께 본다. 범위를 안 보면 아래 `[ ... -ne ... ]` 가 에러(상태 2)로 끝나고
  # `if` 가 그것을 거짓 = "대조군 통과" 로 읽는다 — 실패가 삼켜지는 자리다.
  case "$CONTROL_EXIT" in
    ''|*[!0-9]*) usage ;;
  esac
  # 선행 0 만 벗긴다(0255 → 255 · 000 → 0). **산술을 쓰지 않는다** — bash 산술은 오버플로에서
  # 에러를 내지 않고 조용히 랩어라운드해서(`$((10#18446744073709551616))` = 0) 사용자가 적은
  # 기대값이 사라진 채 다른 값으로 판정된다. `|| usage` 도 그때는 한 번도 발화하지 않는다.
  while [ "${#CONTROL_EXIT}" -gt 1 ] && [ "${CONTROL_EXIT#0}" != "$CONTROL_EXIT" ]; do
    CONTROL_EXIT="${CONTROL_EXIT#0}"
  done
  { [ "${#CONTROL_EXIT}" -le 3 ] && [ "$CONTROL_EXIT" -le 255 ]; } || usage

  C_OUT="$WORK_DIR/control.out"; C_ERR="$WORK_DIR/control.err"
  bash -c "$CONTROL" >"$C_OUT" 2>"$C_ERR"
  C_RC=$?

  if [ "$C_RC" -ne "$CONTROL_EXIT" ]; then
    echo "FAIL(2): 대조군이 기대(exit $CONTROL_EXIT)와 다르게 끝났다 — exit $C_RC." >&2
    echo "  이 실행에서 대상이 실패해도 '안 된다'의 증거가 아니다. 절차 자체가 틀렸을 수 있다." >&2
    case "$C_RC" in
      126) echo "  (126 = 실행 권한 없음 — 대조 명령 자체가 안 돌았다)" >&2 ;;
      127) echo "  (127 = 명령을 찾을 수 없음 — 대조 명령 자체가 안 돌았다)" >&2 ;;
    esac
    echo "  대조 명령: $CONTROL" >&2
    [ -s "$C_ERR" ] && sed 's/^/  control stderr: /' "$C_ERR" >&2
    [ -s "$C_OUT" ] && tail -20 "$C_OUT" | sed 's/^/  control stdout: /' >&2
    exit 2
  fi

  S_OUT="$WORK_DIR/subject.out"; S_ERR="$WORK_DIR/subject.err"
  bash -c "$SUBJECT" >"$S_OUT" 2>"$S_ERR"
  S_RC=$?

  echo "실행기: bash -c   (sh 는 플랫폼마다 방언이 달라 같은 입력의 판정이 뒤집힌다)"
  echo "대조군: $CONTROL"
  echo "  → exit $C_RC (기대 $CONTROL_EXIT) — 절차가 작동한다"
  echo "대상:   $SUBJECT"
  echo "  → exit $S_RC"
  [ -s "$S_ERR" ] && sed 's/^/  stderr: /' "$S_ERR"
  [ -s "$S_OUT" ] && tail -20 "$S_OUT" | sed 's/^/  stdout: /'

  # 실행조차 안 된 것은 판정이 아니다. 여기서 0 을 내주면 "대상이 안 된다"와
  # "내가 친 명령이 틀렸다"가 같은 결론이 되고, 그게 이 도구가 없애려던 실패다.
  case "$S_RC" in
    126|127)
      echo "FAIL(2): 대상 명령이 **실행되지 않았다**(exit $S_RC) — 실패가 아니라 무효다." >&2
      echo "  126 = 실행 권한 없음 · 127 = 명령을 찾을 수 없음." >&2
      echo "  **바이너리 부재**를 판정하려면 1 을 내는 형태로 바꿔라 — 예: --subject 'command -v <bin>'" >&2
      exit 2 ;;
  esac

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
# pattern 모드에 command 모드 플래그를 섞으면 조용히 무시되지 않고 거절된다.
[ "$CONTROL_EXIT_SET" -eq 0 ] || usage
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
# 경로는 **배열**로 넘긴다. 공백 구분 문자열로 쌓아 인용 없이 전개하면 `a b` 같은 경로가
# 단어 분할돼 엉뚱한 곳을 훑고 `매치: 0건` 을 낸다 — canary 를 통과한 뒤라
# 사용자는 최대 확신 상태에서 거짓 부재를 받는다.
OUT="$WORK_DIR/out.txt"; ERR="$WORK_DIR/err.txt"
PATHS=()
for p in "$@"; do
  [ -e "$p" ] && PATHS+=("$p")
done
if [ "${#PATHS[@]}" -eq 0 ]; then
  echo "FAIL(2): 검사 대상 경로가 하나도 존재하지 않는다 — '없음'이 아니라 '안 봤음'이다." >&2
  exit 2
fi

grep -rInIE ${IGNORE_CASE:+"$IGNORE_CASE"} "$PATTERN" "${PATHS[@]}" >"$OUT" 2>"$ERR"
GREP_RC=$?

if [ "$GREP_RC" -ge 2 ]; then
  echo "FAIL(2): grep 이 오류로 끝났다(exit $GREP_RC) — 결과를 부재로 읽으면 안 된다." >&2
  [ -s "$ERR" ] && sed 's/^/  grep: /' "$ERR" >&2
  exit 2
fi
[ -s "$ERR" ] && sed 's/^/  warn: /' "$ERR" >&2

COUNT=$(wc -l < "$OUT" | tr -d "[:space:]")
printf '검사 대상:'; printf ' %s' "${PATHS[@]}"; printf '\n'
echo "패턴: $PATTERN  (canary '$CANARY' 검증 통과)"
echo "매치: ${COUNT}건"

if [ "$COUNT" -gt 0 ]; then
  head -50 "$OUT"
  [ "$COUNT" -gt 50 ] && echo "  … 외 $((COUNT - 50))건"
  exit 1
fi
exit 0
