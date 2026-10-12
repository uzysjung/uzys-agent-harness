#!/usr/bin/env bash
for V in 26.100.0 26.140.0 26.150.0; do for FL in A B Am Bm; do /scripts/run3.sh $V codex sessedit-$FL; done; done
for FL in A B Am Bm; do /scripts/run3.sh 26.150.0 codex hredit-$FL; done
for V in 26.100.0 26.132.0; do for CS in codex claude+codex; do /scripts/run3.sh $V $CS blockedit-C; /scripts/run3.sh $V $CS blockedit-Cun; done; done
echo DONE > /ev/x/DONE4
