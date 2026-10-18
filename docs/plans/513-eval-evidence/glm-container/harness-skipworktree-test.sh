#!/usr/bin/env bash
# B2 직접 확인 — DeepSWE 과제 이미지(/app) 에 상류 CLAUDE.md 가 "있는" 상황을 만들고(커밋), 하네스 설치 →
# skip-worktree + .git/info/exclude 처리 → ⓐ 루트 CLAUDE.md 의 import 줄이 디스크에 남는가 ⓑ git status 가 설치 전과 같은가
# ⓒ 에이전트가 커밋한 뒤 `git diff <base> HEAD` 에 하네스 몫이 빠지는가.
set -u
cd /app || exit 2
export PATH="$HOME/.npm-global/bin:$PATH"; npm config set prefix "$HOME/.npm-global" >/dev/null 2>&1
git config user.email eval@local; git config user.name eval

echo "## 0) 상류 CLAUDE.md 를 만들어 커밋 (상류 저장소에 지시 파일이 있는 경우를 흉내)"
printf '# Upstream notes\n\nRun go test ./... before committing.\n' > CLAUDE.md
git add CLAUDE.md && git commit -qm "upstream: add CLAUDE.md" && BASE=$(git rev-parse HEAD) && echo "base=$BASE"
git status --porcelain > /tmp/status-before.txt; echo "status-before lines: $(wc -l < /tmp/status-before.txt)"

echo "## 1) 하네스 설치"
npm install -g --no-fund --no-audit @uzysjung/agent-harness@26.174.0 >/tmp/npm.log 2>&1 || { echo "npm install failed"; exit 3; }
agent-harness install --track base --cli claude > /tmp/install.log 2>&1; echo "install exit $?"
echo "## 설치 직후 git status"; git status --porcelain

echo "## 2) skip-worktree + exclude (pier-agent-b.py 와 같은 명령)"
for f in .gitignore CLAUDE.md AGENTS.md; do
  git ls-files --error-unmatch "$f" >/dev/null 2>&1 && git update-index --skip-worktree "$f" && echo "skip-worktree: $f"
done
printf '%s\n' .claude/ .uzys-agent-harness/ .mcp.json CLAUDE.md CLAUDE-uzys-harness.md .github/workflows/ci.yml AGENTS.md .agents/ >> .git/info/exclude
git status --porcelain > /tmp/status-after.txt
echo "## status diff (before vs after) — 비어야 한다"; diff /tmp/status-before.txt /tmp/status-after.txt && echo "SAME"

echo "## 3) 디스크의 CLAUDE.md — import 줄이 남아 있는가"
grep -n "uzys-harness\|@CLAUDE-uzys-harness.md\|^@" CLAUDE.md | head -5
echo "## .gitignore 하네스 줄 남아 있는가: $(grep -c 'agent-harness' .gitignore)"

echo "## 4) 에이전트 흉내 — 소스 1줄 고치고 git add . && commit"
echo "// eval-513 agent edit" >> main.go 2>/dev/null || echo "// eval" >> README.md
git add . && git commit -qm "agent work" && echo "committed"
echo "## git diff \$BASE HEAD --stat (하네스 파일이 없어야 한다)"
git diff --stat "$BASE" HEAD
echo "## 하네스 경로가 diff 에 있나: $(git diff "$BASE" HEAD --name-only | grep -cE '^(\.claude/|\.uzys-agent-harness/|\.mcp\.json|CLAUDE|\.gitignore|\.github/workflows/ci\.yml)')"
echo "## 한계 확인 — 에이전트가 CLAUDE.md 를 고의로 고치면"
echo "agent line" >> CLAUDE.md; git add . ; git commit -qm "agent edits CLAUDE.md" 2>/dev/null; echo "CLAUDE.md in diff: $(git diff "$BASE" HEAD --name-only | grep -c '^CLAUDE.md$') (skip-worktree 라 0 — model.patch 사후 점검으로만 보인다)"
