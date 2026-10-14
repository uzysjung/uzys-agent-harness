# ⓕ ⓐ 뒤 update → install --cli codex(재추가) → update → 전량 uninstall
bash /s/step.sh 1-install cur install --track tooling --cli claude --cli codex --scope project
bash /s/link.sh user-centered-explanation user-centered-explanation
bash /s/step.sh 2-cli-codex cur uninstall --cli codex
bash /s/step.sh 3-update cur update
bash /s/step.sh 4-readd-codex cur install --track tooling --cli codex --scope project
bash /s/step.sh 5-update2 cur update
bash /s/step.sh 6-dry-all cur uninstall --dry-run
bash /s/step.sh 7-uninstall-all cur uninstall --yes
