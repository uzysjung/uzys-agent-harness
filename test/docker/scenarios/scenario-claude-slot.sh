#!/usr/bin/env bash
# #529 · #524 · #536 — scenario-claude-slot: Claude 자리의 install · update · uninstall --cli claude 가
# 설치자 파일을 잃지 않고, `.claude/skills/<id>` → `.agents/skills/<id>` 링크 구성의 본문을 갱신하는가.
#
# #524 설치자 구성 그대로 친다 — claude+codex 로 깔고, 스킬 본문은 `.agents/skills/` 에 두고
# `.claude/skills/<id>` 에는 상대 링크만 둔다. 그 뒤 위저드 기본값(Claude 단독 Add)과 같은
# `install --cli claude` → `update` → `uninstall --cli claude`.
#
# 검증:
#   ① `install --cli claude`(add) 가 링크가 가리키는 공유 본문을 **포팅판** 최신으로 맞춘다 — 링크는
#      그대로, 백업 0, 화면에 'linked · updated via', 기록(externalFiles) sha 갱신
#   ② `update` 가 백업 파일을 만들지 않고, 화면이 그 자리를 'owned by another tool' 이 아니라
#      'linked · updated via' 로 말한다. `.claude.backup-*` 은 claude 가 깔렸으니 1(대조군 — 되돌림 지점)
#   ③ `uninstall --cli claude` 뒤 `.claude/` 없음 · 공유 본문 유지 · 루트 `CLAUDE.md` 설치자 본문 유지 ·
#      로그 clis = ["codex"]
#   ④ 그 뒤 설치자가 `.claude/` 를 다시 가져도(Claude Code 의 settings.local.json · 팀 훅이 든
#      settings.json) update 가 통째 사본(`.claude.backup-*`)을 더 쌓지 않고(#536-1) 그 파일들을
#      바이트 그대로 둔다(리뷰 BLOCKER-1 — 사본이 없는 실행이라 바뀌면 원본이 없다)

set -euo pipefail

echo "▸ scenario-claude-slot: 링크 스킬 본문 갱신 · Claude 자리 백업 규약 (#529 #524 #536)"
echo ""

PROJ=/tmp/proj-claude-slot
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"
LOG="${PROJ}/.uzys-agent-harness/.harness-install.json"
OUT=$(mktemp -d)

agent-harness install --track tooling --cli claude --cli codex --scope project >"${OUT}/install1.txt" 2>&1
echo "✓ install 완료 (cli=claude,codex)"

