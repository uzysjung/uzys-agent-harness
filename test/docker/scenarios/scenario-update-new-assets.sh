#!/usr/bin/env bash
# 2026-08-04 (#283) — scenario-update-new-assets: update 가 **릴리즈로 추가된** 자산을 설치하는가.
#
# 왜 별도 시나리오인가: 기존 update 시나리오들은 "이미 있는 파일이 갱신되는가"를 검증한다.
# 그런데 결함은 그 반대편에 있었다 — update 는 `readdirSync(target)` 로 **디스크에 이미 있는
# 파일만** 순회하므로, 릴리즈가 자산을 추가하면 기존 설치본은 update 를 몇 번 돌려도 그 파일을
# 영영 못 받는다. 증상은 `.uzys-agent-harness/` 의 두 스크립트로 드러났다: 배포판 룰이 그 경로를
# 호출하라고 적는 동안 파일이 없었다.
#
# 구버전 설치본을 모사하는 방법: 설치 후 해당 파일을 지운다 — "그 릴리즈에는 없었다"와
# 디스크 상태가 동일하다.
#
# 검증:
#   ① `.uzys-agent-harness/*.sh` 가 없으면 update 가 설치한다 (룰이 가리키는 실행체)
#   ② 설치된 스크립트가 실제로 실행 가능하다 (파일만 놓고 깨진 상태가 아닌지)
#   ③ 룰 파일이 없으면 update 가 설치한다 (트랙이 요구하는 것만)
#   ④ 사용자가 고친 파일은 덮어쓰지 않는다 (신규 설치 경로가 갱신 경로를 침범하지 않는다)
#   ⑤ 트랙 밖 룰은 들이지 않는다 (Track 혼입 방지)
#   ⑥ codex 전용 설치본에 `.claude/` 를 들이지 않는다 (독립 리뷰 HIGH-1)
#   ⑦ 배선할 수 없는 훅은 깔지 않고 재설치를 안내한다 (독립 리뷰 HIGH-2)

set -euo pipefail

echo "▸ scenario-update-new-assets: update 가 신규 자산을 설치하는가 (#283)"
echo ""

PROJ=/tmp/proj-update-new
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

agent-harness install --track tooling --scope project >/dev/null
echo "✓ install 완료 (track=tooling)"

HARNESS_DIR="${PROJ}/.uzys-agent-harness"
DRIFT="${HARNESS_DIR}/spec-drift-check.sh"
PROTECT="${HARNESS_DIR}/protect-branch.sh"

# 전제 확인 — install 이 애초에 깔지 않는다면 이 시나리오는 update 가 아니라 install 을
# 검증하게 된다. 전제가 깨진 채 green 이 나오면 안 된다.
for f in "${DRIFT}" "${PROTECT}"; do
  if [[ ! -f "${f}" ]]; then
    echo "FAIL: install 이 ${f} 를 안 깔았다 — 이 시나리오의 전제가 성립하지 않는다"
    exit 1
  fi
done
echo "✓ 전제: install 이 스크립트 2종을 깐다"

