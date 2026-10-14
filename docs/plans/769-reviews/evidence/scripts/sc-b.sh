# ⓑ .claude/skills 폴더째 링크 (→ ../.agents/skills)
bash /s/step.sh 1-install cur install --track tooling --cli claude --cli codex --scope project
cd /w/p && rm -rf .claude/skills && ln -s ../.agents/skills .claude/skills && ls .claude/skills/ > /ev/$SC-$B/folder-link-ls.txt
bash /s/snap.sh 2-linked
bash /s/step.sh 3-dry cur uninstall --cli codex --dry-run
bash /s/step.sh 4-cli-codex cur uninstall --cli codex
