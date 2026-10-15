#!/usr/bin/env bash
# #543 가설 확인 실험 — "설치 기록에서 트랙 T 를 빼고 기존 update 를 돌리면 T 전용 자산이 치워지는가".
#
# 이 워크트리에서 빌드한 CLI(`dist/index.js`)를 mktemp 프로젝트에서 실행한다. 실 AI CLI 는 실행하지 않는다 —
# `mocks/`(npx skills add · claude plugin) 를 PATH 앞에 두고 HOME 도 임시 폴더로 바꿔 호스트 ~/ 에 아무것도 쓰지 않는다.
#
# 사용: bash docs/plans/543-design-evidence/run-experiment.sh            # 세 장면 전부
#       bash docs/plans/543-design-evidence/run-experiment.sh S1 S3      # 고른 장면만
# 출력: docs/plans/543-design-evidence/out/<장면>/ — 화면(screen-*.txt) · 스냅샷(snap-*.txt) · diff · 기록 사본
set -euo pipefail

EVID="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "${EVID}/../../.." && pwd)"
CLI=(node "${REPO}/dist/index.js")
OUT="${EVID}/out"
WORK="$(mktemp -d /tmp/ah-543-XXXXXX)"
export HOME="${WORK}/home"; mkdir -p "${HOME}"
ORIG_PATH="${PATH}"
export PATH="${EVID}/mocks:${PATH}"
export NO_COLOR=1 FORCE_COLOR=0
strip() { sed -E 's/\x1b\[[0-9;]*m//g'; }

