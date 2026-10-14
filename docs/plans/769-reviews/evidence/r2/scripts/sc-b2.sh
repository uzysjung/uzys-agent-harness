# ⓑ2 폴더째 링크 → --cli codex → update (회복되는가) — 실제 사용자 배치 모양(#524 보고 · .claude/skills 를 링크로)
bash /s/step.sh 1-install cur install --track tooling --cli claude --cli codex --scope project
cd /w/p && rm -rf .claude/skills && ln -s ../.agents/skills .claude/skills
bash /s/step.sh 2-cli-codex cur uninstall --cli codex
bash /s/step.sh 3-update cur update
