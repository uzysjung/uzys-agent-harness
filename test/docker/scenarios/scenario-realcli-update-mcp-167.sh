#!/usr/bin/env bash
# #722 · #712 · #711 (ADR-106) — 게시판 26.166.0 으로 깐 설치본을 이 판으로 update 하면 실 CLI 가 결과를 받는가.
#
# 단위 테스트(`tests/mcp-migration-167.test.ts`)는 파일 바이트와 화면을 문다(옛 판은 옛 템플릿으로 흉내 낸다). 여기서는 **진짜
# 게시판 26.166.0** 의 산출물에서 출발해 ① update 뒤 옛 github 가 걷히고 railway 가 원격으로 바뀌며 화면이 그렇게 말하는지,
# ② 실 codex · opencode 가 원격 정의(`url` · `type: "remote"`)와 토큰 환경변수 정의(`bearer_token_env_var` · `{env:…}`)를 설정
# 오류 없이 받는지를 본다. OAuth 로그인 완주는 범위 밖(계정 필요) — 연결 상태는 판정하지 않는다.

set -uo pipefail # set -e 제외: 판정마다 failed 를 모은다.

echo "▸ scenario-realcli-update-mcp-167: 26.166.0 → 이 판 update 뒤 실 CLI 가 원격 MCP 를 받는가 (#722 #712 #711)"
echo ""
failed=0
codex --version 2>&1 | sed 's/^/  codex /'
opencode --version 2>&1 | sed 's/^/  opencode /'

# ── ① 26.166.0 설치본 → update ─────────────────────────────────────────
P=/tmp/proj-mcp167
rm -rf "${P}"
mkdir -p "${P}"
cd "${P}" || exit 1
# 게시판을 따로 받는다 — `npx` 는 이미 전역에 깔린 같은 이름(이 판 빌드, package.json 버전이 같을 수 있다)을 쓴다
OLD=/tmp/harness-166
npm install --prefix "${OLD}" --no-audit --no-fund @uzysjung/agent-harness@26.166.0 >/tmp/old-npm.log 2>&1 || {
  echo "FAIL: 게시판 26.166.0 을 받지 못했다"
  tail -20 /tmp/old-npm.log
  exit 1
}
"${OLD}/node_modules/.bin/agent-harness" install --track csr-fastapi --cli claude --cli codex --cli opencode \
  --with-codex-trust --scope project >/tmp/old-install.log 2>&1 || {
  echo "FAIL: 26.166.0 install 실패"
  tail -30 /tmp/old-install.log
  exit 1
}
if jq -e '.mcpServers | has("github")' .mcp.json >/dev/null && grep -q '^\[mcp_servers.github\]' .codex/config.toml; then
  echo "✓ 대조군: 26.166.0 은 github 를 .mcp.json · Codex 에 깔았다"
else
  echo "FAIL: 대조군 — 26.166.0 설치본에 github 가 없다. 아래 판정이 증거가 아니다"
  failed=1
fi

agent-harness update >/tmp/update.log 2>&1 || {
  echo "FAIL: update 실패"
  tail -30 /tmp/update.log
  exit 1
}
if jq -e '.mcpServers | has("github") | not' .mcp.json >/dev/null \
  && jq -e '.mcp | has("github") | not' opencode.json >/dev/null \
  && ! grep -q '^\[mcp_servers.github\]' .codex/config.toml; then
  echo "✓ update 가 옛 github 를 세 자리에서 걷었다"
else
  echo "FAIL: update 뒤에도 옛 github 가 남았다"
  failed=1
fi
if [[ "$(jq -c '.mcpServers["railway-mcp-server"]' .mcp.json)" == '{"type":"http","url":"https://mcp.railway.com"}' ]] \
  && [[ "$(jq -c '.mcp["railway-mcp-server"]' opencode.json)" == '{"type":"remote","url":"https://mcp.railway.com"}' ]] \
  && grep -A1 '^\[mcp_servers.railway-mcp-server\]' .codex/config.toml | grep -q '^url = "https://mcp.railway.com"$'; then
  echo "✓ railway 가 세 자리 모두 원격 정의로 바뀌었다"
else
  echo "FAIL: railway 원격 교체가 안 됐다: $(jq -c '.mcpServers["railway-mcp-server"]' .mcp.json)"
  failed=1
