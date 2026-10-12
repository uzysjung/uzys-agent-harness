#!/usr/bin/env bash
# #781 container check — real old npm versions installed, then THIS branch's build: dry-run, then uninstall --yes.
set -uo pipefail
OUT=/evidence/out; mkdir -p "$OUT"
FP=/evidence/fp.txt
strip() { sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'; }
snap() { find . -path ./.git -prune -o -path ./node_modules -prune -o \( -type f -o -type l \) -print | sort | while read -r f; do printf '%s  %s\n' "$(sha256sum "$f" | cut -d' ' -f1)" "${f#./}"; done; }
# live (non-backup) files whose (path,sha) is in the fingerprint set (.agents/skills/<rel> looked up as .claude/skills/<rel>)
fpmatch() {
  grep -v '\.backup-' "$1" | while read -r sha path; do
    key="$path"; case "$path" in .agents/skills/*) key=".claude/skills/${path#.agents/skills/}";; esac
    grep -qxF "$key $sha" "$FP" && echo "$path"
  done
}
for V in "$@"; do
  P=/tmp/p-$V; rm -rf "$P"; mkdir -p "$P"; cd "$P" || exit 3; git init -q
  D="$OUT/$V"; mkdir -p "$D"
  npx -y "@uzysjung/agent-harness@$V" install --track tooling --cli claude --cli codex >"$D/old-install.txt" 2>&1; echo "$V old install exit=$?" | tee "$D/log.txt"
  # installer markers
  mkdir -p .claude/skills/mine .claude/skills/north-star .claude/rules .claude/hooks
  printf 'MINE-SKILL\n' > .claude/skills/mine/SKILL.md
  printf 'MINE-RULE\n' > .claude/rules/my-rule.md
  printf 'MINE-NOTE\n' > .claude/skills/north-star/my-notes.md
  [ -f .claude/rules/git-policy.md ] && printf '\nMINE-EDIT\n' >> .claude/rules/git-policy.md
  if [ -f .claude/settings.json ]; then jq '.hooks.PreToolUse += [{"matcher":"Bash","hooks":[{"type":"command","command":"bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/mine.sh\""}]}]' .claude/settings.json > /tmp/s.json && mv /tmp/s.json .claude/settings.json; fi
  printf 'echo MINE-HOOK\n' > .claude/hooks/mine.sh
  snap > "$D/snap-1-with-markers.txt"
  cp .claude/settings.json "$D/settings-1.json" 2>/dev/null
  fpmatch "$D/snap-1-with-markers.txt" > "$D/fp-live-1.txt"
  # dry-run must not touch disk
  agent-harness uninstall --dry-run >"$D/new-dryrun.txt" 2>&1; echo "dry-run exit=$?" | tee -a "$D/log.txt"
  snap > "$D/snap-2-after-dryrun.txt"
  if cmp -s "$D/snap-1-with-markers.txt" "$D/snap-2-after-dryrun.txt"; then echo "dry-run disk unchanged: yes" | tee -a "$D/log.txt"; else echo "dry-run disk unchanged: NO" | tee -a "$D/log.txt"; fi
  agent-harness uninstall --yes >"$D/new-uninstall.txt" 2>&1; echo "uninstall exit=$?" | tee -a "$D/log.txt"
  snap > "$D/snap-9-after-uninstall.txt"; cp .claude/settings.json "$D/settings-9.json" 2>/dev/null
  fpmatch "$D/snap-9-after-uninstall.txt" > "$D/fp-live-9.txt"
  for f in "$D"/new-*.txt "$D"/old-install.txt; do strip < "$f" > "$f.tmp" && mv "$f.tmp" "$f"; done
  {
    echo "fp-match live before: $(wc -l < "$D/fp-live-1.txt")  after: $(wc -l < "$D/fp-live-9.txt")"
    echo "backups after: $(grep -c '\.backup-' "$D/snap-9-after-uninstall.txt")"
    echo "MINE markers (live or backup):"; grep -rl "MINE" . --exclude-dir=.git --exclude-dir=node_modules | sort
    echo "settings hooks after:"; jq -c '[.hooks[]?[]?.hooks[]?.command]' .claude/settings.json 2>/dev/null
  } | tee -a "$D/log.txt"
done
echo DONE > "$OUT/DONE"
