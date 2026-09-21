#!/usr/bin/env bash
# #531 (Epic #527 L3) — OpenCode 레인: install · update · `uninstall --cli opencode`.
#
# 설치자가 실제로 치는 순서 그대로 친다 — opencode 단독으로 깔고 → 스킬 자리를 두 가지로
# 망가뜨린 뒤 update → codex 를 **추가** 설치 → update → `uninstall --cli opencode`.
#
# 검증:
#   ① install --cli opencode 가 opencode 전용(opencode.json · .opencode/) + 공유
#      (AGENTS.md · .agents/skills/) 를 깐다. claude 자산은 안 깐다
#   ② **없는 스킬 자리**를 update 가 만든다 (#531 S3 — 새 릴리즈가 더한 번들 스킬과 같은 상태).
#      claude 자리를 안 거치고 `.agents/` 에 직접 와야 한다 — 이 설치본에는 `.claude/` 가 없다
#   ③ 하네스 구버전 내용이 남은 스킬은 최신판으로 덮이고, **백업은 0** — 사용자가 고친 게
#      아니므로(기준선 sha 를 같이 맞췄다) 백업이 생기면 릴리즈마다 쌓여 보호가 무력해진다
#   ④ codex 를 추가해도 백업이 안 생기고, `AGENTS.md` 는 **OpenCode 판**으로 남는다 —
#      codex·opencode 가 같은 파일을 쓰고 transform 순서상 opencode 가 뒤라서다(문서화된 동작)
#   ⑤ `uninstall --cli opencode` 는 opencode **전용**만 회수한다. `AGENTS.md` 와
#      `.agents/skills/` 는 codex 가 아직 쓰므로 남는다
#
# **스킬 이름을 적지 않는다** — 설치 결과에서 고른다. 이름을 박으면 카탈로그가 바뀌는 순간
# 이 시나리오가 조용히 아무것도 검증하지 않는다(전례 = scenario-dev-method-skills 의 26일 red).

set -euo pipefail

echo "▸ scenario-opencode-lane: opencode 의 install · update · uninstall --cli (#531)"
echo ""

PROJ=/tmp/proj-opencode-lane
LOG="${PROJ}/.uzys-agent-harness/.harness-install.json"
SKILLS="${PROJ}/.agents/skills"

rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

# 프로젝트 전체의 백업 파일 수 — 하나라도 늘면 "사용자 편집으로 오판했다"는 뜻이다.
backup_count() {
  find "${PROJ}" -name '*.backup-*' | wc -l | tr -d ' '
}

# ───────────────────────── ① install --cli opencode ─────────────────────────
agent-harness install --track tooling --cli opencode --scope project >/dev/null
echo "✓ install --cli opencode 완료"

# `.opencode/` 는 여기 없다 — ADR-081 이 커맨드 사본을 은퇴시킨 뒤로 **install 이 만들지 않는다**
# (옛 설치본에만 남아 있다). 그래서 ⑤ 에서 그 자리를 직접 심어 회수를 잰다.
for path in "${PROJ}/AGENTS.md" "${PROJ}/opencode.json" "${SKILLS}"; do
  if [[ ! -e "${path}" ]]; then
    echo "FAIL: ${path} 가 설치되지 않았다 — 검증 대상이 없다"
    exit 1
  fi
done
# claude 를 고른 적이 없다 — 이 부재가 ② 의 "claude 자리를 안 거친다" 를 성립시킨다.
for path in "${PROJ}/.claude" "${PROJ}/CLAUDE-uzys-harness.md"; do
  if [[ -e "${path}" ]]; then
    echo "FAIL: ${path} 가 생겼다 — 고른 적 없는 CLI 의 자산이다"
    exit 1
  fi
done
echo "✓ 전제 — opencode 전용·공유 자리 존재 · claude 자산 없음"

