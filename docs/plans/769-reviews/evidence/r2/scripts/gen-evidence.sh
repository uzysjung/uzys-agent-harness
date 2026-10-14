# gen-evidence.sh — 리뷰 기록용 증거를 워크트리 docs/plans/769-reviews/evidence/ 로 모은다
R=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/r769
W=/Users/uzysjung/Development/Claude-Workspace/uzysClaudeUniversalEnv/.claude/worktrees/agent-a9c1c79c5b344a42c
O=$W/docs/plans/769-reviews/evidence
mkdir -p $O/cmp $O/scripts
for sc in a b b2 c d e1 e2 e3 e4 e5 e6 f f2 g h; do
  steps=$(ls $R/ev/$sc-br/ | sed -n 's/^snap-\(.*\)\.txt$/\1/p' | sort)
  bash $R/bin/cmp.sh $sc $steps 2>&1 | grep -v '^[<>] [FD] ./node_modules' > $O/cmp/$sc.txt
done
cp $R/bin/*.sh $O/scripts/
cp $R/ev/docker-scenario-br.log $R/ev/docker-scenario-main-control.log $R/ev/unit-negative-control-main.log $O/
tail -25 $R/ci.log > $O/ci-branch-tail.log
cp $R/raw.tgz $O/raw-screens-snapshots-logs.tgz
du -sh $O
