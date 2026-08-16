#!/usr/bin/env bash
# 2026-08-16 (ADR-072) — scenario-update-mcp-retire: 은퇴한 자산이 실제로 회수되는가.
#
# 왜 별도 시나리오인가: 유닛 테스트는 `retireMcpAllowlist` 를 직접 부르고 `runUpdateMode` 배선을
# 확인한다. 그런데 사용자가 만나는 것은 함수가 아니라 **설치된 CLI 를 update 로 돌린 결과**다 —
# 실제 파이프라인에는 install 화면 · 훅 prune · settings 정리가 함께 얽혀 있고, 그중 하나만
# 어긋나도 "파일은 지웠는데 아무 말 안 함" 또는 "훅만 남고 데이터는 남음" 같은 반쪽 상태가 된다.
# 유닛이 초록인 채로 그 반쪽이 출하될 수 있어서 실환경에서 한 번 더 본다.
#
# 구버전 설치본 모사: install 은 이제 `.mcp-allowlist` 를 만들지 않으므로 **손으로 만든다** —
# "그 릴리즈에는 있었다"와 디스크 상태가 동일하다. 사용자가 서버 한 줄을 주석 처리한 상태로
# 만드는 이유는 그게 보존 대상이기 때문이다(자동 생성물이지만 편집분은 사용자 것이다).
#
# 검증:
#   ① install 이 더 이상 `.mcp-allowlist` 를 만들지 않는다
#   ② install 이 더 이상 mcp-pre-exec 훅을 깔지도 배선하지도 않는다 (탐지기 자기검증 포함)
#   ③ 구 설치본의 `.mcp-allowlist` 를 update 가 제거한다
#   ④ 제거 전 내용이 백업에 보존된다 (사용자 편집분 포함)
#   ⑤ 회수 사실이 화면에 뜬다 — 침묵은 파일이 사라진 이유를 지운다
#   ⑥ 구 설치본에 남아 있던 훅 스크립트도 update 가 물러낸다

set -euo pipefail

echo "▸ scenario-update-mcp-retire: 은퇴한 MCP allowlist 가 회수되는가 (ADR-072)"
echo ""

PROJ=/tmp/proj-mcp-retire
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

agent-harness install --track tooling --scope project >/tmp/mcp-install.txt 2>&1
echo "✓ install 완료 (track=tooling)"

ALLOWLIST="${PROJ}/.mcp-allowlist"
HOOK="${PROJ}/.claude/hooks/mcp-pre-exec.sh"
SETTINGS="${PROJ}/.claude/settings.json"

# --- ① install 이 allowlist 를 안 만든다 ---
if [[ -f "${ALLOWLIST}" ]]; then
  echo "FAIL: install 이 여전히 .mcp-allowlist 를 만든다 — 생성기가 안 빠졌다"
  exit 1
fi
# 전제 확인: `.mcp.json` 은 실제로 생겼는가. 이게 없으면 구 생성기도 skip 했을 것이라
# 위 단언이 "생성기가 빠져서"가 아니라 "입력이 없어서" 통과한 것이 된다.
if [[ ! -f "${PROJ}/.mcp.json" ]]; then
  echo "FAIL: 전제 실패 — .mcp.json 이 없다. 위 판정이 무의미하다"
  exit 1
fi
echo "✓ ① install 이 .mcp-allowlist 미생성 (.mcp.json 은 존재 — 입력이 있는데도 안 만든다)"

# --- ② 훅도 파일도 배선도 없다 ---
if [[ -f "${HOOK}" ]]; then
  echo "FAIL: install 이 mcp-pre-exec.sh 를 깔았다"
  exit 1
fi
if grep -q "mcp-pre-exec" "${SETTINGS}"; then
  echo "FAIL: settings.json 에 mcp-pre-exec 배선이 남았다"
  exit 1
fi
# 탐지기 자기검증 — 위 grep 이 "없음"을 낸 것이 파일을 잘못 읽어서가 아님을 보인다.
# 알려진 양성(protect-files)이 같은 명령에 잡혀야 빈 결과를 부재의 증거로 쓸 수 있다.
if ! grep -q "protect-files" "${SETTINGS}"; then
  echo "FAIL: 탐지기 자기검증 실패 — 실재하는 훅조차 못 찾는다. 위 '없음' 판정을 신뢰할 수 없다"
  exit 1
fi
echo "✓ ② 훅 파일·배선 모두 부재 (탐지기는 protect-files 를 정상 검출)"

