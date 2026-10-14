R=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/rA
SRC=$R/src-main
[ "$2" = br ] && SRC=/Users/uzysjung/Development/Claude-Workspace/uzysClaudeUniversalEnv/.claude/worktrees/agent-ad52e8ca178ec38bb
docker run --rm --name "review-a-scen-$1-$2" -e HOME=/home/uzys -e PATH=/opt/ah/$2/node_modules/.bin:/usr/local/bin:/usr/bin:/bin --tmpfs /home/uzys:rw,size=1g,uid=1001,gid=1001,exec --tmpfs /tmp:rw,size=1g,exec -v "$SRC:/work:ro" -v "$R/ah:/opt/ah:ro" uzys-harness-test:v26.64 "/work/test/docker/scenarios/scenario-$1.sh" > "$R/ev/scen-$1-$2.log" 2>&1
echo "$1 $2 rc=$?"