# --- ① 구버전 설치본 모사: 스크립트가 없는 상태 → update ---
rm -rf "${HARNESS_DIR:?}"/*.sh
if [[ -f "${DRIFT}" ]]; then
  echo "FAIL: 삭제가 안 됐다 — 이후 판정이 무의미하다"
  exit 1
fi

set +e
agent-harness update >/tmp/new-assets.txt 2>&1
RC=$?
set -e

if [[ "${RC}" -ne 0 ]]; then
  echo "FAIL: update 가 exit ${RC}"
  tail -30 /tmp/new-assets.txt
  exit 1
fi

for f in "${DRIFT}" "${PROTECT}"; do
  if [[ ! -f "${f}" ]]; then
    echo "FAIL: update 후에도 ${f} 가 없다 — #283 이 재발했다"
    tail -30 /tmp/new-assets.txt
    exit 1
  fi
done
echo "✓ ① 없던 스크립트 2종을 update 가 설치"

# 화면에 남는가 — 조용히 늘어난 파일은 사용자가 자기 것으로 오인한다.
# 경로마다 한 줄로 나온다(다수일 때 한 줄에 이어 붙이면 화면이 무너진다).
if ! grep -q "added by this release" /tmp/new-assets.txt; then
  echo "FAIL: 신규 설치가 화면에 안 뜬다 — 사용자는 파일이 늘어난 걸 모른다"
  tail -30 /tmp/new-assets.txt
  exit 1
fi
if ! grep -q "spec-drift-check.sh.*added by this release" /tmp/new-assets.txt; then
  echo "FAIL: 어느 파일이 늘었는지가 안 보인다 — 건수만으로는 추적할 수 없다"
  tail -30 /tmp/new-assets.txt
  exit 1
fi
echo "✓ ① 신규 설치를 파일 이름과 함께 보고"

# --- ② 설치된 스크립트가 실제로 도는가 ---
# 파일이 있다는 것과 쓸 수 있다는 것은 다르다. 배포판 룰은 이걸 `ship` 인자로 부르라고 적는다.
mkdir -p "${PROJ}/docs"
printf '# Spec\n\n- [x] done\n' > "${PROJ}/docs/SPEC.md"
printf '# Todo\n\n- [x] done\n' > "${PROJ}/docs/todo.md"

set +e
bash "${DRIFT}" ship >/tmp/drift-run.txt 2>&1
DRC=$?
set -e
if [[ "${DRC}" -ne 0 ]]; then
  echo "FAIL: 설치된 spec-drift-check.sh 가 깨끗한 문서에 exit ${DRC} — 실행체가 아니라 파일뿐이다"
  cat /tmp/drift-run.txt
  exit 1
fi
echo "✓ ② 설치된 스크립트가 실제로 실행됨 (exit 0)"

set +e
bash "${PROTECT}" --dry-run >/tmp/protect-run.txt 2>&1
set -e
# 이 컨테이너에는 gh 가 없다. 그건 스크립트의 정상 경로 중 하나이고(안내 후 종료), gh 가 있는
# 환경에서는 적용 대상을 출력한다. 둘 다 "사용자가 다음에 뭘 할지 아는" 상태여야 한다 —
# 한쪽 경로만 단언하면 다른 환경에서 이 시나리오가 스크립트의 결함이 아닌 이유로 깨진다.
if [[ ! -s /tmp/protect-run.txt ]]; then
  echo "FAIL: protect-branch.sh --dry-run 이 아무 출력도 안 냈다 — 침묵은 안내가 아니다"
  exit 1
fi
if ! grep -qiE "gh .*not found|dry|rule|branch" /tmp/protect-run.txt; then
  echo "FAIL: 출력은 있으나 무엇을 하라는 안내가 아니다"
  cat /tmp/protect-run.txt
  exit 1
fi
echo "✓ ② protect-branch.sh --dry-run 이 안내를 출력 ($(head -c 40 /tmp/protect-run.txt | tr '\n' ' ')…)"

# --- ③ 룰 파일이 없으면 update 가 설치 ---
RULE="${PROJ}/.claude/rules/git-policy.md"
if [[ ! -f "${RULE}" ]]; then
  echo "FAIL: 전제 실패 — install 이 git-policy.md 를 안 깔았다"
  exit 1
fi
rm -f "${RULE}"

agent-harness update >/tmp/new-rule.txt 2>&1
if [[ ! -f "${RULE}" ]]; then
  echo "FAIL: 지워진 룰을 update 가 복구하지 못했다"
  tail -20 /tmp/new-rule.txt
  exit 1
fi
# 존재만 보면 빈 파일·손상본도 PASS 된다 — 내용까지 본다.
if [[ ! -s "${RULE}" ]] || ! grep -q "Git Safety" "${RULE}"; then
  echo "FAIL: 복구된 룰이 비었거나 내용이 다르다 — 파일 존재는 도달의 증거가 아니다"
  head -5 "${RULE}"
  exit 1
fi
# 전에 깔아 준 파일이므로 '신규'가 아니라 '복구'로 보고돼야 한다.
if ! grep -q "was missing — reinstalled" /tmp/new-rule.txt; then
  echo "FAIL: 사용자가 지운 파일을 '이번 릴리즈 추가'로 보고한다 — 오귀인이다"
  tail -20 /tmp/new-rule.txt
  exit 1
fi
echo "✓ ③ 없던 룰을 내용까지 복구 + '복구'로 정확히 보고"

# --- ④ 사용자가 고친 파일은 덮어쓰지 않는다 ---
printf '# MY OWN SCRIPT\n' > "${DRIFT}"
agent-harness update >/dev/null 2>&1
if ! grep -q "MY OWN SCRIPT" "${DRIFT}"; then
  echo "FAIL: 사용자가 고친 스크립트를 신규 설치 경로가 덮어썼다"
  exit 1
fi
echo "✓ ④ 사용자 편집분은 그대로 (신규 설치가 갱신 경로를 침범하지 않는다)"

# --- ⑤ 트랙 밖 룰은 들이지 않는다 ---
# tooling 트랙에 UI 룰(playwright-launch)이 깔리면 그건 Track 혼입이다.
if [[ -f "${PROJ}/.claude/rules/playwright-launch.md" ]]; then
  echo "FAIL: tooling 트랙에 UI 룰이 깔렸다 — update 가 트랙을 무시했다"
  exit 1
fi
echo "✓ ⑤ 트랙 밖 룰 미설치 (Track 혼입 없음)"

# --- ⑥ codex 전용 설치본에 `.claude/` 를 들이지 않는다 (독립 리뷰 HIGH-1) ---
# install 은 claude 를 고른 설치본에만 `.claude/` 를 만든다. update 에 그 술어가 없으면
# codex 로 깐 프로젝트에 고른 적 없는 CLI 의 하네스가 통째로 들어간다.
CODEX_PROJ=/tmp/proj-update-codex
rm -rf "${CODEX_PROJ}"; mkdir -p "${CODEX_PROJ}"; cd "${CODEX_PROJ}"
agent-harness install --track tooling --scope project --cli codex >/dev/null 2>&1

# 이 사용자는 Claude Code 도 쓴다 — 자기 `.claude/` 가 있다(그 상태가 도달 조건이다).
mkdir -p "${CODEX_PROJ}/.claude/agents"
printf 'my own agent\n' > "${CODEX_PROJ}/.claude/agents/my-own.md"

agent-harness update >/tmp/codex-update.txt 2>&1 || true

if [[ -f "${CODEX_PROJ}/.claude/settings.json" ]]; then
  echo "FAIL: codex 전용 설치본에 .claude/settings.json 이 생겼다 — 훅 배선과 외부 실행이 딸려 온다"
  exit 1
fi
if [[ -f "${CODEX_PROJ}/.claude/rules/git-policy.md" ]]; then
  echo "FAIL: codex 전용 설치본에 .claude/rules 가 생겼다 — 고른 적 없는 CLI 의 자산이다"
  exit 1
fi
if [[ ! -f "${CODEX_PROJ}/.claude/agents/my-own.md" ]]; then
  echo "FAIL: 사용자 자기 파일이 사라졌다"
  exit 1
fi
echo "✓ ⑥ codex 전용 설치본에 .claude/ 미유입 (사용자 자기 파일은 보존)"

# --- ⑦ 배선할 수 없는 훅은 깔지 않고 재설치를 안내한다 (독립 리뷰 HIGH-2) ---
cd "${PROJ}"
HOOK="${PROJ}/.claude/hooks/session-start.sh"
if [[ ! -f "${HOOK}" ]]; then
  echo "FAIL: 전제 실패 — install 이 훅을 안 깔았다"
  exit 1
fi
rm -f "${HOOK}"
agent-harness update >/tmp/hook-update.txt 2>&1

if [[ -f "${HOOK}" ]]; then
  echo "FAIL: update 가 훅 파일을 깔았다 — settings.json 배선이 없어 영영 안 도는 상태다"
  exit 1
fi
if ! grep -q "needs reinstall" /tmp/hook-update.txt; then
  echo "FAIL: 재설치 안내가 없다 — 사용자는 최신 상태라고 믿는다"
  tail -30 /tmp/hook-update.txt
  exit 1
fi
echo "✓ ⑦ 배선 불가 훅은 미설치 + 재설치 안내"

echo ""
echo "PASS: scenario-update-new-assets (전항 ①~⑦)"
