#!/usr/bin/env bash
# #551 PR-4 — Codex · OpenCode 를 이미 쓰던 프로젝트에 처음 깔아도 설치자 설정이 남고, 실 CLI 가 결과 파일을 받는가.
#
# 단위 테스트(`tests/cli-shared-files.test.ts`)는 파일 바이트를 문다. 여기서는 **실 바이너리가 그 파일을 읽는지**를 문다 —
# 병합 결과가 설치자 키를 지켰어도 CLI 가 설정 오류로 거절하면 설치자에게는 전부 사라진 것과 같다.
#
#   ① #563 `.codex/config.toml` — 설치자 MCP 서버 + model 이 있는 파일에 설치 → 실 `codex mcp list` 에 설치자 서버와
#      하네스 서버가 함께 나오고 exit 0. 대조: 설치 전(신뢰 전)에는 이 파일을 안 읽는다 = 뒤의 목록은 이 파일에서 왔다.
#   ② #563 `opencode.json` — 설치자 model + MCP 서버가 있는 파일에 설치 → 실 `opencode debug config` 가 받아들이고
#      설치자 model · 서버 + 하네스 서버를 본다. 대조: 설치 전에는 설치자 서버 하나만 보인다.
#   ③ #558 `AGENTS.md` — `## Project Context` · `## Project Rules` 를 채운 파일에 설치 → 두 절의 설치자 문장이 남고
#      하네스 몫은 블록 하나.

set -uo pipefail # set -e 제외: 판정마다 failed 를 모은다.

echo "▸ scenario-realcli-shared-files: 설치자 설정이 남고 실 CLI 가 결과 파일을 받는가 (#563 · #558)"
echo ""

failed=0

# ── ① .codex/config.toml ────────────────────────────────────────────────
echo "── ① .codex/config.toml (#563) ──"
codex --version 2>&1 | sed 's/^/  /'
P1=/tmp/proj-shared-codex
rm -rf "${P1}"
mkdir -p "${P1}/.codex"
cd "${P1}" || exit 1
cat >.codex/config.toml <<'TOML'
model = "o3"

[mcp_servers.myown]
command = "node"
args = ["my-server.js"]
TOML

before="$(codex mcp list 2>&1)"
if printf '%s\n' "${before}" | grep -q 'myown'; then
  echo "FAIL: 대조군 — 신뢰 전인데 codex 가 프로젝트 파일을 읽었다. 아래 판정이 이 파일에서 왔다고 할 수 없다"
  failed=1
else
  echo "✓ 대조군: 신뢰 전 codex 는 프로젝트 config.toml 을 읽지 않는다"
fi

# 신뢰 항목은 컨테이너 홈에만 — `--with-codex-trust`(ADR-097 결정 2)
agent-harness install --track tooling --cli codex --with-codex-trust --scope project >/tmp/shared-codex.log 2>&1 ||
  {
    echo "FAIL: install 실패"
    tail -30 /tmp/shared-codex.log
    exit 1
  }

if grep -q '^model = "o3"$' .codex/config.toml && grep -q '^\[mcp_servers.myown\]$' .codex/config.toml; then
  echo "✓ 라이브 파일에 설치자 model · [mcp_servers.myown] 이 그대로"
else
  echo "FAIL: 설치자 설정이 라이브 config.toml 에서 빠졌다 (#563)"
  cat .codex/config.toml
  failed=1
fi

list_err="$(mktemp)"
if list="$(codex mcp list 2>"${list_err}")"; then
  missing=""
  # 하네스 서버 이름은 같은 설치의 `.mcp.json`(같은 원천, #568)에서 유도한다 — 이름을 여기 박지 않는다
  want="myown $(jq -r '.mcpServers | keys[]' "${P1}/.mcp.json" 2>/dev/null | tr '\n' ' ')"
  if [[ "$(echo "${want}" | wc -w | tr -d ' ')" -lt 2 ]]; then
    echo "FAIL: 하네스 서버 목록을 못 읽었다 — 대조가 증거가 아니다"
    failed=1
  fi
  for name in ${want}; do
    printf '%s\n' "${list}" | grep -qE "^${name}[[:space:]]" || missing="${missing} ${name}"
  done
  if [[ -z "${missing}" ]]; then
    echo "✓ 실 codex mcp list 가 설치자 서버와 하네스 서버를 함께 본다: ${want}"
  else
    echo "FAIL: codex mcp list 에 없다:${missing}"
    printf '%s\n' "${list}" | sed 's/^/    /'
    failed=1
  fi
else
  echo "FAIL: codex 가 설정을 거절했다 (codex mcp list exit ≠ 0)"
  head -10 "${list_err}" | sed 's/^/    /'
  failed=1
fi
rm -f "${list_err}"
echo ""

