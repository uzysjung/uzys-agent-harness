#!/usr/bin/env bash
E=$1
for d in $E/*/*/; do n=$(basename $d); case $n in *m|*r) continue;; esac
  m=${d%/}m; [ -f $m/summary.txt ] && grep -q 'step=un' $m/summary.txt && grep -q 'step=un' $d/summary.txt || continue
  v=$(basename $(dirname $d))
  a=$(awk '/step=un/{f=1} f&&/^TOK/{print $2,$3}' $d/summary.txt); b=$(awk '/step=un/{f=1} f&&/^TOK/{print $2,$3}' $m/summary.txt)
  td=$(diff <(echo "$a") <(echo "$b") | grep '^[<>]' | tr '\n' ' ')
  rd=$(diff $d/residual.txt $m/residual.txt | grep '^[<>]' | tr '\n' ' ')
  echo "$v $n | tokens(PR< >main): ${td:-same} | residual(PR< >main): ${rd:-same}"
done
