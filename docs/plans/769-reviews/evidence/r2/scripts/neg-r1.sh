# neg-r1.sh — 수정 커밋의 새 테스트 3파일을 1차 코드(01b1498) 위에서 돌린다: 새 단언이 1차 결함을 무는지 (음성 대조)
R=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/r769
W=/Users/uzysjung/Development/Claude-Workspace/uzysClaudeUniversalEnv/.claude/worktrees/agent-a9c1c79c5b344a42c
rm -rf $R/src-r1 && mkdir -p $R/src-r1 && tar -xf $R/r1.tar -C $R/src-r1
ln -s $R/src-main/node_modules $R/src-r1/node_modules
cp $W/tests/claude-slot.test.ts $W/tests/uninstall-cli-scope.test.ts $W/tests/uninstall-legacy-fingerprints.test.ts $R/src-r1/tests/
cd $R/src-r1 && npx tsc --noEmit -p tsconfig.json > $R/ev/neg-r1-typecheck.log 2>&1; echo "typecheck exit=$?"
npx vitest run tests/claude-slot.test.ts tests/uninstall-cli-scope.test.ts tests/uninstall-legacy-fingerprints.test.ts > $R/ev/neg-r1-tests.log 2>&1; echo "vitest exit=$?"
grep -E "×|Tests  " $R/ev/neg-r1-tests.log
