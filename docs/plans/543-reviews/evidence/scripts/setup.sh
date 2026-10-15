#!/usr/bin/env bash
# 리뷰 준비 — main/브랜치 pack 과 옛 npm 판을 각자의 prefix 에 설치한다. REV_SCRATCH 필수.
set -euo pipefail
S="${REV_SCRATCH:?}"
for pair in "branch=$S/packs/branch.tgz" "main=$S/packs/main.tgz" "v125=@uzysjung/agent-harness@26.125.0" "v161=@uzysjung/agent-harness@26.161.0" "v163=@uzysjung/agent-harness@26.163.0" "v169=@uzysjung/agent-harness@26.169.0" "v150=@uzysjung/agent-harness@26.150.0"; do
  name="${pair%%=*}"; spec="${pair#*=}"
  if [ -n "${ONLY:-}" ] && [ "${ONLY}" != "${name}" ]; then continue; fi
  mkdir -p "$S/cli/$name"
  echo '{"name":"x","private":true}' > "$S/cli/$name/package.json"
  npm install --prefix "$S/cli/$name" --no-audit --no-fund --ignore-scripts "$spec" > /dev/null 2>&1
  echo "ok $name"
  node "$S/cli/$name/node_modules/@uzysjung/agent-harness/dist/index.js" --version
done
