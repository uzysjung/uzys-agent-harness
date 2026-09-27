#!/usr/bin/env bash
# #533 · #523 — scenario-wizard-add-cli: 위저드 Update 에서 CLI 를 **더하면** 깔린 CLI 는 그대로 남는가.
#
# 설치자가 치는 순서 그대로: claude 로 install → `agent-harness`(위저드) → Update → Step 2 에서
# OpenCode 만 체크 → 자산 페이지 전부 Enter → 확인 Enter.
#
# 왜 pty 인가: 위저드는 TTY 없이는 거부한다. `script` 로 pty 를 붙이고, **화면이 그 단계를 그린 것을
# 본 뒤에** 키를 보낸다(FIFO). 고정 지연으로 흘려 넣으면 느린 러너에서 키가 프롬프트보다 먼저 지나가
# 아무것도 안 돈 채 끝난다. 자산 페이지 수는 스크립트에 박지 않고 화면의 `Page n/N` 에서 읽는다.
#
# 검증:
#   ① 설치 기록 clis = ["claude","opencode"] · spec.tracks = ["tooling"] (깔린 CLI 가 빠지지 않았다)
#   ② OpenCode 산출물(opencode.json · AGENTS.md)이 생겼고 .claude/ 는 그대로다
#      (`.opencode/` 는 ADR-081 뒤로 만들지 않는다 — OpenCode 전용 자리는 opencode.json 이다)
#   ③ 화면에 Claude Code `● installed` 와 `RUNS AS agent-harness install --track tooling --cli claude --cli opencode`
#   ④ 새 릴리즈 자산 모사(.claude/rules/git-policy.md 삭제) → `agent-harness update` 가 되살린다
#      (Claude 자산이 여전히 갱신 대상이다)
#   ⑤ `uninstall --cli claude` 는 `.claude/` 를 지우지 않고 `.claude.backup-*` 로 옮긴다 — 설치자 파일 보존
#      (사용자 결정 2026-09-27)
#   ⑥ 대조군 — 남은 opencode 를 `--cli` 로 빼는 것은 거절된다(마지막 CLI)
#
# "Claude 를 화면에서 풀 수 없다"의 키 입력 재현은 pty 에서 취약하다 — 그 잠금은 유닛
# (`tests/wizard-update-flow.test.ts` CLI 잠금)이 맡고, 여기서는 ①·③ 으로 결과를 본다.

set -euo pipefail

echo "▸ scenario-wizard-add-cli: 위저드 Update 로 CLI 추가 — 깔린 CLI 는 남는다 (#533)"
echo ""

PROJ=/tmp/proj-wizard-add-cli
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

agent-harness install --track tooling --cli claude --scope project >/dev/null
echo "✓ install 완료 (cli=claude)"

LOG="${PROJ}/.uzys-agent-harness/.harness-install.json"
[[ -d "${PROJ}/.claude" ]] || { echo "FAIL: 전제 — .claude/ 가 없다"; exit 1; }
[[ ! -e "${PROJ}/opencode.json" ]] || { echo "FAIL: 전제 — opencode.json 이 이미 있다"; exit 1; }

# --- 위저드를 pty 로 구동한다 (화면을 보고 키를 보낸다) ---
WORK=$(mktemp -d)
OUT="${WORK}/wizard-out.txt"
FIFO="${WORK}/keys"
mkfifo "${FIFO}"
: > "${OUT}"

# 넓은 pty — 확인 화면의 RUNS AS 한 줄이 접히지 않게 한다.
script -qec "stty cols 220 rows 60; agent-harness" /dev/null <"${FIFO}" >"${OUT}" 2>&1 &
WIZARD_PID=$!
exec 3>"${FIFO}"

