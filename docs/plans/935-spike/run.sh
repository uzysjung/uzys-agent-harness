#!/bin/sh
# #935 스파이크 재현 — 컨테이너 안에서만 돌린다(npm 설치가 있다). 저장소를 /repo 에 읽기 전용으로 붙인다.
#   docker run --rm -v "$PWD:/repo:ro" node:20-bookworm sh /repo/docs/plans/935-spike/run.sh
# ⓐ @shadcn/lint(ESLint · Oxlint)가 hono/jsx 의 class 속성에서 위반을 잡는가 — #820 Fastify 스파이크와 같은 설정
# ⓑ hono/jsx 가 자식·속성을 기본으로 이스케이프하는가(raw() = 대조군)
# ⓒ testClient 타입이 체이닝(서브앱 .route() 포함)에만 잡히는가 — typing-ok 는 통과, typing-bad 는 실패해야 한다
set -u
SPIKE=/repo/docs/plans/935-spike
W=$(mktemp -d)

cp -r "$SPIKE/hono" "$W/hono"
cd "$W/hono" || exit 3
npm install --no-audit --no-fund --silent oxlint@latest >/dev/null 2>&1 || { echo "npm install 실패"; exit 3; }
npm ls --depth=0

echo "== ⓐ lint"
npx eslint .
echo "eslint exit=$?"
npx oxlint src
echo "oxlint exit=$?"

echo "== ⓑ escape"
npx tsc -p tsconfig.json --outDir out
echo "tsc(ok) exit=$?"
node out/escape.js

echo "== ⓒ testClient typing"
npx tsc -p tsconfig.bad.json --noEmit
echo "tsc(bad) exit=$?"
