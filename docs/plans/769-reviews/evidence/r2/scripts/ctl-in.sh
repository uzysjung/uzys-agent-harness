#!/usr/bin/env bash
# 컨테이너 안(root): main 판을 전역에 덮어 깔고 uzys 로 브랜치 시나리오를 친다 — 음성 대조
npm install -g /pk/main/uzysjung-agent-harness-26.173.0.tgz >/dev/null 2>&1
su uzys -c "HOME=/home/uzys agent-harness --version; /work/test/docker/scenarios/scenario-uninstall-cli.sh"
