"""#513 — Pier 커스텀 에이전트 골격: B 구성(하네스 설치 뒤 Claude Code).

2단계에서 쓴다. 1단계에서는 실행하지 않았다(유료). 구조만 고정한다. 부모 클래스의 필드 이름은
datacurve-pier 0.3.1 설치본(`pier/agents/installed/claude_code.py` · `pier/models/agent/install.py`)에서 2026-10-18 확인했다.

    pier run -p <tasks> --agent-import-path docs/plans/513-eval-evidence/pier-agent-b.py:HarnessedClaudeCode --ak track=base ...

원칙
- A 는 Pier 내장 `claude-code` 그대로. B 는 그 클래스를 상속해 **설치 단계 하나**만 더한다.
  Claude Code 실행 명령·플래그·환경변수는 부모 것을 그대로 쓴다 — 두 팔의 차이는 하네스 설치 유무뿐이다.
- 설치 명령은 설계 문서 §4 에 고정: `agent-harness install --track base --cli claude` (실사용 과제는 `--track tooling`).
- 하네스가 쓴 파일은 과제 저장소의 **채점 대상 diff 에 들어가지 않게** 한다 (실측 2026-10-18 — 설치가 `.gitignore` 를
  고치고 untracked 6개를 만든다: `feasibility/harness-install-in-deepswe-image.txt`):
  tracked 변경은 되돌리고, untracked 하네스 경로는 `.git/info/exclude` 에 적는다.
  설치 전후 `git status --porcelain` 이 같아야 한다 — 다르면 trial 을 실패(exit 97)로 기록한다.
- 설치 로그 · 설치 기록(`.uzys-agent-harness/.harness-install.json`)은 /logs/agent/ 로 복사해 "B 가 실제로 B 였다"의 증거로 남긴다.
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


class HarnessedClaudeCode(ClaudeCode):
    """B 팔. 부모(A)와의 차이 = install_spec 에 하네스 설치 단계가 하나 더 있다."""

    def __init__(self, *args, track: str = "base", **kwargs):
        super().__init__(*args, **kwargs)
        self._track = track

    def install_spec(self) -> AgentInstallSpec:
        parent = super().install_spec()
        exclude_lines = "\\n".join(HARNESS_PATHS_EXCLUDED)
        harness_step = InstallStep(
            user="agent",
            run=(
                "set -e; cd /app; mkdir -p /logs/agent; "
                "git status --porcelain > /tmp/status-before.txt; "
                f"npm install -g --no-fund --no-audit @uzysjung/agent-harness@{HARNESS_VERSION}; "
                f"agent-harness install --track {self._track} --cli claude > /logs/agent/harness-install.log 2>&1; "
                "cp .uzys-agent-harness/.harness-install.json /logs/agent/harness-install-record.json; "
                # tracked 파일(.gitignore)의 하네스 변경은 되돌린다 — 채점 diff 는 에이전트 작업만 담아야 한다.
                "git checkout -- . ; "
                f"printf '{exclude_lines}\\n' >> .git/info/exclude; "
                "git status --porcelain > /tmp/status-after.txt; "
                "diff /tmp/status-before.txt /tmp/status-after.txt > /logs/agent/harness-git-status-diff.txt "
                "|| { echo 'harness install changed git status' >&2; exit 97; }"
            ),
        )
        # 부모의 설치 단계(Claude Code 설치) 뒤에 붙인다. 네트워크는 Pier 가 설치 단계에 열어 준다.
        return AgentInstallSpec(
            agent_name=parent.agent_name,
            version=parent.version,
            steps=[*parent.steps, harness_step],
            verification_command=parent.verification_command,
            cache_key=f"{parent.cache_key or parent.agent_name}+uzys-{HARNESS_VERSION}-{self._track}",
            metadata={**parent.metadata, "uzys_harness": HARNESS_VERSION, "track": self._track},
        )

    # 네트워크 allowlist: 부모 것(ANTHROPIC_BASE_URL 호스트) 그대로. context7 MCP 는 no-network 과제에서
    # 연결에 실패하고 Claude Code 가 MCP_TIMEOUT(30s) 뒤 진행한다 — 그 비용은 B 의 비용으로 집계한다(설계 §8).
