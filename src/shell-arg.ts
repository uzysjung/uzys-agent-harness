/**
 * 화면이 복사해 붙여 넣으라고 내는 명령 · id 의 인자 하나 (#944).
 *
 * 키 id 에는 셸이 펼치는 글자가 들어갈 수 있다 — `opencode:instructions[=.agents/rules/*.md]` 는 따옴표 없이 붙여 넣으면 zsh 가
 * `no matches found` 로 명령째 거절한다(bash 는 그대로 넘기지만 그 판정은 셸 옵션에 달렸다). 그런 글자가 있을 때만 작은따옴표로
 * 감싼다 — 나머지 id(`mcp:context7` · `settings:hooks.SessionStart#session-start.sh`)는 화면 그대로다.
 */
const SHELL_SPECIAL = /[\s*?[\]{}()$`'"\\;&|<>!]/;

export function shellArg(s: string): string {
  return SHELL_SPECIAL.test(s) ? `'${s.replaceAll("'", `'\\''`)}'` : s;
}
