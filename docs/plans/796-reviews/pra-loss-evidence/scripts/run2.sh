#!/usr/bin/env bash
# usage: run.sh <version> ; CLISETS / FLOWS env override. evidence -> /ev/<v>/<cs>-<flow>/
set -uo pipefail
V=$1; SC=/scripts; OLD=/opt/old/$V/node_modules/.bin/agent-harness
B=/usr/local/lib/node_modules/@uzysjung/agent-harness/templates
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
mine() { # path token [append]
  mkdir -p "$(dirname "$1")"; if [ "${3:-}" = a ]; then printf '\n%s\n' "$2" >> "$1"; else printf '%s\n' "$2" > "$1"; fi
  echo "$2" >> "$D/tokens-before.txt"; echo "$1" >> "$D/mine-paths.txt"; }
for CS in ${CLISETS:-claude claude+codex}; do
 for FLOW in ${FLOWS:-A S N H D Am Sm Nm Hm Dm}; do
  P=/tmp/r/$V-$CS-$FLOW; rm -rf "$P"; mkdir -p "$P"; cd "$P"; git init -q
  D=/ev/$V/$CS-$FLOW; rm -rf "$D"; mkdir -p "$D"; : > "$D/tokens-before.txt"; : > "$D/mine-paths.txt"
  case $FLOW in *m) NEW=ah-main;; *r) NEW=ah-rel;; *) NEW=agent-harness;; esac
  EXTRA=""; case $FLOW in D|Dm|Dr) EXTRA="--with model-orchestration";; esac
  "$OLD" install --track tooling $(clis_args $CS) $EXTRA > "$D/old-install.txt" 2>&1; echo "old-install exit=$?" >> "$D/log.txt"
  REC=.uzys-agent-harness/.harness-install.json; [ -f "$REC" ] || REC=.claude/.harness-install.json; cp "$REC" "$D/record-old.json"
  snap > "$D/snap-old.txt"
  # --- markers: own files (non-harness names)
  mine .claude/rules/my-rule.md MINE-RULE
  mine .claude/skills/mine/SKILL.md MINE-SKILL
  mine .claude/agents/my-agent.md MINE-AGENT
  # own files at harness names not installed by the old version (current tooling targets)
  for r in doc-governance.md change-management.md cli-development.md; do [ -f .claude/rules/$r ] || { mine .claude/rules/$r MINE-RULEHN-$r; break; }; done
  mine .claude/rules/ui-components.md MINE-RULEHN-ui   # harness name, other track
  for a in implementer.md strategist.md data-analyst.md; do [ -f .claude/agents/$a ] || { mine .claude/agents/$a MINE-AGENTHN-$a; break; }; done
  for s in objective-brief natural-korean user-centered-explanation audit-harness-fit external-model-consult; do [ -d .claude/skills/$s ] || { mine .claude/skills/$s/SKILL.md MINE-SKILLHN-$s; mine .claude/skills/$s/notes.md MINE-SKILLHNX-$s; break; }; done
  mine .claude/skills/ui-visual-review/SKILL.md MINE-SKILLHN-uvr   # opt-in harness skill name, not chosen
  # own file at a retired harness name (not installed by tooling)
  mine .claude/rules/database.md MINE-OWNRETIRED
  # edits to harness files
  [ -f .claude/rules/git-policy.md ] && mine .claude/rules/git-policy.md MINE-EDRULE a
  [ -f .claude/rules/test-policy.md ] && mine .claude/rules/test-policy.md MINE-EDTEST a
  [ -f .claude/agents/reviewer.md ] && mine .claude/agents/reviewer.md MINE-EDAGENT a
  [ -f .claude/hooks/session-start.sh ] && mine .claude/hooks/session-start.sh MINE-EDHOOK a
  [ -f .claude/skills/north-star/SKILL.md ] && mine .claude/skills/north-star/SKILL.md MINE-EDSKILL a
  [ -d .claude/skills/north-star ] && mine .claude/skills/north-star/my-notes.md MINE-NOTE
  [ -d .claude/skills/compaction-handoff ] && mine .claude/skills/compaction-handoff/refs/mine.md MINE-NOTE2
  [ -f .claude/rules/code-style.md ] && mine .claude/rules/code-style.md MINE-EDRETIRED a
  [ -f .claude/agents/code-reviewer.md ] && mine .claude/agents/code-reviewer.md MINE-EDRETAGENT a
  [ -f .uzys-agent-harness/check-absence.sh ] && mine .uzys-agent-harness/check-absence.sh MINE-EDHELPER a
  if [ -f .claude/settings.json ]; then jq '.hooks.PreToolUse += [{"matcher":"Bash","hooks":[{"type":"command","command":"bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/mine.sh\" # MINE-HOOKLINE"}]}]' .claude/settings.json > /tmp/s.json && mv /tmp/s.json .claude/settings.json; echo MINE-HOOKLINE >> "$D/tokens-before.txt"; fi
  mine .claude/hooks/mine.sh MINE-HOOKSCRIPT
  if [ -d .agents/skills ]; then mine .agents/skills/mine-ag/SKILL.md MINE-AGSKILL
    AGD=$(ls -d .agents/skills/*/ 2>/dev/null | grep -v mine-ag | head -1); if [ -n "$AGD" ]; then mine "${AGD}my-notes.md" MINE-AGNOTE; [ -f "${AGD}SKILL.md" ] && mine "${AGD}SKILL.md" MINE-AGEDIT a; fi; fi
  [ -f .codex/config.toml ] && { printf '\n# MINE-CODEXCFG\n[mcp_servers.minesrv]\ncommand = "echo"\n' >> .codex/config.toml; echo MINE-CODEXCFG >> "$D/tokens-before.txt"; }
  [ -f AGENTS.md ] && { printf '\n## My Team Rules\n\nMINE-SECTION\n' >> AGENTS.md; echo MINE-SECTION >> "$D/tokens-before.txt"; }
  # deletions (flow D)
  if [ "${FLOW%[mr]}" = D ]; then
    for x in .claude/skills/gh-issue-workflow .claude/skills/model-orchestration .claude/rules/cli-development.md; do [ -e "$x" ] && { rm -rf "$x"; echo "deleted $x" >> "$D/log.txt"; }; done
  fi
  sort -u -o "$D/tokens-before.txt" "$D/tokens-before.txt"
  snap > "$D/snap-markers.txt"; bash $SC/check.sh markers
  case ${FLOW%[mr]} in
   A|D) step u1 $NEW update; step u2 $NEW update; step u3 $NEW update;;
   S) step o1 $NEW update --only skills; step u1 $NEW update; step u2 $NEW update;;
   N) step o1 $NEW update --only new-skills; step u1 $NEW update; step u2 $NEW update;;
   H) step o1 $NEW update --only hooks; step u1 $NEW update; step u2 $NEW update;;
   P1) step o1 $NEW update --only skills;;
   P2) step o1 $NEW update --only new-skills;;
   P3) step o1 $NEW update --only hooks;;
   P4) step o1 $NEW update --only rules;;
  esac
  step un $NEW uninstall --yes
  find . -path ./.git -prune -o -type f -print | grep -v backup | sort > "$D/residual.txt"
 done
done
echo DONE > /ev/$V/DONE
