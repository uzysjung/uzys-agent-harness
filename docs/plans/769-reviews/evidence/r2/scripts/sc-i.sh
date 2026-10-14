# ⓘ 26.170 claude+codex → objective-brief · audit-harness-fit 링크 → --cli codex → 링크 본문에 설치자 편집·추가·삭제 → update ×2 → 전량
bash /s/step.sh 1-install v170 install --track tooling --cli claude --cli codex --scope project
bash /s/link.sh objective-brief objective-brief
bash /s/link.sh audit-harness-fit audit-harness-fit
bash /s/step.sh 2-cli-codex cur uninstall --cli codex
cd /w/p
echo "MINE-OB-EDIT" >> .agents/skills/objective-brief/SKILL.md
echo "MINE-OB-NOTES" > .agents/skills/objective-brief/my-notes.md
echo "MINE-APPLY-EDIT" >> .agents/skills/audit-harness-fit/references/apply.md
echo "MINE-REF" > .agents/skills/audit-harness-fit/references/my-ref.md
rm -f .agents/skills/audit-harness-fit/evals/scenarios.yaml
bash /s/snap.sh 3-edited
bash /s/step.sh 4-update cur update
bash /s/step.sh 5-update-again cur update
bash /s/step.sh 6-uninstall-all cur uninstall --yes
cd /w/p && grep -rl "MINE-" . --exclude-dir=.git > /ev/$SC-$B/mine-where.txt 2>&1
true
