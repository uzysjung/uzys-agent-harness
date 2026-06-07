#!/bin/bash
# PreToolUse(Bash) Hook — 실 CLI 설치/검증은 Docker 격리에서만 (호스트 글로벌 오염 방지).
#
# 근거: CLAUDE.md "실환경 검증(4-CLI native 인식, 실설치 등)은 반드시 Docker 격리 컨테이너에서".
#   호스트 ~/.claude / ~/.codex / ~/.opencode / ~/.gemini / npm -g 에 write 금지.
#   에이전트가 호스트에서 `claude-harness install` / `claude plugin install` 등을 직접 돌리면
#   파싱 통과 즉시 실 설치로 진행 → ~/.claude/plugins 오염 + repo package.json/_bmad 오염.
#   (2026-06-07 실제 발생: probe 가 호스트 오염 → 사후 정리 필요했음.)
#
# 동작: 위험 명령이 docker 래핑·CI·명시 허용 없이 들어오면 exit 2 (차단) + stderr 사유.
#   통과 조건: `docker run|exec|build` 포함 / CI / DOCKER_VERIFY_ALLOW=1·CATALOG_VERIFY_ALLOW=1 / 컨테이너 내부.
# 의존: jq 있으면 사용, 없으면 grep 폴백 (jq 미설치 환경 대응).

INPUT_JSON=$(cat)

if command -v jq &> /dev/null; then
  CMD=$(echo "$INPUT_JSON" | jq -r '.tool_input.command // ""' 2>/dev/null)
else
  CMD=$(echo "$INPUT_JSON" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"$//')
fi

[ -z "$CMD" ] && exit 0

# --- 통과(allow) 조건: 격리/명시 허용 ---
# 컨테이너 경유 실행은 호스트 무관 → 허용
echo "$CMD" | grep -qE 'docker[[:space:]]+(run|exec|build)' && exit 0
# CI 러너 (격리 env)
[ -n "${CI:-}" ] && exit 0
# 컨테이너 내부에서 hook 이 돌면 허용
[ -f /.dockerenv ] && exit 0
# 명시적 허용 토큰 (시나리오 스크립트가 컨테이너 안에서 세팅)
echo "$CMD" | grep -qE 'DOCKER_VERIFY_ALLOW=1|CATALOG_VERIFY_ALLOW=1' && exit 0

# --- 안전: 조회성 플래그는 실 설치 안 함 ---
echo "$CMD" | grep -qE -- '--help|--version|(^| )-h( |$)' && exit 0

# --- 차단(block) 패턴: 실 설치 트리거 ---
DANGER='(\bclaude-harness\b|dist/index\.js|dist/cli\.js)[^|;&]*\binstall\b|claude[[:space:]]+plugin[[:space:]]+(install|marketplace[[:space:]]+add)|\bskills[[:space:]]+add\b|\bbmad-method\b|\bget-shit-done-cc\b|verify-catalog\.mjs'

if echo "$CMD" | grep -qE "$DANGER"; then
  echo "차단: 실 CLI 설치/검증은 Docker 격리 컨테이너에서만 실행 (호스트 글로벌 오염 방지)." >&2
  echo "  근거: CLAUDE.md 실환경 검증 원칙 — ~/.claude, ~/.codex, ~/.opencode, ~/.gemini, npm -g write 금지." >&2
  echo "  통과법: test/docker/ 시나리오 사용 또는 'docker run …' 래핑." >&2
  echo "  의도적 격리 실행이면 컨테이너 안에서 DOCKER_VERIFY_ALLOW=1 설정." >&2
  exit 2
fi

exit 0
