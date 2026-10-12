#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../../../../../.." 2>/dev/null || true
cd /Users/uzysjung/Development/Claude-Workspace/uzysClaudeUniversalEnv
OUT="$1"
NPM=$(npm view @uzysjung/agent-harness versions --json 2>/dev/null | tr -d '[]", ' )
: > "$OUT/pairs.tsv"; n=0; missing=""
for v in $NPM; do t="v$v"; git rev-parse -q --verify "$t" >/dev/null || { missing="$missing $t"; continue; }; n=$((n+1))
  git ls-tree -r "$t" -- templates/rules templates/agents templates/commands templates/hooks templates/skills templates/settings.json templates/CLAUDE.md templates/codex templates/opencode templates/antigravity 2>/dev/null | awk -v v="$v" '{print v"\t"$3"\t"$4}' >> "$OUT/pairs.tsv"; done
echo "tags processed: $n ; npm versions without git tag:$missing"
echo "rows: $(wc -l < $OUT/pairs.tsv)"
CLAUDE=$(awk -F'\t' '$3 ~ /^templates\/(rules|agents|commands|hooks|skills)\//' "$OUT/pairs.tsv")
echo "$CLAUDE" | cut -f2,3 | sort -u > "$OUT/claude-pairs.txt"
echo ".claude/ targets: unique (blob,path): $(wc -l < $OUT/claude-pairs.txt) · unique paths: $(cut -f2 $OUT/claude-pairs.txt | sort -u | wc -l)"
cut -f2 "$OUT/claude-pairs.txt" | sort -u | while read -r p; do [ -e "$p" ] || echo "$p"; done > "$OUT/claude-paths-not-current.txt"
echo "  paths not in current templates: $(wc -l < $OUT/claude-paths-not-current.txt)"
grep -F -f <(sed 's/^/\t/' "$OUT/claude-paths-not-current.txt" | sed 's/$//') "$OUT/claude-pairs.txt" > "$OUT/claude-pairs-not-current.txt" || true
echo "  (blob,path) pairs for paths not in current templates: $(wc -l < $OUT/claude-pairs-not-current.txt)"
echo "  by dir:"; cut -f2 "$OUT/claude-pairs-not-current.txt" | cut -d/ -f2 | sort | uniq -c | sed 's/^/     /'
echo "  bytes if stored as sha256(64)+path+newline: $(awk -F'\t' '{s+=64+length($2)+3} END{print s}' $OUT/claude-pairs-not-current.txt)"
echo "  bytes if stored as sha256 prefix(16)+path+newline: $(awk -F'\t' '{s+=16+length($2)+3} END{print s}' $OUT/claude-pairs-not-current.txt)"
