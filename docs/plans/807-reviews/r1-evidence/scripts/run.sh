set -u
V=$1; FLOW=$2; B=$3; NEW=ah-$3
export D=/ev/$V-$FLOW-$B
mkdir -p "$D"; : > "$D/tokens.txt"
bash /s/step.sh o-install ah-$V install --track tooling --cli claude --cli codex
bash /s/mine.sh .claude/rules/my-rule.md MINE-RULE
bash /s/mine.sh .claude/skills/mine/SKILL.md MINE-SKILL
bash /s/mine.sh .claude/rules/ui-components.md MINE-UIHN
test -f .claude/rules/test-policy.md && bash /s/mine.sh .claude/rules/test-policy.md MINE-EDRULE a
test -f .claude/agents/reviewer.md && bash /s/mine.sh .claude/agents/reviewer.md MINE-EDAGENT a
bash /s/mine.sh .agents/skills/mine2/SKILL.md MINE-AGSKILL
echo "$FLOW" | grep -q m && bash /s/mine.sh .claude/agents/strategist.md MINE-STRAT
echo "$FLOW" | grep -q m && test -f .claude/agents/data-analyst.md && bash /s/mine.sh .claude/agents/data-analyst.md MINE-DA a
test -f /s/extra-$FLOW.sh && bash /s/extra-$FLOW.sh
find . -type f -print0 | sort -z | xargs -0 sha256sum | cut -c1-12,65- > "$D/snap-markers.txt"
bash /s/step.sh u170 ah-26.170.0 update
echo "$FLOW" | grep -q U && bash /s/step.sh n1 $NEW update
echo "$FLOW" | grep -q U && bash /s/step.sh n2 $NEW update
echo "$FLOW" | grep -q X && bash /s/step.sh dry $NEW uninstall --dry-run
echo "$FLOW" | grep -q X && bash /s/step.sh un $NEW uninstall --yes
echo DONE >> "$D/log.txt"
