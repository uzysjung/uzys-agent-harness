#!/usr/bin/env bash
# #530 · #531 · #532 (Epic #527 S3 · S5) — 공유 스킬 자리 `.agents/skills/<id>` 의 install · update ·
# `uninstall --cli`. Codex · OpenCode · Antigravity 가 **한 자리**를 쓰므로 세 CLI 를 한 시나리오로 잰다.
#
# 설치자가 실제로 치는 순서 그대로 친다 — codex 로 깔고 → AGENTS.md 의 Project Context 를 채우고
# update → opencode 를 **추가** → 스킬 자리를 두 가지로 망가뜨린 뒤 update → antigravity 를 추가 →
# update → CLI 를 하나씩 뺀다.
#
# 검증:
#   ① **없는 스킬 자리**를 update 가 만든다(새 릴리즈가 더한 번들 스킬과 같은 상태) — 디렉터리
#      전체가 설치 직후 판과 같고, 기록(`externalFiles`)에 다시 실린다. claude 자리는 안 거친다
#   ② 하네스 구버전 내용이 남은 스킬은 최신판으로 덮이고 **백업 0** — 사용자가 고친 게 아니므로
#      (기준선 sha 를 같이 맞췄다) 백업이 생기면 릴리즈마다 쌓여 보호가 무력해진다
#   ③ antigravity 를 더해 세 CLI 가 같은 자리를 써도 update 백업 0
#   ③' 화면 — 기록 없는 스킬은 "added by this release", 설치자가 **손으로 지운** 스킬은 이름 +
#      "was missing" + 영구히 빼는 `--without <id>` 안내 (#550)
#   ④ `uninstall --cli codex` — `.codex/` 만 회수, `.agents/skills` · `AGENTS.md` 는 남는다
#   ⑤ `uninstall --cli opencode` — `opencode.json` 회수, `.agents/skills` 는 antigravity 가 쓰니 남고,
#      `AGENTS.md` 는 마지막 사용자가 나가므로 #516 규칙(하네스 절 제거 · 설치자 절 유지)
#   ⑥ `uninstall --cli antigravity` — 마지막 CLI 라 **거절**되고 파일은 그대로다(L0 규칙)
#
# **스킬 이름을 적지 않는다** — 설치 결과에서 고른다. 이름을 박으면 카탈로그가 바뀌는 순간
# 이 시나리오가 조용히 아무것도 검증하지 않는다(전례 = scenario-dev-method-skills 의 26일 red).

set -euo pipefail

echo "▸ scenario-agents-skills-slot: .agents/skills 공유 자리 — codex · opencode · antigravity (#530 #531 #532)"
echo ""

PROJ=/tmp/proj-agents-skills-slot
LOG="${PROJ}/.uzys-agent-harness/.harness-install.json"
SKILLS="${PROJ}/.agents/skills"
AGENTS="${PROJ}/AGENTS.md"
FRESH="$(mktemp -d)"
OUT="$(mktemp -d)"

rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

# 프로젝트 전체의 백업 파일 수 — 하나라도 늘면 "사용자 편집으로 오판했다"는 뜻이다.
backup_count() {
  find "${PROJ}" -name '*.backup-*' | wc -l | tr -d ' '
}

assert_no_new_backup() {
  local when="$1" before="$2" after
  after="$(backup_count)"
  if [[ "${after}" != "${before}" ]]; then
    echo "FAIL: ${when} — 백업이 ${before} → ${after} 로 늘었다 (하네스 산출물을 사용자 편집으로 오판)"
    find "${PROJ}" -name '*.backup-*'
    exit 1
  fi
}

run_update() {
  local tag="$1"
  agent-harness update >"${OUT}/${tag}.txt" 2>&1 || {
    echo "FAIL: update(${tag}) 가 실패했다"
    tail -30 "${OUT}/${tag}.txt"
    exit 1
  }
}

# ───────────────────────── install --cli codex ─────────────────────────
agent-harness install --track tooling --cli codex --scope project >/dev/null
for path in "${AGENTS}" "${PROJ}/.codex" "${SKILLS}"; do
  if [[ ! -e "${path}" ]]; then
    echo "FAIL: ${path} 가 설치되지 않았다 — 검증 대상이 없다"
    exit 1
  fi
done
if [[ -e "${PROJ}/.claude" ]]; then
  echo "FAIL: codex 단독인데 .claude/ 가 생겼다"
  exit 1
fi
echo "✓ install --cli codex — AGENTS.md · .codex/ · .agents/skills · .claude/ 없음"