snap() { # snap <projectDir> <outFile> — 파일 목록 + sha(링크는 대상)
  ( cd "$1" && find . \( -path ./node_modules -o -path ./.git \) -prune -o \( -type f -o -type l \) -print | sort | while read -r f; do
      if [ -L "$f" ]; then printf '%s -> %s\n' "$f" "$(readlink "$f")"; else printf '%s %s\n' "$f" "$(shasum -a 256 "$f" | cut -c1-12)"; fi
    done ) > "$2"
}
mcp_servers() { node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(Object.keys(j.mcpServers||{}).sort().join(","))' "$1" 2>/dev/null || echo "(none)"; }
log_tracks() { node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("tracks="+j.spec.tracks.join(",")+" assets="+j.assets.map(a=>a.id).join(",")+" policyFiles="+(j.policyFiles||[]).length+" skillFiles="+(j.skillFiles||[]).length+" externalFiles="+(j.externalFiles||[]).length+" portions="+(j.portions||[]).length)' "$1"; }

run_scene() { # run_scene <name> <removeTrack> <install args...>
  local name="$1" remove="$2"; shift 2
  local proj="${WORK}/${name}" o="${OUT}/${name}"
  rm -rf "${o}"; mkdir -p "${o}" "${proj}"
  echo "━━━ ${name}: install $* → remove ${remove} → update"
  ( cd "${proj}" && git init -q . && "${CLI[@]}" install "$@" --project-dir "${proj}" 2>&1 | strip ) > "${o}/screen-0-install.txt" || { echo "install failed"; tail -20 "${o}/screen-0-install.txt"; return 1; }
  # 설치자가 T 전용 파일 하나를 고친다(백업 규약 확인용) — 장면별 EDIT 변수
  if [ -n "${EDIT:-}" ] && [ -f "${proj}/${EDIT}" ]; then printf '\n<!-- installer edit for #543 experiment -->\n' >> "${proj}/${EDIT}"; echo "edited ${EDIT}" > "${o}/edited.txt"; fi
  snap "${proj}" "${o}/snap-A-after-install.txt"
  cp "${proj}/.uzys-agent-harness/.harness-install.json" "${o}/log-A.json"
  { echo "# A (after install)"; log_tracks "${o}/log-A.json"; echo "mcp.json: $(mcp_servers "${proj}/.mcp.json")"; echo "installed-tracks: $(tr '\n' ',' < "${proj}/.claude/.installed-tracks")"; } > "${o}/state-A.txt"

  # 1a — spec.tracks 만 뺀다 → 읽는 쪽(readInstallLog → healRecordedTracks)이 되살리는가
  node "${EVID}/edit-log.mjs" "${proj}" spec-only "${remove}" > "${o}/edit-1a.txt"
  ( cd "${proj}" && "${CLI[@]}" list --project-dir "${proj}" 2>&1 | strip ) > "${o}/screen-1a-list-after-spec-only.txt" || true
  grep -E "tracks:" "${o}/screen-1a-list-after-spec-only.txt" >> "${o}/edit-1a.txt" || true

  # 1b — spec.tracks + .installed-tracks(+sha) 를 함께 뺀다 → T 전용 집합(설계 술어) → update
  node "${EVID}/edit-log.mjs" "${proj}" spec+meta "${remove}" > "${o}/edit-1b.txt"
  ( cd "${proj}" && "${CLI[@]}" list --project-dir "${proj}" 2>&1 | strip ) > "${o}/screen-1b-list.txt" || true
  grep -E "tracks:" "${o}/screen-1b-list.txt" >> "${o}/edit-1b.txt" || true
  cp "${proj}/.uzys-agent-harness/.harness-install.json" "${o}/log-B-before-update.json"
  ( cd "${REPO}" && PATH="${ORIG_PATH}" npx tsx "${EVID}/track-diff.ts" "${o}/log-A.json" "${remove}" ) > "${o}/track-diff-predicate.txt" 2>/dev/null || true
  cp "${proj}/AGENTS.md" "${o}/AGENTS-B.md" 2>/dev/null || true
  cp "${proj}/.mcp.json" "${o}/mcp-B.json" 2>/dev/null || true
  ( cd "${proj}" && "${CLI[@]}" update --project-dir "${proj}" 2>&1 | strip ) > "${o}/screen-2-update.txt" || echo "(update exit != 0)" >> "${o}/screen-2-update.txt"
  snap "${proj}" "${o}/snap-C-after-update.txt"
  cp "${proj}/.uzys-agent-harness/.harness-install.json" "${o}/log-C-after-update.json"
  { echo "# C (after update)"; log_tracks "${o}/log-C-after-update.json"; echo "mcp.json: $(mcp_servers "${proj}/.mcp.json")"; echo "installed-tracks: $(tr '\n' ',' < "${proj}/.claude/.installed-tracks")"; } > "${o}/state-C.txt"
  diff "${o}/snap-A-after-install.txt" "${o}/snap-C-after-update.txt" > "${o}/diff-A-C.txt" || true
  cp "${proj}/AGENTS.md" "${o}/AGENTS-C.md" 2>/dev/null || true
  diff "${o}/AGENTS-B.md" "${o}/AGENTS-C.md" > "${o}/diff-AGENTS-B-C.txt" 2>/dev/null || true
  grep -n "Active track" "${proj}/CLAUDE.md" > "${o}/root-claude-md-track-line.txt" || true
  # T 전용 파일이 디스크에 남았는가 — 장면별 PROBE(공백 구분 경로)
  for p in ${PROBE:-}; do if [ -e "${proj}/${p}" ]; then echo "STILL THERE  ${p}"; else echo "GONE         ${p}"; fi; done > "${o}/probe-after-update.txt"
  # 두 번째 update — 조용한가(백업 노이즈 · 되살림)
  ( cd "${proj}" && "${CLI[@]}" update --project-dir "${proj}" 2>&1 | strip ) > "${o}/screen-3-update-again.txt" || true
  snap "${proj}" "${o}/snap-D-after-update2.txt"
  diff "${o}/snap-C-after-update.txt" "${o}/snap-D-after-update2.txt" > "${o}/diff-C-D.txt" || true
  # 증거 폴더 500KB 상한 — diff 가 남으니 사본은 지운다(기록은 A · C 두 벌만)
  rm -f "${o}/AGENTS-B.md" "${o}/AGENTS-C.md" "${o}/snap-D-after-update2.txt" "${o}/log-B-before-update.json" "${o}/mcp-B.json"
  echo "  → ${o}"
}

scenes=("$@"); [ ${#scenes[@]} -eq 0 ] && scenes=(S1 S2 S3)
for s in "${scenes[@]}"; do
  case "$s" in
    # S1 — tooling+csr-fastapi · claude+codex+antigravity · `--with vercel`(MCP 선택 행) · csr 전용 룰을 고침 → csr-fastapi 를 뺀다
    S1) EDIT=".claude/rules/ui-components.md" \
        PROBE=".claude/rules/ui-components.md .claude/skills/ui-visual-review .agents/rules/ui-components.md .agents/skills/ui-visual-review .claude/skills/frontend-design .agents/skills/frontend-design .claude/rules/git-policy.md .claude/skills/objective-brief .claude/rules/cli-development.md" \
        run_scene S1 csr-fastapi --track tooling --track csr-fastapi --cli claude --cli codex --cli antigravity --with vercel ;;
    # S2 — 같은 설치(claude+antigravity) → tooling 을 뺀다(cli-development 룰 · .agents/rules 사본)
    S2) EDIT=".claude/rules/cli-development.md" \
        PROBE=".claude/rules/cli-development.md .agents/rules/cli-development.md .claude/rules/ui-components.md .claude/skills/ui-visual-review .claude/hooks/session-start.sh" \
        run_scene S2 tooling --track tooling --track csr-fastapi --cli claude --cli antigravity ;;
    # S3 — tooling+data · claude 만 → data 를 뺀다(data-analyst 에이전트 · anthropic-data-plugin 자산)
    S3) EDIT=".claude/agents/data-analyst.md" \
        PROBE=".claude/agents/data-analyst.md .claude/agents/implementer.md .claude/rules/cli-development.md" \
        run_scene S3 data --track tooling --track data --cli claude ;;
    *) echo "unknown scene $s"; exit 3;;
  esac
done
echo "work dir: ${WORK} (삭제해도 된다)"