# ── ② opencode.json ─────────────────────────────────────────────────────
echo "── ② opencode.json (#563) ──"
opencode --version 2>&1 | sed 's/^/  opencode: /'
P2=/tmp/proj-shared-opencode
rm -rf "${P2}"
mkdir -p "${P2}"
cd "${P2}" || exit 1
cat >opencode.json <<'JSON'
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "mcp": { "myown": { "type": "local", "command": ["node", "my-server.js"] } }
}
JSON

before_mcp="$(opencode debug config 2>/dev/null | jq -r '.mcp // {} | keys[]' | tr '\n' ' ')"
if [[ "${before_mcp}" == "myown " ]]; then
  echo "✓ 대조군: 설치 전 opencode 는 설치자 서버 하나만 본다"
else
  echo "FAIL: 대조군 — 설치 전 opencode 가 보는 서버가 [${before_mcp}] — 아래 판정이 증거가 아니다"
  failed=1
fi

agent-harness install --track tooling --cli opencode --scope project >/tmp/shared-oc.log 2>&1 ||
  {
    echo "FAIL: install 실패"
    tail -30 /tmp/shared-oc.log
    exit 1
  }

dbg_err="$(mktemp)"
if dbg="$(opencode debug config 2>"${dbg_err}")"; then
  model="$(printf '%s\n' "${dbg}" | jq -r '.model // ""')"
  got="$(printf '%s\n' "${dbg}" | jq -r '.mcp // {} | keys[]' | sort | tr '\n' ' ')"
  want="$( (
    echo myown
    jq -r '.mcpServers | keys[]' "${P2}/.mcp.json"
  ) | sort | tr '\n' ' ')"
  if [[ "${model}" != "anthropic/claude-sonnet-4-5" ]]; then
    echo "FAIL: 설치자 model 이 사라졌다 — opencode 가 보는 model = [${model}]"
    failed=1
  elif [[ "${got}" != "${want}" ]]; then
    echo "FAIL: opencode 가 보는 MCP 서버 [${got}] ≠ 기대 [${want}]"
    failed=1
  else
    echo "✓ 실 opencode 가 설정을 받아들이고 설치자 model · 서버 + 하네스 서버를 본다: ${got}"
  fi
else
  echo "FAIL: opencode 가 설정을 거절했다"
  head -5 "${dbg_err}" | sed 's/^/    /'
  failed=1
fi
rm -f "${dbg_err}"
echo ""

# ── ③ AGENTS.md ─────────────────────────────────────────────────────────
echo "── ③ AGENTS.md (#558) ──"
P3=/tmp/proj-shared-agents
rm -rf "${P3}"
mkdir -p "${P3}"
cd "${P3}" || exit 1
cat >AGENTS.md <<'MD'
## Project Context
MARKER-CONTEXT-FILLED-BY-USER — this is my own project description.

## Project Rules
MARKER-RULES-FILLED-BY-USER — my own rule: always run tests before commit.
MD
cp AGENTS.md /tmp/agents-original.md

agent-harness install --track base --cli codex --scope project >/tmp/shared-agents.log 2>&1 ||
  {
    echo "FAIL: install 실패"
    tail -30 /tmp/shared-agents.log
    exit 1
  }

for mark in MARKER-CONTEXT-FILLED-BY-USER MARKER-RULES-FILLED-BY-USER; do
  if grep -q "${mark}" AGENTS.md; then
    echo "✓ ${mark} 남음"
  else
    echo "FAIL: ${mark} 가 라이브 AGENTS.md 에서 사라졌다 (#558)"
    failed=1
  fi
done
orig_bytes="$(wc -c </tmp/agents-original.md | tr -d ' ')"
if cmp -s -n "${orig_bytes}" /tmp/agents-original.md AGENTS.md; then
  echo "✓ 설치자 본문이 바이트 그대로 파일 앞에 있다"
else
  echo "FAIL: 설치자 본문 바이트가 바뀌었다"
  failed=1
fi
blocks="$(grep -c '^<!-- uzys-harness:agents:start -->$' AGENTS.md)"
if [[ "${blocks}" -eq 1 ]] && grep -q '^## Harness Rules' AGENTS.md; then
  echo "✓ 하네스 몫은 블록 하나 (룰 포함)"
else
  echo "FAIL: 하네스 블록이 ${blocks}개이거나 룰 절이 없다"
  failed=1
fi
if ls AGENTS.md.backup-* >/dev/null 2>&1; then
  echo "FAIL: 함께 쓰는 파일인데 백업이 생겼다 — 몫만 바꿨다면 잃을 것이 없다"
  failed=1
fi
echo ""

if [[ "${failed}" -eq 0 ]]; then
  echo "PASS: scenario-realcli-shared-files"
  exit 0
fi
echo "FAIL: scenario-realcli-shared-files"
exit 1
