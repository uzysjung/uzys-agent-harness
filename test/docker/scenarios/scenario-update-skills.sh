#!/usr/bin/env bash
# v26.126.0 (R-3a · ADR-046) — scenario-update-skills: update 가 `.claude/skills` 를 갱신하는가.
#
# 왜 pty 를 쓰나: 이 시나리오가 검증하는 것은 **위저드 경로**의 update 다. 위저드는 TTY 없이는
# 거부하므로 `script` 로 pty 를 붙이고 키 입력 2개를 흘려 넣는다.
# (v26.131.0 부터 비대화형 `agent-harness update` 도 있다 — 그쪽은 scenario-update-noninteractive
#  가 non-TTY 조건에서 따로 검증한다. 두 경로는 서로의 증거가 되지 않는다.)
#   ① 라우터에서 "update" 선택 (2번째 항목 → ↓ + Enter)  ② "What to update" 체크박스(#480 ①, 전부
#   체크 → Enter 로 수락)  ③ 확인 프롬프트 Enter
#
# 검증:
#   - install 후 `.claude/skills/` 존재 + install log 에 skillFiles 기준선 기록
#   - 사용자가 스킬을 고친 뒤 update → `.backup-<stamp>` 생성 + **최신판이 자리를 차지**
#   - 편집 없이 update 재실행 → 백업본이 더 늘지 않는다 (노이즈 미축적)

set -euo pipefail

echo "▸ scenario-update-skills: update 가 skills 를 갱신하는가 (R-3a)"
echo ""

PROJ=/tmp/proj-upskill
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

agent-harness install --track tooling --scope project >/dev/null

SKILLS="${PROJ}/.claude/skills"
LOG="${PROJ}/.uzys-agent-harness/.harness-install.json"

if [[ ! -d "${SKILLS}" ]]; then
  echo "FAIL: install 이 .claude/skills/ 를 안 만들었다 — 이 시나리오가 검증할 대상이 없다"
  exit 1
fi
echo "✓ install 완료 — 스킬 $(find "${SKILLS}" -mindepth 1 -maxdepth 1 -type d | wc -l)개"

# 기준선이 실제로 기록됐는가 (없으면 update 가 전부 "사용자가 고쳤다"로 오판한다)
BASE_COUNT=$(jq '(.skillFiles // []) | length' "${LOG}")
if [[ "${BASE_COUNT}" -eq 0 ]]; then
  echo "FAIL: install log 에 skillFiles 기준선이 없다"
  exit 1
fi
echo "✓ 기준선 기록 ${BASE_COUNT}건"

# 갱신 대상 스킬 하나를 고른다 (SKILL.md 를 가진 첫 디렉터리).
TARGET=$(find "${SKILLS}" -mindepth 2 -maxdepth 2 -name SKILL.md | head -1)
if [[ -z "${TARGET}" ]]; then
  echo "FAIL: SKILL.md 를 가진 스킬이 없다"
  exit 1
fi
TARGET_DIR=$(dirname "${TARGET}")

# --- 위저드 update 를 pty 로 구동 ---
run_update() {
  # 키 사이에 **지연이 필요하다.** 한 번에 흘리면 clack 이 프롬프트를 그리기 전에 입력이
  # 지나가 라우터 선택 자체가 안 된다 (그 경우 update 가 아예 안 돌고도 조용히 끝난다).
  ( sleep 2; printf '\033[B'; sleep 0.5; printf '\r'; sleep 2; printf '\r'; sleep 1.5; printf '\r'; sleep 3 ) \
    | script -qec "agent-harness" /dev/null >/tmp/update-out.txt 2>&1 || true

  # update 가 실제로 돌았는지부터 확인한다 — 안 돌았는데 "백업 없음"을 통과로 읽으면
  # 이 시나리오는 아무것도 검증하지 않으면서 green 이 된다.
  if ! sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' /tmp/update-out.txt | grep -q "Update complete"; then
    echo "FAIL: update 가 실행되지 않았다 (위저드 구동 실패 — pty 입력 확인 필요)"
    sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' /tmp/update-out.txt | tail -20
    exit 1
  fi
}

# --- 케이스 1: 사용자가 고친 파일 ---
printf '\n<!-- MY LOCAL EDIT -->\n' >> "${TARGET}"
EDITED=$(cat "${TARGET}")

run_update

BACKUPS=$(find "${TARGET_DIR}" -name '*.backup-*' | wc -l)
if [[ "${BACKUPS}" -lt 1 ]]; then
  echo "FAIL: 편집분을 백업하지 않았다 (사용자 작업 소실)"
  sed -n '1,40p' /tmp/update-out.txt
  exit 1
fi
echo "✓ 편집분 백업 생성 (${BACKUPS}건)"

# 백업본에 내 편집이 살아 있어야 한다
BK=$(find "${TARGET_DIR}" -name '*.backup-*' | head -1)
if ! grep -q "MY LOCAL EDIT" "${BK}"; then
  echo "FAIL: 백업본에 편집 내용이 없다 — 백업이 무의미하다"
  exit 1
fi
echo "✓ 백업본에 편집 내용 보존"

