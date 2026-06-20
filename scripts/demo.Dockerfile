# 데모 재녹화 — Docker 격리에서 현재 빌드의 install 을 asciinema 로 캡처 → gif.
# 호스트 오염 0 (컨테이너 격리). scripts/record-demo.sh 가 build + run.
# 구식 박제 방지: 매 릴리스 후 재실행 → cast/gif 가 현재 코드 출력으로 자동 최신화.
FROM node:22-bookworm

# asciinema(rec) + agg(cast→gif). agg 는 arch 분기 binary.
RUN apt-get update && apt-get install -y --no-install-recommends python3-pip curl ca-certificates \
 && pip3 install --break-system-packages asciinema \
 && ARCH="$(uname -m)" \
 && case "$ARCH" in \
      aarch64) A=agg-aarch64-unknown-linux-gnu ;; \
      *)       A=agg-x86_64-unknown-linux-gnu ;; \
    esac \
 && curl -fsSL "https://github.com/asciinema/agg/releases/latest/download/$A" -o /usr/local/bin/agg \
 && chmod +x /usr/local/bin/agg \
 && rm -rf /var/lib/apt/lists/*

# 실 claude CLI (plugin install 캡처용 — install 이 외부 plugin 자산 설치).
RUN npm i -g @anthropic-ai/claude-code

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build \
 && git config --global url."https://github.com/".insteadOf "git@github.com:"

CMD ["bash", "scripts/demo-capture.sh"]
