S=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/r807
docker run --rm --name "review-807-$1-$2-$3" -v "$S/scripts:/s:ro" -v "$S/ev:/ev" -w /w/p review-807-x /s/run.sh "$1" "$2" "$3" > /dev/null 2>&1
echo "$1 $2 $3 rc=$?"
