#!/usr/bin/env bash
# ADR-090 (#458) — scenario-update-demoted-agents: 트랙에서 강등된 에이전트가 update 화면에 보이는가.
#
# 왜 별도 시나리오인가: 유닛은 `demotedAgentFiles` 의 판정과 렌더 문구를 각각 본다. 그런데
# 사용자가 만나는 것은 **옛 릴리즈로 깐 프로젝트를 이 빌드로 update 한 결과**다 — 그 상태는
# 손으로 못 만든다(어떤 파일이 남는지가 그 릴리즈의 manifest 에 달려 있다). 그래서 모사하지 않고
# **registry 에서 실제 26.151.0 을 받아 깐다**. 모사하면 시나리오는 코드가 아니라 자기 모사의
# 결함을 잡는다(scenario-update-mcp-retire 에서 실제로 한 번 그랬다).
#
# 검증:
#   ① 전제 — 26.151.0 tooling 설치본에 `data-analyst.md`·`strategist.md` 가 실재한다
#      (없으면 이 실행은 무효다. "안내가 없다"가 코드 탓인지 전제 탓인지 갈리지 않는다)
#   ② 이 빌드로 update → 강등 안내 2행이 **각각 트랙명과 함께** 뜨고, 파일은 남고,
#      상주 계측의 `agents N` 이 디스크의 `.claude/agents/*.md` 수와 같다 (계측 줄은 정확히 1개)
#   ③ 이 빌드로 새로 깐 tooling 프로젝트에는 그 안내가 없다 — 같은 grep 이 ② 출력에서는
#      잡혀야 한다(탐지기 자기검증). 빈 결과는 그 자체로 부재의 증거가 아니다

set -uo pipefail

echo "▸ scenario-update-demoted-agents: 강등된 에이전트가 update 화면에 보이는가 (ADR-090 · #458)"
echo ""

OLD_VERSION=26.151.0
OLD_PREFIX=/tmp/old-harness
OLD_BIN="${OLD_PREFIX}/bin/agent-harness"
PROJ=/tmp/proj-demoted
FRESH=/tmp/proj-demoted-fresh
UPD_LOG=/tmp/demoted-update.txt
FRESH_LOG=/tmp/demoted-fresh.txt

# 강등 안내를 찾는 **단일 탐지기**. ②와 ③이 같은 명령을 쓴다 — 다른 패턴을 쓰면 ③의 "없음"이
# 코드가 아니라 패턴 차이에서 나올 수 있다.
demote_rows() {
  grep -E "이 트랙에서는 더 이상 설치하지 않는다" "$1" || true
}

# --- ① 옛 판본 설치 (registry) ---
rm -rf "${PROJ}" "${OLD_PREFIX}"
mkdir -p "${PROJ}"
if ! npm i -g "@uzysjung/agent-harness@${OLD_VERSION}" --prefix "${OLD_PREFIX}" \
  >/tmp/demoted-oldinstall.txt 2>&1; then
  echo "FAIL(무효): registry 에서 @uzysjung/agent-harness@${OLD_VERSION} 을 못 받았다."
  echo "      네트워크·레지스트리 문제면 이 실행은 코드에 대해 아무것도 말하지 않는다."
  tail -20 /tmp/demoted-oldinstall.txt
  exit 1
fi
if [[ ! -x "${OLD_BIN}" ]]; then
  echo "FAIL(무효): ${OLD_BIN} 이 없다 — 옛 판본 설치 형태가 바뀌었다."
  exit 1
fi

cd "${PROJ}" || { echo "FAIL: cd ${PROJ}"; exit 1; }
"${OLD_BIN}" install --track tooling --cli claude --scope project \
  >/tmp/demoted-oldsetup.txt 2>&1
OLD_RC=$?
echo "✓ v${OLD_VERSION} 로 tooling 설치 (exit ${OLD_RC})"

AGENTS="${PROJ}/.claude/agents"
for id in data-analyst strategist; do
  if [[ ! -f "${AGENTS}/${id}.md" ]]; then
    echo "FAIL(무효): 모사 전제 실패 — v${OLD_VERSION} 설치본에 ${id}.md 가 없다."
    echo "      이 시나리오가 검증하려는 상태 자체가 안 만들어졌다. 이후 판정은 무의미하다."
    ls -1 "${AGENTS}" 2>/dev/null || echo "      (.claude/agents 가 없다)"
    tail -20 /tmp/demoted-oldsetup.txt
    exit 1
  fi
done
# 트랙 판정의 근거는 설치 기록이다. 없으면 update 는 (설계대로) 아무 말도 안 하므로,
# 그 상태에서 ②를 돌리면 코드가 아니라 기록 부재를 보게 된다.
if ! grep -q '"tooling"' "${PROJ}/.uzys-agent-harness/.harness-install.json" 2>/dev/null; then
  echo "FAIL(무효): 설치 기록에 tooling 트랙이 없다 — 강등 판정의 입력이 없다."
  exit 1
fi
echo "✓ ① 전제 확인: data-analyst.md · strategist.md 실재 + 설치 기록 tracks=tooling"

