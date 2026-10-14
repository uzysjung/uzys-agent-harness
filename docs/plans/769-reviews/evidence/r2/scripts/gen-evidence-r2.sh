# gen-evidence-r2.sh — 2차 리뷰 증거를 docs/plans/769-reviews/evidence/r2/ 로
R=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/r769
W=/Users/uzysjung/Development/Claude-Workspace/uzysClaudeUniversalEnv/.claude/worktrees/agent-a9c1c79c5b344a42c
O=$W/docs/plans/769-reviews/evidence/r2
mkdir -p $O/cmp $O/regress $O/scripts
for sc in h e4 f i j j2 k k2 m n; do bash $R/bin/cmp2.sh main br2 $sc > $O/cmp/$sc.txt 2>&1; done
for sc in a d e1 e2 e3 g; do cp $R/ev/regress-$sc.txt $O/regress/$sc.txt; done
bash $R/bin/regress.sh > $O/regress/summary.txt 2>&1
cp $R/bin/*.sh $O/scripts/
cp $R/ev/docker-scenario-br2.log $R/ev/neg-r1-tests.log $R/ev/neg-r1-typecheck.log $O/
grep -E "Tests |Statements|Branches|Functions|Lines|CI_EXIT" $R/ci-r2.log > $O/ci-r2-summary.log
cd $R/ev && tar -czf $O/raw-r2.tgz *-br2 h-main e4-main f-main i-main j-main j2-main k-main k2-main m-main n-main
du -sh $O
