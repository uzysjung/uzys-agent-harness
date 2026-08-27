#!/usr/bin/env bash
# #374 — `update` 가 **외부 스킬**(npx skills add 로 깐 것)을 상류 최신판으로 다시 받는가.
#
# 그전까지 update 는 우리가 렌더한 CLI 산출물만 새로 썼다. 상류 저장소가 스킬을 고쳐도
# 설치받은 사람은 영영 못 받았고, 화면에는 `✓ external CLI artifacts` 가 떠서 다 된 것처럼
# 보였다(실측: npx 호출 install 2회 · update 0회).
#
# scenario-update-external(ADR-049)은 **우리 산출물**을 검증한다. 이쪽은 **남의 저장소에서
# 받아온 스킬 본문**이라 서로 다른 코드를 탄다 — 한쪽 증거가 다른 쪽 증거가 되지 않는다.
#
# 검증:
#   ① install 이 두 자리(.claude/ · .agents/)에 **실제 디렉터리**를 만든다 (#372)
#   ② 변이 후 update → 두 사본 다 상류판으로 돌아온다
#   ③ **update 후에도 슬롯이 디렉터리다** — 심링크로 강등되면 foreign-slot 이 "남의 것"으로
#      판정해 그 뒤 우리 최신본이 영영 안 들어간다(#343). `skills update` 서브명령을 쓰면
#      실제로 그렇게 된다(독립 리뷰 CRITICAL, 2026-08-27 실측)
#   ④ claude 단독 설치에 **`.agents/` 가 생기지 않는다** — 고른 적 없는 CLI 자산 금지(ADR-031)
#   ⑤ 설치 기록이 없으면 화면이 **판정 불가**를 말한다 (조용한 무동작 금지)
#   ⑥ update 화면에 external skills 행이 뜬다
#
# **대상 스킬을 열거하지 않는다** — 설치 기록에서 derive 한다. 여기 이름을 적으면 카탈로그가
# 바뀌는 순간 이 시나리오가 조용히 아무것도 검증하지 않게 된다.

set -euo pipefail

echo "▸ scenario-update-external-skills: update 가 외부 스킬을 갱신하는가 (#374)"
echo ""

LOG_REL=".uzys-agent-harness/.harness-install.json"

# 슬롯 형태를 낸다: LINK / DIR / ABSENT. `-L` 을 `-d` 보다 **먼저** 본다 —
# 디렉터리를 가리키는 심링크는 `-d` 도 참이라 `-d` 를 먼저 보면 강등을 못 잡는다.
shape() {
  if [[ -L "$1" ]]; then echo "LINK"
  elif [[ -d "$1" ]]; then echo "DIR"
  else echo "ABSENT"; fi
}

# ───────────────────────── A. claude + codex ─────────────────────────
PROJ=/tmp/proj-upd-skills
rm -rf "${PROJ}"; mkdir -p "${PROJ}"; cd "${PROJ}"

agent-harness install --track tooling --scope project --cli claude --cli codex >/dev/null

if [[ ! -f "${PROJ}/${LOG_REL}" ]]; then
  echo "FAIL: 설치 기록이 없다 — 이 시나리오가 검증할 대상이 없다"
  exit 1
fi

SKILL_ID="$(jq -r '[.assets[] | select(.method == "skill") | .id][0]' "${PROJ}/${LOG_REL}")"
if [[ -z "${SKILL_ID}" || "${SKILL_ID}" == "null" ]]; then
  echo "FAIL: 설치 기록에 skill 자산이 없다 — 외부 스킬이 하나도 안 깔렸다"
  echo "      (네트워크 · skills CLI 실패 가능. 이 시나리오는 실 설치를 전제한다)"
  exit 1
fi
echo "✓ install 완료 — 기록의 첫 스킬 자산 = ${SKILL_ID}"

# **슬롯은 설치 기록의 skill 자산에서만 고른다.** 디스크를 훑어 아무 슬롯이나 고르면 내부 번들
# 스킬(`templates/skills/` 에서 온 것)이 걸리는데, 그건 update 가 원래 갱신하던 자산이라
# 이 시나리오가 자기 대상이 아닌 것을 재고 초록을 낸다 (실제로 한 번 그렇게 됐다 —
# `audit-harness-fit` 이 뽑혔고, 그 슬롯은 수정 없이도 되돌아온다).
SLOT=""
while IFS= read -r cand; do
  [[ -z "${cand}" ]] && continue
  if [[ -e "${PROJ}/.claude/skills/${cand}" && -e "${PROJ}/.agents/skills/${cand}" ]]; then
    SLOT="${cand}"; break
  fi
done < <(jq -r '[.assets[] | select(.method == "skill") | .detail.skill // empty][]' "${PROJ}/${LOG_REL}")
if [[ -z "${SLOT}" ]]; then
  echo "FAIL: 설치 기록의 외부 스킬 중 두 자리에 다 있는 것이 없다 — #372(--copy 누락) 회귀다"
  jq -c '[.assets[] | select(.method == "skill")]' "${PROJ}/${LOG_REL}"
  ls -la "${PROJ}/.claude/skills" "${PROJ}/.agents/skills" 2>&1 || true
  exit 1
fi
CLAUDE_SLOT="${PROJ}/.claude/skills/${SLOT}"
AGENTS_SLOT="${PROJ}/.agents/skills/${SLOT}"