# --- #524 설치자 구성: 두 자리에 모두 있는 스킬은 `.claude/skills/<id>` 를 상대 링크로 ---
LINKED=()
for dir in "${PROJ}"/.claude/skills/*/; do
  id=$(basename "${dir}")
  if [[ -d "${PROJ}/.agents/skills/${id}" ]]; then
    rm -rf "${PROJ}/.claude/skills/${id}"
    ln -s "../../.agents/skills/${id}" "${PROJ}/.claude/skills/${id}"
    LINKED+=("${id}")
  fi
done
if [[ "${#LINKED[@]}" -eq 0 ]]; then
  echo "FAIL: 두 자리에 함께 깔린 스킬이 없다 — 시나리오가 무의미해진다"
  exit 1
fi
ID="${LINKED[0]}"
BODY="${PROJ}/.agents/skills/${ID}/SKILL.md"
if [[ ! -L "${PROJ}/.claude/skills/${ID}" || ! -f "${PROJ}/.claude/skills/${ID}/SKILL.md" ]]; then
  echo "FAIL: 링크를 만들지 못했다 — .claude/skills/${ID}"
  exit 1
fi
echo "✓ .claude/skills 링크 ${#LINKED[@]}개 (표본: ${ID})"

# 정본 = 첫 설치의 codex 변환이 쓴 포팅판. 이 바이트로 돌아와야 한다.
cp "${BODY}" "${OUT}/ported.md"

# --- 본문 하나를 지난 릴리즈 판으로 + 기록 sha 도 그 판으로 (하네스가 놓아둔 상태) ---
printf '# stale\n' >"${BODY}"
STALE_SHA=$(sha256sum "${BODY}" | cut -d' ' -f1)
KEY=".agents/skills/${ID}/SKILL.md"
jq --arg p "${KEY}" --arg s "${STALE_SHA}" \
  '.externalFiles |= map(if .path == $p then .sha256 = $s else . end)' "${LOG}" >"${LOG}.tmp"
mv "${LOG}.tmp" "${LOG}"
# 대조군 — 조작이 먹었는지부터. 안 먹으면 stale 이 "설치자 편집"으로 읽혀 백업 판정이 다른 이유로 난다.
if [[ "$(jq -r --arg p "${KEY}" '.externalFiles[] | select(.path == $p) | .sha256' "${LOG}")" != "${STALE_SHA}" ]]; then
  echo "FAIL: externalFiles 의 ${KEY} sha 를 stale 로 맞추지 못했다"
  exit 1
fi
echo "✓ ${KEY} = '# stale' · 기록 sha 동기화 (대조군 확인)"

# --- 루트 CLAUDE.md 에 설치자 본문 (import 블록 밖) ---
MARK="우리 팀 메모 — 배포는 금요일 금지 $$"
printf '\n%s\n' "${MARK}" >>"${PROJ}/CLAUDE.md"
grep -qF "${MARK}" "${PROJ}/CLAUDE.md" || { echo "FAIL: 설치자 본문을 넣지 못했다"; exit 1; }

no_backup_files() {
  local found
  found=$(find "${PROJ}/.claude" "${PROJ}/.agents" -name '*.backup-*' 2>&1)
  if [[ -n "${found}" ]]; then
    echo "FAIL: $1 뒤 백업 파일이 생겼다:"
    echo "${found}"
    exit 1
  fi
}
count_claude_copies() {
  find "${PROJ}" -maxdepth 1 -name '.claude.backup-*' | wc -l | tr -d ' '
}

# --- ① install --cli claude (add) ---
agent-harness install --track tooling --cli claude --scope project >"${OUT}/install2.txt" 2>&1 || {
  echo "FAIL: install --cli claude 가 실패했다"
  tail -30 "${OUT}/install2.txt"
  exit 1
}
if ! cmp -s "${BODY}" "${OUT}/ported.md"; then
  echo "FAIL: 공유 본문이 포팅판 최신이 아니다 (#524 — 링크 자리 본문이 갱신되지 않았다)"
  head -5 "${BODY}"
  exit 1
fi
if [[ ! -L "${PROJ}/.claude/skills/${ID}" ]]; then
  echo "FAIL: 링크가 실체 디렉터리로 바뀌었다 — 설치자 구성을 부쉈다"
  exit 1
fi
if ! grep -qF "linked · updated via .agents/skills/${ID}" "${OUT}/install2.txt"; then
  echo "FAIL: 설치 화면에 'linked · updated via .agents/skills/${ID}' 행이 없다"
  grep -n "skills" "${OUT}/install2.txt" | head -20
  exit 1
fi
PORTED_SHA=$(sha256sum "${OUT}/ported.md" | cut -d' ' -f1)
if [[ "$(jq -r --arg p "${KEY}" '.externalFiles[] | select(.path == $p) | .sha256' "${LOG}")" != "${PORTED_SHA}" ]]; then
  echo "FAIL: 기록(externalFiles)의 ${KEY} sha 가 갱신되지 않았다 — 다음 실행이 방금 쓴 판을 편집분으로 오판한다"
  exit 1
fi
no_backup_files "install --cli claude"
echo "✓ ① 본문 = 포팅판 최신 · 링크 유지 · 'linked · updated via' 행 · 기록 sha 갱신 · 백업 0"

# --- ② update ---
agent-harness update >"${OUT}/update1.txt" 2>&1 || {
  echo "FAIL: update 가 실패했다"
  tail -30 "${OUT}/update1.txt"
  exit 1
}
no_backup_files "update"
if ! grep -qF "linked · updated via .agents/skills/${ID}" "${OUT}/update1.txt"; then
  echo "FAIL: update 화면에 'linked · updated via .agents/skills/${ID}' 행이 없다"
  grep -n "skills\|owned" "${OUT}/update1.txt" | head -20
  exit 1
fi
if grep -F "owned by another tool" "${OUT}/update1.txt" | grep -qwF "${ID}"; then
  echo "FAIL: update 가 이 프로젝트의 링크 자리를 'owned by another tool' 로 말한다"
  grep -F "owned by another tool" "${OUT}/update1.txt"
  exit 1
fi
if ! cmp -s "${BODY}" "${OUT}/ported.md"; then
  echo "FAIL: update 뒤 공유 본문이 포팅판이 아니다"
  exit 1
fi
COPIES=$(count_claude_copies)
if [[ "${COPIES}" -ne 1 ]]; then
  echo "FAIL: claude 가 깔린 update 의 .claude.backup-* 이 ${COPIES}개다 — 대조군(되돌림 지점 1개)이 성립하지 않는다"
  exit 1
fi
echo "✓ ② update — 백업 파일 0 · 'linked · updated via' 행 · 'owned by another tool' 에 없음 · .claude 사본 1 (대조군)"

# --- ③ uninstall --cli claude ---
set +e
agent-harness uninstall --cli claude >"${OUT}/uninstall.txt" 2>&1
RC=$?
set -e
if [[ "${RC}" -ne 0 ]]; then
  echo "FAIL: uninstall --cli claude 가 exit ${RC}"
  tail -30 "${OUT}/uninstall.txt"
  exit 1
fi
if [[ -e "${PROJ}/.claude" ]]; then
  echo "FAIL: .claude/ 가 남았다 — claude 전용 자리가 회수되지 않았다"
  exit 1
fi
if [[ ! -f "${BODY}" ]] || ! cmp -s "${BODY}" "${OUT}/ported.md"; then
  echo "FAIL: 공유 본문(${KEY})이 사라지거나 바뀌었다 — codex 가 아직 쓰는 자리다"
  exit 1
fi
if [[ ! -f "${PROJ}/CLAUDE.md" ]] || ! grep -qF "${MARK}" "${PROJ}/CLAUDE.md"; then
  echo "FAIL: 루트 CLAUDE.md 의 설치자 본문이 사라졌다"
  exit 1
fi
CLIS=$(jq -c '.spec.clis' "${LOG}")
if [[ "${CLIS}" != '["codex"]' ]]; then
  echo "FAIL: 로그 clis 가 [\"codex\"] 가 아니다 — 실제: ${CLIS}"
  exit 1
fi
echo "✓ ③ uninstall --cli claude — .claude/ 없음 · 공유 본문 유지 · 루트 CLAUDE.md 설치자 본문 유지 · clis=[\"codex\"]"

# --- ④ #536-1 — claude 가 없는 설치본의 설치자 .claude/ 는 update 가 복사하지 않는다 ---
mkdir -p "${PROJ}/.claude"
printf '{}\n' >"${PROJ}/.claude/settings.local.json"
# 팀이 커밋한 Claude Code 훅 — 스크립트는 생성물이라 클론에 아직 없다. update 의 죽은 훅 정리
# 단계가 지우는 바로 그 모양이고, 이 실행엔 `.claude` 사본이 없으니 바뀌면 원본이 어디에도 없다
# (리뷰 BLOCKER-1). 4칸 들여쓰기 = 설치자 서식(재서식도 변경이다).
cat >"${PROJ}/.claude/settings.json" <<'JSON'
{
    "permissions": {
        "allow": ["Bash(make build)"]
    },
    "hooks": {
        "PreToolUse": [
            {
                "matcher": "Bash",
                "hooks": [
                    { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/team-guard.sh\"" }
                ]
            }
        ]
    }
}
JSON
cp "${PROJ}/.claude/settings.json" "${OUT}/team-settings.json"
BEFORE=$(count_claude_copies)
agent-harness update >"${OUT}/update2.txt" 2>&1 || {
  echo "FAIL: codex 단독 update 가 실패했다"
  tail -30 "${OUT}/update2.txt"
  exit 1
}
AFTER=$(count_claude_copies)
if [[ "${AFTER}" -ne "${BEFORE}" ]]; then
  echo "FAIL: claude 가 깔리지 않은 update 가 .claude.backup-* 을 또 만들었다 (${BEFORE} → ${AFTER}) — #536-1"
  exit 1
fi
if [[ "$(cat "${PROJ}/.claude/settings.local.json")" != "{}" ]]; then
  echo "FAIL: 설치자 .claude/settings.local.json 이 바뀌었다"
  exit 1
fi
if ! cmp -s "${PROJ}/.claude/settings.json" "${OUT}/team-settings.json"; then
  echo "FAIL: claude 가 깔리지 않은 update 가 설치자 .claude/settings.json 을 고쳤다 — 사본도 없다"
  diff "${OUT}/team-settings.json" "${PROJ}/.claude/settings.json" || true
  exit 1
fi
echo "✓ ④ claude 없는 update — .claude.backup-* ${BEFORE} → ${AFTER} (새 사본 0) · 설치자 settings.json·settings.local.json 바이트 무변경"

rm -rf "${OUT}"
echo ""
echo "PASS: scenario-claude-slot"
