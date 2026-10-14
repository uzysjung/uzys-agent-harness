# ⓚ Codex 가 깔린 채 일반 update — 26.170 claude+codex → objective-brief 링크 + 본문 편집 → update (회귀 확인: 이중 백업 없나)
bash /s/step.sh 1-install v170 install --track tooling --cli claude --cli codex --scope project
bash /s/link.sh objective-brief objective-brief
cd /w/p && echo "MINE-OB-EDIT" >> .agents/skills/objective-brief/SKILL.md
bash /s/step.sh 2-update cur update
bash /s/step.sh 3-update-again cur update
