#!/usr/bin/env bash
# 룰·스킬·훅이 **마지막으로 언제, 어떤 커밋으로** 바뀌었는지 보여준다.
#
# 왜 이것이 판정 근거인가 (사용자 확정 2026-08-26):
#   본문의 뜻이 옳은지는 읽어서 판정한다. 그것을 어휘로 판정하려던 시도는 #345 에서 세 라운드
#   내내 우회당했다 — 어절을 고정하면 정당한 개정이 막히고, 풀면 의미 반전이 샌다.
#   그래서 검사 대상을 **내용에서 이력으로** 옮긴다. 날짜와 커밋 제목은 기계가 정확히 답할 수
#   있고, "왜 바꿨는가"는 커밋 본문에 남는다(.claude/rules/change-management.md).
#
# 사용:
#   bash scripts/asset-history.sh              # 전부, 최근에 바뀐 것부터
#   bash scripts/asset-history.sh --since 30   # 최근 30일 안에 바뀐 것만
#   bash scripts/asset-history.sh --no-issue   # 커밋 제목에 이슈 번호(#N)가 없는 것만
#   bash scripts/asset-history.sh --sweep 3    # 한 커밋이 자산 3개 이상을 건드린 것만
#
# `자산수` 열이 이 도구의 핵심이다 — **한 커밋이 여러 자산을 한꺼번에 건드렸다**는 것이
# "건드릴 이유가 없는데 건드려졌다"의 신호다. 숫자가 크면 그 커밋의 이슈를 열어 그 자산이
# 정말 그 이슈의 범위였는지 본다. 넓은 정리 커밋(룰 다이어트 등)은 정당하게 클 수 있으니
# 숫자 자체는 판정이 아니라 **읽을 곳을 가리키는 것**이다.
#
# 이 스크립트는 아무것도 차단하지 않는다(항상 exit 0).

set -euo pipefail

cd "$(dirname "$0")/.."

SINCE_DAYS=""
ONLY_NO_ISSUE=0
MIN_SWEEP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --since) SINCE_DAYS="${2:?--since 에 일수를 달라}"; shift 2 ;;
    --no-issue) ONLY_NO_ISSUE=1; shift ;;
    --sweep) MIN_SWEEP="${2:?--sweep 에 자산 개수를 달라}"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) printf 'unknown option: %s\n' "$1" >&2; exit 3 ;;
  esac
done

# 대상은 **글롭으로 훑는다** — 열거하면 목록 밖 파일이 다음 서식지가 된다(이 리포 6회 재발).
# 이 글롭 하나가 SSOT 다: 행 목록도, 아래 자산수 계산도 같은 pathspec 을 git 에 넘긴다.
# 두 벌로 쓰면 그 자체가 두 번째 하드코딩 사본이 된다.
ASSET_GLOBS=(
  'templates/rules/*.md'
  'templates/skills/*/SKILL.md'
  'templates/hooks/*'
  '.claude/rules/*.md'
  '.claude/hooks/*'
  'templates/CLAUDE.md'
  'CLAUDE.md'
  '.claude/CLAUDE.md'
)
TARGETS=$(git ls-files -- "${ASSET_GLOBS[@]}" | sort -u)

if [ -z "$TARGETS" ]; then
  echo "대상 파일이 하나도 안 잡혔다 — 글롭이 저장소 구조와 안 맞는다." >&2
  exit 2
fi

# 대조군: 되는 줄 아는 파일 하나가 이력을 내는지 먼저 본다. 안 나오면 git 이 아니라 절차가 틀렸다.
if ! git log -1 --format=%H -- "CLAUDE.md" >/dev/null 2>&1; then
  echo "대조군(CLAUDE.md)이 이력을 안 낸다 — 이 실행은 무효다." >&2
  exit 2
fi

CUTOFF=""
if [ -n "$SINCE_DAYS" ]; then
  # BSD/GNU date 분기 (cli-development.md §Cross-Platform)
  if date -v-1d +%Y-%m-%d >/dev/null 2>&1; then
    CUTOFF=$(date -v-"${SINCE_DAYS}"d +%Y-%m-%d)
  else
    CUTOFF=$(date -d "${SINCE_DAYS} days ago" +%Y-%m-%d)
  fi
fi

printf '%-11s  %-9s  %-5s  %-52s  %s\n' "바뀐날짜" "커밋" "자산수" "자산" "왜 바꿨나 (커밋 제목)"
printf '%s\n' "------------------------------------------------------------------------------------------------------"

ROWS=$(mktemp); trap 'rm -f "$ROWS"' EXIT
shown=0
total=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  total=$((total + 1))
  line=$(git log -1 --format='%cs%x09%h%x09%s' -- "$f")
  [ -n "$line" ] || continue
  d=${line%%	*}
  rest=${line#*	}
  h=${rest%%	*}
  subject=${rest#*	}

  # 그 커밋이 자산을 몇 개 건드렸나 — 큰 값이 "일괄 정리 중 딸려 들어감"의 신호다.
  # pathspec 을 git 에 넘겨 센다. 현재 파일 목록과 교집합을 내면 **그 커밋이 지운 자산이
  # 안 세어진다** — 삭제야말로 이 규칙이 막으려는 최악의 사고다(2026-08-11 금지문 소실).
  n=$(git show --name-only --format= "$h" -- "${ASSET_GLOBS[@]}" | grep -c . || true)

  [ -n "$CUTOFF" ] && [ "$d" \< "$CUTOFF" ] && continue
  [ "$n" -lt "$MIN_SWEEP" ] && continue
  if [ "$ONLY_NO_ISSUE" -eq 1 ] && printf '%s' "$subject" | grep -q '#[0-9]'; then
    continue
  fi
  printf '%-11s  %-9s  %5s  %-52s  %s\n' "$d" "$h" "$n" "$f" "$subject" >>"$ROWS"
  shown=$((shown + 1))
done <<EOF
$TARGETS
EOF

sort -r "$ROWS"   # 최근에 바뀐 것부터 — 판정이 필요한 쪽이 위로 온다
printf '%s\n' "------------------------------------------------------------------------------------------------------"
printf '자산 %d개 중 %d개 표시.\n' "$total" "$shown"
printf '자산수가 큰 줄부터 읽는다 — 그 커밋의 이슈가 이 자산까지 범위였나: git show <커밋>\n'
