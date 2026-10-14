#!/bin/sh
# #820 스파이크 재현 — 컨테이너 안에서만 돌린다(npm·pip 설치가 있다). 저장소를 /repo 에 읽기 전용으로 붙인다.
#   docker run --rm -v "$PWD:/repo:ro" node:22-bookworm sh /repo/docs/plans/820-spike/run.sh
# ⓐⓑ Fastify 서버 JSX + daisyUI + @shadcn/lint(ESLint · Oxlint) · ⓒ FastAPI Jinja + ast-grep.
# ⓒ 의 규칙은 배포 룰 본문(templates/rules/htmx-fastapi-ui.md)의 yaml 블록을 그대로 꺼내 쓴다 — 사본을 두지 않는다.
set -u
SPIKE=/repo/docs/plans/820-spike
W=$(mktemp -d)

echo "== ⓐⓑ fastify"
cp -r "$SPIKE/fastify" "$W/fastify"
cd "$W/fastify" || exit 3
npm install --no-audit --no-fund --silent oxlint@latest >/dev/null 2>&1 || { echo "npm install 실패"; exit 3; }
npm ls --depth=0
npx eslint .
echo "eslint exit=$?"
npx oxlint src
echo "oxlint exit=$?"

echo "== ⓒ fastapi"
cp -r "$SPIKE/fastapi" "$W/fastapi"
cd "$W/fastapi" || exit 3
mkdir -p rules
awk '/^```yaml$/{n++; on=1; next} /^```$/{on=0; next} on && n==1' /repo/templates/rules/htmx-fastapi-ui.md > sgconfig.yml
awk '/^```yaml$/{n++; on=1; next} /^```$/{on=0; next} on && n==2' /repo/templates/rules/htmx-fastapi-ui.md > rules/tailwind.yml
npm i -g --silent @ast-grep/cli >/dev/null 2>&1 || { echo "ast-grep 설치 실패"; exit 3; }
ast-grep --version
ast-grep scan --report-style short
echo "ast-grep exit=$?"
