"""#513 — Pier 커스텀 에이전트: B 구성 = 하네스 설치 + **trial 안에서** 초기 정리 3회 + 과제 세션.

    PYTHONPATH=docs/plans/513-eval-evidence pier run -p <tasks> -i <task-id> \
      --agent-import-path pier_agent_b:HarnessedClaudeCode --ak track=base ...

부모 클래스의 필드·메서드 이름은 datacurve-pier 0.3.1 설치본(`pier/agents/installed/claude_code.py` run() 의 env 조립 ·
`base.py` exec_as_agent/build_process_env/NonZeroAgentExitCodeError · `models/trial/paths.py` EnvironmentPaths)에서 2026-10-18 확인했다.

구조(재검증 2차 — 경우를 덧대지 않고 구조를 바꿨다)
- A 는 Pier 내장 `claude-code` 그대로. B 는 그 클래스를 상속해 ⓐ 설치 단계 하나(이미지 빌드, root) ⓑ `run()` 앞단의 정리 구간을 더한다.
  정리는 **같은 컨테이너 · 같은 Pier egress 정책(API 호스트만) · 같은 사용자 · 같은 git 상태**에서 과제 세션 직전에 돈다 —
  별도 docker run · prep.tar · 키 매핑이 없다(1차 D9 구현의 결함 B1·B3·B4 가 그 구조에서 나왔다).
- 정리 1회 = 고정 프롬프트 PREP_PROMPT 로 `claude -p` **새 세션** 1번. 3회 누적. 과제 지시문(`instruction`)은 정리 구간에 **쓰지 않는다**
  — 코드가 보증한다(정리 구간은 `instruction` 을 참조하지 않는다). 정리가 끝나면 B2 규칙(skip-worktree · exclude)을 다시 적용하고 과제 세션(`super().run()`)을 시작한다.
- trial 마다 정리하므로 정리 결과가 trial 마다 다를 수 있다 — 설치자가 매 저장소에서 겪는 조건과 같다. 결과 파일(`prep/` 아래 세션 JSON ·
  `fill-count.txt` · `prep-git-status.txt`)을 trial 마다 남긴다. 예비 실험은 1회 반복이라 영향이 작다.
- 정리 비용·시간은 trial 의 정리 구간으로 분리 집계한다: 세션 JSON 의 `modelUsage`(서브에이전트 포함 — `usage` 아님) · `duration_ms` ·
  `prep-timing.txt`(벽시계). `agent_execution` 전체에서 정리 벽시계를 빼면 과제 구간이다(summarize.sh).
- 정리 실패 규칙(설계 §5.3): 세션의 **API·인프라 오류**(`api_error_status` 있음 · `terminal_reason == api_error` · 네트워크 예외)는 **1회 재실행**;
  그래도 실패면 `/logs/agent/prep-infra-error.txt` 에 적고 exit 96 → 그 trial 은 §5.3 "인프라 오류 1회 재실행" 규칙으로 간다(양팔 동일).
  **그 밖의 실패**(`is_error` · 턴 상한 · 정리가 하네스 경로 밖 소스를 건드림)는 **제품의 실패**다 — `/logs/agent/prep-failed.txt` 에 사유를 적고
  과제 세션 없이 exit 95 → 검증기 reward 0 = **B 의 실패로 집계, 제외하지 않는다**(B 에서만 빠지는 선택 편향을 막는다).
- 이미지 빌드 단계의 git 처리는 `/app` 이 git 저장소일 때만 한다(T-Bench 는 git 이 아니다 — 재검증 B2). 비-git 과제는 `git-repo: no` 를 남긴다.
  설치 전후 `git status --porcelain` 이 다르면 exit 97(빌드 실패) → §5.3 양팔 제외. 그 전에 `/logs/agent/excluded.txt` 를 못 쓰므로(빌드 시점)
  summarize.sh 는 trial 의 `exception.txt` 에 'exit 97' 이 있는 과제를 양팔 제외 목록으로 만든다.
- "B 가 실제로 B 였다"(설계 §10 5): 설치 단계가 `/opt/eval-513/` 에 쓴 것을 `run()` 이 `/logs/agent/` 로 복사한다(빌드 시점에 `/logs/agent` 에 쓴 것은
  실행 시 bind mount 에 가려진다). 정리 구간의 산출물은 `/logs/agent/prep/` 에 직접 쓴다.
"""