plain() { sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g' "${OUT}"; }

wait_for() {
  local pattern="$1" tries=0
  until plain | grep -qE -- "${pattern}"; do
    tries=$((tries + 1))
    if [[ "${tries}" -gt 300 ]]; then
      echo "FAIL: 위저드 화면에 '${pattern}' 이 30초 안에 안 나왔다"
      plain | tail -30
      exit 1
    fi
    sleep 0.1
  done
  sleep 0.3 # 프롬프트가 키를 받을 준비가 될 때까지
}

key() { printf '%b' "$1" >&3; sleep 0.3; }

wait_for "Installed here: tracks tooling"
key '\r' # 메뉴 — Update (첫 항목)

wait_for "Step 1/5"
key '\r' # 트랙 그대로

wait_for "Step 2/5"
key '\033[B'
key '\033[B'
key ' ' # OpenCode 체크
key '\r'

wait_for "Page 1/[0-9]+"
PAGES=$(plain | grep -oE "Page 1/[0-9]+" | head -1 | cut -d/ -f2)
echo "✓ 자산 페이지 ${PAGES}장 (화면에서 읽음)"
for n in $(seq 1 "${PAGES}"); do
  wait_for "Page ${n}/${PAGES}"
  key '\r'
done

wait_for "Step 4/5"
wait_for "Proceed\?"
key '\r' # 확인 (기본 Yes)

set +e
for _ in $(seq 1 600); do
  kill -0 "${WIZARD_PID}" 2>/dev/null || break
  sleep 0.2
done
exec 3>&-
wait "${WIZARD_PID}"
set -e

# --- ① 기록 ---
CLIS=$(jq -c '.spec.clis' "${LOG}")
TRACKS=$(jq -c '.spec.tracks' "${LOG}")
if [[ "${CLIS}" != '["claude","opencode"]' ]]; then
  echo "FAIL: clis 가 [\"claude\",\"opencode\"] 가 아니다 — 실제: ${CLIS} (깔린 CLI 가 빠졌거나 추가가 안 됐다)"
  plain | tail -40
  exit 1
fi
if [[ "${TRACKS}" != '["tooling"]' ]]; then
  echo "FAIL: spec.tracks 가 [\"tooling\"] 가 아니다 — 실제: ${TRACKS}"
  exit 1
fi
echo "✓ ① 기록 clis=${CLIS} · tracks=${TRACKS}"

# --- ② 디스크 ---
for path in "${PROJ}/opencode.json" "${PROJ}/AGENTS.md" "${PROJ}/.claude/rules/git-policy.md"; do
  if [[ ! -e "${path}" ]]; then
    echo "FAIL: ${path} 가 없다"
    exit 1
  fi
done
echo "✓ ② opencode.json · AGENTS.md 생성 · .claude/ 유지"
# 설계 §10 ② 전제 관측(B) — 같은 실행이 공유 스킬 자리를 만들고 기록하는가.
AGENTS_SKILLS=$(find "${PROJ}/.agents/skills" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
RECORDED=$(jq '[(.externalFiles // [])[] | select(.path | startswith(".agents/skills/"))] | length' "${LOG}")
echo "  · 관측: .agents/skills/ 디렉터리 ${AGENTS_SKILLS}개 · 기록 ${RECORDED}건"
LINKS=$(find "${PROJ}/.claude/skills" -mindepth 1 -maxdepth 1 -type l | wc -l)
echo "  · 관측: .claude/skills/ 링크 ${LINKS}개 (A 의 링크 자리)"

# --- ③ 화면 ---
if ! plain | grep -qF "Claude Code   ● installed"; then
  echo "FAIL: Step 2 화면에 'Claude Code   ● installed' 가 없다"
  plain | grep -n "Step 2" | head -5
  exit 1
fi
if ! plain | grep -qE "RUNS AS +agent-harness install --track tooling --cli claude --cli opencode"; then
  echo "FAIL: 확인 화면에 RUNS AS install 명령이 없다"
  plain | grep -n "RUNS AS" | head -5
  exit 1
fi
echo "✓ ③ 화면 — Claude Code ● installed · RUNS AS agent-harness install --track tooling --cli claude --cli opencode"

# --- ④ Claude 자산이 계속 갱신 대상인가 ---
rm "${PROJ}/.claude/rules/git-policy.md"
agent-harness update >"${WORK}/update-out.txt" 2>&1 || {
  echo "FAIL: update 가 실패했다"
  tail -30 "${WORK}/update-out.txt"
  exit 1
}
if [[ ! -f "${PROJ}/.claude/rules/git-policy.md" ]]; then
  echo "FAIL: update 가 .claude/rules/git-policy.md 를 되살리지 않았다 — Claude 가 갱신 대상에서 빠졌다"
  tail -30 "${WORK}/update-out.txt"
  exit 1
fi
echo "✓ ④ update 가 .claude/rules/git-policy.md 를 되살린다"

# --- ⑤ uninstall --cli claude — .claude/ 는 백업으로 옮긴다 ---
MINE='{ "permissions": { "allow": ["Bash(make build)"] } }'
printf '%s\n' "${MINE}" > "${PROJ}/.claude/settings.local.json"
set +e
agent-harness uninstall --cli claude >"${WORK}/uninstall-claude.txt" 2>&1
RC=$?
set -e
if [[ "${RC}" -ne 0 ]]; then
  echo "FAIL: uninstall --cli claude 가 exit ${RC}"
  tail -30 "${WORK}/uninstall-claude.txt"
  exit 1
fi
if [[ -e "${PROJ}/.claude" ]]; then
  echo "FAIL: uninstall --cli claude 뒤에도 .claude/ 가 남았다"
  exit 1
fi
# 백업 자리는 uninstall 이 화면에 말한 것을 읽는다 — 앞의 update 도 `.claude.backup-*` 사본을 남기므로
# 디렉터리 이름으로 고르면 엉뚱한 백업을 볼 수 있다.
BACKUP_NAME=$(sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g' "${WORK}/uninstall-claude.txt" | grep -oE 'moved aside → \.claude\.backup-[^ ]+' | head -1 | sed 's/^moved aside → //')
BACKUP="${PROJ}/${BACKUP_NAME}"
if [[ -z "${BACKUP_NAME}" ]]; then
  echo "FAIL: uninstall --cli claude 가 백업 자리를 말하지 않았다"
  tail -20 "${WORK}/uninstall-claude.txt"
  exit 1
fi
if ! grep -qF "${MINE}" "${BACKUP}/settings.local.json"; then
  echo "FAIL: .claude.backup-* 안에 설치자 파일(settings.local.json)이 없다 — 백업 없이 사라졌다"
  exit 1
fi
if [[ ! -e "${PROJ}/opencode.json" || ! -e "${PROJ}/AGENTS.md" ]]; then
  echo "FAIL: claude 를 뺐는데 OpenCode 산출물(opencode.json · AGENTS.md)이 사라졌다"
  exit 1
fi
echo "✓ ⑤ uninstall --cli claude — .claude/ → $(basename "${BACKUP}") (settings.local.json 보존) · opencode.json 유지"

# --- ⑥ 대조군 — 마지막 CLI 는 거절 ---
set +e
agent-harness uninstall --cli opencode >"${WORK}/uninstall-last.txt" 2>&1
RC2=$?
set -e
if [[ "${RC2}" -eq 0 ]]; then
  echo "FAIL: 마지막 CLI(opencode) 제거가 성공했다 — 전량 삭제 경로가 둘이 된다"
  exit 1
fi
if [[ ! -e "${PROJ}/opencode.json" ]]; then
  echo "FAIL: 거절했는데 opencode.json 이 사라졌다 — 부분 작업이 일어났다"
  exit 1
fi
echo "✓ ⑥ 대조군 — 마지막 CLI 제거는 거절 (exit ${RC2}), 파일 무변경"

if [[ -n "${WIZARD_DUMP:-}" ]]; then plain; fi
rm -rf "${WORK}"
echo ""
echo "PASS: scenario-wizard-add-cli"
