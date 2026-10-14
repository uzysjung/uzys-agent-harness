E=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/r807/ev
for r in "$E"/*-pr; do
  n=$(basename "$r" -pr); m="$E/$n-main"
  echo "=== $n"
  echo "exits pr: $(grep -h exit "$r/log.txt" | paste -sd' ')"
  echo "exits main: $(grep -h exit "$m/log.txt" | paste -sd' ')"
  last=$(grep '^## ' "$r/summary.txt" | tail -1)
  echo "last step: $last"
  awk -v L="$last" '$0==L' "$r/summary.txt" > /dev/null
  sed -n "/^$last\$/,\$p" "$r/summary.txt" | grep -E '^(TOK|DISPLACED)' | sed -e 's/backup-[0-9T]*/bk/g' | cut -d' ' -f1-3 > /tmp/a
  sed -n "/^$last\$/,\$p" "$m/summary.txt" | grep -E '^(TOK|DISPLACED)' | sed -e 's/backup-[0-9T]*/bk/g' | cut -d' ' -f1-3 > /tmp/b
  echo "pr tokens/displaced:"; paste -sd'|' /tmp/a
  echo "diff pr<>main:"; diff /tmp/a /tmp/b | grep '^[<>]'
  lf=$(ls "$r"/snap-*.txt | grep -v markers | xargs ls -t | head -1)
  b=$(basename "$lf")
  grep -v -e node_modules -e backup "$r/$b" > /tmp/ra; grep -v -e node_modules -e backup "$m/$b" > /tmp/rb
  echo "live diff ($b) pr<>main:"; diff /tmp/ra /tmp/rb | grep '^[<>]'
  echo "backups pr=$(grep -c backup "$r/$b") main=$(grep -c backup "$m/$b")"
done
