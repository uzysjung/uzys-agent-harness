#!/usr/bin/env bash
# DeepSWE 과제 이미지(/app = 과제 저장소) 안에 하네스를 설치하면 git 이 무엇을 보는가 — B 구성의 산출물 오염 확인용.
set -u
cd /app || exit 2
echo "## node/npm 유무"; command -v node && node --version; command -v npm && npm --version
echo "## 설치 전 git status"; git status --porcelain | head -5; echo "(end)"
export PATH="$HOME/.npm-global/bin:$PATH"; npm config set prefix "$HOME/.npm-global" >/dev/null 2>&1
npm install -g --no-fund --no-audit @uzysjung/agent-harness@26.174.0 >/tmp/npm.log 2>&1 || { echo "npm install failed"; tail -5 /tmp/npm.log; exit 3; }
echo "## agent-harness install --track base --cli claude"
agent-harness install --track base --cli claude > /tmp/install.log 2>&1; echo "exit $?"; tail -25 /tmp/install.log
echo "## 설치 후 git status (tracked 변경 · untracked)"; git status --porcelain | head -40
echo "## .gitignore diff"; git diff -- .gitignore | head -20
echo "## .claude/settings.json hooks"; grep -c "hooks" .claude/settings.json; ls .claude .claude/hooks 2>/dev/null
echo "## 기록"; ls .uzys-agent-harness/ 2>/dev/null