# --- 구버전 설치본 모사 ---
# 사용자가 context7 을 주석 처리해 자기 정책을 적어 넣은 상태.
printf '# MCP Server Allowlist\n# context7\ngithub\n' > "${ALLOWLIST}"

# 훅은 파일만 놓으면 모사가 **부정확하다**. `pruneOrphans` 는 install log 기준선에 있는 것만
# 지우고(없으면 사용자가 만든 파일로 본다), 진짜 구 설치본은 하네스가 깔았으므로 기준선에
# 기록이 있다. 그 기록까지 만들어야 "그 릴리즈에는 있었다"와 디스크+로그 상태가 같아진다.
# 이 줄이 없으면 시나리오는 코드가 아니라 자기 모사의 결함을 잡는다(실제로 한 번 그랬다).
mkdir -p "$(dirname "${HOOK}")"
HOOK_BODY='#!/bin/bash
exit 0
'
printf '%s' "${HOOK_BODY}" > "${HOOK}"
LOG="${PROJ}/.uzys-agent-harness/.harness-install.json"
node -e '
const fs = require("fs"), crypto = require("crypto");
const [logPath, hookPath] = process.argv.slice(1);
const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
const sha = crypto.createHash("sha256").update(fs.readFileSync(hookPath, "utf8")).digest("hex");
log.policyFiles = [...(log.policyFiles ?? []), { path: "hooks/mcp-pre-exec.sh", sha256: sha }];
fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
' "${LOG}" "${HOOK}"
if ! grep -q "mcp-pre-exec" "${LOG}"; then
  echo "FAIL: 모사 실패 — install log 에 기준선 기록을 못 넣었다. 이후 ⑥ 판정이 무의미하다"
  exit 1
fi
echo "✓ 구 설치본 모사 (.mcp-allowlist + 훅 스크립트 + install log 기준선 기록)"

set +e
agent-harness update >/tmp/mcp-update.txt 2>&1
RC=$?
set -e
if [[ "${RC}" -ne 0 ]]; then
  echo "FAIL: update 가 exit ${RC}"
  tail -30 /tmp/mcp-update.txt
  exit 1
fi

# --- ③ allowlist 제거 ---
if [[ -f "${ALLOWLIST}" ]]; then
  echo "FAIL: update 후에도 .mcp-allowlist 가 남아 있다 — 아무도 안 읽는 파일이 영구 잔존한다"
  tail -30 /tmp/mcp-update.txt
  exit 1
fi
echo "✓ ③ update 가 .mcp-allowlist 제거"

# --- ④ 백업 보존 ---
BACKUP="$(ls "${PROJ}"/.mcp-allowlist.backup-* 2>/dev/null | head -1)"
if [[ -z "${BACKUP}" ]]; then
  echo "FAIL: 백업이 없다 — 사용자 편집분이 조용히 사라졌다"
  ls -a "${PROJ}" | head -20
  exit 1
fi
if ! grep -q "^# context7$" "${BACKUP}"; then
  echo "FAIL: 백업에 사용자 편집분(주석 처리한 줄)이 없다 — 백업이 원본이 아니다"
  cat "${BACKUP}"
  exit 1
fi
echo "✓ ④ 백업에 사용자 편집분 보존 ($(basename "${BACKUP}"))"

# --- ⑤ 화면 고지 ---
if ! grep -q "mcp-allowlist" /tmp/mcp-update.txt; then
  echo "FAIL: 회수 사실이 화면에 안 뜬다 — 사용자는 파일이 사라진 이유를 알 수 없다"
  tail -30 /tmp/mcp-update.txt
  exit 1
fi
if ! grep -qi "retired" /tmp/mcp-update.txt; then
  echo "FAIL: 파일 이름만 나오고 '회수됐다'는 사실이 없다 — 무슨 일이 일어났는지 안 보인다"
  grep -i "mcp" /tmp/mcp-update.txt
  exit 1
fi
echo "✓ ⑤ 회수 사실을 화면에 고지"

# --- ⑥ 훅 스크립트도 물러난다 ---
if [[ -f "${HOOK}" ]]; then
  echo "FAIL: 구 훅 스크립트가 남아 있다 — 배선 없는 파일이 계속 상주한다"
  exit 1
fi
echo "✓ ⑥ 구 훅 스크립트도 update 가 물러냄"

echo ""
echo "PASS: scenario-update-mcp-retire (전항 ①~⑥)"
