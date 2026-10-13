FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends bash git jq ca-certificates && rm -rf /var/lib/apt/lists/*
COPY claude /usr/local/bin/claude
COPY skills /usr/local/bin/skills
RUN chmod +x /usr/local/bin/claude /usr/local/bin/skills
COPY pr.tgz main.tgz /pkgs/
RUN npm install -g /pkgs/pr.tgz >/dev/null 2>&1 && mkdir -p /opt/main && cd /opt/main && npm init -y >/dev/null && npm install /pkgs/main.tgz >/dev/null 2>&1 && ln -s /opt/main/node_modules/.bin/agent-harness /usr/local/bin/ah-main
RUN for v in 26.100.0 26.125.0 26.150.0 26.161.0; do mkdir -p /opt/old/$v && cd /opt/old/$v && npm init -y >/dev/null && npm install @uzysjung/agent-harness@$v >/dev/null 2>&1 || exit 1; done
RUN git config --global user.email r@x && git config --global user.name r
COPY check.sh /scripts/check.sh
