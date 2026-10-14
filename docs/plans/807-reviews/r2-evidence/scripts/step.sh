N=$1; shift
NO_COLOR=1 FORCE_COLOR=0 "$@" > "$D/$N.txt" 2>&1
echo "$N exit=$?" >> "$D/log.txt"
find . -type f -print0 | sort -z | xargs -0 sha256sum | cut -c1-12,65- > "$D/snap-$N.txt"
R=.uzys-agent-harness/.harness-install.json
[ -f "$R" ] || R=.claude/.harness-install.json
cp "$R" "$D/rec-$N.json" || true
echo "## $N" >> "$D/summary.txt"
xargs -n1 bash /s/tok.sh < "$D/tokens.txt" >> "$D/summary.txt"
node /s/disp.js "$R" >> "$D/summary.txt"
