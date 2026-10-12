#!/usr/bin/env bash
# usage: run.sh <version> ; runs all clisets x flows for that version. evidence -> /ev/<v>/<cs>-<flow>/
set -uo pipefail
V=$1; S=/scripts; OLD=/opt/old/$V/node_modules/.bin/agent-harness
strip() { sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'; }
clis_args() { local a=""; for c in ${1//+/ }; do a="$a --cli $c"; done; echo "$a"; }
snap() { (find . -path ./.git -prune -o -type f -print | sort | while read -r f; do printf '%s  %s\n' "$(sha256sum "$f" | cut -c1-12)" "$f"; done); }
step() { # name cmd...
  local name=$1; shift; "$@" > "$D/$name.txt" 2>&1; local rc=$?; strip < "$D/$name.txt" > "$D/$name.t" && mv "$D/$name.t" "$D/$name.txt"
  echo "$name exit=$rc" >> "$D/log.txt"; cp AGENTS.md "$D/AGENTS-$name.md" 2>/dev/null
  ls -1 | grep -c '^AGENTS.md.backup-' | sed "s/^/$name agents-backups=/" >> "$D/log.txt"
  REC=.uzys-agent-harness/.harness-install.json; [ -f "$REC" ] || REC=.claude/.harness-install.json; cp "$REC" "$D/record-$name.json" 2>/dev/null
}
# fresh PR renders per cliset
for CS in ${CLISETS:-codex opencode claude+codex claude}; do
  F=/tmp/fresh-$CS; rm -rf $F; mkdir -p $F; (cd $F && git init -q && agent-harness install --track tooling $(clis_args $CS) >/dev/null 2>&1); mkdir -p /ev/fresh; cp $F/AGENTS.md /ev/fresh/AGENTS-$CS.md 2>/dev/null
done
for CS in ${CLISETS:-codex opencode claude+codex claude}; do
 for FLOW in ${FLOWS:-A B C D Am Bm Dm}; do
  P=/tmp/r/$V-$CS-$FLOW; rm -rf "$P"; mkdir -p "$P"; cd "$P"; git init -q
  D=/ev/$V/$CS-$FLOW; rm -rf "$D"; mkdir -p "$D"
  case $FLOW in *m) NEW=ah-main;; *) NEW=agent-harness;; esac
  step old-install $OLD install --track tooling $(clis_args $CS)
  cp AGENTS.md "$D/AGENTS-old0.md" 2>/dev/null || :
  # claude-only: installer's own AGENTS.md = verbatim old codex AGENTS.md from another project (B2 attack)
  if [ ! -f AGENTS.md ] && [ "$CS" = claude ]; then
    Q=/tmp/other-$V; if [ ! -f $Q/AGENTS.md ]; then rm -rf $Q; mkdir -p $Q; (cd $Q && git init -q && $OLD install --track tooling --cli codex >/dev/null 2>&1); fi
    cp $Q/AGENTS.md AGENTS.md; cp AGENTS.md "$D/AGENTS-old0.md"; echo "claude-only: copied other project's old codex AGENTS.md" >> "$D/log.txt"
  fi
  node $S/mutate.mjs "$P" "$D"
  mkdir -p .claude/skills/mine .claude/rules .agents/skills/mine-ag
  printf 'MINE-SKILL\n' > .claude/skills/mine/SKILL.md
  printf 'MINE-RULE\n' > .claude/rules/my-rule.md
  printf 'MINE-AGSKILL\n' > .agents/skills/mine-ag/SKILL.md
  [ -d .claude/skills/north-star ] && printf 'MINE-NOTE\n' > .claude/skills/north-star/my-notes.md
  [ -f .claude/rules/git-policy.md ] && printf '\nMINE-EDGIT\n' >> .claude/rules/git-policy.md
  [ -f .claude/rules/test-policy.md ] && printf '\nMINE-EDTEST\n' >> .claude/rules/test-policy.md
  AGD=$(ls -d .agents/skills/*/ 2>/dev/null | grep -v mine-ag | head -1); if [ -n "$AGD" ]; then printf 'MINE-AGNOTE\n' > "$AGD/my-notes.md"; [ -f "$AGD/SKILL.md" ] && printf '\nMINE-AGEDIT\n' >> "$AGD/SKILL.md"; fi
  [ -f .codex/config.toml ] && printf '\n# MINE-CODEXCFG\n[mcp_servers.minesrv]\ncommand = "echo"\n' >> .codex/config.toml
  if [ -f opencode.json ]; then jq '.mine_note = "MINE-OCJSON"' opencode.json > /tmp/o.json && mv /tmp/o.json opencode.json; fi
  if [ -f .claude/settings.json ]; then mkdir -p .claude/hooks; jq '.hooks.PreToolUse += [{"matcher":"Bash","hooks":[{"type":"command","command":"bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/mine.sh\" # MINE-HOOKLINE"}]}]' .claude/settings.json > /tmp/s.json && mv /tmp/s.json .claude/settings.json; printf 'echo MINE-HOOKSCRIPT\n' > .claude/hooks/mine.sh; fi
  cp AGENTS.md "$D/AGENTS-1-mutated.md" 2>/dev/null
  grep -rhoE 'MINE-[A-Z0-9-]*[A-Z0-9]' . --exclude-dir=.git | sort -u > "$D/tokens-before.txt"
  snap > "$D/snap-1.txt"
  FR=/ev/fresh/AGENTS-$CS.md; [ -f $FR ] || FR=-
  case $FLOW in
   A|Am) step u1 $NEW update; node $S/check.mjs "$P" "$D" u1 "$D/AGENTS-old0.md" $FR >> "$D/summary.txt"
         step u2 $NEW update; node $S/check.mjs "$P" "$D" u2 "$D/AGENTS-old0.md" $FR >> "$D/summary.txt";;
   B|Bm) :;;
   C) step u169 ah-main update; node $S/check.mjs "$P" "$D" u169 "$D/AGENTS-old0.md" $FR >> "$D/summary.txt"
      if [ -f AGENTS.md ]; then printf '\n## MINE After169 Section\n\nMINE-AFTER169: added after the v26.169 update.\n' >> AGENTS.md; node -e 'const fs=require("fs");const p=process.argv[1];const b=JSON.parse(fs.readFileSync(p));b.AFTER169={text:"## MINE After169 Section\n\nMINE-AFTER169: added after the v26.169 update."};fs.writeFileSync(p,JSON.stringify(b,null,1))' "$D/blocks.json"; echo MINE-AFTER169 >> "$D/tokens-before.txt"; fi
      step u1 agent-harness update; node $S/check.mjs "$P" "$D" u1 "$D/AGENTS-old0.md" $FR >> "$D/summary.txt"
      step u2 agent-harness update; node $S/check.mjs "$P" "$D" u2 "$D/AGENTS-old0.md" $FR >> "$D/summary.txt";;
   D|Dm) step reinst $NEW install --track tooling $(clis_args $CS); node $S/check.mjs "$P" "$D" reinst "$D/AGENTS-old0.md" $FR >> "$D/summary.txt";;
  esac
  step un $NEW uninstall --yes; node $S/check.mjs "$P" "$D" un "$D/AGENTS-old0.md" - >> "$D/summary.txt"
  snap > "$D/snap-9.txt"
  ls -1A | grep backup > "$D/backups-root.txt"; find . -path ./.git -prune -o -name '*.backup-*' -print | sort > "$D/backups-all.txt"
 done
done
echo DONE > /ev/$V/DONE
