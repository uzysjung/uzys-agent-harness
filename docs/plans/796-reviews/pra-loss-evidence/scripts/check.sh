#!/usr/bin/env bash
# usage: check.sh <step> ; cwd = project ; writes to $D
set -uo pipefail
step=$1
REC=.uzys-agent-harness/.harness-install.json; [ -f "$REC" ] || REC=.claude/.harness-install.json
{
  echo "## step=$step"
  while read -r tok; do
    [ -z "$tok" ] && continue
    live=$(grep -rlwF -- "$tok" . --exclude-dir=.git 2>/dev/null | grep -v backup | tr '\n' ' ')
    bk=$(grep -rlwF -- "$tok" . --exclude-dir=.git 2>/dev/null | grep backup | tr '\n' ' ')
    if [ -n "$live" ]; then st=LIVE; elif [ -n "$bk" ]; then st=BACKUP; else st=LOST; fi
    echo "TOK $tok $st live=[$live] bk=[$bk]"
  done < "$D/tokens-before.txt"
  if [ -f "$REC" ]; then
    echo "REC records=$(jq -r '.records // "-"' "$REC") keys=$(jq -c 'keys' "$REC")"
    # harness entries whose live path contains MINE
    jq -r '(.policyFiles//[])[]|".claude/"+.path+"\t"+(.sha256//"nosha")' "$REC" > /tmp/re.$$
    jq -r '(.skillFiles//[])[]|".claude/skills/"+.path+"\t"+(.sha256//"nosha")' "$REC" >> /tmp/re.$$
    jq -r '(.externalFiles//[])[]|.path+"\t"+(.sha256//"nosha")' "$REC" >> /tmp/re.$$
    while IFS=$'\t' read -r p sha; do
      if [ -f "$p" ] && grep -qF MINE- "$p"; then
        cur=$(sha256sum "$p" | cut -c1-64); m=$([ "$cur" = "$sha" ] && echo same || echo diff)
        echo "MINEREC $p recsha=$m"
      fi
    done < /tmp/re.$$
    for p in $(cat "$D/mine-paths.txt"); do
      q=${p#./}
      if grep -qP "^\Q$q\E\t" /tmp/re.$$; then echo "MINEPATH-IN-HARNESS-REC $q live-has-MINE=$(grep -qF MINE- "$q" 2>/dev/null && echo y || echo n)"; fi
    done
    jq -r '(.rootFiles//[])[]|select(.change!=null)|"ROOT "+.path+" change="+.change' "$REC"
    echo "RETIRED-CLAIMS: $(for r in rules/code-style.md rules/error-handling.md rules/gates-taxonomy.md agents/code-reviewer.md hooks/hito-counter.sh; do jq -r --arg r $r '(.policyFiles//[])[]|select(.path==$r)|.path' "$REC"; done | tr '\n' ' ')"
    rm -f /tmp/re.$$
  else echo "REC none"; fi
  echo "BACKUPS total=$(find . -path ./.git -prune -o -name '*backup*' -print | grep -c .)"
} >> "$D/summary.txt"