# 설치자가 Project Context 를 채운다 — ⑤ 의 "설치자 절 유지" 를 재려면 그 절이 실재해야 하고,
# update 가 한 번 돌아 기준선에 들어가 있어야 한다(#516 이 다루는 상태).
MARK="우리 팀 정산 배치. 빌드는 make build. $$"
awk -v mark="${MARK}" '
  { print }
  $0 == "## Project Context" && !done { print ""; print mark; done = 1 }
' "${AGENTS}" > "${AGENTS}.tmp"
mv "${AGENTS}.tmp" "${AGENTS}"
if ! grep -qF "${MARK}" "${AGENTS}"; then
  echo "FAIL: 문단을 넣지 못했다 — 대조군 없이 아래 판정을 신뢰할 수 없다"
  exit 1
fi
BK="$(backup_count)"
run_update codex-only
assert_no_new_backup "codex 단독 update" "${BK}"
if ! grep -qF "${MARK}" "${AGENTS}"; then
  echo "FAIL: update 가 설치자 문단을 지웠다 (#503 회귀)"
  exit 1
fi
echo "✓ Project Context 문단 추가 → update 뒤 보존 · 백업 0"

# ───────────────────────── install --cli opencode (추가) ─────────────────────────
BK="$(backup_count)"
agent-harness install --track tooling --cli opencode --scope project >/dev/null
assert_no_new_backup "opencode 추가 설치" "${BK}"
if [[ ! -f "${PROJ}/opencode.json" || ! -d "${PROJ}/.codex" ]]; then
  echo "FAIL: opencode 추가 뒤 opencode.json 또는 .codex/ 가 없다 — CLI 집합은 더해지기만 한다"
  exit 1
fi
CLIS="$(jq -c '.spec.clis | sort' "${LOG}")"
if [[ "${CLIS}" != '["codex","opencode"]' ]]; then
  echo "FAIL: clis 가 codex+opencode 가 아니다 — 실제: ${CLIS}"
  exit 1
fi
echo "✓ install --cli opencode 추가 — clis=${CLIS} · 백업 0"

