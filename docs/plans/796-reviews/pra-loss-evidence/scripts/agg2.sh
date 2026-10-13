#!/usr/bin/env bash
# usage: agg2.sh <evdir>  -> one line per run
E=$1
echo "ver|cs|flow|LOST|backupOnlyAfterUn|installerContentRecordedAsHarness(step:path)|records|retiredClaims(1st update)|newBackups|nonzeroExit"
for d in $E/*/*/; do
  v=$(basename $(dirname $d)); n=$(basename $d); cs=${n%-*}; fl=${n##*-}
  s=$d/summary.txt; [ -f $s ] || continue; grep -q '^## step=un' $s || continue
  lost=$(grep '^TOK .* LOST ' $s | awk '{print $2}' | sort -u | tr '\n' ' ')
  bko=$(awk '/step=un/{f=1} f && /^TOK .* BACKUP /{print $2}' $s | sed 's/MINE-//' | tr '\n' ' ')
  mr=$(awk '/^## step=/{st=$2; sub("step=","",st)} st!="markers" && /^MINEREC .* recsha=same/{print st":"$2}' $s | grep -vE 'AGENTS.md|config.toml|settings.json|\.mcp\.json|opencode.json' | sort -u | tr '\n' ' ')
  recs=$(grep '^REC records=' $s | awk '{print $2}' | sort -u | tr '\n' ' ')
  first=$(grep -m1 -oE '^(o1|u1) exit' $d/log.txt | cut -d' ' -f1)
  rc=$(awk -v f="step=$first" '$0 ~ "## "f"$"{g=1} g && /^RETIRED-CLAIMS/{print; exit}' $s | cut -d: -f2 | wc -w | tr -d ' ')
  nb=$(for st in o1 u1 u2 u3 un; do c=$(grep -c "^$st NEWBACKUP" $d/log.txt); grep -q "^$st exit" $d/log.txt && printf '%s=%s ' $st $c; done)
  ex=$(grep exit $d/log.txt | grep -v 'exit=0' | tr '\n' ' ')
  echo "$v|$cs|$fl|${lost:--}|${bko:--}|${mr:--}|$recs|$rc|$nb|${ex:--}"
done