mapfile -t SKILL_IDS < <(find "${SKILLS}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)
if [[ "${#SKILL_IDS[@]}" -lt 2 ]]; then
  echo "FAIL: .agents/skills 의 번들 스킬이 ${#SKILL_IDS[@]}개 — 두 가지 변이를 걸 수 없다"
  exit 1
fi
GONE_ID="${SKILL_IDS[0]}"
STALE_ID="${SKILL_IDS[1]}"
echo "✓ 대상 스킬 — 삭제: ${GONE_ID} · 구버전화: ${STALE_ID}"

# ───────────────── ②③ 변이: 하나는 삭제, 하나는 구버전 내용 ─────────────────
rm -rf "${SKILLS:?}/${GONE_ID}"

# "하네스 구버전이 깔아 둔 상태" — 디스크와 **기준선 sha 를 함께** 옛 내용으로 맞춘다.
# 기준선을 안 맞추면 사용자 편집으로 판정돼 백업이 생기고, 그건 이 축이 재려는 것과 다르다.
STALE_SKILL="${SKILLS}/${STALE_ID}/SKILL.md"
FRESH_STALE="$(cat "${STALE_SKILL}")"
printf '# v26.1.0 시절 스킬 본문\n' > "${STALE_SKILL}"
STALE_SHA="$(sha256sum "${STALE_SKILL}" | cut -d' ' -f1)"
jq --arg p ".agents/skills/${STALE_ID}/SKILL.md" --arg s "${STALE_SHA}" \
  '.externalFiles = [.externalFiles[] | if .path == $p then .sha256 = $s else . end]' \
  "${LOG}" > "${LOG}.tmp"
mv "${LOG}.tmp" "${LOG}"
if ! grep -qF "${STALE_SHA}" "${LOG}"; then
  echo "FAIL: 기준선 sha 를 못 바꿨다 — 아래 백업 0 판정의 전제가 깨진다"
  exit 1
fi
echo "✓ 변이 적용 — ${GONE_ID} 삭제 · ${STALE_ID} 구버전화(기준선 포함)"

BEFORE_BK="$(backup_count)"

agent-harness update >/tmp/opencode-lane-upd1.txt 2>&1 || {
  echo "FAIL: update 가 실패했다"
  tail -30 /tmp/opencode-lane-upd1.txt
  exit 1
}

if [[ ! -f "${SKILLS}/${GONE_ID}/SKILL.md" ]]; then
  echo "FAIL: update 가 ${GONE_ID} 를 되살리지 않았다 — 새 번들 스킬이 opencode 자리에 못 온다 (#531 S3)"
  tail -30 /tmp/opencode-lane-upd1.txt
  exit 1
fi
if [[ -e "${PROJ}/.claude" ]]; then
  echo "FAIL: update 가 .claude/ 를 만들었다 — 고른 적 없는 CLI 의 자리다"
  exit 1
fi
if grep -qF 'v26.1.0 시절 스킬 본문' "${STALE_SKILL}"; then
  echo "FAIL: 구버전 스킬이 최신판으로 안 바뀌었다"
  exit 1
fi
if [[ "$(cat "${STALE_SKILL}")" != "${FRESH_STALE}" ]]; then
  echo "FAIL: ${STALE_ID} 의 본문이 설치 직후 판과 다르다"
  exit 1
fi
AFTER_BK="$(backup_count)"
if [[ "${AFTER_BK}" != "${BEFORE_BK}" ]]; then
  echo "FAIL: 백업이 ${BEFORE_BK} → ${AFTER_BK} 로 늘었다 — 하네스 산출물을 사용자 편집으로 오판했다"
  find "${PROJ}" -name '*.backup-*'
  exit 1
fi
echo "✓ update — 없던 스킬 생성 · 구버전 스킬 최신화 · 백업 ${AFTER_BK}건(무변화)"

# ───────────────────────── ④ codex 를 추가 설치 ─────────────────────────
agent-harness install --track tooling --cli codex --scope project >/dev/null
if [[ ! -d "${PROJ}/.codex" ]]; then
  echo "FAIL: codex 추가 설치가 .codex/ 를 안 만들었다"
  exit 1
fi
if [[ ! -f "${PROJ}/opencode.json" ]]; then
  echo "FAIL: codex 를 더했더니 opencode 산출물이 사라졌다 — CLI 집합은 더해지기만 한다 (Epic #527 ①)"
  exit 1
fi
echo "✓ install --cli codex 추가 — .codex/ 생성 · opencode 산출물 보존"

BEFORE_BK="$(backup_count)"
agent-harness update >/tmp/opencode-lane-upd2.txt 2>&1 || {
  echo "FAIL: 두 CLI 설치본의 update 가 실패했다"
  tail -30 /tmp/opencode-lane-upd2.txt
  exit 1
}
AFTER_BK="$(backup_count)"
if [[ "${AFTER_BK}" != "${BEFORE_BK}" ]]; then
  echo "FAIL: 백업이 ${BEFORE_BK} → ${AFTER_BK} 로 늘었다 — codex·opencode 가 서로의 산출물을 오판한다"
  find "${PROJ}" -name '*.backup-*'
  exit 1
fi
# codex 와 opencode 는 같은 `AGENTS.md` 를 쓰고 transform 은 codex → opencode 순이라 마지막
# 판이 남는다. 이 줄은 **현재 문서화된 동작**을 못박는 것이지 선호를 적은 것이 아니다.
if ! head -1 "${PROJ}/AGENTS.md" | grep -qF 'OpenCode Agent Guide'; then
  echo "FAIL: AGENTS.md 가 OpenCode 판이 아니다 — 실제: $(head -1 "${PROJ}/AGENTS.md")"
  exit 1
fi
echo "✓ update(codex+opencode) — 백업 ${AFTER_BK}건(무변화) · AGENTS.md 는 OpenCode 판"

# ───────────────────── ⑤ uninstall --cli opencode ─────────────────────
# 옛 설치본이 남긴 `.opencode/` 를 심는다(ADR-081 이전 판의 커맨드 사본). 없는 자리의 부재를
# 확인하는 것은 아무것도 재지 못한다 — 회수 대상이 실재해야 판정이 성립한다.
mkdir -p "${PROJ}/.opencode/commands"
printf '# 옛 판이 남긴 커맨드 사본\n' > "${PROJ}/.opencode/commands/legacy-probe.md"

set +e
agent-harness uninstall --cli opencode >/tmp/opencode-lane-uninst.txt 2>&1
RC=$?
set -e
if [[ "${RC}" -ne 0 ]]; then
  echo "FAIL: uninstall --cli opencode 가 exit ${RC}"
  tail -30 /tmp/opencode-lane-uninst.txt
  exit 1
fi

for gone in "${PROJ}/opencode.json" "${PROJ}/.opencode"; do
  if [[ -e "${gone}" ]]; then
    echo "FAIL: ${gone} 가 남았다 — opencode 전용 자리인데 회수되지 않았다"
    exit 1
  fi
done
# 공유 자리는 codex 가 아직 쓴다 — 마지막 사용자가 나갈 때만 회수한다(Epic #527 ④ · S5).
if [[ ! -f "${PROJ}/AGENTS.md" ]]; then
  echo "FAIL: AGENTS.md 가 사라졌다 — codex 가 아직 이 파일을 쓴다"
  exit 1
fi
if [[ ! -f "${SKILLS}/${GONE_ID}/SKILL.md" ]]; then
  echo "FAIL: .agents/skills/${GONE_ID} 가 사라졌다 — codex 가 아직 이 자리를 쓴다"
  exit 1
fi
if [[ ! -d "${PROJ}/.codex" ]]; then
  echo "FAIL: .codex/ 가 사라졌다 — opencode 를 뺐는데 codex 자산이 없어졌다"
  exit 1
fi
CLIS="$(jq -c '.spec.clis' "${LOG}")"
if [[ "${CLIS}" != '["codex"]' ]]; then
  echo "FAIL: 설치 로그 clis 가 [\"codex\"] 가 아니다 — 실제: ${CLIS}"
  exit 1
fi
echo "✓ uninstall --cli opencode — 전용 자리만 회수 · 공유 자리·codex 보존 · clis=[\"codex\"]"

echo ""
echo "PASS: scenario-opencode-lane"
