"""#513 — Pier 커스텀 에이전트: B 구성(하네스 설치 + 초기 정리 3회 결과 적용 뒤 Claude Code).

    PYTHONPATH=docs/plans/513-eval-evidence pier run -p <tasks> \
      --agent-import-path pier_agent_b:HarnessedClaudeCode --ak track=base --ak prep_dir=<저장소 밖>/prep ...

부모 클래스의 필드·메서드 이름은 datacurve-pier 0.3.1 설치본(`pier/agents/installed/claude_code.py` · `base.py` ·
`pier/models/agent/install.py` · `environments/agent_setup.py` · `environments/docker/docker.py` upload_file)에서 2026-10-18 확인했다.

원칙
- A 는 Pier 내장 `claude-code` 그대로. B 는 그 클래스를 상속해 **설치 단계 하나**와 **실행 직전 단계 하나**만 더한다.
  Claude Code 실행 명령·플래그·환경변수는 부모 것을 그대로 쓴다 — 두 팔의 차이는 하네스(+정리 결과) 유무뿐이다.
- 설치 명령은 설계 문서 §4.2 에 고정: `agent-harness install --track base --cli claude` (실사용 과제는 저장소 스택의 트랙).
- D9(사용자 결정 2026-10-18): B = 설치 + **초기 정리 3회**. 정리는 `prep-b.sh` 가 저장소+시작 커밋 단위로 한 번 만들고
  (과제 지시문 없이), 결과 `prep.tar` 를 같은 시작 커밋의 모든 과제·반복에 **똑같이** 적용한다 — `run()` 이 `super().run()`
  직전에 호스트의 `<prep_dir>/<task-id>/prep.tar` 를 `upload_file` 로 올려 /app 에 푼다. 빌드 단계가 아니라 실행 직전인 이유 =
  Pier 가 생성하는 Dockerfile 에 COPY 를 끼울 자리가 없다. 올리는 데 드는 몇 초는 `agent_execution` 에 들어간다(공시, §4.4).
- 하네스가 쓴 파일을 **되돌리지 않는다**(검증 B2). 설치가 고친 tracked 파일(`.gitignore` · 있으면 `CLAUDE.md` · `AGENTS.md`)은
  `git update-index --skip-worktree`, untracked 하네스 경로는 `.git/info/exclude`. 정리 결과를 푼 뒤에도 같은 규칙을 다시 적용한다.
  실측: `feasibility/harness-skipworktree-in-deepswe-image.txt`.
- 설치 전후 · 정리 적용 전후 `git status --porcelain` 이 같아야 한다. 빌드 단계의 불일치는 exit 97(이미지 빌드 실패),
  실행 직전의 불일치는 exit 98 — 둘 다 **그 과제를 두 팔 모두에서 제외**하고 목록에 적는다(summarize.sh).
- "B 가 실제로 B 였다"의 증거(설계 §10 5): 설치 단계가 `/opt/eval-513/` 에 쓰고 `run()` 이 `/logs/agent/` 로 복사한다
  (빌드 시점에 `/logs/agent` 에 쓴 것은 실행 시 bind mount 에 가려진다). 정리 적용 뒤 `CLAUDE.md` 의 `<!-- FILL:` 수도 거기 적는다.
"""

from __future__ import annotations

from pathlib import Path

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
SHARED_TRACKED = (".gitignore", "CLAUDE.md", "AGENTS.md")  # 설치·정리가 "하네스 몫"을 더하는 함께 쓰는 파일
EVIDENCE_DIR = "/opt/eval-513"
PREP_TAR_IN_CONTAINER = "/opt/eval-513/prep.tar"


def _skip_worktree_cmd() -> str:
    return " ".join(
        f'(git ls-files --error-unmatch {f} >/dev/null 2>&1 && git update-index --skip-worktree {f} && echo "skip-worktree {f}" >> {EVIDENCE_DIR}/harness-git.txt || true);'
        for f in SHARED_TRACKED
    )


