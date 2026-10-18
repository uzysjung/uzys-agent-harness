#!/usr/bin/env bash
# B1 — 실사용 과제 후보 저장소 조사: 에이전트 지시 파일 부재 확인(+ 대조군) · 테스트를 동반한 최근 머지 PR 1건.
# gh api 만 쓴다(읽기 전용). 출력은 마크다운.
set -u
PATHS=(CLAUDE.md AGENTS.md .claude .cursor .cursorrules GEMINI.md .github/copilot-instructions.md .windsurfrules .clinerules)
CANDIDATES=(
  uzysjung/uzys-agent-harness   # 대조군 — 여기서는 FOUND 가 나와야 한다
  chalk/chalk tj/commander.js yargs/yargs sindresorhus/execa colinhacks/zod
  pallets/click encode/httpx hynek/structlog Textualize/rich fastapi/typer psf/requests
  casey/just sharkdp/bat sharkdp/hyperfine jqlang/jq
  junegunn/fzf spf13/cobra go-chi/chi stretchr/testify tidwall/gjson
)
DEEPSWE_PROV=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/dl/deep-swe/PROVENANCE.md

echo "# 실사용 과제 후보 저장소 조사 (gh api, $(date -u +%Y-%m-%d))"
echo
echo "검사 경로: ${PATHS[*]}"
echo
echo "| 저장소 | 지시 파일 | DeepSWE 겹침 | 기본 브랜치 | 최근 머지 PR(테스트 동반 · 이슈 연결) |"
echo "|---|---|---|---|---|"
for repo in "${CANDIDATES[@]}"; do
  found=""
  for p in "${PATHS[@]}"; do
    if gh api -X GET "repos/$repo/contents/$p" --silent >/dev/null 2>&1; then found="$found $p"; fi
  done
  [ -z "$found" ] && found="none"
  overlap="no"; grep -q "| $repo " "$DEEPSWE_PROV" 2>/dev/null && overlap="YES"
  branch=$(gh api "repos/$repo" --jq .default_branch 2>/dev/null || echo "?")
  pr_cell="-"
  if [ "$found" = "none" ] && [ "$overlap" = "no" ]; then
    # 최근 머지 PR 20건 중 본문이 이슈를 닫고 테스트 파일을 건드린 첫 1건
    while IFS=$'\t' read -r num title; do
      [ -z "$num" ] && continue
      body=$(gh pr view "$num" -R "$repo" --json body --jq .body 2>/dev/null)
      echo "$body" | grep -qiE "(close[sd]?|fix(e[sd])?|resolve[sd]?) +#[0-9]+" || continue
      tests=$(gh pr view "$num" -R "$repo" --json files --jq '[.files[].path | select(test("(^|/)(test|tests|spec|__tests__)(/|_|\\.)|_test\\.(go|rs|py|js|ts)$|\\.test\\.|\\.spec\\."))] | length' 2>/dev/null)
      [ "${tests:-0}" -gt 0 ] || continue
      issue=$(echo "$body" | grep -oiE "(close[sd]?|fix(e[sd])?|resolve[sd]?) +#[0-9]+" | head -1 | grep -oE "#[0-9]+")
      pr_cell="#$num ($title) → $issue · 테스트 파일 $tests"
      break
    done < <(gh pr list -R "$repo" --state merged --limit 20 --json number,title --jq '.[] | [.number, .title] | @tsv' 2>/dev/null)
  fi
  echo "| $repo | $found | $overlap | $branch | $pr_cell |"
done
