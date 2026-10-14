# ⓔ2 옛 판 26.170 claude+codex → 현행 update → 링크 → --cli codex
bash /s/step.sh 1-install v170 install --track tooling --cli claude --cli codex --scope project
bash /s/step.sh 2-update cur update
bash /s/link.sh user-centered-explanation user-centered-explanation
bash /s/snap.sh 3-linked
bash /s/step.sh 4-dry cur uninstall --cli codex --dry-run
bash /s/step.sh 5-cli-codex cur uninstall --cli codex
