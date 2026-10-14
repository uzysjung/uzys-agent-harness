#!/usr/bin/env bash
# 컨테이너 안: 각 판을 /opt/ah/NAME 에 따로 깐다 (npm 게시판과 같은 tgz 산출물) — 이미 깐 것은 건너뛴다
set -eu
for pair in main:/pk/main/uzysjung-agent-harness-26.173.0.tgz br:/pk/br/uzysjung-agent-harness-26.172.0.tgz v161:/pk/old/uzysjung-agent-harness-26.161.0.tgz v170:/pk/old/uzysjung-agent-harness-26.170.0.tgz v125:/pk/old/uzysjung-agent-harness-26.125.0.tgz; do
  n=${pair%%:*}; t=${pair#*:}
  if [ ! -x /opt/ah/$n/node_modules/.bin/agent-harness ]; then
    mkdir -p /opt/ah/$n
    echo '{"name":"x","private":true}' > /opt/ah/$n/package.json
    npm install --prefix /opt/ah/$n --no-audit --no-fund --omit=dev $t >/dev/null 2>&1
  fi
  node -p "'$n ' + require('/opt/ah/$n/node_modules/@uzysjung/agent-harness/package.json').version"
done
