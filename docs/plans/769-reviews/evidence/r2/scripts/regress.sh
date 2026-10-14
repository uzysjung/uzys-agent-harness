# regress.sh — 1차 브랜치(br) 와 수정 브랜치(br2) 를 1차 장면에서 대조: 스냅샷 + 화면(첫 줄 · 백업 시각 제외)
R=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/r769
for s in a d e1 e2 e3 g; do
  bash $R/bin/cmp2.sh br br2 $s > $R/ev/regress-$s.txt 2>&1
  nsnap=$(grep -c 'snapshot diff' $R/ev/regress-$s.txt); nid=$(grep -c '^IDENTICAL' $R/ev/regress-$s.txt)
  scr=0; tot=0
  for o in $R/ev/$s-br/*.out; do
    n=$(basename $o); tot=$((tot+1))
    if diff <(sed 1d $o | sed -E 's/[0-9]{8}T[0-9]{6}/TS/g' | grep -v CONTEXT) <(sed 1d $R/ev/$s-br2/$n | sed -E 's/[0-9]{8}T[0-9]{6}/TS/g' | grep -v CONTEXT) > /dev/null; then scr=$((scr+1)); else echo "  screen differs: $s $n"; fi
  done
  echo "$s: snapshots identical $nid/$nsnap · screens identical $scr/$tot"
done
