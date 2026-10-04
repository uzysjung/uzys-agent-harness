#!/usr/bin/env bash
# ADR-100 (#658) — scenario-clone-teammate: 동료가 깔고 커밋한 저장소를 클론하면 아무 명령 없이 관리 상태인가.
#
# 왜 컨테이너인가: 유닛(`tests/commit-install-record.test.ts`)은 `runInstall` 을 직접 부른다. 설치자가 실제로 치는 것은
# 게시판 `agent-harness` 와 `git` 이고, 그 사이를 잇는 것은 **커밋된 설치 기록** 하나다 — 그 경로 전체를 한 번 밟는다.
#
# 검증:
#   ① install → git add · commit → git clone: 클론에 기록 · 보조 스크립트 3종이 오고 런타임 파일 둘은 안 온다
#   ② 클론에서 list exit 0 · update exit 0 뒤 `git status --porcelain` 빈 출력 · uninstall --dry-run exit 0
#   ③ 변형(N1): 원본에서 하네스 룰 하나를 고쳐 커밋 → 클론 pull → update: 그 파일 하나만 백업 · 작업트리 diff 1건 · 요약에 표시
#   ④ 이관: 26.163.0 으로 깐 저장소에 이 판 install → `.gitignore` 의 폴더 줄이 런타임 두 줄로 바뀌고 화면이 말한다
#      (26.163.0 은 npm 레지스트리에서 받는다 — 네트워크가 필요하다)
#   ⑤ 대조: 기록을 지운 클론 → list · update · uninstall --yes 셋 다 exit 1 · 첫 줄 동일 · 트리 불변 (판정은 기록이 한다)

set -euo pipefail

echo "▸ scenario-clone-teammate: 커밋된 설치 기록으로 클론이 관리 상태가 되는가 (#658)"
echo ""

g() { git -c user.name=t -c user.email=t@example.invalid -c commit.gpgsign=false "$@"; }
fail() { echo "FAIL: $*"; exit 1; }

ROOT=/tmp/clone-teammate
rm -rf "${ROOT}"
mkdir -p "${ROOT}/origin"
cd "${ROOT}/origin"
g init -q
printf 'node_modules/\n' >.gitignore

# --- ① 동료의 설치 + 커밋 + 클론 ---
agent-harness install --track tooling --cli claude >/tmp/ct-install.txt 2>&1 || {
  tail -30 /tmp/ct-install.txt; fail "install 이 실패했다"; }
# 런타임 파일 둘 — 기계마다 다르다. 클론으로 가면 안 된다
printf '2026-10-04T00:00:00Z\tprotect-files\t.env\n' >.uzys-agent-harness/hook-blocks.log
printf '[]\n' >.uzys-agent-harness/update-backups.json
g add .
g commit -q -m "harness"
g clone -q "${ROOT}/origin" "${ROOT}/clone"
cd "${ROOT}/clone"

[ -f .uzys-agent-harness/.harness-install.json ] || fail "클론에 설치 기록이 없다"
for s in protect-branch.sh spec-drift-check.sh check-absence.sh; do
  [ -f ".uzys-agent-harness/${s}" ] || fail "클론에 보조 스크립트 ${s} 가 없다"
done
for r in hook-blocks.log update-backups.json; do
  [ ! -e ".uzys-agent-harness/${r}" ] || fail "런타임 파일 ${r} 가 클론에 왔다 — .gitignore 가 그것을 무시하지 않는다"
done
echo "✓ 클론에 기록 · 스크립트 3종이 오고 런타임 파일 둘은 안 온다"

# --- ② 클론에서 세 명령 ---
agent-harness list >/tmp/ct-list.txt 2>&1 || { cat /tmp/ct-list.txt; fail "클론에서 list 가 실패했다"; }
grep -q tooling /tmp/ct-list.txt || { cat /tmp/ct-list.txt; fail "list 가 트랙을 말하지 않는다"; }
echo "✓ list exit 0 (기록을 읽는다)"

agent-harness update >/tmp/ct-update.txt 2>&1 || { tail -30 /tmp/ct-update.txt; fail "클론에서 update 가 실패했다"; }
PORCELAIN="$(g status --porcelain)"
[ -z "${PORCELAIN}" ] || { echo "${PORCELAIN}"; fail "같은 판 update 뒤 작업트리가 바뀌었다"; }
echo "✓ update exit 0 · git status --porcelain 빈 출력"

agent-harness uninstall --dry-run >/tmp/ct-uninstall.txt 2>&1 || {
  tail -30 /tmp/ct-uninstall.txt; fail "클론에서 uninstall --dry-run 이 실패했다"; }
echo "✓ uninstall --dry-run exit 0"

