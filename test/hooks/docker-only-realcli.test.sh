#!/bin/bash
# docker-only-realcli.sh hook 단위 테스트 — stdin JSON mock (cli-development rule 패턴).
#
# 실행: bash test/hooks/docker-only-realcli.test.sh
#   호스트 안전 — hook 자체는 grep/sed 텍스트 검사만 수행, 실 설치 0.
#
# WHY: v2 정밀화(2026-06-13)의 양방향 회귀 방지.
#   - block 케이스가 뚫리면 → 호스트 글로벌 오염 가드 상실 (2026-06-07 오염 사고 재발)
#   - allow 케이스가 막히면 → over-blocking 재발 (커밋 메시지/PR 본문/grep 인자 언급에
#     발화해 단어 변형·문자열 조립 우회를 강요 — 코드품질 사이클 중 4회+ 실측)
set -u

HOOK="$(cd "$(dirname "$0")/../.." && pwd)/.claude/hooks/docker-only-realcli.sh"
PASS=0
FAIL=0

# $1=command 텍스트 → hook 실행, exit code 반환. CI env 는 비워 allow 단락 방지.
run_hook() {
  CMD_TEXT="$1" python3 -c 'import json,os; print(json.dumps({"tool_input":{"command":os.environ["CMD_TEXT"]}}))' \
    | CI='' bash "$HOOK" >/dev/null 2>&1
}

expect_block() { # $1=설명 $2=command
  if run_hook "$2"; then
    echo "  ✗ FAIL(block 기대, 통과됨): $1"
    FAIL=$((FAIL + 1))
  else
    echo "  ✓ block: $1"
    PASS=$((PASS + 1))
  fi
}

expect_allow() { # $1=설명 $2=command
  if run_hook "$2"; then
    echo "  ✓ allow: $1"
    PASS=$((PASS + 1))
  else
    echo "  ✗ FAIL(allow 기대, 차단됨): $1"
    FAIL=$((FAIL + 1))
  fi
}

echo "━━ block: 실 설치 트리거 (호스트 오염 가드 유지) ━━"
expect_block "claude-harness install 직접 실행" \
  'claude-harness install --track tooling'
expect_block "dist CLI install 실행" \
  'node dist/index.js install --track tooling --cli claude'
expect_block "claude plugin install" \
  'claude plugin install ecc@every-claude-code'
expect_block "claude plugin marketplace add" \
  'claude plugin marketplace add anthropics/claude-code'
expect_block "npx skills add" \
  'npx skills add vercel-labs/agent-skills'
expect_block "npx bmad 실행 (pinned 포함)" \
  'npx bmad-method@6.8.0 install -i'
expect_block "npx -y gsd 실행" \
  'npx -y get-shit-done-cc@1.42.3'
expect_block "bmad 직접 실행 (명령 위치)" \
  'bmad-method install'
expect_block "구분자 뒤 bmad 실행" \
  'cd /tmp/x && bmad-method install'
expect_block "node 로 catalog verify 실행" \
  'node scripts/verify-catalog.mjs'
expect_block "catalog verify 직접 실행" \
  './scripts/verify-catalog.mjs --all'

echo "━━ allow: 격리/조회 (기존 동작 유지) ━━"
expect_allow "docker run 래핑 (격리)" \
  'docker run --rm harness-test bash -c "claude-harness install --track tooling"'
expect_allow "조회성 --help" \
  'claude-harness install --help'
expect_allow "무관 명령" \
  'ls -la src/'

echo "━━ allow: 단순 언급 (v2 over-blocking 해소 — 회귀 방지 핵심) ━━"
expect_allow "커밋 메시지 안 패키지명 언급" \
  'git commit -m "feat: bmad-method 6.8.0 pinning + Docker 검증"'
expect_allow "커밋 메시지 안 스크립트명 언급" \
  "git commit -m 'docs: verify-catalog.mjs exhaustiveness 가드'"
expect_allow "grep bare 인자 패키지명" \
  'grep -rn bmad-method src/external-assets.ts'
expect_allow "grep 따옴표 패턴 (plugin install 문구)" \
  'grep -n "claude plugin install" docs/USAGE.md'
expect_allow "echo 텍스트 출력" \
  'echo get-shit-done-cc'
# shellcheck disable=SC2016  # 테스트 데이터 — $( 미확장이 의도 (hook 에 들어갈 명령 텍스트)
expect_allow "PR 본문 heredoc 안 실행 예시 언급" \
  'gh pr create --title "docs: scenario" --body "$(cat <<EOF
Docker scenario: npx bmad-method@6.8.0 install PASS
node scripts/verify-catalog.mjs 3/3 green
EOF
)"'

echo ""
echo "결과: ${PASS} pass / ${FAIL} fail"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