class HarnessedClaudeCode(ClaudeCode):
    """B 팔. 부모(A)와의 차이 = 설치 단계 하나 + 실행 직전(정리 결과 적용 · 증거 복사)."""

    def __init__(self, *args, track: str = "base", prep_dir: str | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self._track = track
        self._prep_dir = Path(prep_dir) if prep_dir else None  # 없으면 "설치 직후" 상태(정리 0회) — D9 이전 구성, 보고서에 표시

    def install_spec(self) -> AgentInstallSpec:
        parent = super().install_spec()
        exclude_lines = " ".join(HARNESS_PATHS_EXCLUDED)
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
                f"{_skip_worktree_cmd()} "
                f"for p in {exclude_lines}; do echo \"$p\" >> .git/info/exclude; done; "
                f"git status --porcelain > {EVIDENCE_DIR}/status-after.txt; "
                f"diff {EVIDENCE_DIR}/status-before.txt {EVIDENCE_DIR}/status-after.txt > {EVIDENCE_DIR}/harness-git-status-diff.txt "
                "|| { echo 'harness install changed git status — task excluded from BOTH arms' >&2; exit 97; }; "
                f"echo \"after-install $(grep -c '<!-- FILL:' CLAUDE.md || true)\" > {EVIDENCE_DIR}/fill-count.txt; "
                f"chmod -R a+rwX {EVIDENCE_DIR} /app/.claude /app/.uzys-agent-harness 2>/dev/null || true"
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
        # 1) 정리 결과 적용 (D9) — 과제 id 폴더의 prep.tar. 없으면 정리 0회로 기록만 하고 진행한다.
        # trial 폴더 이름 = "<task-id>__<난수>" (실측: abs-stepped-slices__X9rVSv8). AgentContext 에는 과제 id 가 없다.
        task_id = Path(self.logs_dir).parent.name.split("__")[0]
        prep_tar = (self._prep_dir / task_id / "prep.tar") if self._prep_dir else None
        if prep_tar is not None and prep_tar.exists():
            await environment.upload_file(prep_tar, PREP_TAR_IN_CONTAINER)
            await self.exec_as_agent(
                environment,
                command=(
                    f"set -e; cd /app; git status --porcelain > {EVIDENCE_DIR}/status-before-prep.txt; "
                    f"tar -xf {PREP_TAR_IN_CONTAINER} -C /app; "
                    f"{_skip_worktree_cmd()} "
                    f"git status --porcelain > {EVIDENCE_DIR}/status-after-prep.txt; "
                    f"diff {EVIDENCE_DIR}/status-before-prep.txt {EVIDENCE_DIR}/status-after-prep.txt > {EVIDENCE_DIR}/prep-git-status-diff.txt "
                    "|| { echo 'prep apply changed git status — task excluded from BOTH arms' >&2; exit 98; }; "
                    f"echo \"after-prep $(grep -c '<!-- FILL:' CLAUDE.md || true)\" >> {EVIDENCE_DIR}/fill-count.txt; "
                    f"echo applied > {EVIDENCE_DIR}/prep-applied.txt"
                ),
            )
        else:
            await self.exec_as_agent(environment, command=f"echo none > {EVIDENCE_DIR}/prep-applied.txt")
        # 2) 증거 복사 — /logs/agent 는 실행 시에만 trial 폴더에 마운트된다.
        await self.exec_as_agent(
            environment,
            command=f"mkdir -p /logs/agent && cp -r {EVIDENCE_DIR}/. /logs/agent/ 2>/dev/null; rm -f /logs/agent/prep.tar; true",
        )
        await super().run(instruction, environment, context)

    # 네트워크 allowlist: 부모 것(ANTHROPIC_BASE_URL 호스트) 그대로. context7 MCP 는 no-network 과제에서
    # 연결에 실패하고 Claude Code 가 MCP_TIMEOUT(30s) 뒤 진행한다 — 그 비용은 B 의 비용으로 집계한다(설계 §4.5).
