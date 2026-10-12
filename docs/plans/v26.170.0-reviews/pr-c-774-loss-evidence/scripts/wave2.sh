#!/usr/bin/env bash
V=$1
MUT=min EVSUB=w2-min/ CLISETS="codex opencode claude+codex" FLOWS="A B C E D Am Bm" /scripts/run2.sh $V
MUT=none EVSUB=w2-none/ CLISETS="codex opencode claude+codex" FLOWS="A B C E D Am Bm" /scripts/run2.sh $V
MUT=full EVSUB=w2-full/ CLISETS="codex+opencode claude+codex" FLOWS="A B E F Fm G Gm" /scripts/run2.sh $V
echo ALL > /ev/w2-done-$V
