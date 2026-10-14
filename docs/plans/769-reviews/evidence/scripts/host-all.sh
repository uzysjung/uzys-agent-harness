H=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/r769/bin/host-scene.sh
for s in "$@"; do
  bash $H $s main &
  bash $H $s br &
done
wait
