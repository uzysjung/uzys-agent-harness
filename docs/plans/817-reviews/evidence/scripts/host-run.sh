R=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/rA
docker run --rm --name review-a-help --tmpfs /home/uzys:rw,size=256m,uid=1001,gid=1001 --tmpfs /tmp:rw,size=256m -v $R/ah:/opt/ah:ro -v $R/bin:/b:ro --entrypoint bash uzys-harness-test:v26.64 /b/$1
