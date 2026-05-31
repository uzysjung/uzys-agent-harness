#!/bin/bash
# ============================================================
# prune-ecc.sh
# ECC plugin을 project local로 복사하고 KEEP 외 항목을 prune.
# 글로벌 ~/.claude/는 read-only로만 사용 (D16 안전).
#
# 사용:
#   1. (선행 1회) claude plugin install everything-claude-code@everything-claude-code
#   2. bash prune-ecc.sh                # dry-run (기본). 변경 없음.
#   3. bash prune-ecc.sh --apply        # 실제 복사 + prune (확인 prompt)
#   4. bash prune-ecc.sh --apply --force # 확인 없이 즉시 진행
#   5. claude --plugin-dir .claude/local-plugins/ecc  # 사용
#
# 옵션:
#   --apply           실제 복사 + prune. 기본은 dry-run.
#   --force           확인 prompt 생략.
#   --dest <path>     복사 대상 경로 (기본: .claude/local-plugins/ecc)
#   --keep-existing   dest가 이미 있으면 덮어쓰기 안 함 (기본은 재복사)
#   --copy-only       prune 단계 skip. 전체 ECC를 project local로 복사만.
#
# 안전성:
#   - 글로벌 ~/.claude/plugins/cache/ : read-only (cp 소스로만 사용)
#   - dest 위치 (.claude/local-plugins/ecc) : .gitignore 자동 추가
#   - 다른 프로젝트 영향 없음 (이 프로젝트 local만)
# ============================================================
set -u

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# --- Args ---
APPLY=false
FORCE=false
KEEP_EXISTING=false
COPY_ONLY=false
DEST=".claude/local-plugins/ecc"
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=true; shift ;;
    --force) FORCE=true; shift ;;
    --keep-existing) KEEP_EXISTING=true; shift ;;
    --copy-only) COPY_ONLY=true; shift ;;
    --dest)
      [ -z "${2:-}" ] || [[ "$2" == --* ]] && { echo "ERROR: --dest requires a value" >&2; exit 1; }
      DEST="$2"; shift 2 ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# v26.11.1 — DEST 경계 검증: 글로벌 ~/.claude/ 또는 시스템 경로 차단 (path traversal 방어)
# v0.6.6 — dirname 디렉토리 미존재 시 pwd 기준으로 fallback (이전엔 상대경로 그대로 잔존 → pwd 검증 실패)
DEST_PARENT="$(cd "$(dirname "$DEST")" 2>/dev/null && pwd)" || DEST_PARENT=""
if [ -n "$DEST_PARENT" ]; then
  DEST_ABS="$DEST_PARENT/$(basename "$DEST")"
