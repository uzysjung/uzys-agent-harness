#!/usr/bin/env bash
# 컨테이너 안: 시나리오를 돌린 뒤 같은 프로젝트에서 EXTERNAL 이 무엇을 빼는지 · 그중 하네스 기록 파일이 있는지
set -uo pipefail
/work/test/docker/scenarios/scenario-uninstall-track.sh > /tmp/scn.log 2>&1; echo "scenario exit=$?"
tail -3 /tmp/scn.log
PROJ=/tmp/proj-uninstall-track
cd "$PROJ"
LOG=.uzys-agent-harness/.harness-install.json
EXTERNAL=$(jq -r '.assets[].files[]?.path' "$LOG" | cut -d/ -f1-3 | sort -u)
echo "--- EXTERNAL (prefixes) ---"; echo "$EXTERNAL"
echo "--- files excluded by EXTERNAL prefixes + skills-lock.json ---"
find . -type f -not -path './.uzys-agent-harness/*' | sort > /tmp/all.txt
: > /tmp/excl.txt
while read -r f; do
  base=$(basename "$f"); hit=""
  [ "$base" = "skills-lock.json" ] && hit=1
  for e in $EXTERNAL; do case "$f" in "./$e/"*) hit=1;; esac; done
  [ -n "$hit" ] && echo "$f" >> /tmp/excl.txt
done < /tmp/all.txt
cat /tmp/excl.txt
echo "--- harness-recorded paths (policyFiles/skillFiles/externalFiles) ---"
jq -r '(.policyFiles[]?.path | ".claude/" + .), (.skillFiles[]?.path | ".claude/skills/" + .), (.externalFiles[]?.path)' "$LOG" | sed 's#^#./#' | sort -u > /tmp/harness.txt
wc -l < /tmp/harness.txt
echo "--- overlap (excluded AND harness-recorded) ---"
comm -12 /tmp/excl.txt /tmp/harness.txt
echo "--- end overlap ---"
echo "--- control: a known harness path must NOT be in excl ---"
grep -c "objective-brief/SKILL.md" /tmp/excl.txt