# --- ② 이 빌드로 update ---
agent-harness update >"${UPD_LOG}" 2>&1
UPD_RC=$?
if [[ "${UPD_RC}" -ne 0 ]]; then
  echo "FAIL: update 가 exit ${UPD_RC}"
  tail -40 "${UPD_LOG}"
  exit 1
fi

failed=0

ROWS="$(demote_rows "${UPD_LOG}")"
for pair in "data-analyst:data · full" "strategist:executive · full"; do
  id="${pair%%:*}"; tracks="${pair#*:}"
  if ! printf '%s\n' "${ROWS}" | grep -q "${id}"; then
    echo "  ✗ FAIL: ${id} 의 강등 안내가 화면에 없다 — 설치자는 죽은 descriptor 를 계속 상주시킨다"
    failed=1
    continue
  fi
  if ! printf '%s\n' "${ROWS}" | grep -F "${id}" | grep -qF "${tracks} 트랙 전용"; then
    echo "  ✗ FAIL: ${id} 행에 트랙명(${tracks})이 없다 — '어느 트랙 것인가'가 이 안내의 핵심이다"
    printf '%s\n' "${ROWS}" | grep -F "${id}"
    failed=1
  fi
  if ! printf '%s\n' "${ROWS}" | grep -F "${id}" | grep -qF ".claude/agents/${id}.md 를 지워도 된다"; then
    echo "  ✗ FAIL: ${id} 행에 지울 경로가 없다 — 손은 사용자가 쓰는데 어디를 지울지 안 알려준다"
    failed=1
  fi
  if [[ ! -f "${AGENTS}/${id}.md" ]]; then
    echo "  ✗ FAIL: update 가 ${id}.md 를 지웠다 — 안내만 하기로 한 결정(ADR-046)을 어겼다"
    failed=1
  fi
done
[[ "${failed}" -eq 0 ]] && echo "✓ ② 강등 안내 2행(트랙명 포함) + 파일 잔존"

# --- ② 계측이 디스크와 맞는가 ---
COST_COUNT="$(grep -c "session-start context cost" "${UPD_LOG}")"
if [[ "${COST_COUNT}" -ne 1 ]]; then
  echo "  ✗ FAIL: 상주 계측 줄이 ${COST_COUNT}개다 (1개여야 한다 — 계획과 실측이 같이 뜨면"
  echo "          어느 쪽이 참인지 사용자가 알 수 없다)"
  grep "session-start context cost" "${UPD_LOG}"
  failed=1
else
  SHOWN="$(grep "session-start context cost" "${UPD_LOG}" | sed -n 's/.*agents \([0-9][0-9]*\) ~.*/\1/p')"
  DISK="$(find "${AGENTS}" -maxdepth 1 -name '*.md' -type f | wc -l | tr -d ' ')"
  if [[ -z "${SHOWN}" ]]; then
    echo "  ✗ FAIL: 계측 줄에서 agents 개수를 못 읽었다 — 탐지기가 고장났거나 문구가 바뀌었다"
    grep "session-start context cost" "${UPD_LOG}"
    failed=1
  elif [[ "${SHOWN}" != "${DISK}" ]]; then
    echo "  ✗ FAIL: 화면 agents ${SHOWN} ≠ 디스크 ${DISK}개 — 같은 화면이 '이 파일 지워도 된다'고"
    echo "          말하면서 그 파일을 안 세고 있다"
    ls -1 "${AGENTS}"
    failed=1
  else
    echo "✓ ② 상주 계측 agents ${SHOWN} = 디스크 ${DISK}개 (계측 줄 1개)"
  fi
fi

# --- ③ 새 설치에는 안내가 없다 ---
rm -rf "${FRESH}"
mkdir -p "${FRESH}"
cd "${FRESH}" || { echo "FAIL: cd ${FRESH}"; exit 1; }
agent-harness install --track tooling --cli claude --scope project >"${FRESH_LOG}" 2>&1
FRESH_RC=$?
if [[ "${FRESH_RC}" -ne 0 ]]; then
  echo "  ✗ FAIL: 새 설치가 exit ${FRESH_RC}"
  tail -40 "${FRESH_LOG}"
  failed=1
fi
# 탐지기 자기검증 — 같은 함수가 ② 출력에서는 잡아야 한다. 안 잡히면 아래 "없음"은
# 부재의 증거가 아니라 탐지기 고장의 증거다.
if [[ -z "$(demote_rows "${UPD_LOG}")" ]]; then
  echo "  ✗ FAIL(무효): 탐지기 자기검증 실패 — update 출력에서도 아무것도 못 찾는다"
  failed=1
elif [[ -n "$(demote_rows "${FRESH_LOG}")" ]]; then
  echo "  ✗ FAIL: 새 설치 화면에 강등 안내가 뜬다 — 깔지도 않은 파일을 지우라고 말한다"
  demote_rows "${FRESH_LOG}"
  failed=1
else
  echo "✓ ③ 새 tooling 설치에는 안내 없음 (같은 탐지기가 ② 출력에서는 검출)"
fi

echo ""
if [[ "${failed}" -eq 0 ]]; then
  echo "PASS: scenario-update-demoted-agents (①~③)"
  exit 0
fi
echo "FAIL: scenario-update-demoted-agents"
echo "── update 로그 tail ──"
tail -40 "${UPD_LOG}"
exit 1
