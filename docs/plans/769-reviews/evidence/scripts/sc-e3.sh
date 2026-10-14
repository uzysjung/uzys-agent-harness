# ⓔ3 옛 판 26.161 claude+codex → 링크 → (update 없이) 현행 --cli codex  — 기록 없는 옛 판 사본 경로
bash /s/step.sh 1-install v161 install --track tooling --cli claude --cli codex --scope project
bash /s/link.sh user-centered-explanation user-centered-explanation
bash /s/snap.sh 2-linked
bash /s/step.sh 3-dry cur uninstall --cli codex --dry-run
bash /s/step.sh 4-cli-codex cur uninstall --cli codex
