#!/usr/bin/env bash
# drop variants: a "next release" that removed templates/agents/strategist.md without adding it to RETIRED_PATHS
set -e
G=/usr/local/lib/node_modules/@uzysjung; cp -a $G/agent-harness $G/ah-prdrop; rm $G/ah-prdrop/templates/agents/strategist.md
M=/opt/main/node_modules/@uzysjung; cp -a $M/agent-harness $M/ah-maindrop; rm $M/ah-maindrop/templates/agents/strategist.md
printf '#!/bin/sh\nexec node %s/ah-prdrop/dist/index.js "$@"\n' $G > /usr/local/bin/ah-prdrop
printf '#!/bin/sh\nexec node %s/ah-maindrop/dist/index.js "$@"\n' $M > /usr/local/bin/ah-maindrop
chmod +x /usr/local/bin/ah-prdrop /usr/local/bin/ah-maindrop
grep -c policyBase $G/ah-prdrop/dist/index.js || true; grep -c policyBase $M/ah-maindrop/dist/index.js
