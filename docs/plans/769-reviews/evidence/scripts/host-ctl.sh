R=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/r769
docker run --rm --name rev-769-scen-main -u 0 -e HOME=/home/uzys -v $R/pk-main:/pk/main:ro -v $R/bin:/s:ro --entrypoint bash rev-769-br /s/ctl-in.sh > $R/ev/docker-scenario-main-control.log 2>&1
echo "exit=$?"
cat $R/ev/docker-scenario-main-control.log
