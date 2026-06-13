#!/usr/bin/env bash
# install.sh — thin wrapper that hands control to the npx-distributed CLI.
#
# After v0.1.0-alpha (CLI rewrite), the project is shipped as a Node package.
# This script exists so curl|bash invocations from older docs still work; it
# delegates to the TypeScript CLI bundled at the same git ref.
#
# Recommended invocation:
#   bash <(curl -fsSL https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/install.sh)
#
# CI / scripted use should call npx directly:
#   npx -y github:uzysjung/uzys-agent-harness#main install --track <track>

set -euo pipefail

REQUIRED_NODE_MAJOR=20

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required (>= ${REQUIRED_NODE_MAJOR}.0.0)." >&2
  echo "       https://nodejs.org/  or  brew install node" >&2
  exit 1
fi

NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])' 2>/dev/null || echo "0")
if [ "${NODE_MAJOR}" -lt "${REQUIRED_NODE_MAJOR}" ]; then
  echo "ERROR: Node ${NODE_MAJOR} detected; this CLI requires Node >= ${REQUIRED_NODE_MAJOR}." >&2
  exit 1
fi

REF="${UZYS_CH_REF:-main}"
exec npx -y "github:uzysjung/uzys-agent-harness#${REF}" "$@"
