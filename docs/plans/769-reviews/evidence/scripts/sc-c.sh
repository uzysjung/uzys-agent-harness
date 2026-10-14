# ⓒ 다른 id 를 가리키는 링크 (.claude/skills/user-centered-explanation → .agents/skills/audit-harness-fit)
bash /s/step.sh 1-install cur install --track tooling --cli claude --cli codex --scope project
bash /s/link.sh user-centered-explanation audit-harness-fit
bash /s/snap.sh 2-linked
bash /s/step.sh 3-dry cur uninstall --cli codex --dry-run
bash /s/step.sh 4-cli-codex cur uninstall --cli codex
