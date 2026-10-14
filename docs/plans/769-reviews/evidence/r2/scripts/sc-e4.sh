# ⓔ4 옛 판 26.125 claude+codex(외부 기록 모양이 옛것) → 링크(compaction-handoff — 26.125 에도 현행에도 있는 id) → (update 없이) 현행 --cli codex → 전량 uninstall
bash /s/step.sh 1-install v125 install --track tooling --cli claude --cli codex --scope project
bash /s/link.sh compaction-handoff compaction-handoff
bash /s/snap.sh 2-linked
bash /s/step.sh 3-dry cur uninstall --cli codex --dry-run
bash /s/step.sh 4-cli-codex cur uninstall --cli codex
bash /s/step.sh 5-update cur update
bash /s/step.sh 6-uninstall-all cur uninstall --yes
