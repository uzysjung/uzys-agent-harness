# 측정용 실행 환경 — 사용자 전역 설정 · 개인 지시문 · 외부 스킬 · 프로젝트 opencode.json(MCP) 제외, 폴더 밖 · 셸 · 웹 금지
ocenv() {
  env -i PATH="$PATH" HOME="$HOME" TERM=dumb LANG=en_US.UTF-8 XDG_CONFIG_HOME="$OCB/xdgcfg" XDG_DATA_HOME="$OCB/xdgdata" XDG_STATE_HOME="$OCB/xdgstate" \
    OPENCODE_DISABLE_AUTOUPDATE=1 OPENCODE_DISABLE_CLAUDE_CODE_PROMPT=1 \
    OPENCODE_DISABLE_EXTERNAL_SKILLS=1 OPENCODE_DISABLE_LSP_DOWNLOAD=1 OPENCODE_CONFIG_CONTENT="$(cat $OCB/opencode-scope.json)" \
    "$@"
}