from __future__ import annotations

import json
import shlex

from pier.agents.installed.base import NonZeroAgentExitCodeError
from pier.agents.installed.claude_code import ClaudeCode
from pier.models.agent.install import AgentInstallSpec, InstallStep
from pier.models.trial.paths import EnvironmentPaths

HARNESS_VERSION = "26.174.0"  # 결과를 보기 전에 고정. 바꾸면 사유를 커밋 본문에.
# 설치 화면 FILL 안내("… or ask the audit-harness-fit skill to fill it from repository evidence")를 명령형으로 옮긴 고정 프롬프트.
PREP_PROMPT = "Use the audit-harness-fit skill to fill CLAUDE.md from repository evidence."
PREP_SESSIONS = 3
PREP_MAX_TURNS = 60
PREP_MAX_BUDGET_USD = 10
HARNESS_PATHS = (
    ".claude/",
    ".uzys-agent-harness/",
    ".mcp.json",
    "CLAUDE.md",
    "CLAUDE-uzys-harness.md",
    ".github/workflows/ci.yml",
    "AGENTS.md",
    ".agents/",
)
SHARED_TRACKED = (".gitignore", "CLAUDE.md", "AGENTS.md", ".mcp.json")  # 설치·정리가 "하네스 몫"을 더하는 함께 쓰는 파일(.mcp.json — 재검증 N6)
EVIDENCE_DIR = "/opt/eval-513"
AGENT_LOGS = str(EnvironmentPaths().agent_dir)  # /logs/agent — 호스트 trial 폴더에 bind mount
PREP_DIR = f"{AGENT_LOGS}/prep"


def _git_guard(body: str) -> str:
    # `fi;` — 뒤에 이어지는 명령과 반드시 `;` 로 끊는다(2026-10-18 리허설 1차: `fi echo …` 로 exit 2 = 셸 문법 오류 → 이미지 빌드 실패).
    return f"if git -C /app rev-parse --git-dir >/dev/null 2>&1; then {body} fi;"


def _skip_worktree_cmd(evidence_file: str) -> str:
    return " ".join(
        f'(git ls-files --error-unmatch {f} >/dev/null 2>&1 && git update-index --skip-worktree {f} && echo "skip-worktree {f}" >> {evidence_file} || true);'
        for f in SHARED_TRACKED
    )


