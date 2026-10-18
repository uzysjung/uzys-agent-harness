"""#513 — Pier 커스텀 에이전트: B 구성(하네스 설치 뒤 Claude Code).

    pier run -p <tasks> --agent-import-path pier_agent_b:HarnessedClaudeCode --ak track=base ...

부모 클래스의 필드·메서드 이름은 datacurve-pier 0.3.1 설치본(`pier/agents/installed/claude_code.py` · `base.py` ·
`pier/models/agent/install.py` · `environments/agent_setup.py`)에서 2026-10-18 확인했다.

원칙
- A 는 Pier 내장 `claude-code` 그대로. B 는 그 클래스를 상속해 **설치 단계 하나**와 **실행 직전 복사 하나**만 더한다.
  Claude Code 실행 명령·플래그·환경변수는 부모 것을 그대로 쓴다 — 두 팔의 차이는 하네스 설치 유무뿐이다.
- 설치 명령은 설계 문서 §4.2 에 고정: `agent-harness install --track base --cli claude` (실사용 과제는 저장소 스택의 트랙).
- 하네스가 쓴 파일을 **되돌리지 않는다**(설계 검증 B2 — `git checkout -- .` 는 상류 CLAUDE.md 에 더해진 import 줄을 지워
  B 를 부분-A 로 만든다). 대신: 설치가 고친 tracked 파일(`.gitignore` · 있으면 `CLAUDE.md` · `AGENTS.md`)은
  `git update-index --skip-worktree`, untracked 하네스 경로는 `.git/info/exclude`. 디스크의 하네스 몫은 그대로 로드되고
  `git add .` · `commit -a` · 검증기의 `git diff <base> HEAD` 에는 들어가지 않는다 (실측: `feasibility/harness-skipworktree-in-deepswe-image.txt`).
  한계: 에이전트가 그 파일을 고의로 고친 변경도 diff 에서 빠진다 — 벤치마크 과제에서는 일어나지 않는 편집이고 `model.patch` 사후 점검으로 본다.
- 설치 전후 `git status --porcelain` 이 같아야 한다. 다르면 exit 97 → **이미지 빌드 실패**다(설치 단계는 docker build 의 RUN).
  그 과제는 **두 팔 모두에서 제외하고 목록에 적는다** — B 에서만 조용히 빠지지 않게 한다(run-pilot.sh 가 B 빌드 실패 과제를 A 결과에서도 뺀다).
- "B 가 실제로 B 였다"의 증거(설계 §10 5): 설치 단계는 빌드 시점이라 `/logs/agent` 에 쓴 것은 실행 시 bind mount 에 가려진다.
  그래서 `/opt/eval-513/` 에 쓰고, `run()` 이 `super().run()` 직전에 `/logs/agent/` 로 복사한다.
"""

from __future__ import annotations

from pier.agents.installed.claude_code import ClaudeCode
from pier.models.agent.install import AgentInstallSpec, InstallStep

HARNESS_VERSION = "26.174.0"  # 결과를 보기 전에 고정. 바꾸면 사유를 커밋 본문에.
HARNESS_PATHS_EXCLUDED = (
    ".claude/",
    ".uzys-agent-harness/",
    ".mcp.json",
    "CLAUDE.md",
    "CLAUDE-uzys-harness.md",
    ".github/workflows/ci.yml",
    "AGENTS.md",
    ".agents/",
)
SHARED_TRACKED = (".gitignore", "CLAUDE.md", "AGENTS.md")  # 설치가 "하네스 몫"을 더하는 함께 쓰는 파일
EVIDENCE_DIR = "/opt/eval-513"


class HarnessedClaudeCode(ClaudeCode):
    """B 팔. 부모(A)와의 차이 = 설치 단계 하나 + 실행 직전 증거 복사."""

    def __init__(self, *args, track: str = "base", **kwargs):
        super().__init__(*args, **kwargs)
        self._track = track

    def install_spec(self) -> AgentInstallSpec:
        parent = super().install_spec()
        exclude_lines = " ".join(HARNESS_PATHS_EXCLUDED)
        skip_cmd = " ".join(
            f'(git ls-files --error-unmatch {f} >/dev/null 2>&1 && git update-index --skip-worktree {f} && echo "skip-worktree {f}" >> {EVIDENCE_DIR}/harness-git.txt || true);'
            for f in SHARED_TRACKED
        )
        harness_step = InstallStep(
            user="root",  # npm -g · /opt 쓰기. 부모의 root 단계와 같은 사용자(N2 — 설치 단계는 root 로 돈다)
            run=(
                "set -e; cd /app; "
                f"mkdir -p {EVIDENCE_DIR}; "
                "git config --global --add safe.directory /app; "
                f"git status --porcelain > {EVIDENCE_DIR}/status-before.txt; "
                f"npm install -g --no-fund --no-audit @uzysjung/agent-harness@{HARNESS_VERSION}; "
                f"agent-harness install --track {self._track} --cli claude > {EVIDENCE_DIR}/harness-install.log 2>&1; "
                f"cp .uzys-agent-harness/.harness-install.json {EVIDENCE_DIR}/harness-install-record.json; "
                f"{skip_cmd} "
                f"for p in {exclude_lines}; do echo \"$p\" >> .git/info/exclude; done; "
                f"git status --porcelain > {EVIDENCE_DIR}/status-after.txt; "
                f"diff {EVIDENCE_DIR}/status-before.txt {EVIDENCE_DIR}/status-after.txt > {EVIDENCE_DIR}/harness-git-status-diff.txt "
                "|| { echo 'harness install changed git status — task excluded from BOTH arms' >&2; exit 97; }; "
                f"chmod -R a+rX {EVIDENCE_DIR}; chmod -R a+rwX /app/.claude /app/.uzys-agent-harness 2>/dev/null || true"
            ),
        )
        return AgentInstallSpec(
            agent_name=parent.agent_name,
            version=parent.version,
            steps=[*parent.steps, harness_step],
            verification_command=parent.verification_command,
            cache_key=f"{parent.cache_key or parent.agent_name}+uzys-{HARNESS_VERSION}-{self._track}",
            metadata={**parent.metadata, "uzys_harness": HARNESS_VERSION, "track": self._track},
        )

    async def run(self, instruction, environment, context) -> None:
        # 증거 복사 — /logs/agent 는 실행 시에만 trial 폴더에 마운트된다.
        await self.exec_as_agent(
            environment,
            command=f"mkdir -p /logs/agent && cp -r {EVIDENCE_DIR}/. /logs/agent/ 2>/dev/null || true",
        )
        await super().run(instruction, environment, context)

    # 네트워크 allowlist: 부모 것(ANTHROPIC_BASE_URL 호스트) 그대로. context7 MCP 는 no-network 과제에서
    # 연결에 실패하고 Claude Code 가 MCP_TIMEOUT(30s) 뒤 진행한다 — 그 비용은 B 의 비용으로 집계한다(설계 §4.4).
