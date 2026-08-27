#!/usr/bin/env bash
# v26.87.0 — 고른 항목이 4-CLI 자리에 도달하는가 (no-false-ship Surface Parity).
#            2026-08-28 (#369) — **릴리즈 게시를 막는 두 게이트 중 하나**다.
#
# 실 컨테이너 install 한 번으로 **배달 방식 두 가지**를 본다:
#   ⓐ 템플릿 복사   — 번들 스킬이 각 CLI 자리에
#   ⓑ npx skills add — 외부 스킬이 claude 자리와 범용(.agents) 자리에
# 자리:
#   - Claude:              .claude/skills/<id>/SKILL.md
#   - Codex/Antigravity:   .agents/skills/<id>/SKILL.md (범용 자리, 외부 스킬도 여기)
#   - OpenCode:            .opencode/commands/<id>.md   (번들 스킬의 command 폴백)
#
# (나머지 두 배달 방식 — `npm i` 와 `npx <cmd>@<ver>` — 은 scenario-pinned-versions 가 맡는다.
#  둘을 합쳐 게시 차단 게이트를 이룬다. 파일 이름은 옛 범위(dev-method)를 남긴 것이고,
#  지금 범위는 위와 같다.)
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
# 실 CLI 의 native 인식(claude/codex 가 SKILL.md 를 실제 로드)은 CLI 측 계약이고
# scenario-realcli-* 가 증거를 모은다 — 그쪽은 게시를 막지 않는 신호다.

set -uo pipefail

echo "▸ scenario-dev-method-skills: 고른 항목이 4-CLI 자리에 도달하는가 (번들 복사 + 외부 스킬)"
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

# ⓑ 외부 스킬(`npx skills add`)도 같은 설치 한 번의 산출물이다 — 설치를 더 돌리지 않고
#    설치 기록에서 유도해 확인한다. #344 가 이 축이었다: Codex·OpenCode·Antigravity 를 고른
#    사용자가 기본 추천 자산을 **한 번도 못 받았고** 발견한 것은 사용자였다.
#    (배달 방식이 애초에 claude 전용이 되는 형태는 tests/cli-external-path.test.ts 가 막는다.
#     여기서 보는 것은 그 다음 질문 — 그래서 디스크에 실재하는가.)
echo "── 외부 스킬 (npx skills add → claude 자리 + 범용 자리) ──"
LOGJSON="${PROJ}/.uzys-agent-harness/.harness-install.json"
if [[ ! -f "${LOGJSON}" ]]; then
  echo "  ✗ FAIL: 설치 기록(${LOGJSON})이 없다 — 이 판정은 무효다"
  failed=1
else
  EXT_SKILLS=$(jq -r '.assets[] | select(.method == "skill") | .detail.skill // .id' "${LOGJSON}")
  EXT_COUNT=$(printf '%s\n' "${EXT_SKILLS}" | grep -c . || true)
  if [[ "${EXT_COUNT}" -eq 0 ]]; then
    # 모집단 0 은 "위반 없음"이 아니라 "아무것도 안 쟀음"이다. 외부 설치가 통째로 실패한
    # 상태(네트워크·git CA)가 여기서 초록으로 새면 게이트가 장식이 된다.
    echo "  ✗ FAIL: 설치 기록에 skill 자산이 0건 — 외부 설치가 통째로 실패했거나 기록 형식이 바뀌었다"
    failed=1
  else
    echo "  설치 기록에서 유도한 외부 스킬 ${EXT_COUNT}종: $(printf '%s ' ${EXT_SKILLS})"
    for sid in ${EXT_SKILLS}; do
      assert_file "${PROJ}/.claude/skills/${sid}/SKILL.md" "claude 자리: ${sid}"
      assert_file "${PROJ}/.agents/skills/${sid}/SKILL.md" "범용 자리: ${sid}"
    done
  fi
fi

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
