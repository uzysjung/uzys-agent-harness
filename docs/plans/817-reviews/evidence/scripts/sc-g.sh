bash /s/step.sh o ah-26.161.0 install --track tooling --cli claude --cli codex
bash /s/mine.sh .claude/skills/multi-model-debate/SKILL.md MINE-MMD
bash /s/mine.sh .agents/skills/multi-model-debate/SKILL.md MINE-AGMMD
bash /s/step.sh m true
bash /s/step.sh u ah-$1 update
bash /s/ub.sh u
bash /s/step.sh u2 ah-$1 update
bash /s/step.sh dry ah-$1 uninstall --dry-run
bash /s/step.sh un ah-$1 uninstall --yes
