#!/usr/bin/env bash
set -u
S=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/r769
W=/Users/uzysjung/Development/Claude-Workspace/uzysClaudeUniversalEnv/.claude/worktrees/agent-a9c1c79c5b344a42c
mkdir -p $S/pk-br $S/pk-main $S/pk-old $S/src-main
tar -xf $S/main.tar -C $S/src-main
cd $S/src-main && npm ci --no-audit --no-fund >/dev/null 2>&1; npm run build >/dev/null 2>&1; echo build-main=$?
npm pack --pack-destination $S/pk-main 2>&1 | tail -1
cd $W && npm pack --pack-destination $S/pk-br 2>&1 | tail -1
cd $S/pk-old && for v in 26.161.0 26.170.0; do npm pack @uzysjung/agent-harness@$v 2>&1 | tail -1; done
ls -la $S/pk-*
