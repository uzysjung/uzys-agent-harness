bash /s/step.sh o ah-26.161.0 install --track tooling --cli claude --cli codex
bash /s/mine.sh CLAUDE-uzys-harness.md MINE-ANCHOR a
for S in .agents/skills/*/SKILL.md; do echo "edited $S" >> "$D/log.txt"; bash /s/mine.sh "$S" MINE-AGSKILL a; break; done
bash /s/step.sh m true
bash /s/step.sh u ah-$1 update
bash /s/ub.sh u