mapfile -t SKILL_IDS < <(find "${SKILLS}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)
if [[ "${#SKILL_IDS[@]}" -lt 2 ]]; then
  echo "FAIL: .agents/skills 의 번들 스킬이 ${#SKILL_IDS[@]}개 — 두 가지 변이를 걸 수 없다"
  exit 1
fi
GONE_ID="${SKILL_IDS[0]}"
STALE_ID="${SKILL_IDS[1]}"
echo "✓ 대상 스킬 — 삭제: ${GONE_ID} · 구버전화: ${STALE_ID}"

# ───────────────── 변이: 하나는 삭제 + 기록 제거, 하나는 구버전 내용 ─────────────────
cp -r "${SKILLS}/${GONE_ID}" "${FRESH}/gone"
cp "${SKILLS}/${STALE_ID}/SKILL.md" "${FRESH}/stale.md"

# "이 릴리즈가 더한 스킬" — 디렉터리와 **기록을 함께** 없앤다. 기록이 남으면 "있었는데 사용자가
# 지웠다" 가 되어 다른 상태를 재게 된다.
GONE_PREFIX=".agents/skills/${GONE_ID}/"
if ! grep -qF "${GONE_PREFIX}" "${LOG}"; then
  echo "FAIL: 설치 로그에 ${GONE_PREFIX} 기록이 원래 없다 — 기록 제거를 확인할 대조군이 없다"
  exit 1
fi
rm -rf "${SKILLS:?}/${GONE_ID}"
jq --arg p "${GONE_PREFIX}" '.externalFiles |= map(select(.path | startswith($p) | not))' \
  "${LOG}" > "${LOG}.tmp"
mv "${LOG}.tmp" "${LOG}"
if grep -qF "${GONE_PREFIX}" "${LOG}"; then
  echo "FAIL: ${GONE_PREFIX} 기록을 못 지웠다"
  exit 1
fi

# "하네스 구버전이 깔아 둔 상태" — 디스크와 **기준선 sha 를 함께** 옛 내용으로 맞춘다.
STALE_SKILL="${SKILLS}/${STALE_ID}/SKILL.md"
printf '# stale\n' > "${STALE_SKILL}"
STALE_SHA="$(sha256sum "${STALE_SKILL}" | cut -d' ' -f1)"
jq --arg p ".agents/skills/${STALE_ID}/SKILL.md" --arg s "${STALE_SHA}" \
  '.externalFiles |= map(if .path == $p then .sha256 = $s else . end)' \
  "${LOG}" > "${LOG}.tmp"
mv "${LOG}.tmp" "${LOG}"
if ! grep -qF "${STALE_SHA}" "${LOG}"; then
  echo "FAIL: 기준선 sha 를 못 바꿨다 — 아래 백업 0 판정의 전제가 깨진다"
  exit 1
fi
echo "✓ 변이 적용 — ${GONE_ID} 삭제·기록 제거 · ${STALE_ID} 구버전화(기준선 포함, 대조군 확인)"

# ───────────────────────── ①② update (codex + opencode) ─────────────────────────
BK="$(backup_count)"
run_update codex-opencode

if ! diff -r "${FRESH}/gone" "${SKILLS}/${GONE_ID}" >/dev/null; then
  echo "FAIL: update 가 ${GONE_ID} 를 설치 직후 판 그대로 되살리지 않았다 (#530 #531 S3)"
  diff -r "${FRESH}/gone" "${SKILLS}/${GONE_ID}" || true
  tail -30 "${OUT}/codex-opencode.txt"
  exit 1
fi
if ! jq -e --arg p "${GONE_PREFIX}SKILL.md" 'any(.externalFiles[]; .path == $p)' "${LOG}" >/dev/null; then
  echo "FAIL: 되살린 ${GONE_ID} 가 기준선에 기록되지 않았다 — 다음 update 가 판정 불가로 백업한다"
  exit 1
fi
if ! diff -q "${FRESH}/stale.md" "${STALE_SKILL}" >/dev/null; then
  echo "FAIL: 구버전 ${STALE_ID} 가 최신판으로 안 바뀌었다"
  exit 1
fi
if [[ -e "${PROJ}/.claude" ]]; then
  echo "FAIL: update 가 .claude/ 를 만들었다 — 고른 적 없는 CLI 의 자리다"
  exit 1
fi
assert_no_new_backup "codex+opencode update" "${BK}"
echo "✓ ①② update — ${GONE_ID} 생성(디렉터리 전체·기록) · ${STALE_ID} 최신화 · 백업 0"

# ───────────────────────── ③ install --cli antigravity (추가) → update ─────────────────────────
BK="$(backup_count)"
agent-harness install --track tooling --cli antigravity --scope project >/dev/null
CLIS="$(jq -c '.spec.clis | sort' "${LOG}")"
if [[ "${CLIS}" != '["antigravity","codex","opencode"]' ]]; then
  echo "FAIL: clis 가 세 CLI 가 아니다 — 실제: ${CLIS}"
  exit 1
fi
run_update all-three
assert_no_new_backup "antigravity 추가 + update" "${BK}"
if ! grep -qF "${MARK}" "${AGENTS}"; then
  echo "FAIL: 세 CLI update 뒤 설치자 문단이 사라졌다"
  exit 1
fi
echo "✓ ③ antigravity 추가 → update — clis=${CLIS} · 백업 0 · 설치자 문단 보존"

# ───────────────── ③' 화면이 스킬 이름을 댄다 (#550) ─────────────────
# 색 코드를 걷고 본다 — 문구 판정에 방해만 된다.
plain() { sed 's/\x1b\[[0-9;]*m//g' "$1"; }
# ①② 의 GONE_ID 는 기록까지 지운 "이 릴리즈의 추가"였다 — 되살림으로 말하면 거짓이다.
if ! plain "${OUT}/codex-opencode.txt" | grep -F ".agents/skills/${GONE_ID}" | grep -qF "added by this release"; then
  echo "FAIL: 기록 없던 ${GONE_ID} 가 화면에 'added by this release' 로 뜨지 않았다 (#550)"
  plain "${OUT}/codex-opencode.txt" | tail -30
  exit 1
fi
# 이제 기록이 있다 — 설치자가 손으로 지우면 update 가 되살리고, 그 사실과 빼는 법을 말해야 한다.
rm -rf "${SKILLS:?}/${GONE_ID}"
run_update hand-deleted
if [[ ! -f "${SKILLS}/${GONE_ID}/SKILL.md" ]]; then
  echo "FAIL: 손으로 지운 ${GONE_ID} 를 update 가 되살리지 않았다 — 아래 화면 판정의 전제가 깨졌다"
  exit 1
fi
if ! plain "${OUT}/hand-deleted.txt" | grep -F ".agents/skills/${GONE_ID}" | grep -qF "was missing"; then
  echo "FAIL: 되살린 ${GONE_ID} 의 이름이 화면에 없다 (#550)"
  plain "${OUT}/hand-deleted.txt" | tail -30
  exit 1
fi
if ! plain "${OUT}/hand-deleted.txt" | grep -qF -- "--without ${GONE_ID}"; then
  echo "FAIL: 영구히 빼는 방법(--without ${GONE_ID})이 화면에 없다 (#550)"
  plain "${OUT}/hand-deleted.txt" | tail -30
  exit 1
fi
if plain "${OUT}/hand-deleted.txt" | grep -qF -- "--without ${STALE_ID}"; then
  echo "FAIL: 지우지 않은 ${STALE_ID} 까지 되살림으로 말했다 — 판정이 전부를 낸다"
  exit 1
fi
echo "✓ ③' 화면 — ${GONE_ID}: 신규는 'added by this release', 손으로 지운 뒤엔 'was missing' + --without (#550)"

# ───────────────────────── ④ uninstall --cli codex ─────────────────────────
agent-harness uninstall --cli codex >"${OUT}/uninst-codex.txt" 2>&1 || {
  echo "FAIL: uninstall --cli codex 가 실패했다"
  tail -30 "${OUT}/uninst-codex.txt"
  exit 1
}
if [[ -e "${PROJ}/.codex" ]]; then
  echo "FAIL: .codex/ 가 남았다 — codex 전용 자리다"
  exit 1
fi
for kept in "${SKILLS}/${GONE_ID}/SKILL.md" "${AGENTS}" "${PROJ}/opencode.json"; do
  if [[ ! -e "${kept}" ]]; then
    echo "FAIL: ${kept} 가 사라졌다 — opencode · antigravity 가 아직 쓴다"
    exit 1
  fi
done
echo "✓ ④ uninstall --cli codex — .codex/ 회수 · .agents/skills · AGENTS.md · opencode.json 유지"

# ───────────────────────── ⑤ uninstall --cli opencode ─────────────────────────
agent-harness uninstall --cli opencode >"${OUT}/uninst-opencode.txt" 2>&1 || {
  echo "FAIL: uninstall --cli opencode 가 실패했다"
  tail -30 "${OUT}/uninst-opencode.txt"
  exit 1
}
if [[ -e "${PROJ}/opencode.json" ]]; then
  echo "FAIL: opencode.json 이 남았다 — opencode 전용 자리다"
  exit 1
fi
for kept in "${SKILLS}/${GONE_ID}/SKILL.md" "${SKILLS}/${STALE_ID}/SKILL.md" \
  "${PROJ}/.agents/rules/uzys-harness.md"; do
  if [[ ! -e "${kept}" ]]; then
    echo "FAIL: ${kept} 가 사라졌다 — antigravity 가 아직 쓴다 (S5)"
    exit 1
  fi
done
# AGENTS.md 의 마지막 사용자(opencode)가 나갔다 — 하네스 절만 걷어내고 설치자 절을 남긴다(#516).
if [[ ! -f "${AGENTS}" ]] || ! grep -qF "${MARK}" "${AGENTS}"; then
  echo "FAIL: AGENTS.md 의 설치자 문단이 사라졌다 (#516)"
  tail -30 "${OUT}/uninst-opencode.txt"
  exit 1
fi
for needle in '## Harness Rules' '<!-- uzys-harness:'; do
  if grep -qF "${needle}" "${AGENTS}"; then
    echo "FAIL: AGENTS.md 에 '${needle}' 가 남았다 — 마지막 사용자가 나갔는데 하네스 몫이 남는다"
    exit 1
  fi
done
echo "✓ ⑤ uninstall --cli opencode — opencode.json 회수 · .agents/skills 유지 · AGENTS.md 하네스 절만 제거"

# ───────────────────────── ⑥ uninstall --cli antigravity (마지막 CLI) ─────────────────────────
tree_digest() {
  find "${PROJ}" -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1
}
BEFORE="$(tree_digest)"
set +e
agent-harness uninstall --cli antigravity >"${OUT}/uninst-agy.txt" 2>&1
RC=$?
set -e
if [[ "${RC}" -eq 0 ]]; then
  echo "FAIL: 마지막 CLI 제거가 성공했다 — 전량 삭제 경로가 둘이 된다"
  exit 1
fi
if [[ "$(tree_digest)" != "${BEFORE}" ]]; then
  echo "FAIL: 거절했는데 파일이 바뀌었다 — 부분 작업이 일어났다"
  exit 1
fi
echo "✓ ⑥ uninstall --cli antigravity — 마지막 CLI 라 거절(exit ${RC}) · 파일 무변경"

rm -rf "${FRESH}" "${OUT}"
echo ""
echo "PASS: scenario-agents-skills-slot"
