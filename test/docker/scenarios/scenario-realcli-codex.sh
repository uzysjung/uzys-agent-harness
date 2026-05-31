#!/usr/bin/env bash
# B2 — 실 Codex CLI 가 harness project-scope 자산을 인식하는가 (Promise=Implementation).
#
# Tier A (hard assert): harness install --cli codex --with-uzys-harness 가
#   <proj>/.codex/prompts/uzys-*.md 6 file 을 정확히 write.
# Tier B (evidence): 실 codex 가 prompt 를 어디서 탐색하는지 경험적 수집.
#   - codex custom prompt = TUI slash command, source = $CODEX_HOME/prompts/ (공식 docs).
#   - 질문: project-local <cwd>/.codex/prompts/ 도 스캔하는가? → 증거 dump 후 해석.
# Tier C (실행): 슬래시 실제 실행은 auth(login) 필요 → 범위 외.

set -uo pipefail   # set -e 제외: Tier B probe 는 실패 허용(evidence 수집).

echo "▸ scenario-realcli-codex: 실 Codex 가 project-local .codex/prompts/ 인식?"
echo ""

PROJ=/tmp/proj-codex
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}" || { echo "FAIL: cd ${PROJ}"; exit 1; }

failed=0

# ── Tier A: harness 가 project .codex/prompts/ 에 write ──────────────────
echo "── Tier A: harness project-scope write ──"
claude-harness install --track tooling --cli codex --with-uzys-harness --scope project >/tmp/install-codex.log 2>&1 \
  || { echo "FAIL: install 실패"; cat /tmp/install-codex.log; exit 1; }

PROMPTS_DIR="${PROJ}/.codex/prompts"
expected=(uzys-spec uzys-plan uzys-build uzys-test uzys-review uzys-ship)
missing=0
for p in "${expected[@]}"; do
  if [[ ! -f "${PROMPTS_DIR}/${p}.md" ]]; then
    echo "FAIL: ${PROMPTS_DIR}/${p}.md 없음"
    missing=1
  fi
done
if [[ "${missing}" -eq 0 ]]; then
  echo "✓ Tier A: .codex/prompts/uzys-*.md 6 file 정상 write"
  echo "  $(ls "${PROMPTS_DIR}")"
else
  echo "FAIL: Tier A — 일부 prompt 파일 누락"
  failed=1
fi
echo ""

# ── Tier B: 실 codex prompt 탐색 경험적 수집 ─────────────────────────────
echo "── Tier B: 실 codex prompt discovery (evidence) ──"
codex --version 2>&1 | sed 's/^/  codex: /'

# 격리 CODEX_HOME — /home/uzys 하위 (codex 가 /tmp 하위 codex_home 거부함).
ISO_HOME=/home/uzys/.codex-iso
rm -rf "${ISO_HOME}"
mkdir -p "${ISO_HOME}/prompts"
# 두 위치에 sentinel 배치: global(CODEX_HOME) vs project(cwd/.codex)
printf -- '---\ndescription: "sentinel HOME"\n---\nSENTINEL_HOME_BODY\n' > "${ISO_HOME}/prompts/zz-sentinel-home.md"
printf -- '---\ndescription: "sentinel PROJ"\n---\nSENTINEL_PROJ_BODY\n' > "${PROMPTS_DIR}/zz-sentinel-proj.md"

export CODEX_HOME="${ISO_HOME}"

echo "  [probe 1] codex --help 전체 (prompt/skill 열거 서브커맨드 존재?)"
codex --help 2>&1 | sed 's/^/    /'

echo "  [probe 2] RUST_LOG=trace startup — codex 가 어느 prompt dir 를 스캔? (auth-free, discovery 는 model 호출 전)"
# pty 로 TUI 잠깐 기동 → discovery 로그 캡처. CODEX_HOME/log + 캡처 typescript 둘 다 grep.
CAP=/tmp/codex-cap.txt
rm -f "${CAP}"
( cd "${PROJ}" && timeout 8 script -qec "env RUST_LOG=trace codex" "${CAP}" </dev/null >/dev/null 2>&1 || true ) || true
# 로그 소스 통합 (typescript 캡처 + CODEX_HOME/log/*)
LOGS=$(cat "${CAP}" 2>/dev/null; cat "${ISO_HOME}"/log/*.log 2>/dev/null) || true
echo "${LOGS}" | tr -d '\000' | grep -iE "prompt" | grep -iE "dir|path|load|discover|scan|/" | head -15 | sed 's/^/    /' || echo "    (prompt 디렉토리 로그 미검출)"
echo "    --- sentinel/uzys 언급 (어느 위치가 로드됐나) ---"
if echo "${LOGS}" | grep -qi "zz-sentinel-proj\|${PROJ}/.codex"; then
  echo "    → project-local (.codex/prompts) 스캔 검출!"
fi
if echo "${LOGS}" | grep -qi "zz-sentinel-home\|${ISO_HOME}/prompts"; then
  echo "    → CODEX_HOME/prompts 스캔 검출"
fi
echo "${LOGS}" | tr -d '\000' | grep -oiE "(zz-sentinel-[a-z]+|uzys-[a-z]+|${PROJ}/\.codex[a-z/]*|${ISO_HOME}/prompts)" | sort -u | head -10 | sed 's/^/      /' || true

echo "  [probe 3] auth 상태 (TUI 가 login 벽인지)"
echo "${LOGS}" | tr -d '\000' | grep -iE "login|sign in|authenticate|api key|not logged|unauthorized|ChatGPT" | head -3 | sed 's/^/    /' || echo "    (auth 관련 로그 없음)"
echo ""

echo "── 요약 ──"
echo "  Tier A (구조): $([ "${failed}" -eq 0 ] && echo PASS || echo FAIL)"
echo "  Tier B (탐색): 위 probe 출력으로 판정 (project-local vs CODEX_HOME)"
echo "  Tier C (실행): auth-gated, 범위 외"
echo ""

if [[ "${failed}" -eq 0 ]]; then
  echo "━━━ Tier A PASS (Tier B 는 evidence — 상위에서 해석) ━━━"
  exit 0
else
  echo "━━━ FAIL: scenario-realcli-codex (Tier A) ━━━"
  exit 1
fi
