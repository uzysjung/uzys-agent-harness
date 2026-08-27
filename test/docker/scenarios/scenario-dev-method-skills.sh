#!/usr/bin/env bash
# v26.87.0 — dev-method skills 4-CLI 라우팅 검증 (no-false-ship Surface Parity).
#
# 6종 dev-method skill(internal, official, has-dev-track = tooling 기본 설치)이 실 컨테이너
# install 에서 4개 CLI 산출 경로로 정확히 렌더되는지 file-level 검증한다:
#   - Claude:              .claude/skills/<id>/SKILL.md
#   - Codex/Antigravity:   .agents/skills/<id>/SKILL.md (native, frontmatter 보존)
#   - OpenCode:            .opencode/commands/<id>.md   (command 폴백)
#
# 이 시나리오가 묻는 것은 **세 가지뿐**이다 (2026-08-28 사용자 확정):
#   ① 고른 항목이 각 CLI 자리에 복사됐나   ② 설치가 실제로 됐나   ③ 원하는 버전인가
# 파일 *내용*이 원본과 같은지는 묻지 않는다 — 설치는 복사이고, 복사본을 원본과 맞대 보는 것은
# 자기 자신과의 대조다. 변환 로직(frontmatter 보존 · `uzys-` 접두 오염 · opencode 커맨드
# frontmatter 생성)은 단위 테스트가 소유한다: tests/codex/transform.test.ts ·
# tests/antigravity/transform.test.ts · tests/opencode/commands.test.ts.
#
# 그래서 여기서 보는 것은 ① 자리별 존재와, 선택 제어의 결과다:
#   1. 4-CLI 자리에 dev-method 스킬 전량이 있다
#   2. 독립 게이팅 — 6Gate 산출물은 없다 (ADR-023 으로 제품에서 제거)
#   3. 선택 제어 — --without <id> 시 해당 skill 만 4-CLI 전 경로에서 drop
#
# transform 은 순수 파일 생성 — real CLI 바이너리 불요(mock claude 이미지로 충분).
# 실 CLI 의 native 인식(claude/codex 가 SKILL.md 를 실제 로드)은 CLI 측 계약 — 본 시나리오는
# 하네스가 "올바른 위치에 올바른 내용"을 쓰는지까지 검증한다.

set -uo pipefail

echo "▸ scenario-dev-method-skills: dev-method 6종 4-CLI 라우팅 (v26.87.0)"
echo ""

# 검증 대상은 **카탈로그에서 유도한다**. 예전에는 대표 2종을 이름으로 박아 뒀는데,
# 그중 `asis-tobe-decision` 이 2026-08-02 통합(ADR-060)으로 없어지면서 이 시나리오는
# 26일간 red 인 채 아무도 안 봤다 — 시나리오 안의 이름 목록은 카탈로그의 **두 번째 사본**이고,
# 두 번째 사본은 반드시 썩는다(run.sh 가 시나리오 목록을 디렉터리에서 유도하는 것과 같은 이유).
CATALOG=/work/src/external-assets.ts
# `mapfile` 과 음수 인덱스는 bash 4+ 전용이다 — 컨테이너는 5 지만 이 파일을 macOS(bash 3.2)에서
# 손보는 사람이 문법 확인조차 못 하면 그것도 비용이다. while-read 로 담는다.
DEV_METHOD_IDS=()
while IFS= read -r line; do
  [ -n "${line}" ] && DEV_METHOD_IDS+=("${line}")
done <<EOF
$(sed -n '/^export const DEV_METHOD_SKILL_IDS/,/^\];/p' "${CATALOG}" \
    | grep -oE '"[a-z0-9][a-z0-9-]*"' | tr -d '"')
EOF
# 모집단이 비면 아래 루프는 **한 건도 안 재고 초록**이 된다 — 부재가 아니라 탐지기 고장이다.
if [[ "${#DEV_METHOD_IDS[@]}" -lt 2 ]]; then
  echo "FAIL: ${CATALOG} 에서 DEV_METHOD_SKILL_IDS 를 못 읽었다 (${#DEV_METHOD_IDS[@]}건)."
  echo "      아래 결과는 증거가 아니다 — 카탈로그 상수명/형태가 바뀌었는지 먼저 보라."
  exit 1
fi
echo "▸ 카탈로그에서 유도한 dev-method 스킬 ${#DEV_METHOD_IDS[@]}종: ${DEV_METHOD_IDS[*]}"
SKILL_A="${DEV_METHOD_IDS[0]}"   # --without 선택 제어에 쓰는 대표
SKILL_B="${DEV_METHOD_IDS[$(( ${#DEV_METHOD_IDS[@]} - 1 ))]}"  # 그와 다른 것 하나 (잔존 확인용)

failed=0
assert_file() {
  local path="$1" desc="$2"
  if [[ -f "${path}" ]]; then echo "  ✓ ${desc}"; else echo "  ✗ FAIL: ${desc} (missing: ${path})"; failed=1; fi
}
assert_absent() {
  local path="$1" desc="$2"
  if [[ ! -e "${path}" ]]; then echo "  ✓ ${desc}"; else echo "  ✗ FAIL: ${desc} (present but should be absent: ${path})"; failed=1; fi
}

# ── 1. 4-CLI 설치 (uzys-harness 미선택 — 독립 게이팅 증명) ──
PROJ=/tmp/proj-devmethod
rm -rf "${PROJ}"; mkdir -p "${PROJ}"; cd "${PROJ}" || { echo "FAIL: cd"; exit 1; }
LOG=/tmp/devmethod-install.log
agent-harness install --track tooling \
  --cli claude --cli codex --cli opencode --cli antigravity \
  --scope project >"${LOG}" 2>&1 || { echo "FAIL: install 실패"; cat "${LOG}"; exit 1; }

# 대표 2종만 보던 것을 **유도한 전량**으로 넓힌다. 대표를 고르는 순간 나머지가 사각지대가
# 되고, 그 사각지대는 자산이 늘 때마다 커진다.
echo "── Claude (.claude/skills/) — ${#DEV_METHOD_IDS[@]}종 전량 ──"
for id in "${DEV_METHOD_IDS[@]}"; do
  assert_file "${PROJ}/.claude/skills/${id}/SKILL.md" "claude: ${id}"
done

echo "── Codex/Antigravity native (.agents/skills/) ──"
for id in "${DEV_METHOD_IDS[@]}"; do
  assert_file  "${PROJ}/.agents/skills/${id}/SKILL.md" ".agents: ${id}"
done

echo "── OpenCode command 폴백 (.opencode/commands/) ──"
for id in "${DEV_METHOD_IDS[@]}"; do
  assert_file "${PROJ}/.opencode/commands/${id}.md" "opencode cmd: ${id}"
done

echo "── 독립 게이팅 (uzys-harness 미선택 → uzys-6Gate 산출물 부재) ──"
assert_absent "${PROJ}/.agents/skills/uzys-spec" "uzys-6Gate skill 부재 (dev-method 와 독립)"
# uzys 커맨드 *파일* 부재로 검증 (.claude/commands/uzys 빈 dir 는 uzys-harness 의 무해한 quirk —
# withUzysHarness=false 면 gated copy 0건이라 파일이 안 들어옴. 디렉토리 존재 여부가 아닌 파일로 판정).
assert_absent "${PROJ}/.claude/commands/uzys/spec.md" "uzys 슬래시 커맨드 파일 부재 (withUzysHarness 미선택)"

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
