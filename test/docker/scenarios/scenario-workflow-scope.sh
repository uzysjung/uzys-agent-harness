#!/usr/bin/env bash
# 워크플로 project-scope 설치 실검증 (real claude, throwaway 컨테이너 전용).
#
# 질문: --scope project 로 워크플로(openspec/bmad/superpowers/wshobson) 를 설치하면
#       정말 프로젝트 디렉토리 기준으로 떨어지는가? 호스트 글로벌은 안 건드리는가?
#
# 컨테이너 안에서 실행 가정 (real claude + harness 전역 설치 + git HTTPS insteadOf 완료).
# 호스트에서 직접 실행 금지 — ~/.claude write 발생. run-workflow-scope.sh 가 컨테이너 격리 제공.
set -uo pipefail

# PROJ/NEUTRAL 은 /tmp 아래(package.json 조상 없음) — /work(harness 복사본)의
# package.json 으로 npm 이 walk-up 하는 artifact 방지. standalone 프로젝트 상황 재현.
PROJ=/tmp/wf-proj
NEUTRAL=/tmp/wf-neutral-cwd    # 일부러 PROJ 와 다른 cwd → Bug B(--project-dir 무시) 직접 검증
rm -rf "${PROJ}" "${NEUTRAL}"
mkdir -p "${PROJ}" "${NEUTRAL}"
cd "${NEUTRAL}" || exit 1

echo "▸ project dir: ${PROJ}, cwd: ${NEUTRAL} (의도적 분리 → --project-dir 가 착지 위치 결정해야 PASS)"
echo "▸ 글로벌 baseline 스냅샷"
ls -A "${HOME}/.codex" 2>/dev/null | sort > /tmp/codex-before.txt || true
ls -A "${HOME}/.opencode" 2>/dev/null | sort > /tmp/opencode-before.txt || true

echo ""
echo "▸ agent-harness install --project-dir ${PROJ} (cwd=${NEUTRAL}) + 4 workflow opt-in"
agent-harness install \
  --track tooling --project-dir "${PROJ}" \
  --with openspec --with bmad-method --with superpowers --with wshobson-agents \
  --cli claude --scope project 2>&1 | tail -25

echo ""
echo "━━━ cwid(neutral) 비오염 검증 (Bug B fix 핵심) ━━━"
neutral_leak=$(find "${NEUTRAL}" -mindepth 1 2>/dev/null)
if [ -z "${neutral_leak}" ]; then echo "✓ cwd(${NEUTRAL}) 무오염 — 자산이 cwd 로 새지 않음"; else echo "✗ cwd 오염 (Bug B 미수정): ${neutral_leak}"; fi

echo ""
echo "━━━ 착지 위치 검증 ━━━"
fail=0
check() { # desc, path
  if [ -e "$2" ]; then echo "✓ $1 → $2"; else echo "✗ $1 (없음: $2)"; fail=1; fi
}
check "openspec npm devDep (project node_modules)" "${PROJ}/node_modules/@fission-ai/openspec"
check "bmad (project _bmad)"                        "${PROJ}/_bmad"
check "core track (project .claude)"               "${PROJ}/.claude/.harness-install.json"
check "plugin scope 메타 (project .claude/settings.json)" "${PROJ}/.claude/settings.json"

echo ""
echo "━━━ project settings.json plugin 등록 확인 ━━━"
if [ -f "${PROJ}/.claude/settings.json" ]; then
  grep -oE 'superpowers|full-stack-orchestration' "${PROJ}/.claude/settings.json" | sort -u | sed 's/^/  enabled: /' || echo "  (plugin 등록 없음)"
fi

echo ""
echo "━━━ 호스트 글로벌 비오염 검증 (~/.codex, ~/.opencode) ━━━"
ls -A "${HOME}/.codex" 2>/dev/null | sort > /tmp/codex-after.txt || true
ls -A "${HOME}/.opencode" 2>/dev/null | sort > /tmp/opencode-after.txt || true
cdiff=$(diff /tmp/codex-before.txt /tmp/codex-after.txt 2>/dev/null || true)
odiff=$(diff /tmp/opencode-before.txt /tmp/opencode-after.txt 2>/dev/null || true)
[ -z "${cdiff}" ] && echo "✓ ~/.codex 무변화" || { echo "✗ ~/.codex 변화: ${cdiff}"; fail=1; }
[ -z "${odiff}" ] && echo "✓ ~/.opencode 무변화" || { echo "✗ ~/.opencode 변화: ${odiff}"; fail=1; }

echo ""
echo "━━━ plugin 파일 위치 (Claude 네이티브 — ~/.claude/plugins 는 D16 본질 예외) ━━━"
ls -A "${HOME}/.claude/plugins/cache" 2>/dev/null | sed 's/^/  cache: /' || echo "  (plugin cache 없음 — plugin 설치 실패)"

echo ""
if [ "${fail}" -eq 0 ]; then echo "=== PASS: 워크플로 project-scope 착지 검증 통과 ==="; else echo "=== FAIL: 위 ✗ 항목 확인 ==="; fi
exit "${fail}"
