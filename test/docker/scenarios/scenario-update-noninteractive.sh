#!/usr/bin/env bash
# v26.131.0 — scenario-update-noninteractive: `agent-harness update` 가 **TTY 없이** 도는가.
#
# 왜 별도 시나리오인가: scenario-update-skills 는 같은 기능을 pty(`script -qec`)로 위저드를
# 구동해 검증한다. 그건 update 동작의 증거이지 **CI 사용 가능성의 증거가 아니다.** 여기서
# 검증하는 것은 정확히 그 지점 — 컨테이너에서 TTY 없이, 키 입력 없이, exit code 로 판정되는가.
# (`docker run` 을 `-t` 없이 돌리므로 이 스크립트 전체가 non-TTY 다.)
#
# 검증:
#   ① TTY 없이 update 실행 → exit 0 + 정책 파일 갱신
#   ② 편집분은 `.backup-<stamp>` 로 보존되고 최신판이 자리를 차지 (ADR-046)
#   ③ 설치가 없는 디렉터리에서 update → **exit 1** (조용히 성공하지 않는다)
#   ④ --project-dir 로 다른 디렉터리를 지정해도 동작 (cwd 의존 아님)

set -euo pipefail

echo "▸ scenario-update-noninteractive: update 가 TTY 없이 도는가"
echo ""

# TTY 가 정말 없는지 먼저 확인한다 — 있으면 이 시나리오는 자기가 검증하려는 조건을
# 만족하지 않은 채 green 이 된다.
if [ -t 0 ]; then
  echo "FAIL: stdin 이 TTY 다 — 이 시나리오는 non-TTY 조건에서만 의미가 있다 (docker run -t 제거)"
  exit 1
fi
echo "✓ non-TTY 확인 (CI 조건)"

PROJ=/tmp/proj-update-ni
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

agent-harness install --track tooling --scope project >/dev/null
echo "✓ install 완료"

SKILLS="${PROJ}/.claude/skills"
TARGET=$(find "${SKILLS}" -mindepth 2 -maxdepth 2 -name SKILL.md | head -1)
if [[ -z "${TARGET}" ]]; then
  echo "FAIL: SKILL.md 를 가진 스킬이 없다 — 검증 대상이 없다"
  exit 1
fi
TARGET_DIR=$(dirname "${TARGET}")

# --- ① 편집분이 있는 상태에서 비대화형 update ---
printf '\n<!-- CI EDIT -->\n' >> "${TARGET}"

set +e
agent-harness update >/tmp/ni-out.txt 2>&1
RC=$?
set -e

if [[ "${RC}" -ne 0 ]]; then
  echo "FAIL: update 가 exit ${RC} — TTY 없이 실행되지 않았다"
  tail -30 /tmp/ni-out.txt
  exit 1
fi
echo "✓ TTY 없이 exit 0"

if ! grep -q "Update complete" /tmp/ni-out.txt; then
  echo "FAIL: 'Update complete' 가 없다 — exit 0 이지만 아무것도 안 했을 수 있다"
  tail -30 /tmp/ni-out.txt
  exit 1
fi
echo "✓ Update 실제 수행 확인"

# --- ② 편집분 백업 + 최신판 활성 ---
BK=$(find "${TARGET_DIR}" -name '*.backup-*' | head -1)
if [[ -z "${BK}" ]] || ! grep -q "CI EDIT" "${BK}"; then
  echo "FAIL: 편집분이 백업되지 않았다 (사용자 작업 소실)"
  exit 1
fi
if grep -q "CI EDIT" "${TARGET}"; then
  echo "FAIL: 편집분이 자리에 남았다 — 갱신이 안 됐다"
  exit 1
fi
echo "✓ 편집분 백업 + 최신판 활성 (ADR-046)"

# --- ③ 설치 없는 곳에서는 fail loud ---
EMPTY=/tmp/proj-update-empty
rm -rf "${EMPTY}"; mkdir -p "${EMPTY}"; cd "${EMPTY}"

set +e
agent-harness update >/tmp/ni-empty.txt 2>&1
RC=$?
set -e

if [[ "${RC}" -eq 0 ]]; then
  echo "FAIL: 설치가 없는데 exit 0 — 조용한 성공은 CI 에서 최악이다"
  cat /tmp/ni-empty.txt
  exit 1
fi
if ! grep -q "agent-harness install" /tmp/ni-empty.txt; then
  echo "FAIL: 다음 행동 안내가 없다 — 실패했는데 뭘 해야 하는지 알 수 없다"
  cat /tmp/ni-empty.txt
  exit 1
fi
echo "✓ 설치 부재 시 exit ${RC} + 안내 출력"

# --- ④ --project-dir 로 cwd 밖 대상 지정 ---
cd /
set +e
agent-harness update --project-dir "${PROJ}" >/tmp/ni-dir.txt 2>&1
RC=$?
set -e

if [[ "${RC}" -ne 0 ]]; then
  echo "FAIL: --project-dir 경로가 exit ${RC}"
  tail -20 /tmp/ni-dir.txt
  exit 1
fi
if ! grep -q "Update complete" /tmp/ni-dir.txt; then
  echo "FAIL: --project-dir 로 지정했는데 update 가 안 돌았다"
  tail -20 /tmp/ni-dir.txt
  exit 1
fi
echo "✓ --project-dir 로 cwd 밖 프로젝트 갱신"

echo ""
echo "PASS: scenario-update-noninteractive"
