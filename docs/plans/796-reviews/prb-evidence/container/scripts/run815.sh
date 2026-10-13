#!/usr/bin/env bash
# rev815: usage run815.sh <version> ; CLISETS / FLOWS env. evidence -> /ev/<v>/<cs>-<flow>/
# flows: A S N (PR) · Am Sm Nm (main 8e6d87b) · X / Xm = §1.2 ④ (pre-existing out-of-track template-name file recorded by old scan; new build drops that template without RETIRED_PATHS)
set -uo pipefail
V=$1; SC=/scripts; OLD=/opt/old/$V/node_modules/.bin/agent-harness
strip() { sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'; }
clis_args() { local a=""; for c in ${1//+/ }; do a="$a --cli $c"; done; echo "$a"; }
snap() { (find . -path ./.git -prune -o -type f -print | sort | while read -r f; do printf '%s  %s\n' "$(sha256sum "$f" | cut -c1-12)" "$f"; done); }
export D
step() { local name=$1; shift; local before; before=$(find . -path ./.git -prune -o -name '*backup*' -print | sort)
  "$@" > "$D/$name.txt" 2>&1; local rc=$?; strip < "$D/$name.txt" > "$D/$name.t" && mv "$D/$name.t" "$D/$name.txt"
  echo "$name exit=$rc" >> "$D/log.txt"
  comm -13 <(echo "$before") <(find . -path ./.git -prune -o -name '*backup*' -print | sort) | grep . | sed "s/^/$name NEWBACKUP /" >> "$D/log.txt"
  REC=.uzys-agent-harness/.harness-install.json; [ -f "$REC" ] || REC=.claude/.harness-install.json; cp "$REC" "$D/record-$name.json" 2>/dev/null
  snap > "$D/snap-$name.txt"; bash $SC/check.sh "$name"; }
mine() { mkdir -p "$(dirname "$1")"; if [ "${3:-}" = a ]; then printf '\n%s\n' "$2" >> "$1"; else printf '%s\n' "$2" > "$1"; fi
  echo "$2" >> "$D/tokens-before.txt"; echo "$1" >> "$D/mine-paths.txt"; }
for CS in ${CLISETS:-claude}; do
 for FLOW in ${FLOWS:-A S N Am Sm Nm}; do
  P=/tmp/r/$V-$CS-$FLOW; rm -rf "$P"; mkdir -p "$P"; cd "$P"; git init -q
  D=/ev/$V/$CS-$FLOW; rm -rf "$D"; mkdir -p "$D"; : > "$D/tokens-before.txt"; : > "$D/mine-paths.txt"
  case $FLOW in X) NEW=ah-prdrop;; Xm) NEW=ah-maindrop;; *m) NEW=ah-main;; *) NEW=agent-harness;; esac
  case ${FLOW%m} in X) mine .claude/agents/strategist.md MINE-OOT-strategist;; esac   # before old install: old scan records installer bytes
  "$OLD" install --track tooling $(clis_args $CS) > "$D/old-install.txt" 2>&1; echo "old-install exit=$?" >> "$D/log.txt"
  REC=.uzys-agent-harness/.harness-install.json; [ -f "$REC" ] || REC=.claude/.harness-install.json; cp "$REC" "$D/record-old.json"
  snap > "$D/snap-old.txt"
  mine .claude/rules/my-rule.md MINE-RULE
  mine .claude/skills/mine/SKILL.md MINE-SKILL
  mine .claude/agents/my-agent.md MINE-AGENT
  for r in doc-governance.md change-management.md cli-development.md; do [ -f .claude/rules/$r ] || { mine .claude/rules/$r MINE-RULEHN-$r; break; }; done
  mine .claude/rules/ui-components.md MINE-RULEHN-ui
  for a in implementer.md strategist.md data-analyst.md; do [ -f .claude/agents/$a ] || { mine .claude/agents/$a MINE-AGENTHN-$a; break; }; done
  # retired names: own if absent, edit if present (rules · agents · commands · hooks)
  for x in rules/database.md rules/code-style.md rules/error-handling.md agents/code-reviewer.md agents/security-reviewer.md commands/uzys/auto.md hooks/hito-counter.sh hooks/karpathy-gate.sh; do
    t=$(echo "$x" | tr '/.' '--'); if [ -f .claude/$x ]; then mine .claude/$x MINE-EDRET-$t a; else mine .claude/$x MINE-OWNRET-$t; fi; done
  [ -f .claude/rules/git-policy.md ] && mine .claude/rules/git-policy.md MINE-EDRULE a
  [ -f .claude/agents/reviewer.md ] && mine .claude/agents/reviewer.md MINE-EDAGENT a
  [ -f .claude/hooks/session-start.sh ] && mine .claude/hooks/session-start.sh MINE-EDHOOK a
  [ -f .claude/skills/north-star/SKILL.md ] && mine .claude/skills/north-star/SKILL.md MINE-EDSKILL a
  [ -d .claude/skills/north-star ] && mine .claude/skills/north-star/my-notes.md MINE-NOTE
  mine .claude/hooks/mine.sh MINE-HOOKSCRIPT
  if [ -d .agents/skills ]; then mine .agents/skills/mine-ag/SKILL.md MINE-AGSKILL; fi
  [ -f AGENTS.md ] && { printf '\n## My Team Rules\n\nMINE-SECTION\n' >> AGENTS.md; echo MINE-SECTION >> "$D/tokens-before.txt"; }
  sort -u -o "$D/tokens-before.txt" "$D/tokens-before.txt"
  snap > "$D/snap-markers.txt"; bash $SC/check.sh markers
  case ${FLOW%m} in
   A|X) step u1 $NEW update; step u2 $NEW update; step u3 $NEW update;;
   S) step o1 $NEW update --only skills; step u1 $NEW update; step u2 $NEW update;;
   N) step o1 $NEW update --only new-skills; step u1 $NEW update; step u2 $NEW update;;
   H) step o1 $NEW update --only hooks; step u1 $NEW update; step u2 $NEW update;;
   R) step o1 $NEW update --only rules; step u1 $NEW update; step u2 $NEW update;;
  esac
  step un $NEW uninstall --yes
  find . -path ./.git -prune -o -type f -print | grep -v backup | sort > "$D/residual.txt"
 done
done
echo DONE > /ev/$V/DONE-${FLOWS// /_}-${CLISETS:-claude}
