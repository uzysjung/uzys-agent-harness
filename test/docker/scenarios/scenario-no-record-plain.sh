#!/usr/bin/env bash
# #595 (설계 no-record §6 D) — 설치 기록이 없는 프로젝트에서 `update` 가 아무것도 쓰지 않고 exit 1 인가.
#
# 재현 = 이슈 본문 그대로: 자기 `CLAUDE.md` + Claude Code 로컬 설정(`.claude/settings.local.json`)만 있는 폴더.
# 고치기 전에는 `update` 가 설치로 오판해 `.claude.backup-*` · 앵커 · import 를 만들고 exit 0 이었다.
#
# 검증:
#   ① `update` exit 1 · 실행 전후 트리(경로 · sha) 동일 · 백업 폴더 · 앵커 없음
#   ② `list` · `uninstall --yes` 도 exit 1 · 트리 불변 · stderr 첫 줄이 셋 다 같다

set -euo pipefail

echo "▸ scenario-no-record-plain: 기록 없는 프로젝트에서 update · list · uninstall 이 같은 답 · 쓰기 0"
echo ""

PROJ=/tmp/proj-no-record-plain
rm -rf "${PROJ}"
mkdir -p "${PROJ}/.claude"
cd "${PROJ}"
printf '# my project\n\nmy notes\n' > CLAUDE.md
printf '{ "permissions": {} }\n' > .claude/settings.local.json

snap() { (cd "${PROJ}" && find . -type d | sort && find . -type f -exec sha256sum {} + | sort); }
strip() { sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'; }
BEFORE=$(snap)

LINE=""
run_cmd() { # $@ = 명령 인자. exit code 는 RC, stderr 첫 줄(색 제거)은 LINE 에 남긴다
  set +e
  agent-harness "$@" >/tmp/nr-out.txt 2>/tmp/nr-err.txt
  RC=$?
  set -e
  echo "  \$ agent-harness $* → exit ${RC}"
  strip </tmp/nr-err.txt | sed 's/^/    /'
  LINE=$(strip </tmp/nr-err.txt | head -1)
}

run_cmd update
UPDATE_LINE="${LINE}"
[[ "${RC}" -eq 1 ]] || { echo "FAIL: update exit ${RC} (기대 1)"; exit 1; }
[[ "$(snap)" == "${BEFORE}" ]] || { echo "FAIL: update 가 디스크를 바꿨다"; diff <(echo "${BEFORE}") <(snap) || true; exit 1; }
ls -d "${PROJ}"/.claude.backup-* >/dev/null 2>&1 && { echo "FAIL: .claude.backup-* 가 생겼다"; exit 1; }
[[ -e "${PROJ}/CLAUDE-uzys-harness.md" ]] && { echo "FAIL: 앵커가 생겼다"; exit 1; }
echo "✓ update exit 1 · 트리 불변 · 백업 폴더 · 앵커 없음"

run_cmd list
LIST_LINE="${LINE}"
[[ "${RC}" -eq 1 ]] || { echo "FAIL: list exit ${RC}"; exit 1; }
run_cmd uninstall --yes
UNINSTALL_LINE="${LINE}"
[[ "${RC}" -eq 1 ]] || { echo "FAIL: uninstall exit ${RC}"; exit 1; }
[[ "$(snap)" == "${BEFORE}" ]] || { echo "FAIL: list/uninstall 이 디스크를 바꿨다"; exit 1; }
if [[ "${UPDATE_LINE}" != "${LIST_LINE}" || "${UPDATE_LINE}" != "${UNINSTALL_LINE}" ]]; then
  printf 'FAIL: 첫 줄이 다르다\n  update:    %s\n  list:      %s\n  uninstall: %s\n' "${UPDATE_LINE}" "${LIST_LINE}" "${UNINSTALL_LINE}"
  exit 1
fi
echo "✓ list · uninstall 도 exit 1 · 트리 불변 · 첫 줄 동일: ${UPDATE_LINE}"

echo ""
echo "PASS: scenario-no-record-plain"
