#!/usr/bin/env bash
# #532 (Epic #527 L4) — antigravity 레인: install → update → 다른 CLI 추가 → uninstall --cli.
#
# 설치자가 실제로 치는 순서 그대로 친다 — antigravity 단독으로 깔고, 번들 스킬 한 종은
# **지우고**(설치자가 지웠거나 새 릴리즈가 더한 자리) 한 종은 **구버전 내용으로** 되돌린 뒤
# `update` 를 돌린다. 그다음 codex 를 추가하고, 마지막에 antigravity 만 뺀다.
#
# 검증:
#   ① update 가 없는 `.agents/skills/<id>` 를 만든다 (#532 의 결함 — refreshOnly 가 건너뛰었다)
#   ② update 가 구버전 스킬을 최신판으로 덮는다 · 백업 0 (사용자 편집이 아니므로)
#   ③ `.agents/rules/uzys-harness.md` 의 상시 스킬 안내가 그대로 나간다 (ADR-085)
#   ④ codex 추가 뒤 update 도 백업 0 — 두 transform 이 같은 `.agents/skills/` 를 쓴다
#   ⑤ `uninstall --cli antigravity` 는 전용 자리(`.agents/rules/uzys-harness.md`)만 회수하고
#      공유 자리(`.agents/skills/`)와 codex 자리(`.codex/` · `AGENTS.md`)는 남긴다

set -euo pipefail

echo "▸ scenario-antigravity-lane: antigravity install · update · uninstall --cli (#532)"
echo ""

PROJ=/tmp/proj-antigravity-lane
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

LOG_FILE="${PROJ}/.uzys-agent-harness/.harness-install.json"
# 지운 자리의 표본 · 구버전으로 되돌릴 표본. 상시 안내(ADR-085)에 드는 스킬을 앞에 둔다 —
# ③ 이 같은 표본으로 재진다.
GONE=user-centered-explanation
STALE=north-star

agent-harness install --track tooling --cli antigravity --scope project >/dev/null
echo "✓ install 완료 (cli=antigravity)"

for path in "${PROJ}/.agents/rules/uzys-harness.md" "${PROJ}/.agents/skills/${GONE}/SKILL.md" \
  "${PROJ}/.agents/skills/${STALE}/SKILL.md"; do
  if [[ ! -e "${path}" ]]; then
    echo "FAIL: ${path} 가 설치되지 않았다 — 검증 대상이 없다"
    exit 1
  fi
done
# antigravity 단독이면 claude 자리는 안 생긴다 — 아래 ① 이 "다른 자리에서 복사됐다"가 아님을 굳힌다.
if [[ -e "${PROJ}/.claude" ]]; then
  echo "FAIL: antigravity 단독인데 .claude/ 가 생겼다"
  exit 1
fi
echo "✓ 전제 확인 — .agents/rules · 스킬 2종 · .claude/ 없음"

# 최신판 원본을 따로 잡아 둔다 — update 뒤 비교 기준.
cp "${PROJ}/.agents/skills/${GONE}/SKILL.md" /tmp/fresh-gone.md
cp "${PROJ}/.agents/skills/${STALE}/SKILL.md" /tmp/fresh-stale.md

# --- 하나는 지우고, 하나는 "하네스 구버전이 깔아 둔 내용"으로 되돌린다 ---
rm -rf "${PROJ}/.agents/skills/${GONE}"
printf '# v26.1.0 시절 스킬\n' > "${PROJ}/.agents/skills/${STALE}/SKILL.md"
# 기준선도 그 내용의 해시로 맞춰야 "사용자가 안 고쳤다"가 되어 백업 없이 덮이는 경로가 재현된다.
STALE_SHA=$(printf '# v26.1.0 시절 스킬\n' | sha256sum | cut -d' ' -f1)
jq --arg p ".agents/skills/${STALE}/SKILL.md" --arg s "${STALE_SHA}" \
  '.externalFiles |= map(if .path == $p then .sha256 = $s else . end)' \
  "${LOG_FILE}" > "${LOG_FILE}.tmp"
mv "${LOG_FILE}.tmp" "${LOG_FILE}"
if ! grep -qF "${STALE_SHA}" "${LOG_FILE}"; then
  echo "FAIL: 기준선을 구버전 해시로 못 바꿨다 — 백업 0 판정이 성립하지 않는다"
  exit 1
fi
echo "✓ 픽스처 — ${GONE} 삭제 · ${STALE} 구버전 + 기준선 동기화(대조군 확인)"

# --- update ---
agent-harness update >/tmp/agy-lane-upd1.txt 2>&1 || {
  echo "FAIL: update 가 실패했다"
  tail -30 /tmp/agy-lane-upd1.txt
  exit 1
}

# ① 지워진 자리가 되살아난다
if [[ ! -f "${PROJ}/.agents/skills/${GONE}/SKILL.md" ]]; then
  echo "FAIL: update 가 .agents/skills/${GONE} 을 만들지 않았다 (#532 결함)"
  tail -30 /tmp/agy-lane-upd1.txt
  exit 1
