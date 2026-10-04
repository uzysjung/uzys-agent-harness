#!/usr/bin/env bash
# #595 (설계 no-record §6 E) — 기록이 생기기 전 판의 설치본(옛 트랙 룰 + 메타파일 + 옛 앵커, 기록 없음).
#
# 검증:
#   ① `list` · `update` · `uninstall --yes` 가 exit 1 · 트리 불변 · 안내에 `--track tooling`(메타파일 제안)
#   ② `install --track tooling --cli claude` exit 0 → 기록 생성 · 루트 CLAUDE.md import · 옛 앵커 안내 줄 ·
#      같은 내용이던 룰은 백업 없음
#   ③ 그 뒤 `update` 는 exit 0 (보통 설치본이 됐다)

set -euo pipefail

echo "▸ scenario-no-record-legacy: 기록 전 판 설치본 → 세 명령 거절 · install 한 번으로 보통 설치본"
echo ""

PKG="$(npm root -g)/@uzysjung/agent-harness"
PROJ=/tmp/proj-no-record-legacy
rm -rf "${PROJ}"
mkdir -p "${PROJ}/.claude/rules"
cd "${PROJ}"
cp "${PKG}/templates/rules/cli-development.md" .claude/rules/cli-development.md
printf 'tooling\n' > .claude/.installed-tracks
printf '# old harness anchor\n' > .claude/CLAUDE.md

snap() { (cd "${PROJ}" && find . -type d | sort && find . -type f -exec sha256sum {} + | sort); }
strip() { sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'; }
BEFORE=$(snap)

for cmd in list update "uninstall --yes"; do
  set +e
  # shellcheck disable=SC2086
  agent-harness ${cmd} >/tmp/nl-out.txt 2>/tmp/nl-err.txt
  RC=$?
  set -e
  echo "  \$ agent-harness ${cmd} → exit ${RC}"
  strip </tmp/nl-err.txt | sed 's/^/    /'
  [[ "${RC}" -eq 1 ]] || { echo "FAIL: ${cmd} exit ${RC} (기대 1)"; exit 1; }
  strip </tmp/nl-err.txt | grep -q -- "agent-harness install --track tooling" || { echo "FAIL: ${cmd} 안내에 --track tooling 이 없다"; exit 1; }
  [[ "$(snap)" == "${BEFORE}" ]] || { echo "FAIL: ${cmd} 가 디스크를 바꿨다"; exit 1; }
done
echo "✓ 세 명령 exit 1 · 트리 불변 · --track tooling 제안"

set +e
agent-harness install --track tooling --cli claude >/tmp/nl-install.txt 2>&1
RC=$?
set -e
[[ "${RC}" -eq 0 ]] || { echo "FAIL: install exit ${RC}"; tail -30 /tmp/nl-install.txt; exit 1; }
[[ -f .uzys-agent-harness/.harness-install.json ]] || { echo "FAIL: 기록이 안 생겼다"; exit 1; }
grep -q "@CLAUDE-uzys-harness.md" CLAUDE.md || { echo "FAIL: 루트 CLAUDE.md 에 import 가 없다"; exit 1; }
LINE=$(strip </tmp/nl-install.txt | grep ".claude/CLAUDE.md" | grep "legacy anchor" || true)
[[ -n "${LINE}" ]] || { echo "FAIL: 옛 앵커 안내 줄이 없다"; strip </tmp/nl-install.txt | tail -40; exit 1; }
echo "  install 화면:${LINE}"
ls .claude/rules/cli-development.md.backup-* >/dev/null 2>&1 && { echo "FAIL: 같은 내용이던 룰이 백업됐다"; exit 1; }
[[ "$(cat .claude/CLAUDE.md)" == "# old harness anchor" ]] || { echo "FAIL: 옛 앵커가 바뀌었다"; exit 1; }
echo "✓ install exit 0 · 기록 생성 · import · 옛 앵커 안내 1줄 · 같은 룰 백업 없음 · 옛 앵커 그대로"

agent-harness update >/tmp/nl-update.txt 2>&1 || { echo "FAIL: install 뒤 update 실패"; tail -20 /tmp/nl-update.txt; exit 1; }
echo "✓ 그 뒤 update exit 0 — 보통 설치본"

echo ""
echo "PASS: scenario-no-record-legacy"