elif [[ "$DEST" = /* ]]; then
  DEST_ABS="$DEST"
else
  DEST_ABS="$(pwd)/$DEST"
fi
case "$DEST_ABS" in
  "$HOME/.claude"|"$HOME/.claude/"*)
    echo "ERROR: --dest는 글로벌 ~/.claude/ 영역 불가 (D16)" >&2
    echo "       입력: $DEST (절대: $DEST_ABS)" >&2
    exit 1 ;;
  "/"|"/etc"|"/etc/"*|"/usr/bin"|"/usr/sbin"|"/usr/local/bin"|"/bin"|"/sbin"|"/System"|"/System/"*)
    echo "ERROR: --dest는 시스템 디렉토리 불가" >&2
    echo "       입력: $DEST (절대: $DEST_ABS)" >&2
    exit 1 ;;
esac
# 추가 안전: 현재 pwd 하위만 허용 (project-local 보장)
case "$DEST_ABS" in
  "$(pwd)"|"$(pwd)/"*) ;;
  *)
    echo "ERROR: --dest는 현재 프로젝트 디렉토리 하위만 허용" >&2
    echo "       입력: $DEST (절대: $DEST_ABS)" >&2
    echo "       현재 pwd: $(pwd)" >&2
    exit 1 ;;
esac

info() { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1" >&2; }
section() { echo ""; echo -e "${CYAN}${BOLD}$1${NC}"; }

# --- KEEP list (총 98건, v26.58.0 +6) ---
# v26.58.0 (ADR-019): cherrypicks.lock 의 C2 6개 KEEP 추가 (plugin ON 시 prune 으로 사라지는 구멍 차단):
#   security-reviewer, silent-failure-hunter, build-error-resolver,
#   e2e-testing, agent-introspection-debugging, nextjs-turbopack.
# 직전 baseline 92건 (이전 코멘트 "89건" 은 오기 — 실제 단어 count 검증 시 92).
KEEP_ITEMS="
agent-harness-construction agent-introspection-debugging agentic-engineering
ai-first-engineering api-design aside autonomous-loops backend-patterns
blueprint build-error-resolver build-fix checkpoint claude-api claw
code-review code-reviewer coding-standards configure-ecc content-engine
content-hash-cache-pattern continuous-agent-loop continuous-learning continuous-learning-v2
cost-aware-llm-pipeline crosspost database-migrations database-reviewer deep-research
deployment-patterns dmux-workflows docker-patterns e2e e2e-runner e2e-testing
eval eval-harness evolve exa-search frontend-patterns frontend-slides
harness-audit harness-optimizer instinct-export instinct-import instinct-status
investor-materials investor-outreach iterative-retrieval learn learn-eval
loop-operator loop-start loop-status market-research model-route multi-backend
multi-execute multi-frontend multi-plan multi-workflow nextjs-turbopack orchestrate
plan plankton-code-quality planner postgres-patterns projects promote
prompt-optimize prompt-optimizer python-patterns python-review python-reviewer
python-testing quality-gate refactor-clean regex-vs-llm-structured-text
resume-session save-session search-first security-review security-reviewer
security-scan sessions setup-pm silent-failure-hunter skill-create skill-stocktake
strategic-compact tdd tdd-guide tdd-workflow test-coverage update-codemaps
update-docs verification-loop verify x-api
"

is_keep() {
  # v26.11.1 — grep -F (fixed string)로 정규식 메타문자 안전. 공백으로 단어 경계 강제.
  echo " $KEEP_ITEMS " | tr -s ' \n' ' ' | grep -qF " $1 "
}

# --- Step 1: 글로벌 ECC cache 발견 ---
section "[1/5] Discover global ECC plugin cache (read-only)"
ECC_CACHE_BASE="$HOME/.claude/plugins/cache/everything-claude-code/everything-claude-code"
if [ ! -d "$ECC_CACHE_BASE" ]; then
  fail "ECC plugin 미설치 — 다음 명령으로 먼저 설치:"
  echo "    claude plugin marketplace add affaan-m/everything-claude-code"
  echo "    claude plugin install everything-claude-code@everything-claude-code"
  exit 1
fi
ECC_VERSION=$(ls -1 "$ECC_CACHE_BASE" 2>/dev/null | sort -V | tail -1)
# ECC v1.10.0 구조: 1.10.0/ 자체가 root (skills/, agents/, commands/ top-level).
# everything-claude-code/ 는 빈 디렉토리, ecc2/는 별개 Rust 프로젝트.
ECC_SOURCE="$ECC_CACHE_BASE/$ECC_VERSION"
if [ ! -d "$ECC_SOURCE/skills" ] || [ ! -d "$ECC_SOURCE/agents" ]; then
  fail "ECC plugin source 디렉토리 미발견 (skills/ + agents/): $ECC_SOURCE"
  exit 1
fi
info "Source: $ECC_SOURCE (v$ECC_VERSION)"

# --- Step 2: 복사 (또는 기존 사용) ---
section "[2/5] Copy to project local"
if [ -d "$DEST" ] && [ "$KEEP_EXISTING" = true ]; then
  info "기존 $DEST 유지 (--keep-existing)"
elif [ "$APPLY" = false ]; then
  warn "[DRY-RUN] would copy: $ECC_SOURCE → $DEST"
else
  if [ -d "$DEST" ]; then
    warn "기존 $DEST 제거 후 재복사"
    rm -rf "$DEST"
  fi
  mkdir -p "$(dirname "$DEST")"
  cp -R "$ECC_SOURCE" "$DEST"
  info "Copied to: $DEST"
fi

# --- Step 3: prune 분석 ---
section "[3/5] Prune analysis"
SCAN_DIR="$DEST"
[ ! -d "$SCAN_DIR" ] && SCAN_DIR="$ECC_SOURCE"  # dry-run 시 source로 분석

declare -a PRUNE_TARGETS=()
KEEP_COUNT=0
PRUNE_COUNT=0

analyze_dir() {
  local kind="$1" dir="$2"
  [ ! -d "$dir" ] && return
  local kept=0 pruned=0
  if [ "$kind" = "directory" ]; then
    for d in "$dir"/*/; do
      [ -d "$d" ] || continue
      local name; name=$(basename "$d")
      if is_keep "$name"; then
        kept=$((kept+1))
      else
        PRUNE_TARGETS+=("$d")
        pruned=$((pruned+1))
      fi
    done
  else
    for f in "$dir"/*.md; do
      [ -f "$f" ] || continue
      local name; name=$(basename "$f" .md)
      if is_keep "$name"; then
        kept=$((kept+1))
      else
        PRUNE_TARGETS+=("$f")
        pruned=$((pruned+1))
      fi
    done
  fi
  KEEP_COUNT=$((KEEP_COUNT+kept))
  PRUNE_COUNT=$((PRUNE_COUNT+pruned))
  printf "  %-50s keep=%3d  prune=%3d\n" "${dir#$SCAN_DIR/}" "$kept" "$pruned"
}

analyze_dir "directory" "$SCAN_DIR/skills"
analyze_dir "file"      "$SCAN_DIR/agents"
analyze_dir "file"      "$SCAN_DIR/commands"
[ -d "$SCAN_DIR/.opencode/commands" ] && analyze_dir "file" "$SCAN_DIR/.opencode/commands"
[ -d "$SCAN_DIR/.claude/commands" ]   && analyze_dir "file" "$SCAN_DIR/.claude/commands"

echo ""
echo -e "  ${BOLD}Total keep: ${GREEN}$KEEP_COUNT${NC}${BOLD}  prune: ${RED}$PRUNE_COUNT${NC}"

# KEEP 누락 검증
section "KEEP missing check (사용자 리스트 중 plugin에 없는 것)"
NOT_FOUND=()
for k in $KEEP_ITEMS; do
  if ! find "$SCAN_DIR/skills" "$SCAN_DIR/agents" "$SCAN_DIR/commands" \
         "$SCAN_DIR/.opencode/commands" "$SCAN_DIR/.claude/commands" \
         -maxdepth 1 \( -type d -name "$k" -o -type f -name "$k.md" \) 2>/dev/null \
         | grep -q .; then
    NOT_FOUND+=("$k")
  fi
done
if [ "${#NOT_FOUND[@]}" -eq 0 ]; then
  # 카운트는 KEEP_ITEMS 에서 동적 산출 (하드코딩 시 89→92→98 처럼 drift 누적).
  info "모든 KEEP $(echo "$KEEP_ITEMS" | wc -w | tr -d ' ')건 plugin에 존재"
else
  warn "KEEP 누락 ${#NOT_FOUND[@]}건 (이름 변경/제거됐을 수 있음):"
  printf '    - %s\n' "${NOT_FOUND[@]}"
fi

# --- Step 4: apply ---
section "[4/5] Apply prune"
if [ "$APPLY" = false ]; then
  warn "DRY-RUN — 변경 없음. 실제 복사+prune은 --apply 추가."
  echo "    bash prune-ecc.sh --apply"
  exit 0
fi

# v26.15.0 — --copy-only: prune 단계 skip
if [ "$COPY_ONLY" = true ]; then
  info "copy-only 모드 — prune 단계 skip (전체 ECC 유지)"
  DELETED=0
  FAILED=0
else
  if [ "$FORCE" = false ]; then
    echo ""
    echo -e "  ${YELLOW}경고:${NC} ${PRUNE_COUNT}건을 ${DEST} 하위에서 영구 삭제합니다."
    echo "  글로벌 cache는 영향 없음. 다른 프로젝트도 영향 없음."
    read -rp "  진행? [y/N]: " ANSWER < /dev/tty 2>/dev/null || ANSWER=""
    [[ ! "$ANSWER" =~ ^[Yy]$ ]] && { warn "취소됨"; exit 0; }
  fi
  DELETED=0
  FAILED=0
  for target in "${PRUNE_TARGETS[@]}"; do
    if rm -rf "$target" 2>/dev/null; then
      DELETED=$((DELETED+1))
    else
      FAILED=$((FAILED+1))
      fail "삭제 실패: $target"
    fi
  done
fi

# --- Step 5: .gitignore + 사용 안내 ---
section "[5/5] Post-actions"
if ! grep -q "^.claude/local-plugins/" .gitignore 2>/dev/null; then
  echo ".claude/local-plugins/" >> .gitignore
  info ".gitignore에 .claude/local-plugins/ 추가"
else
  info ".gitignore 이미 등록됨"
fi

# v26.15.0 — DELETED / KEPT 상세 목록 출력
if [ "$COPY_ONLY" = false ] && [ "$DELETED" -gt 0 ]; then
  echo ""
  echo -e "${BOLD}========== DELETED ($DELETED) ==========${NC}"
  for category in skills agents commands; do
    local_deleted=()
    for target in "${PRUNE_TARGETS[@]}"; do
      case "$target" in
        *"/$category/"*)
          local_deleted+=("$(basename "$target")") ;;
      esac
    done
    if [ "${#local_deleted[@]}" -gt 0 ]; then
      echo -e "  ${RED}$category/${NC} (${#local_deleted[@]}):"
      printf '    - %s\n' "${local_deleted[@]}" | sort
    fi
  done
fi

echo ""
echo -e "${BOLD}========== KEPT ($KEEP_COUNT) ==========${NC}"
for category in skills agents commands; do
  dir="$DEST/$category"
  [ ! -d "$dir" ] && continue
  kept_items=()
  for item in "$dir"/*; do
    [ -e "$item" ] || continue
    kept_items+=("$(basename "$item" | sed 's/\.md$//')")
  done
  if [ "${#kept_items[@]}" -gt 0 ]; then
    echo -e "  ${GREEN}$category/${NC} (${#kept_items[@]}):"
    printf '    - %s\n' "${kept_items[@]}" | sort
  fi
done

echo ""
echo -e "${BOLD}========== Summary ==========${NC}"
echo -e "  ${GREEN}Deleted: $DELETED${NC}"
[ "$FAILED" -gt 0 ] && echo -e "  ${RED}Failed: $FAILED${NC}"
echo -e "  ${BOLD}Remaining (KEEP): $KEEP_COUNT${NC}"
echo -e "  ${BOLD}Location: $DEST${NC}"
echo ""
echo -e "${BOLD}사용법:${NC}"
echo "  claude --plugin-dir $DEST"
echo ""
echo -e "${BOLD}재실행 필요 시점:${NC}"
echo "  - ECC plugin 업데이트 후 (claude plugin update)"
echo "  - 글로벌 cache 갱신 후"
