#!/usr/bin/env bash
# step.sh LABEL VER ARGS...  — /w/p 에서 하네스 VER 로 명령을 치고 화면·rc·스냅샷을 /ev/$SC-$B/ 에 남긴다
# VER = main|br|v161|v170|cur (cur = 이 실행의 빌드 $B)
set -u
L=$1; V=$2; shift 2
[ "$V" = cur ] && V=$B
D=/ev/$SC-$B; mkdir -p $D
cd /w/p
echo "\$ agent-harness[$V] $*" > $D/$L.out
/opt/ah/$V/node_modules/.bin/agent-harness "$@" </dev/null >> $D/$L.out 2>&1
rc=$?
echo "rc=$rc" >> $D/$L.out
echo "[$SC-$B] $L ($V $*) rc=$rc"
bash /s/snap.sh $L
