# ⓔ6 26.125 claude+codex → 현행 update → 링크 → 현행 --cli codex → 현행 전량 uninstall (update 가 기록을 채우면 e4 의 잔존이 사라지나)
bash /s/step.sh 1-install v125 install --track tooling --cli claude --cli codex --scope project
bash /s/step.sh 2-update cur update
bash /s/link.sh compaction-handoff compaction-handoff
bash /s/step.sh 3-cli-codex cur uninstall --cli codex
bash /s/step.sh 4-uninstall-all cur uninstall --yes
