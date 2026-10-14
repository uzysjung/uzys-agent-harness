# ⓙ 현행 claude 단독 → 설치자 자기 스킬을 .agents/skills/objective-brief(하네스 id 와 같은 이름, 기록 없음)에 두고 링크 → update → 전량
bash /s/step.sh 1-install cur install --track tooling --cli claude --scope project
cd /w/p && mkdir -p .agents/skills/objective-brief && printf -- "---\nname: objective-brief\ndescription: MINE-OWN skill\n---\nMINE-OWN-BODY\n" > .agents/skills/objective-brief/SKILL.md
bash /s/link.sh objective-brief objective-brief
bash /s/snap.sh 2-own-linked
bash /s/step.sh 3-update cur update
bash /s/step.sh 4-dry-all cur uninstall --dry-run
bash /s/step.sh 5-uninstall-all cur uninstall --yes
cd /w/p && grep -rl "MINE-" . --exclude-dir=.git > /ev/$SC-$B/mine-where.txt 2>&1
true
