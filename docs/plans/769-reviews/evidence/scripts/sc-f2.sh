# ⓕ2 ⓐ 뒤 바로 전량 uninstall (update 없이)
bash /s/step.sh 1-install cur install --track tooling --cli claude --cli codex --scope project
bash /s/link.sh user-centered-explanation user-centered-explanation
bash /s/step.sh 2-cli-codex cur uninstall --cli codex
bash /s/step.sh 3-dry-all cur uninstall --dry-run
bash /s/step.sh 4-uninstall-all cur uninstall --yes