fi
if jq -e '.mcpServers["chrome-devtools"].args | index("--no-usage-statistics")' .mcp.json >/dev/null; then
  echo "✓ chrome-devtools 가 통계를 끈 인자로 바뀌었다"
else
  echo "FAIL: chrome-devtools 인자가 갱신되지 않았다"
  failed=1
fi
for want in "retired: github — the old @modelcontextprotocol/server-github" \
  "railway-mcp-server (now Railway's remote server" \
  "codex mcp login railway-mcp-server" "opencode mcp auth railway-mcp-server"; do
  if grep -qF -- "${want}" /tmp/update.log; then
    echo "✓ update 화면: ${want}"
  else
    echo "FAIL: update 화면에 '${want}' 가 없다"
    failed=1
  fi
done

# 실 CLI 가 원격 정의를 받는다 — 설정 오류(exit ≠ 0)가 없고 이름이 보인다
cx="$(codex mcp list 2>&1)"; cx_code=$?
if [[ ${cx_code} -eq 0 ]] && printf '%s\n' "${cx}" | grep -q 'railway-mcp-server'; then
  echo "✓ 실 codex mcp list 가 원격 railway 를 받는다"
  printf '%s\n' "${cx}" | sed 's/^/    /'
else
  echo "FAIL: codex mcp list (exit ${cx_code}): ${cx}"
  failed=1
fi
oc="$(opencode mcp list 2>&1)"; oc_code=$?
printf '%s\n' "${oc}" | sed 's/^/    /' | head -20
if opencode debug config 2>/dev/null | jq -e '.mcp["railway-mcp-server"].type == "remote"' >/dev/null; then
  echo "✓ 실 opencode 가 설정을 받고 railway 를 remote 로 본다 (mcp list exit ${oc_code})"
else
  echo "FAIL: opencode debug config 가 railway 를 remote 로 보지 않는다"
  failed=1
fi
echo ""

# ── ② --with github-mcp — 토큰은 환경변수 이름만, 실 CLI 가 그 정의를 받는다 ─────
P2=/tmp/proj-mcp167-gh
rm -rf "${P2}"
mkdir -p "${P2}"
cd "${P2}" || exit 1
GITHUB_PAT=ghp_scenario_secret_value agent-harness install --track tooling --cli claude --cli codex --cli opencode \
  --with github-mcp --with-codex-trust --scope project >/tmp/gh-install.log 2>&1 || {
  echo "FAIL: --with github-mcp install 실패"
  tail -30 /tmp/gh-install.log
  exit 1
}
if grep -rqF ghp_scenario_secret_value .mcp.json .codex/config.toml opencode.json; then
  echo "FAIL: 토큰 값이 파일에 박혔다"
  failed=1
else
  echo "✓ 토큰 값은 세 파일 어디에도 없다(변수 이름만)"
fi
grep -qF 'github-mcp needs GITHUB_PAT' /tmp/gh-install.log && echo "✓ 설치 화면이 GITHUB_PAT 를 안내한다" || {
  echo "FAIL: 설치 화면에 GITHUB_PAT 안내가 없다"
  failed=1
}
cx="$(GITHUB_PAT=dummy codex mcp list 2>&1)"; cx_code=$?
if [[ ${cx_code} -eq 0 ]] && printf '%s\n' "${cx}" | grep -q 'github-mcp'; then
  echo "✓ 실 codex 가 bearer_token_env_var 정의를 받는다"
  printf '%s\n' "${cx}" | sed 's/^/    /'
else
  echo "FAIL: codex mcp list (exit ${cx_code}): ${cx}"
  failed=1
fi
if GITHUB_PAT=dummy opencode debug config 2>/dev/null \
  | jq -e '.mcp["github-mcp"].type == "remote" and .mcp["github-mcp"].oauth == false' >/dev/null; then
  echo "✓ 실 opencode 가 헤더 인증 원격 정의(oauth:false)를 받는다"
else
  echo "FAIL: opencode 가 github-mcp 정의를 받지 않는다"
  failed=1
fi
echo ""

if [[ "${failed}" -eq 0 ]]; then
  echo "PASS: scenario-realcli-update-mcp-167"
  exit 0
fi
echo "FAIL: scenario-realcli-update-mcp-167"
exit 1
