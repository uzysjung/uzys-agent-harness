#!/usr/bin/env bash
# 데모 GIF 재녹화 (재현 가능) — Docker 격리에서 현재 빌드의 install 을 캡처.
#
# 사용:  bash scripts/record-demo.sh
# 산출물: docs/assets/agent-harness-demo.{cast,gif}  (README 첫 화면 참조)
# 호스트 오염 0 (컨테이너 격리). **매 릴리스 후 재실행** → 구식(플래그/자산 수) 박제 방지.
#
# 배경: 기존 데모는 로컬 일회성(소스 미커밋)으로 생성돼 v26.81.0 --with-ecc·템플릿 수가
#       구식으로 박제됐다(Issue 후속). 본 스크립트로 소스를 커밋 = drift 재발 차단.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=harness-demo:latest

echo "▸ docker build (asciinema + agg + 현재 빌드)"
docker build -f scripts/demo.Dockerfile -t "$IMAGE" .

echo "▸ docker run — install 캡처 + gif 변환"
docker run --rm -t -v "$PWD/docs/assets:/out" "$IMAGE"

echo "✓ docs/assets/agent-harness-demo.{cast,gif} 갱신 완료 (README 참조 그대로)."
