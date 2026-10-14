# ⓗ 26.170 claude+codex → objective-brief 링크(26.170 판 본문 ≠ 현행) → 현행 --cli codex → 현행 update (남긴 본문이 갱신되나) → install --cli claude(add)
bash /s/step.sh 1-install v170 install --track tooling --cli claude --cli codex --scope project
bash /s/link.sh objective-brief objective-brief
bash /s/step.sh 2-cli-codex cur uninstall --cli codex
bash /s/step.sh 3-update cur update
bash /s/step.sh 4-update-again cur update
bash /s/step.sh 5-add-claude cur install --track tooling --cli claude --scope project
