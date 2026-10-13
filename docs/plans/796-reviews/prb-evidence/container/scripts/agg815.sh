#!/usr/bin/env bash
# usage: agg815.sh <evdir> <template-hashes>
E=$1; TH=$2; awk '{print $1}' $TH | sort -u > /tmp/th.$$
printf '%-9s %-13s %-4s %-5s %-6s %-28s %-8s %s\n' ver cs flow LOST bkOnly newbk records harnessBytesAfterUn
for d in $E/*/*/; do v=$(basename $(dirname $d)); n=$(basename $d); cs=${n%-*}; fl=${n##*-}; s=$d/summary.txt; [ -f $s ] || continue
  lost=$(awk '/step=un/{f=1} f && /^TOK .* LOST /{print $2}' $s | tr '\n' ',')
  lostany=$(grep '^TOK .* LOST ' $s | awk '{print $2}' | sort -u | tr '\n' ',')
  bk=$(awk '/step=un/{f=1} f && /^TOK .* BACKUP /' $s | wc -l | tr -d ' ')
  nb=$(for st in o1 u1 u2 u3 un; do grep -q "^$st exit" $d/log.txt && printf '%s=%s ' $st $(grep -c "^$st NEWBACKUP" $d/log.txt); done)
  recs=$(grep '^REC records=' $s | awk '{print $2}' | sort -u | tr '\n' ' ')
  hb=$(grep -v backup $d/snap-un.txt 2>/dev/null | while read -r h p; do grep -qx "$h" /tmp/th.$$ && echo "$p"; done | tr '\n' ' ')
  ex=$(grep exit= $d/log.txt | grep -v 'exit=0' | tr '\n' ' ')
  printf '%-9s %-13s %-4s %-5s %-6s %-28s %-8s %s %s\n' $v $cs $fl "${lostany:-0}" $bk "$nb" "$recs" "${hb:-0}" "$ex"
done; rm -f /tmp/th.$$
