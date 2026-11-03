#!/usr/bin/env bash
# 하네스 설치는 컨테이너 안에서만 — 저장소는 읽기 전용, 시험 프로젝트만 쓰기
set -u
REPO=/Users/uzysjung/Development/Claude-Workspace/uzysClaudeUniversalEnv
PROJ="$1"
docker run --rm -v "$REPO:/repo:ro" -v "$PROJ:/proj" -w /proj node:20-bookworm \
  bash -c 'git init -q 2>/dev/null; node /repo/dist/index.js install --track ssr-nextjs --cli codex --cli antigravity --scope project < /dev/null > /proj/.install.log 2>&1; echo "install exit=$?"'
