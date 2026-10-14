#!/usr/bin/env bash
# link.sh SLOT_ID BODY_ID — .claude/skills/SLOT_ID 를 지우고 ../../.agents/skills/BODY_ID 로의 링크로 바꾼다 (#524 운용)
set -eu
cd /w/p
rm -rf ".claude/skills/$1"
ln -s "../../.agents/skills/$2" ".claude/skills/$1"
if [ -f ".claude/skills/$1/SKILL.md" ]; then echo "[link] .claude/skills/$1 -> .agents/skills/$2 resolves"; else echo "[link] FAIL .claude/skills/$1 does not resolve"; fi
