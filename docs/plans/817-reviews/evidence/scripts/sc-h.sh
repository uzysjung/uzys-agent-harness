bash /s/step.sh o ah-$1 install --track tooling --with frontend-design --cli claude --cli codex
bash /s/mine.sh .claude/skills/frontend-design/SKILL.md MINE-FD a
bash /s/mine.sh .agents/skills/frontend-design/SKILL.md MINE-AGFD a
bash /s/mine.sh .claude/skills/frontend-design/my-notes.md MINE-FDNOTE
bash /s/step.sh m true
bash /s/step.sh u ah-$1 update
bash /s/ub.sh u
