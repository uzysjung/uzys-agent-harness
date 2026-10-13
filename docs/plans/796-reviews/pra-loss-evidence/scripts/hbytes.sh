#!/usr/bin/env bash
# harness-template bytes left after uninstall (non-backup files whose sha12 matches a bundle template)
S=$1; E=$2
awk '{print $1}' $S/template-hashes.txt | sort -u > /tmp/th.$$
for d in $E/*/*/; do [ -f $d/snap-un.txt ] || continue; n=$(basename $(dirname $d))/$(basename $d)
  hits=$(grep -v backup $d/snap-un.txt | awk '{print $1, $2}' | while read -r h p; do grep -qx "$h" /tmp/th.$$ && echo "$p"; done | tr '\n' ' ')
  echo "$n: ${hits:-0}"
done; rm -f /tmp/th.$$