# --- ① 두 자리가 실제 디렉터리인가 ---
for p in "${CLAUDE_SLOT}" "${AGENTS_SLOT}"; do
  s="$(shape "${p}")"
  if [[ "${s}" != "DIR" ]]; then
    echo "FAIL: install 직후 ${p} 가 ${s} 다 (DIR 이어야 한다)"
    exit 1
  fi
done
echo "✓ install 직후 두 자리 모두 실제 디렉터리 (slot=${SLOT})"

# --- ② 변이 → update → 두 사본이 다 돌아오는가 ---
MARK="MUTATED-BY-SCENARIO-374"
for f in "${CLAUDE_SLOT}/SKILL.md" "${AGENTS_SLOT}/SKILL.md"; do
  printf '\n%s\n' "${MARK}" >> "${f}"
done
# 변이가 실제로 걸렸는지 **먼저** 증명한다 — 안 걸린 초록은 통과의 증거가 아니다.
BEFORE=$( { grep -l "${MARK}" "${CLAUDE_SLOT}/SKILL.md" "${AGENTS_SLOT}/SKILL.md" || true; } | wc -l | tr -d ' ')
if [[ "${BEFORE}" -ne 2 ]]; then
  echo "FAIL: 변이가 두 사본에 안 걸렸다 (${BEFORE}/2) — 이 실행은 무효다"
  exit 1
fi
echo "✓ 변이 2/2 반영 확인"

OUT="${PROJ}/update-out.txt"
agent-harness update > "${OUT}" 2>&1 || {
  echo "FAIL: update 가 실패했다"
  tail -30 "${OUT}"
  exit 1
}

REMAIN=0
for f in "${CLAUDE_SLOT}/SKILL.md" "${AGENTS_SLOT}/SKILL.md"; do
  if grep -q "${MARK}" "${f}"; then
    echo "  ✗ 갱신 안 됨: ${f}"
    REMAIN=$((REMAIN + 1))
  fi
done
if [[ "${REMAIN}" -ne 0 ]]; then
  echo "FAIL: update 후에도 변이가 ${REMAIN}개 사본에 남아 있다 — #374 결함 그대로다"
  exit 1
fi
echo "✓ update 가 두 사본을 모두 상류판으로 되돌렸다"

# --- ③ update 후에도 디렉터리인가 (심링크 강등 금지) ---
for p in "${CLAUDE_SLOT}" "${AGENTS_SLOT}"; do
  s="$(shape "${p}")"
  if [[ "${s}" != "DIR" ]]; then
    echo "FAIL: update 후 ${p} 가 ${s} 다 — 슬롯이 강등되면 foreign-slot 이 '남의 것'으로"
    echo "      판정해(#343) 그 뒤 우리 최신본이 영영 그 자리에 안 들어간다"
    exit 1
  fi
done
echo "✓ update 후에도 두 자리 모두 실제 디렉터리 (심링크 강등 없음)"

# --- ⑥ 화면이 그 사실을 말하는가 ---
if ! grep -q "external skills" "${OUT}"; then
  echo "FAIL: update 화면에 'external skills' 행이 없다 — 갱신하고도 안 알린다"
  cat "${OUT}"
  exit 1
fi
echo "✓ update 화면에 external skills 행이 뜬다"

# ───────────────────── B. claude 단독 — .agents 금지 ─────────────────────
SOLO=/tmp/proj-upd-skills-solo
rm -rf "${SOLO}"; mkdir -p "${SOLO}"; cd "${SOLO}"
agent-harness install --track tooling --scope project --cli claude >/dev/null

if [[ -e "${SOLO}/.agents" ]]; then
  echo "FAIL: claude 단독 install 이 .agents/ 를 만들었다 — 이 시나리오의 전제가 깨졌다"
  exit 1
fi

agent-harness update > "${SOLO}/update-out.txt" 2>&1 || {
  echo "FAIL: claude 단독 update 가 실패했다"
  tail -30 "${SOLO}/update-out.txt"
  exit 1
}

if [[ -e "${SOLO}/.agents" ]]; then
  echo "FAIL: update 가 고른 적 없는 .agents/ 를 만들었다 (ADR-031 과 같은 형태)"
  find "${SOLO}/.agents" -maxdepth 2 | head -10
  exit 1
fi
for d in "${SOLO}"/.claude/skills/*; do
  s="$(shape "${d}")"
  if [[ "${s}" == "LINK" ]]; then
    echo "FAIL: update 후 ${d} 가 심링크다 — .agents/ 를 지우면 본문이 사라진다"
    exit 1
  fi
done
echo "✓ claude 단독: update 가 .agents/ 를 만들지 않고 슬롯도 디렉터리로 유지"

# ───────────────── C. 설치 기록이 없으면 판정 불가를 말한다 ─────────────────
cd "${SOLO}"
mv "${SOLO}/${LOG_REL}" "${SOLO}/harness-install.json.moved"
agent-harness update > "${SOLO}/update-nolog.txt" 2>&1 || true
mv "${SOLO}/harness-install.json.moved" "${SOLO}/${LOG_REL}"
if ! grep -q "판정할 수 없다" "${SOLO}/update-nolog.txt"; then
  echo "FAIL: 설치 기록이 없는데 화면이 아무 말도 안 한다 — 조용한 무동작이다"
  cat "${SOLO}/update-nolog.txt"
  exit 1
fi
echo "✓ 설치 기록이 없으면 화면이 판정 불가를 말한다"

echo ""
echo "▸ scenario-update-external-skills PASS"
