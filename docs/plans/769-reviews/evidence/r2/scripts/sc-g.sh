# ⓖ 링크 슬롯 본문 안에 설치자가 고친 파일 + 추가한 파일 → --cli codex → update → 전량 uninstall
bash /s/step.sh 1-install cur install --track tooling --cli claude --cli codex --scope project
bash /s/link.sh user-centered-explanation user-centered-explanation
cd /w/p && echo "MINE-EDIT-769" >> .agents/skills/user-centered-explanation/SKILL.md && echo "MINE-NOTES-769" > .agents/skills/user-centered-explanation/my-notes.md
bash /s/snap.sh 2-edited
bash /s/step.sh 3-dry cur uninstall --cli codex --dry-run
bash /s/step.sh 4-cli-codex cur uninstall --cli codex
bash /s/step.sh 5-update cur update
bash /s/step.sh 6-uninstall-all cur uninstall --yes
cd /w/p && (grep -rl "MINE-EDIT-769\|MINE-NOTES-769" . 2>&1 | grep -v '^./.git/' > /ev/$SC-$B/mine-where.txt; true)
