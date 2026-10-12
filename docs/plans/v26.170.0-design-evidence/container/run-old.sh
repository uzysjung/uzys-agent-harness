#!/usr/bin/env bash
# d170 design evidence — install real old npm versions, then run the CURRENT build (image uzys-d170-design:local)
# flows: A = update ×2 → uninstall --yes ; B = direct uninstall --yes
set -uo pipefail
OUT=/evidence/out; mkdir -p "$OUT"
strip() { sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'; }
snap() { (find . -path ./.git -prune -o -type f -print | sort | while read -r f; do printf '%s  %s\n' "$(sha256sum "$f" | cut -c1-12)" "$f"; done); }
for V in "$@"; do
  for FLOW in A B; do
    P=/tmp/p-$V-$FLOW; rm -rf "$P"; mkdir -p "$P"; cd "$P"; git init -q
    D="$OUT/$V-$FLOW"; mkdir -p "$D"
    echo "### $V $FLOW install(old)" | tee "$D/log.txt"
    npx -y "@uzysjung/agent-harness@$V" install --track tooling --cli claude --cli codex >"$D/old-install.txt" 2>&1; echo "old install exit=$?" | tee -a "$D/log.txt"
    snap > "$D/snap-0-after-old-install.txt"
    REC=.uzys-agent-harness/.harness-install.json; [ -f "$REC" ] || REC=.claude/.harness-install.json
    cp "$REC" "$D/record-0.json" 2>/dev/null; cp AGENTS.md "$D/AGENTS-0.md" 2>/dev/null; cp .claude/settings.json "$D/settings-0.json" 2>/dev/null
    # installer markers
    mkdir -p .claude/skills/mine .claude/skills/north-star
    printf 'MINE-SKILL\n' > .claude/skills/mine/SKILL.md
    printf 'MINE-RULE\n' > .claude/rules/my-rule.md
    printf 'MINE-NOTE\n' > .claude/skills/north-star/my-notes.md
    [ -f .claude/rules/git-policy.md ] && printf '\nMINE-EDIT\n' >> .claude/rules/git-policy.md
    [ -f .claude/rules/test-policy.md ] && printf '\nMINE-EDIT\n' >> .claude/rules/test-policy.md
    [ -f AGENTS.md ] && printf '\n## My Team Rules\n\nMINE-SECTION\n' >> AGENTS.md
    if [ -f .claude/settings.json ]; then jq '.hooks.PreToolUse += [{"matcher":"Bash","hooks":[{"type":"command","command":"bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/mine.sh\""}]}]' .claude/settings.json > /tmp/s.json && mv /tmp/s.json .claude/settings.json; fi
    printf 'echo mine\n' > .claude/hooks/mine.sh
    snap > "$D/snap-1-with-markers.txt"
    if [ "$FLOW" = A ]; then
      agent-harness update >"$D/new-update-1.txt" 2>&1; echo "update1 exit=$?" | tee -a "$D/log.txt"
      snap > "$D/snap-2-after-update1.txt"; cp "$REC" "$D/record-2.json" 2>/dev/null; cp AGENTS.md "$D/AGENTS-2.md" 2>/dev/null; cp .claude/settings.json "$D/settings-2.json" 2>/dev/null
      agent-harness update >"$D/new-update-2.txt" 2>&1; echo "update2 exit=$?" | tee -a "$D/log.txt"
      snap > "$D/snap-3-after-update2.txt"; cp AGENTS.md "$D/AGENTS-3.md" 2>/dev/null
    fi
    agent-harness uninstall --yes >"$D/new-uninstall.txt" 2>&1; echo "uninstall exit=$?" | tee -a "$D/log.txt"
    snap > "$D/snap-9-after-uninstall.txt"; cp AGENTS.md "$D/AGENTS-9.md" 2>/dev/null; cp .claude/settings.json "$D/settings-9.json" 2>/dev/null
    for f in "$D"/new-*.txt "$D"/old-install.txt; do strip < "$f" > "$f.tmp" && mv "$f.tmp" "$f"; done
    echo "MINE markers after uninstall:" >> "$D/log.txt"; grep -rl "MINE" . --exclude-dir=.git 2>/dev/null | sort >> "$D/log.txt"
  done
done
echo DONE > "$OUT/DONE"
