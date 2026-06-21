#!/usr/bin/env bash
# v26.87.0 — dev-method skills 4-CLI 라우팅 검증 (no-false-ship Surface Parity).
#
# 6종 dev-method skill(internal, official, has-dev-track = tooling 기본 설치)이 실 컨테이너
# install 에서 4개 CLI 산출 경로로 정확히 렌더되는지 file-level 검증한다:
#   - Claude:              .claude/skills/<id>/SKILL.md
#   - Codex/Antigravity:   .agents/skills/<id>/SKILL.md (native, frontmatter 보존)
#   - OpenCode:            .opencode/commands/<id>.md   (command 폴백)
#
# 핵심 가드:
#   1. frontmatter `name: <id>` 보존 + `name: uzys-<id>` 오염 부재 (renderBundledSkill 함정 가드 end-to-end)
#   2. 독립 게이팅 — --with uzys-harness 없이도 dev-method skill 설치 (uzys-6Gate 산출물은 부재)
#   3. 선택 제어 — --without <id> 시 해당 skill 만 4-CLI 전 경로에서 drop
#
# transform 은 순수 파일 생성 — real CLI 바이너리 불요(mock claude 이미지로 충분).
# 실 CLI 의 native 인식(claude/codex 가 SKILL.md 를 실제 로드)은 CLI 측 계약 — 본 시나리오는
# 하네스가 "올바른 위치에 올바른 내용"을 쓰는지까지 검증한다.

set -uo pipefail

echo "▸ scenario-dev-method-skills: dev-method 6종 4-CLI 라우팅 (v26.87.0)"
echo ""

SKILL_A=multi-persona-review   # dev-tools 카테고리 대표
SKILL_B=asis-tobe-decision     # workflow 카테고리 대표

failed=0
assert_file() {
  local path="$1" desc="$2"
  if [[ -f "${path}" ]]; then echo "  ✓ ${desc}"; else echo "  ✗ FAIL: ${desc} (missing: ${path})"; failed=1; fi
}
assert_absent() {
  local path="$1" desc="$2"
  if [[ ! -e "${path}" ]]; then echo "  ✓ ${desc}"; else echo "  ✗ FAIL: ${desc} (present but should be absent: ${path})"; failed=1; fi
}
assert_grep() {
  local pattern="$1" file="$2" desc="$3"
  if [[ -f "${file}" ]] && grep -qE "${pattern}" "${file}"; then echo "  ✓ ${desc}";
  else echo "  ✗ FAIL: ${desc} (pattern '${pattern}' not in ${file})"; failed=1; fi
}
assert_nogrep() {
  local pattern="$1" file="$2" desc="$3"
  if [[ -f "${file}" ]] && grep -qE "${pattern}" "${file}"; then echo "  ✗ FAIL: ${desc} (pattern '${pattern}' WRONGLY present in ${file})"; failed=1;
  else echo "  ✓ ${desc}"; fi
}

# ── 1. 4-CLI 설치 (uzys-harness 미선택 — 독립 게이팅 증명) ──
PROJ=/tmp/proj-devmethod
rm -rf "${PROJ}"; mkdir -p "${PROJ}"; cd "${PROJ}" || { echo "FAIL: cd"; exit 1; }
LOG=/tmp/devmethod-install.log
agent-harness install --track tooling \
  --cli claude --cli codex --cli opencode --cli antigravity \
  --scope project >"${LOG}" 2>&1 || { echo "FAIL: install 실패"; cat "${LOG}"; exit 1; }

echo "── Claude (.claude/skills/) ──"
assert_file "${PROJ}/.claude/skills/${SKILL_A}/SKILL.md" "claude: ${SKILL_A}"
assert_file "${PROJ}/.claude/skills/${SKILL_B}/SKILL.md" "claude: ${SKILL_B}"

echo "── Codex/Antigravity native (.agents/skills/) + frontmatter 보존 가드 ──"
assert_file  "${PROJ}/.agents/skills/${SKILL_A}/SKILL.md" ".agents: ${SKILL_A}"
assert_grep  "^name: ${SKILL_A}$" "${PROJ}/.agents/skills/${SKILL_A}/SKILL.md" "frontmatter name: ${SKILL_A} 보존"
assert_nogrep "^name: uzys-${SKILL_A}$" "${PROJ}/.agents/skills/${SKILL_A}/SKILL.md" "name: uzys-${SKILL_A} 오염 부재 (renderSkill 함정 가드)"
assert_file  "${PROJ}/.agents/skills/${SKILL_B}/SKILL.md" ".agents: ${SKILL_B}"
assert_grep  "^name: ${SKILL_B}$" "${PROJ}/.agents/skills/${SKILL_B}/SKILL.md" "frontmatter name: ${SKILL_B} 보존"

echo "── OpenCode command 폴백 (.opencode/commands/) ──"
assert_file "${PROJ}/.opencode/commands/${SKILL_A}.md" "opencode cmd: ${SKILL_A}"
assert_grep "^description:" "${PROJ}/.opencode/commands/${SKILL_A}.md" "opencode ${SKILL_A}: description frontmatter"
assert_grep "^agent:" "${PROJ}/.opencode/commands/${SKILL_A}.md" "opencode ${SKILL_A}: agent frontmatter"

echo "── 독립 게이팅 (uzys-harness 미선택 → uzys-6Gate 산출물 부재) ──"
assert_absent "${PROJ}/.agents/skills/uzys-spec" "uzys-6Gate skill 부재 (dev-method 와 독립)"
assert_absent "${PROJ}/.claude/commands/uzys" "uzys 슬래시 커맨드 부재"

# ── 2. 선택 제어 (--without <id> → 전 경로 drop) ──
echo ""
echo "── 선택 제어 (--without ${SKILL_A}) ──"
PROJ2=/tmp/proj-devmethod-without
rm -rf "${PROJ2}"; mkdir -p "${PROJ2}"; cd "${PROJ2}" || { echo "FAIL: cd"; exit 1; }
agent-harness install --track tooling \
  --cli claude --cli codex --cli opencode --cli antigravity \
  --without "${SKILL_A}" --scope project >/tmp/devmethod-without.log 2>&1 \
  || { echo "FAIL: install --without 실패"; cat /tmp/devmethod-without.log; exit 1; }
assert_absent "${PROJ2}/.claude/skills/${SKILL_A}" "claude: ${SKILL_A} drop"
assert_absent "${PROJ2}/.agents/skills/${SKILL_A}" ".agents: ${SKILL_A} drop"
assert_absent "${PROJ2}/.opencode/commands/${SKILL_A}.md" "opencode: ${SKILL_A} drop"
assert_file   "${PROJ2}/.claude/skills/${SKILL_B}/SKILL.md" "claude: ${SKILL_B} 잔존 (다른 skill 영향 없음)"

echo ""
if [[ "${failed}" -eq 0 ]]; then
  echo "━━━ PASS: scenario-dev-method-skills (4-CLI 라우팅 + 보존 + 게이팅 + 선택제어) ━━━"
  exit 0
else
  echo "━━━ FAIL: scenario-dev-method-skills ━━━"
  echo "── install 출력 전문 ──"; cat "${LOG}"
  exit 1
fi