# #480 ③ — 백업 목록 파일 + 화면의 다음 행동 안내 (audit-harness-fit 에 넘길 증거)
LIST="${PROJ}/.uzys-agent-harness/update-backups.json"
[[ -f "${LIST}" ]] || { echo "FAIL: update-backups.json 이 없다 — 백업이 있었는데 목록이 안 남았다"; exit 1; }
jq -e --arg p "${TARGET#${PROJ}/}" '.backups[] | select(.path == $p)' "${LIST}" >/dev/null \
  || { echo "FAIL: 목록에 백업된 파일(${TARGET#${PROJ}/})이 없다"; cat "${LIST}"; exit 1; }
sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' /tmp/update-out.txt | grep -q "BACKUPS" \
  || { echo "FAIL: Update 요약에 BACKUPS 행이 없다"; exit 1; }
sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' /tmp/update-out.txt | grep -q "audit-harness-fit" \
  || { echo "FAIL: Update 요약이 다음 행동(audit-harness-fit)을 지목하지 않는다"; exit 1; }
echo "✓ 백업 목록 파일 + 다음 행동 안내"

# 자리에는 최신판(= 편집 없는 templates 판)이 와야 한다 (ADR-046: 최신판이 활성)
if grep -q "MY LOCAL EDIT" "${TARGET}"; then
  echo "FAIL: 편집분이 그대로 남았다 — 갱신이 안 됐다 (= R-3a 재현)"
  exit 1
fi
echo "✓ 최신판이 자리를 차지 (편집분은 백업으로)"

# 화면에 skills 행이 떠야 한다 — 갱신하고도 안 알리는 침묵이 애초의 R-3a 였다.
if ! sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' /tmp/update-out.txt | grep -q '\.claude/skills'; then
  echo "FAIL: Update 요약에 .claude/skills 행이 없다 (사용자가 갱신 사실을 알 수 없다)"
  exit 1
fi
echo "✓ Update 요약에 .claude/skills 행 노출"

if [[ "${EDITED}" == "$(cat "${TARGET}")" ]]; then
  echo "FAIL: 파일 내용이 안 바뀌었다"
  exit 1
fi

# --- 케이스 2: 편집 없이 재실행 — 백업본이 더 늘면 안 된다 ---
run_update

AFTER=$(find "${TARGET_DIR}" -name '*.backup-*' | wc -l)
if [[ "${AFTER}" -ne "${BACKUPS}" ]]; then
  echo "FAIL: 편집이 없는데 백업이 늘었다 (${BACKUPS} → ${AFTER}) — 기준선 갱신이 안 된다"
  exit 1
fi
echo "✓ 재실행해도 백업 미증가 (${AFTER}건 유지) — 기준선이 갱신되고 있다"

# --- 케이스 3 (#477): 번들에서 사라진 파일은 지운다 — 결과는 "지우고 다시 깐 것" 과 같다 ---
# 옛 릴리즈가 깔았다가 이번 번들에서 빠진 파일을 흉내 낸다: 파일을 두고 그 sha 를 기준선에
# 등록한다(= 하네스가 놓아둔 그대로). 실측 전례 = 26.152→26.153 의 clear-korean-communication/references/.
SKILL_ID=$(basename "${TARGET_DIR}")
LEGACY="${TARGET_DIR}/references/legacy-from-old-bundle.md"
mkdir -p "$(dirname "${LEGACY}")"
printf 'old bundle file\n' > "${LEGACY}"
LEGACY_SHA=$(sha256sum "${LEGACY}" | cut -d' ' -f1)
jq --arg p "${SKILL_ID}/references/legacy-from-old-bundle.md" --arg h "${LEGACY_SHA}" \
  '.skillFiles += [{path: $p, sha256: $h}]' "${LOG}" > "${LOG}.tmp" && mv "${LOG}.tmp" "${LOG}"
# 사용자가 직접 둔 파일(기준선 없음) — 지우되 백업이 남아야 한다
printf 'my notes\n' > "${TARGET_DIR}/my-notes.md"

run_update

if [[ -e "${LEGACY}" ]]; then
  echo "FAIL: 번들에서 사라진 파일이 update 뒤에도 남았다 (#477 재현)"
  exit 1
fi
echo "✓ 번들에서 사라진 파일 삭제"
if [[ -e "${TARGET_DIR}/my-notes.md" ]]; then
  echo "FAIL: 번들에 없는 사용자 파일이 남았다 — 디렉터리 내용이 번들과 달라야 할 이유가 없다"
  exit 1
fi
if ! ls "${TARGET_DIR}"/my-notes.md.backup-* >/dev/null 2>&1; then
  echo "FAIL: 사용자 파일을 백업 없이 지웠다 (사용자 작업 소실)"
  exit 1
fi
echo "✓ 사용자 파일은 백업 뒤 삭제"
if ! sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' /tmp/update-out.txt | grep -q 'not in bundle'; then
  echo "FAIL: Update 요약에 삭제 행이 없다 (조용히 지우면 사용자는 파일이 왜 없어졌는지 모른다)"
  exit 1
fi
echo "✓ Update 요약에 삭제 행 노출"

echo ""
echo "PASS: scenario-update-skills"
