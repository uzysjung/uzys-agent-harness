# host-all2.sh SCENE... — 각 장면을 main 과 br2 로 병렬 실행 (레인 전용 컨테이너 이름)
H=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/r769/bin/host-scene.sh
for s in "$@"; do
  [ -d /private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/r769/ev/$s-main ] || bash $H $s main &
  bash $H $s br2 &
done
wait
