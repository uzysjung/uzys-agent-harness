cd /private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/rA/ev
SC=$1; shift
for N in "$@"; do
  echo "== $SC snap-$N main vs br"
  sed -E "s/[.]backup-[0-9]{8}T[0-9]{6}-?[0-9]*/.backup-TS/g" "$SC-main/snap-$N.txt" > "/tmp/rA-m"
  sed -E "s/[.]backup-[0-9]{8}T[0-9]{6}-?[0-9]*/.backup-TS/g" "$SC-br/snap-$N.txt" > "/tmp/rA-b"
  diff /tmp/rA-m /tmp/rA-b && echo IDENTICAL
done
for X in br main; do echo "== tokens $X"; grep -v "^TOK  " "$SC-$X/summary.txt"; done
