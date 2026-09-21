#!/usr/bin/env bash
# #516 — scenario-uninstall-preserves-agents-md: `uninstall` 이 설치자가 채운 AGENTS.md 를 남기는가.
#
# `update` 가 설치자 절을 이어받아 다시 쓰면서(#503) 그 문장이 기준선 안으로 들어갔고, uninstall 은
# "기준선과 같은 파일 = 우리 것"으로 보고 **살아 있는 파일을 통째로 지웠다**. 루트 `CLAUDE.md` 는
# import 블록만 걷어내고 본문을 남기는 것과 비대칭이었다. 여기서는 설치자가 실제로 치는 순서
# 그대로 친다 — install → 절을 채움 → update → uninstall.
#
# 검증:
#   ① uninstall 뒤 AGENTS.md 가 **남아 있고** `## Project Context` 에 적은 문단이 그대로다
#   ② 하네스 몫(`## Harness Rules` · `## Protected Files` · 마커)은 그 파일에서 사라졌다
#   ③ 대조군 — 아무것도 안 채운 설치본은 uninstall 이 AGENTS.md 를 지운다 (전과 같다)

set -euo pipefail

echo "▸ scenario-uninstall-preserves-agents-md: uninstall 이 채워 둔 AGENTS.md 절을 남기는가 (#516)"
echo ""

PROJ=/tmp/proj-agents-uninstall
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

agent-harness install --track tooling --cli codex --scope project >/dev/null
echo "✓ install 완료 (cli=codex)"

AGENTS="${PROJ}/AGENTS.md"
if [[ ! -f "${AGENTS}" ]]; then
  echo "FAIL: AGENTS.md 가 설치되지 않았다 — 검증 대상이 없다"
  exit 1
fi
if ! grep -qF '<!-- uzys-harness:anchor:start -->' "${AGENTS}"; then
  echo "FAIL: 하네스 조각 마커가 없다 — 이 시나리오의 전제(병합 모델)가 깨졌다"
  exit 1
fi
echo "✓ AGENTS.md + 마커 확인"

# --- 설치자가 절을 채운다 ---
MARK="우리 팀 결제 서비스. 빌드는 make build. $$"
awk -v mark="${MARK}" '
  { print }
  $0 == "## Project Context" && !done { print ""; print mark; done = 1 }
' "${AGENTS}" > "${AGENTS}.tmp"
mv "${AGENTS}.tmp" "${AGENTS}"
if ! grep -qF "${MARK}" "${AGENTS}"; then
  echo "FAIL: 문단을 넣지 못했다 — 대조군 없이 아래 판정을 신뢰할 수 없다"
  exit 1
fi
echo "✓ Project Context 에 문단 추가 (대조군 확인)"

# --- update — 설치자 문장이 기준선 안으로 들어가는 조건(= #516 이 생기던 상태) ---
agent-harness update >/tmp/agents-uninstall-upd.txt 2>&1 || {
  echo "FAIL: update 가 실패했다"
  tail -30 /tmp/agents-uninstall-upd.txt
  exit 1
}
if ! grep -qF "${MARK}" "${AGENTS}"; then
  echo "FAIL: update 가 문단을 지웠다 (#503 회귀) — uninstall 판정 전에 전제가 깨졌다"
  exit 1
fi
echo "✓ update 뒤에도 문단 보존 (전제)"

# --- uninstall ---
set +e
agent-harness uninstall --yes >/tmp/agents-uninstall-out.txt 2>&1
RC=$?
set -e
if [[ "${RC}" -ne 0 ]]; then
  echo "FAIL: uninstall 이 exit ${RC}"
  tail -30 /tmp/agents-uninstall-out.txt
  exit 1
fi
echo "✓ uninstall exit 0"

# --- ① 파일이 남고 문단이 그대로 ---
if [[ ! -f "${AGENTS}" ]]; then
  echo "FAIL: uninstall 이 설치자가 채운 AGENTS.md 를 통째로 지웠다 (#516)"
  tail -30 /tmp/agents-uninstall-out.txt
  exit 1
fi
if ! grep -qF "${MARK}" "${AGENTS}"; then
  echo "FAIL: AGENTS.md 는 남았는데 설치자 문단이 없다"
  cat "${AGENTS}"
  exit 1
fi
echo "✓ AGENTS.md 유지 + Project Context 문단 보존"

# --- ② 하네스 몫은 나갔다 ---
for needle in '## Harness Rules' '## Protected Files' '<!-- uzys-harness:'; do
  if grep -qF "${needle}" "${AGENTS}"; then
    echo "FAIL: uninstall 뒤에도 '${needle}' 가 남아 있다 — 하네스 몫이 설치자 파일에 남는다"
    exit 1
  fi
done
if ! grep -q "harness sections removed" /tmp/agents-uninstall-out.txt; then
  echo "FAIL: 화면이 '걷어냈다'고 말하지 않는다 — 디스크와 보고가 다르다"
  tail -30 /tmp/agents-uninstall-out.txt
  exit 1
fi
echo "✓ 하네스 절·마커 제거 + 화면 보고 일치"

# --- ③ 대조군 — 안 채운 설치본은 전과 같이 파일째 삭제 ---
PROJ2=/tmp/proj-agents-uninstall-empty
rm -rf "${PROJ2}"
mkdir -p "${PROJ2}"
cd "${PROJ2}"
agent-harness install --track tooling --cli codex --scope project >/dev/null
agent-harness update >/dev/null 2>&1
agent-harness uninstall --yes >/dev/null 2>&1
if [[ -f "${PROJ2}/AGENTS.md" ]]; then
  echo "FAIL: 아무것도 안 채운 AGENTS.md 가 uninstall 뒤에 남았다 — 빈 스캐폴드가 고아로 남는다"
  exit 1
fi
echo "✓ 대조군 — 안 채운 AGENTS.md 는 삭제"

echo ""
echo "PASS: scenario-uninstall-preserves-agents-md"
