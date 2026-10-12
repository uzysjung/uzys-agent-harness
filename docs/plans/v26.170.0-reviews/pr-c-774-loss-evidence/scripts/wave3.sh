#!/usr/bin/env bash
for V in 26.100.0 26.140.0 26.150.0; do for VAR in ctxsec rulesintro crlf; do for FL in A B Am Bm; do /scripts/run3.sh $V codex $VAR-$FL; done; done; done
for V in 26.100.0 26.132.0 26.140.0; do for CS in codex claude+codex; do /scripts/run3.sh $V $CS blockedit-C; /scripts/run3.sh $V $CS blockedit-Cun; done; done
for V in 26.100.0 26.140.0; do /scripts/run3.sh $V codex dryrun-X; done
echo DONE > /ev/x/DONE
