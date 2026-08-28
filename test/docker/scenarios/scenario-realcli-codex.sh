#!/usr/bin/env bash
# B2 — 실 Codex CLI 가 harness project-scope 자산을 인식하는가 (Promise=Implementation).
#
# Tier A (hard assert): harness install --cli codex 가 **고른 항목을 codex 자리에** 놓는가.
#   묻는 것은 셋뿐이다(2026-08-28 사용자 확정): ① 항목이 복사됐나 ② 설치가 됐나 ③ 원하는 버전인가.
#   파일 내용이 원본과 같은지는 묻지 않는다 — 설치는 복사이고 복사본을 원본과 맞대는 것은
#   자기 대조다. 변환 로직은 tests/codex/*.test.ts 가 소유한다.
#
#   2026-08-28 (#369) — 옛 Tier A 는 `.codex/prompts/uzys-*.md` 6개를 요구했는데, 그 산출물은
#   ADR-023(2026-06-26)에서 제품이 통째로 없앤 것이다. 그 뒤 **63일간 red 인 채 아무도 안 봤다**.
#   같은 일이 반복되지 않게, 기대 목록을 이름으로 박지 않고 **설치 기록에서 유도**한다.
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
# `--with uzys-harness` 를 뺐다 — 그 자산은 ADR-023 에서 없어져 지금은 `[WARN] Unknown asset id`
# 만 찍히고 건너뛴다. 죽은 플래그를 남기면 다음 사람이 이 시나리오의 범위를 오해한다.
agent-harness install --track tooling --cli codex --scope project >/tmp/install-codex.log 2>&1 \
  || { echo "FAIL: install 실패"; cat /tmp/install-codex.log; exit 1; }

missing=0
check_file() { [[ -f "$1" ]] || { echo "FAIL: $1 없음"; missing=1; }; }

# ① codex 자리의 고정 산출물 — 실측 2026-08-28 (컨테이너 4-CLI 설치 관측).
check_file "${PROJ}/AGENTS.md"
check_file "${PROJ}/.codex/config.toml"
if ! ls "${PROJ}"/.codex/hooks/*.sh >/dev/null 2>&1; then
  echo "FAIL: ${PROJ}/.codex/hooks/ 에 훅이 하나도 없다"
  missing=1
fi

# ② 고른 외부 스킬이 codex 가 읽는 자리(.agents/skills/)에 실재하는가.
#    기대 목록은 **설치 기록**에서 유도한다 — 이름을 여기 적으면 카탈로그의 두 번째 사본이 되고,
#    그 사본이 썩는 것이 방금 이 파일에서 63일간 일어난 일이다.
LOGJSON="${PROJ}/.uzys-agent-harness/.harness-install.json"
if [[ ! -f "${LOGJSON}" ]]; then
  echo "FAIL: 설치 기록(${LOGJSON})이 없다 — 아래 판정은 무효다"
  missing=1
else
  SKILL_IDS=$(jq -r '.assets[] | select(.method == "skill") | .detail.skill // .id' "${LOGJSON}")
  COUNT=$(printf '%s\n' "${SKILL_IDS}" | grep -c . || true)
  if [[ "${COUNT}" -eq 0 ]]; then
    # 부재가 아니라 **모집단 0** 이다. 여기서 초록을 내면 "다 있다"로 읽힌다.
    echo "FAIL: 설치 기록에 skill 자산이 0건 — 외부 설치가 통째로 실패했거나 기록 형식이 바뀌었다"
    echo "      (network·git CA 문제일 수 있다. 아래 결과는 증거가 아니다)"
    missing=1
  else
    echo "  설치 기록에서 유도한 외부 스킬 ${COUNT}종: $(printf '%s ' ${SKILL_IDS})"
    for sid in ${SKILL_IDS}; do
      check_file "${PROJ}/.agents/skills/${sid}/SKILL.md"
    done
  fi
fi

if [[ "${missing}" -eq 0 ]]; then
  echo "✓ Tier A: codex 자리(AGENTS.md · .codex/config.toml · .codex/hooks · .agents/skills) 정상"
else
  echo "FAIL: Tier A — 일부 항목 누락"
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
# project-local prompts 디렉터리는 이제 하네스가 만들지 않는다(ADR-023). 이 probe 가 묻는 것은
# **codex 가 그 자리를 스캔하는가**이므로, 여기서 직접 만들어 sentinel 을 둔다.
PROMPTS_DIR="${PROJ}/.codex/prompts"
mkdir -p "${PROMPTS_DIR}"
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
