# ⓜ Claude 단독(26.161)으로 설치 → 설치자가 Claude 사본을 .agents/skills 로 옮기고 링크(#524 한 벌 운용, codex 없이) → 현행 update → 전량
#    한 스킬은 옮긴 뒤 고친다(MINE) — 새 옛 판 지문 회수 범위(usersOf)가 설치자 편집본을 지우지 않는지
bash /s/step.sh 1-install v161 install --track tooling --cli claude --scope project
cd /w/p && mkdir -p .agents/skills && mv .claude/skills/objective-brief .agents/skills/objective-brief && mv .claude/skills/north-star .agents/skills/north-star && echo "MINE-MOVED-EDIT" >> .agents/skills/north-star/SKILL.md
bash /s/link.sh objective-brief objective-brief
bash /s/link.sh north-star north-star
bash /s/snap.sh 2-moved-linked
bash /s/step.sh 3-update cur update
bash /s/step.sh 4-dry-all cur uninstall --dry-run
bash /s/step.sh 5-uninstall-all cur uninstall --yes
cd /w/p && grep -rl "MINE-" . --exclude-dir=.git > /ev/$SC-$B/mine-where.txt 2>&1
true