fi
if ! diff -q /tmp/fresh-gone.md "${PROJ}/.agents/skills/${GONE}/SKILL.md" >/dev/null; then
  echo "FAIL: 되살아난 ${GONE} 의 내용이 번들 최신판과 다르다"
  exit 1
fi
echo "✓ ① update 가 없는 .agents/skills/${GONE} 을 최신판으로 만든다"

# ② 구버전은 최신판으로 · 백업 0
if ! diff -q /tmp/fresh-stale.md "${PROJ}/.agents/skills/${STALE}/SKILL.md" >/dev/null; then
  echo "FAIL: 구버전 ${STALE} 이 최신판으로 갱신되지 않았다"
  exit 1
fi
assert_no_backup() {
  local when="$1" found
  found=$(find "${PROJ}/.agents" -name "*.backup-*" -print)
  if [[ -n "${found}" ]]; then
    echo "FAIL: ${when} — 사용자 편집이 아닌데 백업이 생겼다:"
    echo "${found}"
    exit 1
  fi
}
assert_no_backup "update 직후"
echo "✓ ② 구버전 ${STALE} → 최신판 · 백업 0"

# ③ 상시 스킬 안내 (ADR-085) — 새로 만든 스킬이 룰 파일에서도 이름을 갖는다
if ! grep -qF "${GONE}" "${PROJ}/.agents/rules/uzys-harness.md"; then
  echo "FAIL: 룰 파일의 상시 스킬 안내에 ${GONE} 이 없다"
  exit 1
fi
echo "✓ ③ .agents/rules/uzys-harness.md 의 상시 안내에 ${GONE} 포함"

# --- codex 추가 (CLI 집합은 더해지기만 한다 — Epic #527 정의 1) ---
agent-harness install --track tooling --cli codex --scope project >/dev/null
CLIS=$(tr -d ' \n' < "${LOG_FILE}" | sed -n 's/.*"clis":\[\([^]]*\)\].*/\1/p')
if [[ "${CLIS}" != '"codex","antigravity"' && "${CLIS}" != '"antigravity","codex"' ]]; then
  echo "FAIL: clis 가 codex + antigravity 가 아니다 — 실제: ${CLIS}"
  exit 1
fi
echo "✓ codex 추가 — clis = ${CLIS}"

agent-harness update >/tmp/agy-lane-upd2.txt 2>&1 || {
  echo "FAIL: codex 추가 뒤 update 가 실패했다"
  tail -30 /tmp/agy-lane-upd2.txt
  exit 1
}
# ④ 두 transform 이 같은 `.agents/skills/` 를 쓴다 — 기준선이 안 이어지면 실행마다 백업이 쌓인다.
assert_no_backup "codex 추가 뒤 update"
if [[ ! -f "${PROJ}/.agents/skills/${GONE}/SKILL.md" ]]; then
  echo "FAIL: codex 추가 뒤 update 가 ${GONE} 을 지웠다"
  exit 1
fi
echo "✓ ④ codex 추가 뒤 update — 백업 0 · 스킬 유지"

# --- uninstall --cli antigravity ---
agent-harness uninstall --cli antigravity >/tmp/agy-lane-uninst.txt 2>&1 || {
  echo "FAIL: uninstall --cli antigravity 가 실패했다"
  tail -30 /tmp/agy-lane-uninst.txt
  exit 1
}
# ⑤ 전용 자리만 회수
if [[ -e "${PROJ}/.agents/rules/uzys-harness.md" ]]; then
  echo "FAIL: antigravity 전용 자리(.agents/rules/uzys-harness.md)가 남았다"
  exit 1
fi
for kept in "${PROJ}/.agents/skills/${GONE}/SKILL.md" "${PROJ}/.agents/skills/${STALE}/SKILL.md" \
  "${PROJ}/.codex" "${PROJ}/AGENTS.md"; do
  if [[ ! -e "${kept}" ]]; then
    echo "FAIL: ${kept} 가 사라졌다 — codex 가 아직 쓰는 자리다"
    tail -30 /tmp/agy-lane-uninst.txt
    exit 1
  fi
done
CLIS_AFTER=$(tr -d ' \n' < "${LOG_FILE}" | sed -n 's/.*"clis":\[\([^]]*\)\].*/\1/p')
if [[ "${CLIS_AFTER}" != '"codex"' ]]; then
  echo "FAIL: 제거 뒤 clis 가 '\"codex\"' 가 아니다 — 실제: ${CLIS_AFTER}"
  exit 1
fi
echo "✓ ⑤ 전용 자리만 회수 · .agents/skills · .codex/ · AGENTS.md 유지 · clis = ${CLIS_AFTER}"

echo ""
echo "PASS: scenario-antigravity-lane"
