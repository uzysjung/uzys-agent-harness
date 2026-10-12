#!/usr/bin/env bash
# usage: run3.sh <version> <cliset> <scenario> ; scenario: ctxsec-A ctxsec-B ... crlf-Am ... blockedit-C blockedit-Cun dryrun
set -uo pipefail
V=$1; CS=$2; SC=$3; S=/scripts; OLD=/opt/old/$V/node_modules/.bin/agent-harness
strip() { sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'; }
clis_args() { local a=""; for c in ${1//+/ }; do a="$a --cli $c"; done; echo "$a"; }
snap() { (find . -path ./.git -prune -o -type f -print | sort | while read -r f; do printf '%s  %s\n' "$(sha256sum "$f" | cut -c1-12)" "$f"; done); }
P=/tmp/r3/$V-$CS-$SC; rm -rf $P; mkdir -p $P; cd $P; git init -q
D=/ev/x/$V/$CS-$SC; rm -rf $D; mkdir -p $D
step() { local name=$1; shift; "$@" > "$D/$name.txt" 2>&1; local rc=$?; strip < "$D/$name.txt" > "$D/$name.t" && mv "$D/$name.t" "$D/$name.txt"; echo "$name exit=$rc" >> "$D/log.txt"; cp AGENTS.md "$D/AGENTS-$name.md" 2>/dev/null; ls -1 | grep -c '^AGENTS.md.backup-' | sed "s/^/$name agents-backups=/" >> "$D/log.txt"; }
chk() { node $S/check.mjs "$P" "$D" "$1" "$D/AGENTS-old0.md" - >> "$D/summary.txt"; }
step old-install $OLD install --track tooling $(clis_args $CS); cp AGENTS.md $D/AGENTS-old0.md
VAR=${SC%%-*}; FL=${SC#*-}
case $FL in *m) NEW=ah-main;; *) NEW=agent-harness;; esac
if [ "$VAR" = blockedit ]; then
  MUT=full node $S/mutate2.mjs $P $D; grep -rhoE 'MINE-[A-Z0-9-]*[A-Z0-9]' . --exclude-dir=.git | sort -u > $D/tokens-before.txt
  step u169 ah-main update; node $S/mut3.mjs $P $D blockedit || echo "mut3 fail" >> $D/log.txt; echo MINE-BLOCKEDIT >> $D/tokens-before.txt; cp AGENTS.md $D/AGENTS-1-mutated.md
  [ "$FL" = C ] && { step u1 agent-harness update; chk u1; step u2 agent-harness update; chk u2; }
  step un agent-harness uninstall --yes; chk un
elif [ "$VAR" = dryrun ]; then
  MUT=full node $S/mutate2.mjs $P $D; snap > $D/snap-before.txt
  step dry agent-harness uninstall --dry-run; snap > $D/snap-after.txt; cmp -s $D/snap-before.txt $D/snap-after.txt && echo "dryrun: no change" >> $D/summary.txt || echo "dryrun: CHANGED" >> $D/summary.txt
  step udry agent-harness update --help >/dev/null
else
  MUT=none node $S/mutate2.mjs $P $D; node $S/mut3.mjs $P $D $VAR; cp AGENTS.md $D/AGENTS-1-mutated.md
  grep -rhoE 'MINE-[A-Z0-9-]*[A-Z0-9]' . --exclude-dir=.git | sort -u > $D/tokens-before.txt
  case $FL in A|Am) step u1 $NEW update; chk u1; step u2 $NEW update; chk u2;; esac
  step un $NEW uninstall --yes; chk un
fi
