#!/usr/bin/env bash
# #528 — scenario-uninstall-cli: `uninstall --cli <name>` 이 그 CLI 것만 걷어내는가.
#
# 설치자가 실제로 치는 순서 그대로 친다 — claude+codex 로 install → AGENTS.md 의 Project Context
# 를 채움 → update → `uninstall --cli codex`. codex 는 `AGENTS.md` 의 **마지막 사용자**이므로
# 그 파일은 #516 규칙대로 하네스 절만 빠지고 설치자 문단은 남아야 한다.
#
# 검증:
#   ① codex 전용 자리(`.codex/`)가 사라진다
#   ② codex 가 마지막 사용자였던 공유 자리에서 **하네스가 쓴 스킬**이 사라진다. 같은 디렉터리에
#      심어 둔 남의 스킬(`npx skills` 가 깐 것을 흉내낸 `foreign-probe`)은 그대로다 — 그 자리는
#      공유이고 우리 것만(= 설치 로그에 있는 것만) 회수한다
#   ③ `AGENTS.md` 는 **남고** 설치자 문단이 그대로이며 `## Harness Rules` 는 없다 (#516 승계)
#   ④ claude 쪽(`.claude/` · 루트 `CLAUDE.md` 의 import)은 하나도 안 건드린다
#   ⑤ 설치 로그의 `clis` 에 claude 만 남는다
#   ⑥ 대조군 — 남은 claude 를 `--cli` 로 빼는 것은 거절된다(전량은 `uninstall`)

set -euo pipefail

echo "▸ scenario-uninstall-cli: uninstall --cli 가 그 CLI 것만 회수하는가 (#528)"
echo ""

PROJ=/tmp/proj-uninstall-cli
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

agent-harness install --track tooling --cli claude --cli codex --scope project >/dev/null
echo "✓ install 완료 (cli=claude,codex)"

AGENTS="${PROJ}/AGENTS.md"
# 하네스가 번들로 깐 스킬 하나 — `.agents/` 회수의 대상 표본. `.claude/` 쪽 사본과 짝이다.
HARNESS_SKILL=audit-harness-fit
for path in "${AGENTS}" "${PROJ}/.codex" "${PROJ}/.agents/skills/${HARNESS_SKILL}" \
  "${PROJ}/.claude/skills/${HARNESS_SKILL}"; do
  if [[ ! -e "${path}" ]]; then
    echo "FAIL: ${path} 가 설치되지 않았다 — 검증 대상이 없다"
    exit 1
  fi
done
echo "✓ 전제 확인 — AGENTS.md · .codex/ · .agents/skills/${HARNESS_SKILL} · .claude/ 사본 존재"

# --- 설치자가 Project Context 를 채운다 ---
MARK="우리 팀 결제 정산 배치. 빌드는 make build. $$"
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

# --- update — 설치자 문장이 기준선 sha 안으로 들어가는 조건 ---
agent-harness update >/tmp/uninstall-cli-upd.txt 2>&1 || {
  echo "FAIL: update 가 실패했다"
  tail -30 /tmp/uninstall-cli-upd.txt
  exit 1
}
if ! grep -qF "${MARK}" "${AGENTS}"; then
  echo "FAIL: update 가 문단을 지웠다 (#503 회귀) — 아래 판정 전에 전제가 깨졌다"
  exit 1
fi
echo "✓ update 뒤에도 문단 보존 (전제)"

# --- 남의 스킬을 같은 자리에 심는다 (`npx skills` 가 깐 것의 흉내) ---
# 회수 판정이 "기록에 있는 것만"인지 보려면 기록에 없는 파일이 같은 디렉터리에 있어야 한다.
FOREIGN="${PROJ}/.agents/skills/foreign-probe"
mkdir -p "${FOREIGN}"
printf '# foreign skill\n\nnpx skills 가 깐 것 — 하네스 기록에 없다.\n' > "${FOREIGN}/SKILL.md"
if grep -qF 'foreign-probe' "${PROJ}/.uzys-agent-harness/.harness-install.json"; then
  echo "FAIL: 남의 스킬이 설치 로그에 들어갔다 — 대조군이 성립하지 않는다"
  exit 1
fi
echo "✓ 남의 스킬 심음 (.agents/skills/foreign-probe — 로그에 없음 확인)"

# --- uninstall --cli codex ---
set +e
agent-harness uninstall --cli codex >/tmp/uninstall-cli-out.txt 2>&1
RC=$?
set -e
if [[ "${RC}" -ne 0 ]]; then
  echo "FAIL: uninstall --cli codex 가 exit ${RC}"
  tail -30 /tmp/uninstall-cli-out.txt
  exit 1
