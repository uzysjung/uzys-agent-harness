# ⓝ 26.170 claude+codex → objective-brief 링크 → --cli codex → 링크 본문의 SKILL.md 를 프로젝트 안 설치자 파일로의 파일 링크로 바꿈 → update (링크를 따라 설치자 파일을 덮지 않나)
bash /s/step.sh 1-install v170 install --track tooling --cli claude --cli codex --scope project
bash /s/link.sh objective-brief objective-brief
bash /s/step.sh 2-cli-codex cur uninstall --cli codex
cd /w/p && printf "MINE-OB-OWNFILE\n" > my-ob.md && rm .agents/skills/objective-brief/SKILL.md && ln -s ../../../my-ob.md .agents/skills/objective-brief/SKILL.md
bash /s/snap.sh 3-filelink
bash /s/step.sh 4-update cur update
cd /w/p && cat my-ob.md > /ev/$SC-$B/my-ob-after.txt
true
