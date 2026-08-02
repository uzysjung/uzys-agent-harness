#!/usr/bin/env bash
# v26.64.0 (ADR-020) — scenario-project: install --scope project 검증.
#
# 검증:
#   - ~/.claude/skills/, ~/.codex/, ~/.opencode/, npm -g diff = 0
#   - ~/.claude/plugins/cache/ 는 write 발생 가능 (claude CLI 자체 디자인). 단 mock 사용 시
#     mock 이 cache 에 stub 생성하는 것 검증.
#   - .uzys-agent-harness/.harness-install.json 의 scope = "project"
#   - log.assets[].scope 가 모두 "project"

set -euo pipefail

# 컨테이너 안의 리포 루트(/work). 아래 훅 검사가 배포물에서 목록을 derive 하는 데 쓴다 —
# cd 로 떠나기 전에 잡아 둔다.
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source ./snapshot.sh

echo "▸ scenario-project: install --scope project (default)"
echo ""

PROJ=/tmp/proj-scope
rm -rf "${PROJ}"
mkdir -p "${PROJ}"

snap_take /tmp/proj-scope-before

cd "${PROJ}"
agent-harness install --track tooling --scope project

snap_take /tmp/proj-scope-after

# Strict 검증: ~/.claude/skills, ~/.codex, ~/.opencode 변화 없음
# (~/.claude/plugins/* 는 claude CLI native 디자인으로 변화 가능 — D16 본질 예외)
fs_diff=$(diff /tmp/proj-scope-before-fs.txt /tmp/proj-scope-after-fs.txt 2>/dev/null \
  | grep "^[<>]" \
  | grep -v "${HOME}/\.claude$" \
  | grep -v "${HOME}/\.claude/plugins" \
  || true)

npm_diff=$(diff /tmp/proj-scope-before-npm.txt /tmp/proj-scope-after-npm.txt 2>/dev/null \
  | grep "^[<>]" \
  || true)

failed=0

if [[ -n "${fs_diff}" ]]; then
  echo "FAIL: scope=project 인데 ~/.claude/skills, ~/.codex, ~/.opencode 에 변화 검출:"
  echo "${fs_diff}"
  failed=1
else
  echo "✓ ~/.claude/skills, ~/.codex, ~/.opencode 무변화"
fi

if [[ -n "${npm_diff}" ]]; then
  echo "FAIL: scope=project 인데 npm -g 에 변화 검출:"
  echo "${npm_diff}"
  failed=1
else
  echo "✓ npm -g 무변화"
fi

if [[ ! -d "${PROJ}/.claude" ]]; then
  echo "FAIL: ${PROJ}/.claude/ not created"
  failed=1
else
  echo "✓ ${PROJ}/.claude/ 생성"
fi

LOG="${PROJ}/.uzys-agent-harness/.harness-install.json"
if [[ ! -f "${LOG}" ]]; then
  echo "FAIL: install log missing at ${LOG}"
  failed=1
else
  log_scope=$(jq -r '.scope' "${LOG}")
  if [[ "${log_scope}" != "project" ]]; then
    echo "FAIL: log.scope = '${log_scope}', expected 'project'"
    failed=1
  else
    echo "✓ install log scope=project"
  fi

  # log.assets 가 모두 scope=project 인지
  non_project=$(jq -r '[.assets[].scope] | unique | .[]' "${LOG}" 2>/dev/null | grep -v project || true)
  if [[ -n "${non_project}" ]]; then
    echo "FAIL: log.assets 에 non-project scope 검출: ${non_project}"
    failed=1
  else
    asset_count=$(jq -r '.assets | length' "${LOG}")
    echo "✓ log.assets (${asset_count}) 모두 scope=project"
  fi
fi

# v26.115.0 (ADR-043) — 훅 설치 결과 검증. HITO 폐기로 hito-counter.sh 는 설치되면 안 되고,
# 나머지 훅은 그대로 있어야 한다 (제거가 이웃 훅을 함께 떨어뜨리지 않았는지). 단위 테스트는
# manifest 배선까지만 보므로, "실제로 파일이 안 깔린다"는 실설치에서만 증명된다.
HOOK_DIR="${PROJ}/.claude/hooks"
if [[ -e "${HOOK_DIR}/hito-counter.sh" ]]; then
  echo "FAIL: hito-counter.sh 가 설치됨 (ADR-043 에서 폐기된 훅)"
  failed=1
else
  echo "✓ hito-counter.sh 미설치 (폐기 확인)"
fi

# 기대 훅 목록은 배포물(`templates/hooks/*.sh`)에서 derive 한다. 여기 이름을 열거하면 그것이
# 두 번째 사본이 되고, 지운 훅이 이 파일에 살아남아 시나리오가 거짓말한다 — 실제로
# `spec-drift-check.sh` 가 그렇게 남아 이 검사는 무조건 FAIL 인 채 죽어 있었다.
# (run.sh 의 scenario_names() 와 같은 관례.)
hook_total=0
hook_missing=0
for f in "${REPO_ROOT}"/templates/hooks/*.sh; do
  [[ -e "${f}" ]] || continue # 글롭 미매치 방어
  hook_total=$((hook_total + 1))
  h="$(basename "${f}")"
  if [[ ! -f "${HOOK_DIR}/${h}" ]]; then
    echo "FAIL: 배포 훅 ${h} 미설치 — 훅 제거가 이웃 훅까지 떨어뜨렸다"
    failed=1
    hook_missing=1
  fi
done
if [[ "${hook_total}" -eq 0 ]]; then
  echo "FAIL: ${REPO_ROOT}/templates/hooks/*.sh 0건 — 이 검사가 아무것도 안 본다"
  failed=1
elif [[ "${hook_missing}" -eq 0 ]]; then
  echo "✓ 배포 훅 ${hook_total}종 설치 확인"
fi

# settings.json 에 죽은 훅 참조가 남아 있으면 매 프롬프트마다 없는 파일을 실행한다.
SETTINGS="${PROJ}/.claude/settings.json"
if [[ -f "${SETTINGS}" ]] && grep -q "hito" "${SETTINGS}"; then
  echo "FAIL: 설치된 settings.json 에 hito 배선 잔존"
  failed=1
else
  echo "✓ settings.json 에 hito 배선 없음"
fi

echo ""
if [[ "${failed}" -eq 0 ]]; then
  echo "━━━ PASS: scenario-project ━━━"
  exit 0
else
  echo "━━━ FAIL: scenario-project ━━━"
  exit 1
fi
