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
#   ③ **update 후에도 슬롯이 디렉터리다** — 심링크로 강등되면 `.agents/` 를 지우는 순간 본문이
#      사라지고, 슬롯 이름이 번들 스킬과 겹치면 foreign-slot 이 "남의 것"으로 판정해(#343)
#      하네스 writer 가 건너뛴다. `skills update` 서브명령을 쓰면 실제로 강등된다
#      (독립 리뷰 CRITICAL, 2026-08-27 실측)
#   ④ claude 단독 설치에 **`.agents/` 가 생기지 않는다** — 고른 적 없는 CLI 자산 금지(ADR-031)
#   ⑤ 설치 기록이 없으면 exit 1 · 화면이 **기록 없음**을 말한다 · 한 바이트도 안 쓴다 (조용한 무동작 금지 · #595)
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

# tooling 은 #709(ADR-101)부터 외부 스킬을 미리 받지 않는다 — 외부 스킬 도달을 보려고 frontend-design 을 고른다.
agent-harness install --track tooling --with frontend-design --scope project --cli claude --cli codex >/dev/null

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

# --- ②' #770 — 고친 사본은 그 파일 하나로 백업되고, 화면·목록이 말한다. 안 고친 파일은 백업이 없다 ---
for f in "${CLAUDE_SLOT}/SKILL.md" "${AGENTS_SLOT}/SKILL.md"; do
  BAKS=$(find "$(dirname "${f}")" -maxdepth 1 -name 'SKILL.md.backup-*')
  if [[ "$(printf '%s' "${BAKS}" | grep -c .)" -ne 1 ]] || ! grep -q "${MARK}" "${BAKS}"; then
    echo "FAIL: 고친 ${f} 의 편집이 백업으로 남지 않았다 (#770) — 찾은 백업: [${BAKS}]"
    exit 1
  fi
done
OTHER_BAKS=$(find "${CLAUDE_SLOT}" "${AGENTS_SLOT}" -name '*.backup-*' ! -name 'SKILL.md.backup-*')
if [[ -n "${OTHER_BAKS}" ]]; then
  echo "FAIL: 안 고친 파일까지 백업했다 (#770)"
  echo "${OTHER_BAKS}"
  exit 1
fi
if ! grep -q "BACKUPS" "${OUT}" || grep -q "no checksum on record" "${OUT}"; then
  echo "FAIL: update 화면이 백업을 말하지 않거나 '체크섬 없음' 으로 말한다 (#770)"
  grep -E "BACKUPS" "${OUT}" || echo "  (BACKUPS 행 자체가 없다)"
  exit 1
fi
LIST="${PROJ}/.uzys-agent-harness/update-backups.json"
for rel in ".claude/skills/${SLOT}/SKILL.md" ".agents/skills/${SLOT}/SKILL.md"; do
  if ! jq -e --arg p "${rel}" '.backups[] | select(.path == $p and (.noChecksum | not))' "${LIST}" >/dev/null; then
    echo "FAIL: update-backups.json 에 ${rel} 쌍이 없거나 noChecksum 이다 (#770)"
    cat "${LIST}" 2>&1 || true
    exit 1
  fi
done
echo "✓ 고친 SKILL.md 두 사본만 *.backup-<시각> 으로 남고 화면·목록이 그것을 말한다 (#770)"

# --- ②'' #770 — 다시 update 해도 설치자 파일(노트 · 앞선 백업)은 그대로고, 안 고친 파일은 새 백업 없이 갱신된다 ---
# skills CLI 는 스킬 폴더를 새로 만든다(실측) — 폴더 안의 기록 밖 파일이 지워지면 앞 단계의 백업도 다음 update 에 사라진다.
NOTE="${CLAUDE_SLOT}/my-notes.md"
echo "installer note" > "${NOTE}"
BAKS_BEFORE=$(find "${CLAUDE_SLOT}" "${AGENTS_SLOT}" -name '*.backup-*' | sort)
agent-harness update > "${PROJ}/update-out-2.txt" 2>&1 || {
  echo "FAIL: 두 번째 update 가 실패했다"; tail -30 "${PROJ}/update-out-2.txt"; exit 1
}
BAKS_AFTER=$(find "${CLAUDE_SLOT}" "${AGENTS_SLOT}" -name '*.backup-*' | sort)
if [[ "${BAKS_AFTER}" != "${BAKS_BEFORE}" ]]; then
  echo "FAIL: 두 번째 update 뒤 백업 목록이 바뀌었다 — 앞선 백업이 지워졌거나 안 고친 파일을 백업했다 (#770)"
  echo "before: ${BAKS_BEFORE}"; echo "after:  ${BAKS_AFTER}"
  exit 1
