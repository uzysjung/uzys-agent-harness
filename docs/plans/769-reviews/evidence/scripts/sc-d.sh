# ⓓ claude+codex+opencode → 링크 → --cli codex (opencode 가 남아 .agents 사용) → --cli opencode (마지막 .agents 사용자)
bash /s/step.sh 1-install cur install --track tooling --cli claude --cli codex --cli opencode --scope project
bash /s/link.sh user-centered-explanation user-centered-explanation
bash /s/snap.sh 2-linked
bash /s/step.sh 3-dry cur uninstall --cli codex --dry-run
bash /s/step.sh 4-cli-codex cur uninstall --cli codex
bash /s/step.sh 5-dry-oc cur uninstall --cli opencode --dry-run
bash /s/step.sh 6-cli-opencode cur uninstall --cli opencode
