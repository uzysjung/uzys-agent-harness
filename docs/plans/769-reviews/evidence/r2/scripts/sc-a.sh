# ⓐ 현행 claude+codex → 단일 id 링크 → --cli codex 미리보기 · 실행
bash /s/step.sh 1-install cur install --track tooling --cli claude --cli codex --scope project
bash /s/link.sh user-centered-explanation user-centered-explanation
bash /s/snap.sh 2-linked
bash /s/step.sh 3-dry cur uninstall --cli codex --dry-run
bash /s/step.sh 4-cli-codex cur uninstall --cli codex