fi
if [[ "$(cat "${NOTE}" 2>/dev/null)" != "installer note" ]]; then
  echo "FAIL: 스킬 폴더의 설치자 노트가 update 뒤 사라졌다 (#770)"
  exit 1
fi
echo "✓ 두 번째 update — 앞선 백업·설치자 노트가 남고, 안 고친 파일은 새 백업 없이 갱신된다 (#770)"

# --- ②''' #770 HIGH-1 — install 재실행도 같은 도구 호출이다. 고친 파일은 그 파일 하나로 백업되고, 노트·앞선 백업은
#          제자리에 남고, 안 고친 사본(.agents)은 새 백업 없이 갱신된다 ---
MARK2="MUTATED-BEFORE-REINSTALL-770"
printf '\n%s\n' "${MARK2}" >> "${CLAUDE_SLOT}/SKILL.md"
NOTE2="${CLAUDE_SLOT}/my-notes2.md"
echo "installer note 2" > "${NOTE2}"
if ! grep -q "${MARK2}" "${CLAUDE_SLOT}/SKILL.md"; then
  echo "FAIL: install 재실행 전 변이가 안 걸렸다 — 이 실행은 무효다"
  exit 1
fi
BAKS_BEFORE_RE=$(find "${CLAUDE_SLOT}" "${AGENTS_SLOT}" -name '*.backup-*' | sort)
agent-harness install --track tooling --with frontend-design --scope project --cli claude --cli codex \
  > "${PROJ}/reinstall-out.txt" 2>&1 || {
  echo "FAIL: install 재실행이 실패했다"; tail -30 "${PROJ}/reinstall-out.txt"; exit 1
}
for b in ${BAKS_BEFORE_RE}; do
  if [[ ! -f "${b}" ]]; then
    echo "FAIL: install 재실행이 앞선 백업 ${b} 를 지웠다 (#770 HIGH-1)"
    exit 1
  fi
done
for n in "${NOTE}" "${NOTE2}"; do
  if [[ ! -f "${n}" ]]; then
    echo "FAIL: install 재실행이 스킬 폴더의 설치자 노트 ${n} 를 지웠다 (#770 HIGH-1)"
    exit 1
  fi
done
NEW_BAKS=$(comm -13 <(echo "${BAKS_BEFORE_RE}") <(find "${CLAUDE_SLOT}" "${AGENTS_SLOT}" -name '*.backup-*' | sort))
if [[ "$(printf '%s' "${NEW_BAKS}" | grep -c .)" -ne 1 ]] || [[ "${NEW_BAKS}" != "${CLAUDE_SLOT}/SKILL.md.backup-"* ]] \
  || ! grep -q "${MARK2}" "${NEW_BAKS}"; then
  echo "FAIL: install 재실행 뒤 새 백업이 고친 ${CLAUDE_SLOT}/SKILL.md 하나가 아니다 (#770 HIGH-1) — 새 백업: [${NEW_BAKS}]"
  exit 1
fi
if grep -q "${MARK2}" "${CLAUDE_SLOT}/SKILL.md"; then
  echo "FAIL: install 재실행 뒤에도 고친 SKILL.md 가 상류판이 아니다"
  exit 1
fi
if ! grep -q "$(basename "${NEW_BAKS}")" "${PROJ}/reinstall-out.txt"; then
  echo "FAIL: install 화면이 남긴 백업을 말하지 않는다 (#770 HIGH-1)"
  grep -n "backup" "${PROJ}/reinstall-out.txt" || echo "  (backup 행 자체가 없다)"
  exit 1
fi
echo "✓ install 재실행 — 고친 SKILL.md 만 백업되고 화면이 말하며, 노트·앞선 백업은 남는다 (#770 HIGH-1)"

# --- ③ update 후에도 디렉터리인가 (심링크 강등 금지) ---
for p in "${CLAUDE_SLOT}" "${AGENTS_SLOT}"; do
  s="$(shape "${p}")"
  if [[ "${s}" != "DIR" ]]; then
    echo "FAIL: update 후 ${p} 가 ${s} 다 — 강등되면 .agents/ 를 지우는 순간 본문이 사라지고,"
    echo "      번들 스킬과 이름이 겹치면 foreign-slot 이 '남의 것'으로 판정한다(#343)"
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
# tooling 은 #709(ADR-101)부터 외부 스킬을 미리 받지 않는다 — 외부 스킬 도달을 보려고 frontend-design 을 고른다.
agent-harness install --track tooling --with frontend-design --scope project --cli claude >/dev/null

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

