# ⓔ5 26.161 claude+codex → 링크 → 현행 --cli codex → 현행 전량 uninstall (기록 있는 옛 판 — 끝에 회수되나)
bash /s/step.sh 1-install v161 install --track tooling --cli claude --cli codex --scope project
bash /s/link.sh compaction-handoff compaction-handoff
bash /s/step.sh 2-cli-codex cur uninstall --cli codex
bash /s/step.sh 3-uninstall-all cur uninstall --yes
