#!/usr/bin/env bash
# run.sh SCENE BUILD — 빈 프로젝트 /w/p 에서 장면 스크립트를 BUILD(main|br) 로 친다
set -u
export SC=$1 B=$2
mkdir -p /w/p
cd /w/p && git init -q && git config user.email r@x && git config user.name r
echo "# my project" > README.md
bash /s/sc-$SC.sh
echo "[$SC-$B] done"
