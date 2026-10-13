#!/usr/bin/env bash
# usage: agg.sh <evdir>
E=$1
echo "ver cs flow lost bkAfterUn mineRec(step:path) records newbk(per-step) retiredClaimsAfterU1 nonzeroExits"
for d in $E/*/*/; do
  v=$(basename $(dirname $d)); n=$(basename $d); cs=${n%-*}; fl=${n##*-}
  s=$d/summary.txt; [ -f $s ] || continue
  lost=$(grep -c '^TOK .* LOST ' $s)
  bkun=$(awk '/step=un/{f=1} f && /^TOK .* BACKUP /' $s | wc -l | tr -d ' ')
  minerec=$(awk '/^## step=/{st=$2} /^MINEREC/{print st":"$2} /^MINEPATH-IN-HARNESS-REC .* live-has-MINE=y/{print st":"$2}' $s | sed 's/step=//' | sort -u | tr '\n' ',' )
  recs=$(grep '^REC records=' $s | awk '{print $2}' | sort -u | tr '\n' ' ')
  nb=$(for st in o1 u1 u2 u3 un; do c=$(grep -c "^$st NEWBACKUP" $d/log.txt); grep -q "^$st exit" $d/log.txt && printf '%s=%s ' $st $c; done)
  rc=$(awk '/step=u1/{f=1} f && /^RETIRED-CLAIMS/{print; exit}' $s | cut -d: -f2 | wc -w | tr -d ' ')
  ex=$(grep -v 'exit=0' $d/log.txt | grep exit | tr '\n' ' ')
  printf '%-9s %-13s %-4s %-5s %-4s %-30s %-9s %-26s %s %s\n' $v $cs $fl $lost $bkun "${minerec:--}" "$recs" "$nb" "$rc" "$ex"
done
