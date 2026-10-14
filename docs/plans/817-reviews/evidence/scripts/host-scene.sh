R=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/rA
mkdir -p "$R/ev"
docker run --rm --name "review-a-$1-$2" --tmpfs /home/uzys:rw,size=512m,uid=1001,gid=1001,exec --tmpfs /tmp:rw,size=512m,exec --tmpfs /w:rw,size=512m,uid=1001,gid=1001,exec -v "$R/ah:/opt/ah:ro" -v "$R/bin:/s:ro" -v "$R/w:/w2:ro" -v "$R/ev:/ev" --entrypoint bash uzys-harness-test:v26.64 /s/run.sh "$1" "$2" > "$R/ev/run-$1-$2.log" 2>&1
echo "$1 $2 rc=$?"
