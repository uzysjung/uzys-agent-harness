# eval-513-glm — Claude Code 를 GLM Coding Plan(Z.ai) 으로 돌리는 실행 컨테이너 (#513 1단계).
#
# 원칙
#   - 토큰은 이미지에 없다. 실행 시 `--env-file <저장소 밖 파일>` 로만 들어온다 (smoke-glm.sh 참고).
#   - 호스트 ~/.claude 를 마운트하지 않는다. 컨테이너 안 HOME 은 비어 있는 /home/eval 이다.
#   - 버전은 핀한다 — A/B 가 같은 Claude Code · 같은 하네스 판을 쓴다는 것이 비교의 전제다.
#   - 자동 업데이트 · 비필수 트래픽을 끈다 (A/B 사이에 바이너리가 바뀌는 것을 막는다).
#
# 빌드:  docker build -t eval-513-glm -f docs/plans/513-eval-evidence/glm-container/Dockerfile .
#        (빌드 컨텍스트 내용은 쓰지 않는다 — 어느 디렉터리에서 빌드해도 같다)
#
# Claude Code 는 npm 패키지가 네이티브 바이너리를 내려받는다 (linux-arm64 지원 — code.claude.com/docs/en/setup, 2026-10-18 확인).

FROM node:22-bookworm-slim

ARG CLAUDE_CODE_VERSION=2.1.302
ARG HARNESS_VERSION=26.174.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash git jq curl ca-certificates ripgrep procps \
  && rm -rf /var/lib/apt/lists/*

# 실행 사용자 — root 가 아니어야 Claude Code 가 bypassPermissions 를 받는다.
RUN useradd -m -s /bin/bash eval

# Claude Code (핀) + 하네스 (핀). 둘 다 글로벌 — 컨테이너 격리라 호스트에는 아무것도 안 생긴다.
RUN npm install -g --no-fund --no-audit \
      "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
      "@uzysjung/agent-harness@${HARNESS_VERSION}" \
  && claude --version \
  && agent-harness --version

# 라우팅은 환경변수로만 — 값은 Z.ai 공식 문서(docs.z.ai/devpack/tool/claude, 2026-10-18 확인) 그대로.
# ANTHROPIC_AUTH_TOKEN 은 여기 없다. --env-file 로 들어온다.
ENV ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic \
    API_TIMEOUT_MS=3000000 \
    DISABLE_AUTOUPDATER=1 \
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    DISABLE_TELEMETRY=1 \
    HOME=/home/eval

# 모델 매핑 기본값 — 실행 시 --env-file 로 덮어쓸 수 있다. Z.ai 문서의 수동 설정 예시값.
ENV ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.3 \
    ANTHROPIC_DEFAULT_SONNET_MODEL=glm-5.3 \
    ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-5.3-flash

COPY --chmod=0755 docs/plans/513-eval-evidence/glm-container/entry.sh /usr/local/bin/eval-entry
COPY --chmod=0755 docs/plans/513-eval-evidence/glm-container/run-task.sh /usr/local/bin/eval-run-task

USER eval
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/eval-entry"]
CMD ["bash"]
