#!/usr/bin/env bash
# snap.sh LABEL — /w/p 의 파일 목록 + sha256 + 링크 대상, 링크 해석 여부, 설치 기록 사본(현 위치 · 옛 위치)
set -u
L=$1; D=/ev/$SC-$B; mkdir -p $D
cd /w/p
find . -mindepth 1 -not -path './.git/*' -not -path './node_modules/*' | LC_ALL=C sort | while read -r p; do
  if [ -L "$p" ]; then
    if [ -e "$p" ]; then ok=resolves; else ok=BROKEN; fi
    echo "L $p -> $(readlink "$p") [$ok]"
  elif [ -f "$p" ]; then
    echo "F $p $(sha256sum "$p" | cut -c1-16)"
  elif [ -d "$p" ]; then
    echo "D $p"
  fi
done > $D/snap-$L.txt
if [ -f .uzys-agent-harness/.harness-install.json ]; then cp .uzys-agent-harness/.harness-install.json $D/log-$L.json
elif [ -f .claude/.harness-install.json ]; then cp .claude/.harness-install.json $D/log-$L.json
else echo "{}" > $D/log-$L.json; fi
