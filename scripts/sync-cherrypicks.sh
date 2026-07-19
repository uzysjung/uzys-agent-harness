#!/bin/bash
# ============================================================
# sync-cherrypicks.sh
# ECC, agent-skills, vercel-labs 등 외부 출처에서 cherry-pick한
# 파일들의 변경을 감지하고 동기화한다.
#
# 사용:
#   bash sync-cherrypicks.sh           # 검증 + diff 표시 (실제 수정 안 함)
#   bash sync-cherrypicks.sh --apply   # 변경사항 자동 적용 (modified=false만)
#   bash sync-cherrypicks.sh --check   # CI용 — 변경 있으면 exit 1
#
# exit code:
#   0  전 항목 비교 완료 + drift 없음
#   1  drift 있음(--check) 또는 이유 없이 비교 못 한 항목 있음
#   2  비교한 항목이 0건 — 출처 클론(.dev-references/<src>/)이 없다.
#      "이상 없음"이 아니라 "검사 못 함"이다. 0 과 절대 섞지 말 것.
# ============================================================
# bash 3.2 호환 (declare -A 미사용)
# 글로벌 ~/.claude/는 절대 건드리지 않음

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# 모든 경로는 repo 루트 기준이다 — lock·local_path·dst 전부 루트 상대 경로로 기록돼 있다.
# 이 스크립트가 scripts/ 로 옮겨진 뒤에도 SCRIPT_DIR 을 루트로 쓰던 탓에 lock 을 못 찾아
# 도입 이래 항상 exit 1 이었다 (v26.121.0 수리).
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$REPO_ROOT/.dev-references/cherrypicks.lock"

APPLY=false
CHECK=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --apply) APPLY=true; shift ;;
    --check) CHECK=true; shift ;;
    -h|--help) echo "Usage: $0 [--apply|--check]"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Prerequisites
if ! command -v jq &> /dev/null; then
  echo -e "${RED}ERROR: jq required for sync-cherrypicks.sh${NC}" >&2
  exit 1
fi

if [ ! -f "$MANIFEST" ]; then
  echo -e "${RED}ERROR: $MANIFEST not found${NC}" >&2
  exit 1
fi

# 출처별 source repo pull
echo -e "${CYAN}[1/3] Pulling source repos${NC}"

pull_source() {
  local source_id="$1"
  local local_path expected_url actual_url
  local_path=$(jq -r ".sources.\"$source_id\".local_path // empty" "$MANIFEST")
  if [ -z "$local_path" ] || [ "$local_path" = "null" ]; then
    return 0
  fi
  if [ ! -d "$REPO_ROOT/$local_path/.git" ]; then
    echo -e "  ${YELLOW}!${NC} $source_id: $local_path 미존재 또는 git repo 아님 (skip)"
    return 0
  fi

  # 보안: 매니페스트의 URL과 실제 origin 일치 확인 (.git/config 변조 방어)
  expected_url=$(jq -r ".sources.\"$source_id\".url // empty" "$MANIFEST")
  actual_url=$(cd "$REPO_ROOT/$local_path" 2>/dev/null && git remote get-url origin 2>/dev/null || echo "")
  if [ -n "$expected_url" ] && [ -n "$actual_url" ]; then
    case "$actual_url" in
      "$expected_url"|"$expected_url".git) ;;
      *)
        echo -e "  ${RED}✗${NC} $source_id: origin URL 불일치 (expected=$expected_url, actual=$actual_url) — pull 차단"
        return 1
        ;;
    esac
  fi

  # 보안: core.sshCommand / core.fsmonitor / core.hooksPath 등을 통한 RCE 방어
  echo -n "  $source_id..."
  (cd "$REPO_ROOT/$local_path" && git \
    -c core.sshCommand= \
    -c core.fsmonitor= \
    -c core.hooksPath=/dev/null \
    pull --quiet 2>/dev/null) && echo -e " ${GREEN}✓${NC}" || echo -e " ${YELLOW}pull 실패${NC}"
}

for source_id in $(jq -r '.sources | keys[]' "$MANIFEST"); do
  pull_source "$source_id"
done

# 각 cherrypick 검사
echo ""
echo -e "${CYAN}[2/3] Checking cherrypicks${NC}"

CHANGES=0
CONFLICTS=0
TOTAL=0
# 실제로 hash/diff 까지 도달해 비교가 끝난 건수. TOTAL 과 벌어지면 "검사한 척"이라는 뜻이다.
COMPARED=0
UNVERIFIED=0
DECLARED_SKIP=0
# 출처 클론이 없어 비교 자체가 불가능한 건수. `.dev-references/<src>/` 는 gitignore 라
# lock 만 추적된다 — 즉 CI/fresh clone 에서는 정상적으로 0건 비교가 된다. 이걸 "이상 없음"과
# 섞으면 아무것도 검사 안 하고 green 을 내게 된다. 아래 exit 2 로 구분한다.
SOURCE_MISSING=0

