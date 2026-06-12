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

# --- v2 정밀화 (2026-06-13): 명령 "텍스트 전체" 가 아니라 "실행되는 부분"만 검사 ---
# 배경: bare-word 매칭이 커밋 메시지(-m "...bmad-method...") / PR 본문 heredoc /
#   grep 인자의 단순 언급에도 발화 (코드품질 사이클 중 over-blocking 4회+ 실측)
#   → 단어 변형·문자열 조립 우회를 강요해 가드 신뢰를 깎음.
# fix: ① 첫 heredoc marker(<<) 라인 이후 본문 drop ② 따옴표 구간 strip.
# 한계: bash 완전 파싱 아님 — 본 hook 은 에이전트 "실수" 방지 가드다. 의도적 격리
#   실행은 어차피 DOCKER_VERIFY_ALLOW=1 경로가 정답이므로 우회 방어는 목표가 아님.
SCAN=$(printf '%s\n' "$CMD" | awk '{print} index($0,"<<"){exit}' \
  | sed -e "s/'[^']*'//g" -e 's/"[^"]*"//g')

# --- 차단(block) 패턴: 실 설치 트리거 ---
# ① 구조적 실행 패턴 — 해당 토큰 + install 류 동사 조합 자체가 실행 의도
DANGER_EXEC='(\bclaude-harness\b|dist/index\.js|dist/cli\.js)[^|;&]*\binstall\b|claude[[:space:]]+plugin[[:space:]]+(install|marketplace[[:space:]]+add)|\bskills[[:space:]]+add\b'
# ② 패키지/스크립트 이름 — 실행 형태(npx·node 인자 또는 명령 위치)일 때만.
#   bare 언급(grep 인자 등)은 ① strip 을 통과해도 여기 안 걸림.
# shellcheck disable=SC2016  # 리터럴 ERE — `(` 와 백틱은 명령 구분자 문자 클래스
DANGER_RUN='npx[[:space:]][^|;&]*(bmad-method|get-shit-done-cc)\b|(^|[|;&`(])[[:space:]]*(bmad-method|get-shit-done-cc)\b|node[[:space:]][^|;&]*verify-catalog\.mjs|(^|[|;&`(])[[:space:]]*[^[:space:]]*verify-catalog\.mjs'

if echo "$SCAN" | grep -qE "$DANGER_EXEC|$DANGER_RUN"; then
  echo "차단: 실 CLI 설치/검증은 Docker 격리 컨테이너에서만 실행 (호스트 글로벌 오염 방지)." >&2
  echo "  근거: CLAUDE.md 실환경 검증 원칙 — ~/.claude, ~/.codex, ~/.opencode, ~/.gemini, npm -g write 금지." >&2
  echo "  통과법: test/docker/ 시나리오 사용 또는 'docker run …' 래핑." >&2
  echo "  의도적 격리 실행이면 컨테이너 안에서 DOCKER_VERIFY_ALLOW=1 설정." >&2
  exit 2
fi

exit 0