class HarnessedClaudeCode(ClaudeCode):
    """B 팔. 부모(A)와의 차이 = 설치 단계 하나 + run() 앞단의 정리 구간."""

    def __init__(self, *args, track: str = "base", **kwargs):
        super().__init__(*args, **kwargs)
        self._track = track

    # ── 이미지 빌드 단계: 하네스 설치 ─────────────────────────────────────────────
    def install_spec(self) -> AgentInstallSpec:
        parent = super().install_spec()
        exclude_lines = " ".join(HARNESS_PATHS)
        git_part = _git_guard(
            f"git config --global --add safe.directory /app; "
            f"git status --porcelain -uall > {EVIDENCE_DIR}/status-before.txt; "
            f"echo 'git-repo: yes' > {EVIDENCE_DIR}/git-repo.txt; "
        )
        git_after = _git_guard(
            f"{_skip_worktree_cmd(f'{EVIDENCE_DIR}/harness-git.txt')} "
            f"for p in {exclude_lines}; do echo \"$p\" >> .git/info/exclude; done; "
            f"git status --porcelain -uall > {EVIDENCE_DIR}/status-after.txt; "
            f"diff {EVIDENCE_DIR}/status-before.txt {EVIDENCE_DIR}/status-after.txt > {EVIDENCE_DIR}/harness-git-status-diff.txt "
            "|| { echo 'harness install changed git status — task excluded from BOTH arms (exit 97)' >&2; exit 97; }; "
        )
        harness_step = InstallStep(
            user="root",  # npm -g · /opt 쓰기. 부모의 root 단계와 같은 사용자
            run=(
                "set -e; cd /app; "
                f"mkdir -p {EVIDENCE_DIR}; "
                f"git -C /app rev-parse --git-dir >/dev/null 2>&1 || echo 'git-repo: no' > {EVIDENCE_DIR}/git-repo.txt; "
                f"{git_part} "
                f"npm install -g --no-fund --no-audit @uzysjung/agent-harness@{HARNESS_VERSION}; "
                f"agent-harness install --track {self._track} --cli claude > {EVIDENCE_DIR}/harness-install.log 2>&1; "
                f"cp .uzys-agent-harness/.harness-install.json {EVIDENCE_DIR}/harness-install-record.json; "
                f"{git_after} "
                f"echo \"after-install $(grep -c '<!-- FILL:' CLAUDE.md 2>/dev/null || true)\" > {EVIDENCE_DIR}/fill-count.txt; "
                # 정리·과제 세션은 에이전트 사용자로 돈다 — root 가 쓴 하네스 파일을 그 사용자가 고칠 수 있어야 한다
                f"chmod -R a+rwX {EVIDENCE_DIR} /app/.claude /app/.uzys-agent-harness /app/.mcp.json /app/CLAUDE.md /app/CLAUDE-uzys-harness.md /app/.github /app/.gitignore 2>/dev/null || true"
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

    # ── 실행: 정리 3회 → B2 재적용 → 과제 세션 ───────────────────────────────────
    def _claude_env(self) -> dict[str, str]:
        """부모 run() 의 env 조립(claude_code.py:1219-1296, 비-Bedrock 경로)과 같은 값."""
        env = {
            "ANTHROPIC_API_KEY": self._get_env("ANTHROPIC_API_KEY") or "",
            "ANTHROPIC_AUTH_TOKEN": self._get_env("ANTHROPIC_AUTH_TOKEN") or "",
            "ANTHROPIC_BASE_URL": self._get_env("ANTHROPIC_BASE_URL"),
            "CLAUDE_CODE_OAUTH_TOKEN": self._get_env("CLAUDE_CODE_OAUTH_TOKEN") or "",
            "CLAUDE_CODE_MAX_OUTPUT_TOKENS": self._get_env("CLAUDE_CODE_MAX_OUTPUT_TOKENS"),
        }
        env = self.build_process_env(env, include_resolved_env=False)
        env = {k: v for k, v in env.items() if v}
        if self.model_name:
            env["ANTHROPIC_MODEL"] = self.model_name if "ANTHROPIC_BASE_URL" in env else self.model_name.split("/")[-1]
        elif self._get_env("ANTHROPIC_MODEL"):
            env["ANTHROPIC_MODEL"] = self._get_env("ANTHROPIC_MODEL") or ""
        if "ANTHROPIC_BASE_URL" in env and "ANTHROPIC_MODEL" in env:
            for k in ("ANTHROPIC_DEFAULT_SONNET_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_HAIKU_MODEL", "CLAUDE_CODE_SUBAGENT_MODEL"):
                env[k] = env["ANTHROPIC_MODEL"]
        env["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"] = "1"
        env["IS_SANDBOX"] = "1"
        env.update(self._resolved_env_vars)
        env["CLAUDE_CONFIG_DIR"] = (EnvironmentPaths.agent_dir / "sessions").as_posix()  # 과제 세션과 같은 곳 → 세션 jsonl 이 함께 남는다
        return env

    async def _sh(self, environment, command: str, env: dict[str, str] | None = None) -> str:
        """exec_as_agent — 비정상 종료도 예외 대신 문자열로 받는다 (명령 끝에 '; true' 를 붙이는 쪽에서 exit code 를 파일로 남긴다)."""
        try:
            res = await self.exec_as_agent(environment, command=command, env=env)
            return (getattr(res, "stdout", None) or "").strip()
        except NonZeroAgentExitCodeError as e:  # pragma: no cover — 호출자가 '; true' 를 붙이므로 보통 오지 않는다
            return f"__exec_error__ {e}"

    async def _prep_session(self, environment, i: int, env: dict[str, str]) -> dict:
        effort = self._resolved_flags.get("reasoning_effort")
        effort_flag = f"--effort {effort} " if effort else ""
        out = f"{PREP_DIR}/session-{i}.json"
        cmd = (
            'export PATH="$HOME/.local/bin:$PATH"; cd /app; '
            f"start=$(date -u +%s); "
            f"claude -p {shlex.quote(PREP_PROMPT)} {effort_flag}--permission-mode bypassPermissions --permission-prompts none "
            f"--max-turns {PREP_MAX_TURNS} --max-budget-usd {PREP_MAX_BUDGET_USD} --disallowedTools EnterPlanMode "
            f"--output-format json > {out} 2> {PREP_DIR}/session-{i}.stderr </dev/null; code=$?; "
            f"echo \"session-{i} exit=$code wall=$(( $(date -u +%s) - start ))s fill=$(grep -c '<!-- FILL:' CLAUDE.md 2>/dev/null || true)\" >> {PREP_DIR}/prep-timing.txt; "
            f"cat {out}; true"
        )
        raw = await self._sh(environment, cmd, env)
        try:
            data = json.loads(raw) if raw and not raw.startswith("__exec_error__") else {}
        except json.JSONDecodeError:
            data = {}
        data["_exit_nonzero"] = (not raw) or raw.startswith("__exec_error__")
        return data

    @staticmethod
    def _is_api_or_infra(d: dict) -> bool:
        return bool(d.get("api_error_status")) or d.get("terminal_reason") == "api_error" or d.get("_exit_nonzero") and not d.get("type")

    async def run(self, instruction, environment, context) -> None:
        env = self._claude_env()
        await self._sh(environment, f"mkdir -p {AGENT_LOGS} {PREP_DIR} && cp -r {EVIDENCE_DIR}/. {AGENT_LOGS}/ 2>/dev/null; true")
        await self._sh(environment, f"printf '%s\\n' {shlex.quote(PREP_PROMPT)} > {PREP_DIR}/prep-prompt.txt; true")

        # 1) 정리 3회 — 과제 지시문(instruction)은 이 구간에서 쓰지 않는다.
        for i in range(1, PREP_SESSIONS + 1):
            d = await self._prep_session(environment, i, env)
            ok = d.get("type") == "result" and not d.get("is_error") and (d.get("num_turns") or 0) > 0 and not d.get("_exit_nonzero")
            if ok:
                continue
            if self._is_api_or_infra(d):
                d2 = await self._prep_session(environment, i, env)  # API·인프라 오류는 1회 재실행
                ok2 = d2.get("type") == "result" and not d2.get("is_error") and (d2.get("num_turns") or 0) > 0 and not d2.get("_exit_nonzero")
                if ok2:
                    continue
                if self._is_api_or_infra(d2):
                    await self._sh(environment, f"echo 'prep session {i}: api/infra error twice — rerun this trial for BOTH arms (§5.3)' > {AGENT_LOGS}/prep-infra-error.txt; true")
                    await self.exec_as_agent(environment, command="exit 96")
                d = d2
            reason = f"prep session {i}: is_error={d.get('is_error')} terminal={d.get('terminal_reason')} turns={d.get('num_turns')} exit_nonzero={d.get('_exit_nonzero')}"
            await self._sh(environment, f"echo {shlex.quote(reason)} > {AGENT_LOGS}/prep-failed.txt; true")
            await self.exec_as_agent(environment, command="exit 95")  # 제품의 실패 → B 실패로 집계(reward 0), 제외하지 않는다

        # 2) B2 규칙 재적용 + 정리가 소스를 건드렸는지 (git 과제만)
        status = await self._sh(
            environment,
            _git_guard(
                f"cd /app; {_skip_worktree_cmd(f'{PREP_DIR}/prep-git.txt')} "
                f"git status --porcelain -uall > {PREP_DIR}/prep-git-status.txt; "
                f"diff {AGENT_LOGS}/status-before.txt {PREP_DIR}/prep-git-status.txt > {PREP_DIR}/prep-git-status-diff.txt || true; "
                f"cat {PREP_DIR}/prep-git-status-diff.txt;"
            ) + " true",
        )
        if status.strip():
            await self._sh(environment, f"echo 'prep touched tracked/untracked files outside harness paths' > {AGENT_LOGS}/prep-failed.txt; true")
            await self.exec_as_agent(environment, command="exit 95")
        await self._sh(environment, f"cd /app; echo \"after-prep $(grep -c '<!-- FILL:' CLAUDE.md 2>/dev/null || true)\" >> {AGENT_LOGS}/fill-count.txt; echo done > {PREP_DIR}/prep-done.txt; true")

        # 3) 과제 세션 — 부모 그대로
        await super().run(instruction, environment, context)