fi
echo "✓ uninstall --cli codex exit 0"

# --- ① · ② 전용 자리 + 마지막 사용자가 된 공유 자리 ---
for gone in "${PROJ}/.codex" "${PROJ}/.agents/skills/${HARNESS_SKILL}"; do
  if [[ -e "${gone}" ]]; then
    echo "FAIL: ${gone} 가 남았다 — codex 가 마지막 사용자인데 회수되지 않았다"
    exit 1
  fi
done
# 같은 자리의 claude 사본은 그대로다 — `.agents/` 와 `.claude/` 는 각자의 자리다.
if [[ ! -d "${PROJ}/.claude/skills/${HARNESS_SKILL}" ]]; then
  echo "FAIL: .claude/skills/${HARNESS_SKILL} 이 사라졌다 — claude 는 아직 설치돼 있다"
  exit 1
fi
# 기록에 없는 남의 스킬은 남는다 — `.agents/skills/` 는 `npx skills` 와 공유하는 자리다.
if [[ ! -f "${FOREIGN}/SKILL.md" ]]; then
  echo "FAIL: 남의 스킬(.agents/skills/foreign-probe)이 사라졌다 — 기록에 없는 것을 지웠다"
  exit 1
fi
echo "✓ .codex/ · .agents/skills/${HARNESS_SKILL} 회수 · .claude/ 사본 · 남의 스킬 보존"

# --- ③ AGENTS.md 는 남고 설치자 문단 보존, 하네스 절은 제거 ---
if [[ ! -f "${AGENTS}" ]]; then
  echo "FAIL: 설치자가 채운 AGENTS.md 를 통째로 지웠다 (#516 규칙 미승계)"
  tail -30 /tmp/uninstall-cli-out.txt
  exit 1
fi
if ! grep -qF "${MARK}" "${AGENTS}"; then
  echo "FAIL: AGENTS.md 는 남았는데 설치자 문단이 없다"
  cat "${AGENTS}"
  exit 1
fi
if grep -qF '## Harness Rules' "${AGENTS}"; then
  echo "FAIL: AGENTS.md 에 '## Harness Rules' 가 남아 있다 — 하네스 몫이 설치자 파일에 남는다"
  exit 1
fi
echo "✓ AGENTS.md 유지 + 문단 보존 + 하네스 절 제거"

# --- ④ claude 쪽은 그대로 ---
if [[ ! -d "${PROJ}/.claude" ]]; then
  echo "FAIL: .claude/ 가 사라졌다 — codex 를 뺐는데 claude 자산이 없어졌다"
  exit 1
fi
if ! grep -qF 'uzys-harness:import' "${PROJ}/CLAUDE.md"; then
  echo "FAIL: 루트 CLAUDE.md 의 하네스 import 블록이 사라졌다"
  exit 1
fi
if [[ ! -f "${PROJ}/CLAUDE-uzys-harness.md" ]]; then
  echo "FAIL: 하네스 앵커 파일이 사라졌다 — claude 는 아직 설치돼 있다"
  exit 1
fi
echo "✓ .claude/ · 루트 CLAUDE.md import · 앵커 파일 보존"

# --- ⑤ 로그의 clis ---
LOG="${PROJ}/.uzys-agent-harness/.harness-install.json"
if ! grep -q '"clis"' "${LOG}"; then
  echo "FAIL: 설치 로그에 clis 필드가 없다"
  cat "${LOG}"
  exit 1
fi
CLIS=$(tr -d ' \n' < "${LOG}" | sed -n 's/.*"clis":\[\([^]]*\)\].*/\1/p')
if [[ "${CLIS}" != '"claude"' ]]; then
  echo "FAIL: clis 가 '\"claude\"' 가 아니다 — 실제: ${CLIS}"
  exit 1
fi
echo "✓ install log clis = [\"claude\"]"

# --- ⑥ 대조군 — 마지막 CLI 는 거절 ---
set +e
agent-harness uninstall --cli claude >/tmp/uninstall-cli-last.txt 2>&1
RC2=$?
set -e
if [[ "${RC2}" -eq 0 ]]; then
  echo "FAIL: 마지막 CLI 제거가 성공했다 — 전량 삭제 경로가 둘이 된다"
  exit 1
fi
if [[ ! -d "${PROJ}/.claude" ]]; then
  echo "FAIL: 거절했는데 .claude/ 가 사라졌다 — 부분 작업이 일어났다"
  exit 1
fi
echo "✓ 대조군 — 마지막 CLI 제거는 거절 (exit ${RC2}), 파일 무변경"

echo ""
echo "PASS: scenario-uninstall-cli"
