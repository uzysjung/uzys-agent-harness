cd /private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/rA/ev
jq -S . "$1-main/rec-$2.json" > /tmp/rA-rm
jq -S . "$1-br/rec-$2.json" > /tmp/rA-rb
diff /tmp/rA-rm /tmp/rA-rb && echo REC-IDENTICAL