# ───────────────── C. 설치 기록이 없으면 거절하고 말한다 (#595) ─────────────────
# #595 뒤 기록 없는 update 는 판정 하나로 거절한다 — exit 1 · stderr 첫 줄 `No install record` · 쓰기 0.
# 스킬 사본이 깔린 자리에서도 같은 답인지를 본다(기록 없는 빈 폴더는 scenario-no-record-plain 이 본다).
cd "${SOLO}"
mv "${SOLO}/${LOG_REL}" /tmp/harness-install.json.moved
snap_solo() { (cd "${SOLO}" && find . -type d | sort && find . -type f -exec sha256sum {} + | sort); }
BEFORE_NOLOG=$(snap_solo)
set +e
agent-harness update > /tmp/update-nolog.txt 2>&1
RC_NOLOG=$?
set -e
AFTER_NOLOG=$(snap_solo)
mv /tmp/harness-install.json.moved "${SOLO}/${LOG_REL}"
if [[ "${RC_NOLOG}" -ne 1 ]]; then
  echo "FAIL: 설치 기록이 없는데 update 가 exit ${RC_NOLOG} — 거절하지 않았다 (기대 1)"
  cat /tmp/update-nolog.txt
  exit 1
fi
if ! grep -q "No install record" /tmp/update-nolog.txt; then
  echo "FAIL: 설치 기록이 없는데 화면이 아무 말도 안 한다 — 조용한 무동작이다"
  cat /tmp/update-nolog.txt
  exit 1
fi
if [[ "${AFTER_NOLOG}" != "${BEFORE_NOLOG}" ]]; then
  echo "FAIL: 기록 없는 update 가 디스크를 바꿨다 — 거절한다면서 썼다"
  diff <(echo "${BEFORE_NOLOG}") <(echo "${AFTER_NOLOG}") | head -20 || true
  exit 1
fi
echo "✓ 설치 기록이 없으면 exit 1 · 화면이 'No install record' 를 말한다 · 트리 불변"

# ───────── D. 글로벌 설치본 — 화면이 실제 쓰는 자리를 말하는가 ─────────
# update 는 설치 기록의 스코프를 그대로 쓴다(`-g`). 그래서 글로벌 설치본에서는 홈에 쓴다.
# 그 사실이 헤더에 안 나오면 **홈에 쓰면서 안 쓴다고 적는 것**이고, 그게 이 저장소가 반복해서
# 당한 거짓출하의 형태다 (독립 리뷰 HIGH-1, 2026-08-27 실측).
GLB=/tmp/proj-upd-skills-global
rm -rf "${GLB}"; mkdir -p "${GLB}"; cd "${GLB}"
# 새 설치는 Global 을 받지 않는다(#560). 옛 Global 설치본 = project 설치 뒤 기록 scope 를 global 로 —
# 그러면 install 이 같은 플래그를 받아 외부 자산을 홈에 다시 깐다(옛 판이 남긴 상태와 같은 모양).
agent-harness install --track tooling --with frontend-design --cli claude >/dev/null 2>&1
GLOG="${GLB}/.uzys-agent-harness/.harness-install.json"
jq '.scope = "global"' "${GLOG}" > "${GLOG}.tmp" && mv "${GLOG}.tmp" "${GLOG}"
agent-harness install --track tooling --with frontend-design --scope global --cli claude >/dev/null 2>&1

GSKILL="${HOME}/.claude/skills/frontend-design/SKILL.md"
if [[ ! -f "${GSKILL}" ]]; then
  echo "FAIL: 글로벌 설치가 외부 스킬을 홈에 안 깔았다 — D 단계의 전제가 없다"
  exit 1
fi
printf '\n%s\n' "MUTATED-GLOBAL-374" >> "${GSKILL}"
if [[ "$(grep -c 'MUTATED-GLOBAL-374' "${GSKILL}")" -ne 1 ]]; then
  echo "FAIL: 홈 변이가 안 걸렸다 — 이 실행은 무효다"
  exit 1
fi

agent-harness update > "${GLB}/update-out.txt" 2>&1 || {
  echo "FAIL: 글로벌 설치본 update 가 실패했다"; tail -30 "${GLB}/update-out.txt"; exit 1
}

WROTE_HOME=0
grep -q 'MUTATED-GLOBAL-374' "${GSKILL}" || WROTE_HOME=1
if [[ "${WROTE_HOME}" -eq 1 ]] && ! grep -q "SCOPE.*Global" "${GLB}/update-out.txt"; then
  echo "FAIL: update 가 ~/.claude/ 에 썼는데 화면은 Global 이라고 안 한다 — 거짓출하다"
  grep -E "SCOPE" "${GLB}/update-out.txt" || echo "  (SCOPE 행 자체가 없다)"
  exit 1
fi
echo "✓ 글로벌 설치본: 홈을 갱신하고 화면도 Global 이라고 말한다"

echo ""
echo "▸ scenario-update-external-skills PASS"
