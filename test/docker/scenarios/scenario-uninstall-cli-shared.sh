#!/usr/bin/env bash
# #642 C-3 — scenario-uninstall-cli-shared: `uninstall --cli <x>` 뒤 다른 CLI 가 아직 읽는 `AGENTS.md` 를
# 남는 집합으로 **그 자리에서** 다시 렌더하는가.
#
# 설치자가 실제로 치는 순서 그대로 친다 — codex+opencode 로 install → AGENTS.md 의 Project Context 를 채움 →
# update(설치자 문장이 기준선 안으로) → `uninstall --cli opencode` → update.
#
# 검증:
#   ① 빠진 CLI(OpenCode)의 몫이 사라진다 — 제목에 OpenCode 없음 · OpenCode 1차 방어 줄 없음
#   ② 남는 CLI(Codex)의 몫은 있다 — `## Session Start` · 32 KiB 안내
#   ③ 설치자 문단 그대로
#   ④ 화면이 재렌더를 말한다
#   ⑤ 이어서 update 해도 AGENTS.md 백업 0 · 파일 그대로 (uninstall 이 쓴 바이트 = update 가 낼 바이트)
#   대조군 — uninstall 전에는 제목에 OpenCode 가 있다(판정이 무엇을 재는지 성립)

set -euo pipefail

echo "▸ scenario-uninstall-cli-shared: uninstall --cli 가 공유 AGENTS.md 를 남는 집합으로 다시 쓰는가 (#642)"
echo ""

PROJ=/tmp/proj-uninstall-cli-shared
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

agent-harness install --track tooling --cli codex --cli opencode --scope project >/dev/null
AGENTS="${PROJ}/AGENTS.md"
[[ -f "${AGENTS}" ]] || { echo "FAIL: AGENTS.md 가 설치되지 않았다 — 검증 대상이 없다"; exit 1; }
if ! head -1 "${AGENTS}" | grep -qF "Agent Guide (Codex · OpenCode)"; then
  echo "FAIL: 대조군 — 두 CLI 를 깐 판의 제목이 아니다"
  head -1 "${AGENTS}"
  exit 1
fi
echo "✓ install 완료 (cli=codex,opencode) · 제목 대조군 확인"

MARK="우리 팀 결제 정산 배치. 빌드는 make build. $$"
awk -v mark="${MARK}" '
  { print }
  $0 == "## Project Context" && !done { print ""; print mark; done = 1 }
' "${AGENTS}" > "${AGENTS}.tmp"
mv "${AGENTS}.tmp" "${AGENTS}"
grep -qF "${MARK}" "${AGENTS}" || { echo "FAIL: 문단을 넣지 못했다 — 대조군 없이 판정 불가"; exit 1; }
agent-harness update >/tmp/uninstall-cli-shared-upd1.txt 2>&1 || {
  echo "FAIL: update 가 실패했다"
  tail -30 /tmp/uninstall-cli-shared-upd1.txt
  exit 1
}
echo "✓ Project Context 채움 + update"

agent-harness uninstall --cli opencode >/tmp/uninstall-cli-shared-out.txt 2>&1 || {
  echo "FAIL: uninstall --cli opencode 가 실패했다"
  tail -30 /tmp/uninstall-cli-shared-out.txt
  exit 1
}

# ① 빠진 CLI 의 몫
if head -1 "${AGENTS}" | grep -qF "OpenCode"; then
  echo "FAIL: 제목에 OpenCode 가 남았다 — 빠진 CLI 의 판이 다음 update 까지 남는다 (#642-2)"
  head -1 "${AGENTS}"
  exit 1
fi
if grep -qF 'OpenCode `permission`' "${AGENTS}"; then
  echo "FAIL: OpenCode 의 1차 방어 줄이 남았다 (#642-2)"
  exit 1
fi
# ② 남는 CLI 의 몫
for needle in '## Session Start' 'project_doc_max_bytes' 'Agent Guide (Codex)'; do
  grep -qF "${needle}" "${AGENTS}" || { echo "FAIL: AGENTS.md 에 '${needle}' 가 없다 — Codex 몫이 사라졌다"; exit 1; }
done
# ③ 설치자 문단
grep -qF "${MARK}" "${AGENTS}" || { echo "FAIL: 설치자 문단이 사라졌다"; exit 1; }
# ④ 화면
sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' /tmp/uninstall-cli-shared-out.txt | grep -qF "AGENTS.md — re-rendered for Codex (your sections kept)" || {
  echo "FAIL: 화면이 AGENTS.md 재렌더를 말하지 않았다"
  tail -30 /tmp/uninstall-cli-shared-out.txt
  exit 1
}
echo "✓ ①~④ uninstall --cli opencode — AGENTS.md 가 그 자리에서 Codex 판 · 설치자 문단 유지 · 화면이 말한다"

# ⑤ 이어서 update — 백업 0 · 파일 그대로
AFTER_SUM=$(sha256sum "${AGENTS}" | cut -d' ' -f1)
BEFORE_BK=$(find "${PROJ}" -maxdepth 1 -name 'AGENTS.md.backup-*' | wc -l | tr -d ' ')
agent-harness update >/tmp/uninstall-cli-shared-upd2.txt 2>&1 || {
  echo "FAIL: 두 번째 update 가 실패했다"
  tail -30 /tmp/uninstall-cli-shared-upd2.txt
  exit 1
}
AFTER_BK=$(find "${PROJ}" -maxdepth 1 -name 'AGENTS.md.backup-*' | wc -l | tr -d ' ')
if [[ "${BEFORE_BK}" != "0" || "${AFTER_BK}" != "0" ]]; then
  echo "FAIL: AGENTS.md 백업이 생겼다 (uninstall 뒤 ${BEFORE_BK}건 · update 뒤 ${AFTER_BK}건) — 기록 sha 가 재렌더를 따라가지 않았다"
  exit 1
fi
if [[ "$(sha256sum "${AGENTS}" | cut -d' ' -f1)" != "${AFTER_SUM}" ]]; then
  echo "FAIL: 이어진 update 가 AGENTS.md 를 바꿨다 — uninstall 과 update 의 렌더 입력이 갈렸다"
  exit 1
fi
echo "✓ ⑤ 이어서 update — AGENTS.md 백업 0 · 파일 그대로"
echo ""
echo "PASS: scenario-uninstall-cli-shared"
