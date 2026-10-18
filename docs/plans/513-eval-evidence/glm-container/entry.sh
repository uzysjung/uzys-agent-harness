#!/usr/bin/env bash
# eval-513-glm 컨테이너 진입점.
# - 토큰이 환경변수로 들어왔는지만 본다 (값은 출력하지 않는다).
# - 비대화 실행이 묻지 않도록 온보딩 플래그를 쓴다. 로그인 정보는 없다 — ANTHROPIC_AUTH_TOKEN 이 전부다.
set -euo pipefail

if [ -z "${ANTHROPIC_AUTH_TOKEN:-}" ]; then
  echo "[eval-entry] ANTHROPIC_AUTH_TOKEN 이 없다 — docker run --env-file <저장소 밖 파일> 로 넘긴다" >&2
fi

mkdir -p "$HOME/.claude"
# 온보딩 · 트러스트 다이얼로그를 건너뛴다. 값은 공개 문서에 없는 내부 키라 '없으면 한 번 묻는다' 정도의 영향이다.
if [ ! -f "$HOME/.claude.json" ]; then
  printf '{"hasCompletedOnboarding": true, "theme": "dark"}\n' > "$HOME/.claude.json"
fi

exec "$@"