# BSD(macOS) realpath 에는 `-m` 이 없다 — 한 번만 재고 재사용한다.
REALPATH_M_OK=false
if command -v realpath &> /dev/null && realpath -m / >/dev/null 2>&1; then
  REALPATH_M_OK=true
fi

# bash 3.2 호환: jq로 한 줄씩 출력
while IFS=$'\t' read -r id source src dst type modified; do
  TOTAL=$((TOTAL + 1))

  # source repo의 local_path
  local_path=$(jq -r ".sources.\"$source\".local_path // empty" "$MANIFEST")
  if [ -z "$local_path" ]; then
    # lock 이 local_path: null 로 "이 출처는 클론하지 않는다"고 선언한 경우 — 의도된 비교 불가다.
    # 아래 시어터 단언에서 미검증(버그)과 구분하기 위해 따로 센다.
    echo -e "  ${YELLOW}!${NC} $id: source $source 의 local_path 없음 (lock 이 선언한 skip)"
    DECLARED_SKIP=$((DECLARED_SKIP + 1))
    continue
  fi

  # 출처 클론 부재 — CI/fresh clone 의 정상 상태다. 버그(미검증)와 구분해서 센다.
  if [ ! -d "$REPO_ROOT/$local_path/.git" ]; then
    SOURCE_MISSING=$((SOURCE_MISSING + 1))
    continue
  fi

  # 경로 traversal 방어 (HIGH security finding) — `..` 차단 + 절대경로 차단
  case "$src" in
    *..*|/*) echo -e "  ${RED}✗${NC} $id: 비안전 src 경로 ($src)"; continue ;;
  esac
  case "$dst" in
    *..*|/*) echo -e "  ${RED}✗${NC} $id: 비안전 dst 경로 ($dst)"; continue ;;
  esac

  src_full="$REPO_ROOT/$local_path/$src"
  dst_full="$REPO_ROOT/$dst"

  # realpath 심층 검증 — $REPO_ROOT 안에 있어야 함. 1차 방어는 위의 `..`/절대경로 차단이고
  # 이건 symlink 탈출까지 막는 2중화다.
  # BSD(macOS) realpath 는 `-m` 이 없다 (cli-development.md 의 BSD/GNU 표). 지원 여부를 먼저
  # 재고, 미지원이면 이 층만 건너뛴다 — 예전 코드는 빈 문자열을 받아 전 항목을 "REPO_ROOT 외부"로
  # 오판하고 continue 했고, 그 결과 CHANGES=0 / exit 0 이라는 거짓 green 을 냈다 (v26.121.0).
  if [ "$REALPATH_M_OK" = true ]; then
    src_resolved=$(realpath -m "$src_full" 2>/dev/null)
    dst_resolved=$(realpath -m "$dst_full" 2>/dev/null)
    if [ -z "$src_resolved" ] || [ -z "$dst_resolved" ]; then
      echo -e "  ${RED}✗${NC} $id: 경로 해석 실패 — 검증 불가"
      UNVERIFIED=$((UNVERIFIED + 1))
      continue
    fi
    case "$src_resolved" in "$REPO_ROOT"/*) ;; *) echo -e "  ${RED}✗${NC} $id: src가 REPO_ROOT 외부 ($src_resolved)"; UNVERIFIED=$((UNVERIFIED + 1)); continue ;; esac
    case "$dst_resolved" in "$REPO_ROOT"/*) ;; *) echo -e "  ${RED}✗${NC} $id: dst가 REPO_ROOT 외부 ($dst_resolved)"; UNVERIFIED=$((UNVERIFIED + 1)); continue ;; esac
  fi

  # 파일/디렉토리 존재 확인
  if [ "$type" = "file" ]; then
    if [ ! -f "$src_full" ]; then
      echo -e "  ${RED}✗${NC} $id: src 파일 없음 ($src_full)"
      continue
    fi
    if [ ! -f "$dst_full" ]; then
      echo -e "  ${RED}✗${NC} $id: dst 파일 없음 ($dst_full)"
      continue
    fi

    # hash 비교
    src_hash=$(shasum -a 256 "$src_full" | cut -d' ' -f1)
    dst_hash=$(shasum -a 256 "$dst_full" | cut -d' ' -f1)
    COMPARED=$((COMPARED + 1))

    if [ "$src_hash" = "$dst_hash" ]; then
      echo -e "  ${GREEN}=${NC} $id: 동일"
    else
      CHANGES=$((CHANGES + 1))
      if [ "$modified" = "true" ]; then
        echo -e "  ${YELLOW}!${NC} $id: 변경됨 + 로컬 수정 → 수동 머지 필요"
        CONFLICTS=$((CONFLICTS + 1))
      else
        echo -e "  ${YELLOW}△${NC} $id: 변경됨 (자동 업데이트 가능)"
        if [ "$APPLY" = true ]; then
          cp "$src_full" "$dst_full"
          echo -e "    ${GREEN}→ updated${NC}"
        fi
      fi
    fi
  elif [ "$type" = "directory" ]; then
    if [ ! -d "$src_full" ]; then
      echo -e "  ${RED}✗${NC} $id: src 디렉토리 없음 ($src_full)"
      continue
    fi
    if [ ! -d "$dst_full" ]; then
      echo -e "  ${RED}✗${NC} $id: dst 디렉토리 없음 ($dst_full)"
      continue
    fi

    # 디렉토리는 diff -r로 비교
    COMPARED=$((COMPARED + 1))
    if diff -r -q "$src_full" "$dst_full" > /dev/null 2>&1; then
      echo -e "  ${GREEN}=${NC} $id: 동일 (디렉토리)"
    else
      CHANGES=$((CHANGES + 1))
      if [ "$modified" = "true" ]; then
        echo -e "  ${YELLOW}!${NC} $id: 디렉토리 변경 + 로컬 수정 → 수동 머지 필요"
        CONFLICTS=$((CONFLICTS + 1))
      else
        echo -e "  ${YELLOW}△${NC} $id: 디렉토리 변경 (자동 동기화 가능)"
        if [ "$APPLY" = true ]; then
          # HIGH 수정: trailing slash 정리 후 dst 디렉토리 자체에 sync (sibling 보호)
          src_clean="${src_full%/}"
          dst_clean="${dst_full%/}"
          rsync -a --delete "$src_clean/" "$dst_clean/"
          echo -e "    ${GREEN}→ synced${NC}"
        fi
      fi
    fi
  fi
done < <(jq -r '.cherrypicks[] | [.id, .source, .src, .dst, .type, .modified] | @tsv' "$MANIFEST")

# Summary
echo ""
echo -e "${CYAN}[3/3] Summary${NC}"
echo "  Total: $TOTAL cherrypicks"
echo "  Compared: $COMPARED (실제 비교 완료) / 선언된 skip: $DECLARED_SKIP / 출처 미클론: $SOURCE_MISSING"
echo "  Changed: $CHANGES"
echo "  Conflicts (수동 머지 필요): $CONFLICTS"

# 아무것도 비교하지 못했으면 "이상 없음"이 아니다 — 별도 exit code 로 구분한다.
# CI 에서 이 스크립트를 부르려면 출처 클론이 먼저 있어야 한다는 뜻이고, 그걸 green 으로
# 오인하지 않게 하는 것이 이 분기의 목적이다.
if [ "$COMPARED" -eq 0 ]; then
  echo -e "${YELLOW}⚠ 비교한 항목이 0건이다 — 출처 클론이 없다. 'in sync' 가 아니라 '검사 못 함'이다.${NC}" >&2
  echo -e "${YELLOW}  .dev-references/<source>/ 를 clone 한 뒤 다시 실행하라.${NC}" >&2
  exit 2
fi

# 시어터 방지 — "0건 변경"은 전부 비교했을 때만 의미가 있다. 비교에 도달하지 못한 항목이
# 있는데 green 을 반환하면 그건 검사한 척이다. 3개월간 exit 1(경로 버그) → 수리 후에도
# 전 항목 skip(BSD realpath) 이었던 것을 이 단언이 잡는다.
if [ $((COMPARED + DECLARED_SKIP + SOURCE_MISSING)) -lt "$TOTAL" ]; then
  echo -e "${RED}✗ $((TOTAL - COMPARED - DECLARED_SKIP - SOURCE_MISSING))건이 이유 없이 비교되지 않았다 (미검증 $UNVERIFIED) — 'in sync' 라고 말할 수 없다${NC}" >&2
  exit 1
fi

if [ "$TOTAL" -eq 0 ]; then
  echo -e "${RED}✗ cherrypick 0건 — lock 을 못 읽었다는 뜻이다${NC}" >&2
  exit 1
fi

if [ "$CHECK" = true ] && [ "$CHANGES" -gt 0 ]; then
  echo -e "${RED}변경사항 있음 — CI 모드에서 exit 1${NC}" >&2
  exit 1
fi

if [ "$APPLY" = false ] && [ "$CHANGES" -gt 0 ]; then
  echo ""
  echo "변경사항을 적용하려면: bash $0 --apply"
fi

exit 0
