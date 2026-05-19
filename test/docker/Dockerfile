# v26.64.0 — Docker test environment for project-scope install verification.
#
# 목표:
#   - 사용자 PC 글로벌 (~/.claude/, ~/.codex/, ~/.opencode/, npm -g) 미오염
#   - install --scope project/global 의 fs 동작을 컨테이너 안에서 isolated 검증

FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash git jq \
  && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash uzys

# Mock CLIs (claude/skills — 폐쇄형 또는 외부 의존 stub)
COPY test/docker/mocks/claude /usr/local/bin/claude
COPY test/docker/mocks/skills /usr/local/bin/skills
RUN chmod +x /usr/local/bin/claude /usr/local/bin/skills

# Build as root (tsup 임시 파일 write 권한 회피).
# install 검증은 uzys 사용자로 별도 phase 에서 (Docker stage 한 image 안 root + uzys 둘 다 사용).
WORKDIR /work
COPY . /work
RUN npm ci --ignore-scripts \
  && npm run build \
  && npm install -g .

# uzys 사용자가 컨테이너 안 ~/.claude, ~/.codex 등 자기 home 에 write 가능해야 함.
# /work 는 root:root 소유지만 readable + executable — uzys 가 시나리오 스크립트 실행 OK.
USER uzys
WORKDIR /home/uzys

ENTRYPOINT ["/bin/bash"]
