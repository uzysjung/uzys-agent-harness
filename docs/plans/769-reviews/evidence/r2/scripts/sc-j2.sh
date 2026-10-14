# ⓙ2 현행 claude+codex → (링크 없이) --cli codex → 설치자가 자기 스킬을 .agents/skills/objective-brief 에 새로 두고 링크 → update → 전량
bash /s/step.sh 1-install cur install --track tooling --cli claude --cli codex --scope project
bash /s/step.sh 2-cli-codex cur uninstall --cli codex
cd /w/p && rm -rf .claude/skills/objective-brief && mkdir -p .agents/skills/objective-brief && printf -- "---\nname: objective-brief\ndescription: MINE-OWN skill\n---\nMINE-OWN-BODY\n" > .agents/skills/objective-brief/SKILL.md
bash /s/link.sh objective-brief objective-brief
bash /s/snap.sh 3-own-linked
bash /s/step.sh 4-update cur update
bash /s/step.sh 5-uninstall-all cur uninstall --yes
cd /w/p && grep -rl "MINE-" . --exclude-dir=.git > /ev/$SC-$B/mine-where.txt 2>&1
true