# --- ③ 변형(N1): 동료가 고친 하네스 룰 ---
RULE=.claude/rules/git-policy.md
cd "${ROOT}/origin"
printf '\n<!-- team edit -->\n' >>"${RULE}"
g commit -q -am "team edits a harness rule"
cd "${ROOT}/clone"
g pull -q
agent-harness update >/tmp/ct-update2.txt 2>&1 || { tail -30 /tmp/ct-update2.txt; fail "변형: update 가 실패했다"; }
BACKUPS="$(find .claude/rules -name 'git-policy.md.backup-*' | wc -l | tr -d ' ')"
[ "${BACKUPS}" = "1" ] || fail "변형: 고친 룰의 백업이 1건이 아니다 (${BACKUPS})"
CHANGED="$(g status --porcelain)"
[ "${CHANGED}" = " M ${RULE}" ] || { echo "${CHANGED}"; fail "변형: 작업트리 diff 가 그 룰 1건이 아니다"; }
grep -q "saved before replacing" /tmp/ct-update2.txt || {
  tail -30 /tmp/ct-update2.txt; fail "변형: 요약이 백업을 말하지 않는다"; }
echo "✓ 변형: 동료가 고친 룰 → 백업 1건 · diff 1건(${RULE}) · 요약에 표시"

# --- ⑤ 대조: 기록 없는 클론 — ② 의 초록이 "디스크에 파일이 있어서" 가 아님을 보인다 ---
g clone -q "${ROOT}/origin" "${ROOT}/clone-norecord"
cd "${ROOT}/clone-norecord"
rm -rf .uzys-agent-harness
tree_sha() { find . -path ./.git -prune -o -type f -print | LC_ALL=C sort | xargs sha256sum | sha256sum; }
BEFORE="$(tree_sha)"
FIRST=""
for cmd in list update "uninstall --yes"; do
  code=0
  # shellcheck disable=SC2086 # cmd 는 단어 둘까지 — 의도적 분할
  agent-harness ${cmd} >/tmp/ct-nr.txt 2>&1 || code=$?
  [ "${code}" = "1" ] || { cat /tmp/ct-nr.txt; fail "대조: 기록 없는 클론에서 ${cmd} 가 exit ${code} (1 이어야 한다)"; }
  line="$(grep -m1 . /tmp/ct-nr.txt)"
  [ -z "${FIRST}" ] && FIRST="${line}"
  [ "${line}" = "${FIRST}" ] || fail "대조: 첫 줄이 다르다 — '${FIRST}' vs '${line}'"
done
[ "$(tree_sha)" = "${BEFORE}" ] || fail "대조: 기록 없는 클론에서 세 명령이 디스크를 바꿨다"
echo "✓ 대조: 기록 없는 클론 → 세 명령 exit 1 · 첫 줄 동일(${FIRST}) · 트리 불변"

# --- ④ 이관: 26.163.0 으로 깐 저장소 ---
mkdir -p "${ROOT}/old"
cd "${ROOT}/old"
printf 'node_modules/\n' >.gitignore
# 따로 받는다 — 이 이미지의 전역 판도 package.json 버전이 같으면 `npx …@26.163.0` 이 그것을 집는다(실측)
OLD=/tmp/harness-26.163.0
npm install -q --prefix "${OLD}" @uzysjung/agent-harness@26.163.0 >/tmp/ct-old-npm.txt 2>&1 || {
  tail -30 /tmp/ct-old-npm.txt; fail "26.163.0 을 받지 못했다(네트워크?)"; }
"${OLD}/node_modules/.bin/agent-harness" install --track tooling --cli claude >/tmp/ct-old.txt 2>&1 || {
  tail -30 /tmp/ct-old.txt; fail "26.163.0 install 이 실패했다"; }
grep -qx '.uzys-agent-harness/' .gitignore || fail "전제: 26.163.0 이 폴더 줄을 쓰지 않았다"
agent-harness install --track tooling --cli claude >/tmp/ct-migrate.txt 2>&1 || {
  tail -30 /tmp/ct-migrate.txt; fail "이 판 install 이 실패했다"; }
! grep -qx '.uzys-agent-harness/' .gitignore || { cat .gitignore; fail "이관: 폴더 줄이 남았다"; }
for r in hook-blocks.log update-backups.json; do
  grep -qx ".uzys-agent-harness/${r}" .gitignore || { cat .gitignore; fail "이관: ${r} 줄이 없다"; }
done
grep -qx 'node_modules/' .gitignore || fail "이관: 설치자 줄이 사라졌다"
grep -q "commit .uzys-agent-harness/ so teammates get the install record" /tmp/ct-migrate.txt || {
  tail -30 /tmp/ct-migrate.txt; fail "이관: 화면이 바뀐 까닭을 말하지 않는다"; }
echo "✓ 이관: 26.163.0 의 폴더 줄 → 런타임 두 줄 · 설치자 줄 그대로 · 화면 안내"

echo ""
echo "PASS: scenario-clone-teammate"
