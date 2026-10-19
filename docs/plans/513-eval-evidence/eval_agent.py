"""#513 양팔 공통 에이전트 `EvalClaudeCode` — 설계 513-eval-framework-design.md §3 표(run() ①–⑤ · finally)를 그대로 옮긴다.

    PYTHONPATH=docs/plans/513-eval-evidence pier run ... --agent-import-path eval_agent:EvalClaudeCode \
      --ak harness=off|<판> --ak bench=deepswe|swtbench [--ak workdir=/app|/testbed]

두 팔의 차이는 `harness` 하나다 — A(off)·B(<판>) 모두 이 클래스로 돌고, CLAUDE.md · exclude 규칙 · 정규화 · 증거 기록이 같다.
`pier_agent_b.py`(B 전용 · /app 하드코딩 · 정리 3회)를 대체한다. 부모(Pier 0.3.1 `claude-code`) 확인 위치:
claude_code.py install_spec()·run() · installed/base.py exec_as_agent/NonZeroAgentExitCodeError · trial/trial.py run()(예외 처리) ·
trial/execution.py run_agent()(asyncio.wait_for — 시간 상한이면 run() 이 취소되고 아래 finally 가 돈다).

빌드 단계(install_spec, 과제 정보 없음): A = 부모 그대로. B = 부모 + 하네스 npm 설치**까지만**(설계 B3). 하네스는 `/opt/eval-513/` 아래
전용 prefix 에 깔고 과제 세션의 PATH 에는 넣지 않는다 — 이미지에 Node 20+ 가 없으면(SWT 이미지) 전용 Node 를 같은 자리에 받는다.
과제 세션이 보는 실행 환경(PATH·Node 유무)을 두 팔이 같게 두려는 것이다.

run():
  ① CLAUDE.md = 목표·스택 두 절(eval_common.sections). 상류 CLAUDE.md 가 있으면 두 절 아래에 원문을 붙인다.
  ② B 만 `agent-harness install --track base --cli claude` (기존 CLAUDE.md 본문을 두고 import 블록만 더한다).
  ③ ① 직전과 ② 직후의 `git status --porcelain -uall` 차이 = 이 실행기가 만든 변경 전부. 추적 파일 → skip-worktree,
     미추적 파일 → `<workdir>/.git/info/exclude`. 설치 기록(.uzys-agent-harness/.harness-install.json)도 함께 남긴다.
  ④ 증거(/logs/agent/eval/): 세션 직전 CLAUDE.md 원문·sha256 · head-before · git status(설정 전·세션 시작) · exclude·skip-worktree 목록 · B 설치 기록·로그.
  ⑤ 과제 세션 = 부모 run() 그대로(GLM · effort · 턴 · 예산은 --ak 로). 리허설 전용 `session=script:<호스트 경로>` 는 모델 대신 그 스크립트를 돈다.
finally:
  SWT  — 남은 claude 프로세스를 멈추고 `git reset --soft $(cat head-before)` (설계 §4-1 · B1). 커밋 여부·정규화 전후 채점 패치를 남긴다.
         채점(test.sh 85–86 `git add -A; git diff HEAD`)과 같은 패치를 임시 index 로 만들어 기록한다(실제 index 는 건드리지 않는다).
  DeepSWE — 정규화 없음. 세션 뒤 HEAD · status · CLAUDE.md import 블록 유무만 기록한다.
"""

from __future__ import annotations

import base64
import json
import pathlib
import shlex
import sys
import time

from pier.agents.installed.claude_code import ClaudeCode
from pier.models.agent.install import AgentInstallSpec, InstallStep

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import eval_common as ec  # noqa: E402

EVAL_OPT = "/opt/eval-513"
HARNESS_BIN = f"{EVAL_OPT}/bin/agent-harness"
NODE_VERSION = "22.11.0"  # 이미지에 Node 20+ 가 없을 때만 받는다(하네스 engines = node>=20)
EVIDENCE = "/logs/agent/eval"  # 호스트 trial/agent/eval 로 bind mount
SAFE = "git -c safe.directory='*'"  # 실행기의 git 명령만 소유자 검사를 끈다 — 과제 세션의 전역 git 설정은 건드리지 않는다


class EvalSetupError(RuntimeError):
    """①–④ 실패 — 세션을 시작하지 않는다(B 가 B 가 아닌 채로 돌면 C1 이 무효로 잡을 일을 미리 막는다)."""


class EvalClaudeCode(ClaudeCode):
    def __init__(self, *args, harness: str = "off", bench: str = "", workdir: str = "", session: str = "claude", normalize: str = "on", **kwargs):
        super().__init__(*args, **kwargs)
        self._harness = str(harness)
        if bench not in ec.BENCH_WORKDIR:
            raise ValueError(f"bench=deepswe|swtbench (받은 값: {bench!r})")
        self._bench = bench
        self._workdir = workdir or ec.BENCH_WORKDIR[bench]
        self._session = str(session)
        self._normalize = str(normalize) != "off"  # off 는 리허설 음성 대조 전용(run-tier.sh 는 넘기지 않는다)

    @property
    def _is_b(self) -> bool:
        return self._harness != "off"

    # ── 빌드 단계 ────────────────────────────────────────────────────────────
    def install_spec(self) -> AgentInstallSpec:
        parent = super().install_spec()
        if not self._is_b:
            return parent
        node_dl = (
            f'case "$(uname -m)" in x86_64) a=x64;; aarch64|arm64) a=arm64;; *) echo "unsupported arch $(uname -m)" >&2; exit 1;; esac; '
            f"curl -fsSL https://nodejs.org/dist/v{NODE_VERSION}/node-v{NODE_VERSION}-linux-$a.tar.gz | tar -xz -C {EVAL_OPT}; "
            f"mv {EVAL_OPT}/node-v{NODE_VERSION}-linux-$a {EVAL_OPT}/node; nb={EVAL_OPT}/node/bin; "
        )
        step = InstallStep(
            user="root",
            run=(
                f"set -e; mkdir -p {EVAL_OPT}/bin; "
                'if command -v node >/dev/null 2>&1 && [ "$(node -p "process.versions.node.split(\'.\')[0]")" -ge 20 ]; then '
                'nb=$(dirname "$(command -v node)"); else '
                f"{node_dl}fi; "
                f'PATH="$nb:$PATH" npm install -g --prefix {EVAL_OPT}/harness --no-fund --no-audit @uzysjung/agent-harness@{self._harness}; '
                f"printf '#!/bin/sh\\nPATH=\"%s:$PATH\" exec {EVAL_OPT}/harness/bin/agent-harness \"$@\"\\n' \"$nb\" > {HARNESS_BIN}; "
                f"chmod 755 {HARNESS_BIN}; {HARNESS_BIN} --version > {EVAL_OPT}/harness-version.txt"
            ),
        )
        return AgentInstallSpec(
            agent_name=parent.agent_name,
            version=parent.version,
            steps=[*parent.steps, step],
            verification_command=parent.verification_command,
            cache_key=f"{parent.cache_key or parent.agent_name}+uzys-{self._harness}",
            metadata={**parent.metadata, "uzys_harness": self._harness},
        )

    # ── 실행 ────────────────────────────────────────────────────────────────
    async def _sh(self, environment, command: str, timeout_sec: int | None = None) -> tuple[int, str]:
        """실행기 명령 — 키·--ae 값은 넘기지 않는다(키는 과제 세션에만 간다). 에이전트 명령과 같은 egress 설정(agent_process_env)을 쓴다."""
        res = await environment.exec(command=f"set -o pipefail; {command}", cwd=self._workdir, env=environment.agent_process_env({}), timeout_sec=timeout_sec)
        return res.return_code, (res.stdout or "")

    async def _must(self, environment, command: str, what: str, timeout_sec: int | None = None) -> str:
        rc, out = await self._sh(environment, command, timeout_sec)
        if rc != 0:
            raise EvalSetupError(f"{what} 실패(exit {rc})")
        return out

    def _host_eval_dir(self) -> pathlib.Path:
        d = pathlib.Path(self.logs_dir) / "eval"
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _task_dir(self) -> pathlib.Path:
        """과제 폴더 = 이 trial 의 config.json(task.path). Trial.run() 이 에이전트 실행 전에 쓴다(trial.py run() 첫 줄)."""
        cfg = json.loads((pathlib.Path(self.logs_dir).parent / "config.json").read_text())
        return pathlib.Path(cfg["task"]["path"])

    async def run(self, instruction, environment, context) -> None:
        host = self._host_eval_dir()
        ev: dict = {"harness": self._harness, "bench": self._bench, "workdir": self._workdir, "session": self._session, "normalize": self._normalize, "steps": []}

        def save() -> None:
            (host / "evidence.json").write_text(json.dumps(ev, indent=2, ensure_ascii=False))

        try:
            await self._setup(environment, ev, host)
            save()
            ev["session_started_at"] = time.time()
            ev["steps"].append("⑤ session")
            save()
            if self._session == "claude":
                await super().run(instruction, environment, context)
            elif self._session.startswith("script:"):
                await environment.upload_file(source_path=self._session[len("script:"):], target_path="/tmp/eval-session.sh")
                rc, out = await self._sh(environment, "bash /tmp/eval-session.sh")
                (host / "session-script.log").write_text(out)
                ev["session_script_exit"] = rc
            else:
                raise EvalSetupError(f"session=claude|script:<path> (받은 값: {self._session!r})")
        finally:
            ev["session_finished_at"] = time.time()
            try:
                await self._finalize(environment, ev, host)
            except Exception as e:  # 기록 실패가 trial 의 원래 결과(시간 상한 등)를 가리지 않게
                ev["finalize_error"] = repr(e)
            save()

    async def _setup(self, environment, ev: dict, host: pathlib.Path) -> None:
        wd = self._workdir
        await self._must(environment, f"mkdir -p {EVIDENCE} && {SAFE} rev-parse --git-dir >/dev/null", "작업 폴더 git 확인")
        status_before = await self._must(environment, f"{SAFE} status --porcelain -uall", "설정 전 git status")
        (host / "status-before-setup.txt").write_text(status_before)
        head = (await self._must(environment, f"{SAFE} rev-parse HEAD", "head-before")).strip()
        (host / "head-before.txt").write_text(head + "\n")
        await self._must(environment, f"echo {head} > {EVIDENCE}/head-before.txt", "head-before 기록")
        ev["head_before"] = head

        # ① CLAUDE.md — 두 팔 같은 함수
        rc, up_b64 = await self._sh(environment, "[ -f CLAUDE.md ] && base64 < CLAUDE.md | tr -d '\\n'")
        upstream = base64.b64decode(up_b64) if rc == 0 else None
        if upstream is not None:
            (host / "upstream-CLAUDE.md").write_bytes(upstream)
        tracked = (await self._sh(environment, f"{SAFE} ls-files --error-unmatch CLAUDE.md >/dev/null 2>&1"))[0] == 0
        content_a = ec.claude_md_a(self._task_dir(), upstream)
        ev.update(upstream_claude_md=upstream is not None, upstream_tracked=tracked, expected_a_sha256=ec.sha256(content_a))
        b64 = base64.b64encode(content_a).decode()
        await self._must(environment, f"printf %s {b64} | base64 -d > CLAUDE.md", "① CLAUDE.md 작성")
        ev["steps"].append("① CLAUDE.md")

        # ② B 만 하네스 설치
        if self._is_b:
            rc, out = await self._sh(environment, f"{HARNESS_BIN} install --track base --cli claude </dev/null 2>&1", timeout_sec=600)
            (host / "harness-install.log").write_text(out)
            ev["harness_install_exit"] = rc
            if rc != 0:
                raise EvalSetupError(f"② agent-harness install 실패(exit {rc})")
            rec = await self._must(environment, "cat .uzys-agent-harness/.harness-install.json", "② 설치 기록 읽기")
            (host / "harness-install-record.json").write_text(rec)
            ev["harness_version_in_image"] = (await self._sh(environment, f"cat {EVAL_OPT}/harness-version.txt"))[1].strip()
            ev["steps"].append("② harness install")

        # ③ 실행기가 만든 변경 전부를 채점 diff 밖으로 — 같은 규칙을 두 팔에
        status_mid = await self._must(environment, f"{SAFE} status --porcelain -uall", "③ 설정 뒤 git status")
        before = set(status_before.splitlines())
        changed = sorted({line[3:] for line in status_mid.splitlines() if line not in before})
        excl, skip = [], []
        for p in changed:
            p = p.strip('"')
            if (await self._sh(environment, f"{SAFE} ls-files --error-unmatch -- {shlex.quote(p)} >/dev/null 2>&1"))[0] == 0:
                await self._must(environment, f"{SAFE} update-index --skip-worktree -- {shlex.quote(p)}", f"③ skip-worktree {p}")
                skip.append(p)
            else:
                excl.append(p)
        if excl:
            lines = "".join(f"/{p}\n" for p in excl)
            await self._must(environment, f"printf %s {shlex.quote(lines)} >> .git/info/exclude", "③ exclude")
        (host / "exclude-added.txt").write_text("".join(f"{p}\n" for p in excl))
        (host / "skip-worktree.txt").write_text("".join(f"{p}\n" for p in skip))
        ev.update(exclude_added=excl, skip_worktree=skip)
        ev["steps"].append("③ exclude")

        # ④ 증거 — 세션 직전 상태
        status_start = await self._must(environment, f"{SAFE} status --porcelain -uall", "④ 세션 시작 git status")
        (host / "status-at-start.txt").write_text(status_start)
        cm_b64 = await self._must(environment, "base64 < CLAUDE.md | tr -d '\\n'", "④ CLAUDE.md 읽기")
        cm = base64.b64decode(cm_b64)
        (host / "claude-md-before-session.md").write_bytes(cm)
        ev.update(
            claude_md_before_session_sha256=ec.sha256(cm),
            fill_placeholders=cm.count(b"<!-- FILL:"),
            import_block_before_session=ec.extract_import_block(cm) is not None,
            status_at_start_sha256=ec.sha256(status_start.encode()),
        )
        await self._must(environment, f"echo {ev['claude_md_before_session_sha256']} > {EVIDENCE}/claude-md-before-session.sha256", "④ sha 기록")
        ev["steps"].append("④ evidence")

    async def _finalize(self, environment, ev: dict, host: pathlib.Path) -> None:
        if "head_before" not in ev:
            return
        hb = ev["head_before"]
        if self._bench == "swtbench":
            # 시간 상한에서는 부모 run() 의 claude 가 컨테이너 안에서 계속 돈다(docker exec 취소는 안쪽 프로세스를 멈추지 않는다) — 정규화 전에 멈춘다
            await self._sh(environment, 'for c in /proc/[0-9]*/comm; do [ "$(cat "$c" 2>/dev/null)" = claude ] && kill -9 "$(basename "$(dirname "$c")")" 2>/dev/null; done; true')
        head_after = (await self._sh(environment, f"{SAFE} rev-parse HEAD"))[1].strip()
        commits = (await self._sh(environment, f"{SAFE} log --oneline {hb}..HEAD"))[1]
        ev.update(head_after=head_after, committed=head_after != hb, n_commits=len(commits.splitlines()))
        (host / "commits.txt").write_text(commits)
        if self._bench == "swtbench":
            # test.sh 85–86 과 같은 패치를 임시 index 로(실제 index 는 그대로)
            grade = f"t=$(mktemp); cp .git/index $t; GIT_INDEX_FILE=$t {SAFE} add -A >/dev/null 2>&1; GIT_INDEX_FILE=$t {SAFE} diff --cached HEAD; rm -f $t"
            (host / "patch-raw.diff").write_text((await self._sh(environment, grade))[1])
            if self._normalize and head_after != hb:
                rc, _ = await self._sh(environment, f"{SAFE} reset --soft {hb}")
                ev["normalized"] = rc == 0
            else:
                ev["normalized"] = False
            patch = (await self._sh(environment, grade))[1]
            (host / "patch-normalized.diff").write_text(patch)
            ev["patch_bytes"] = len(patch.encode())
        status_end = (await self._sh(environment, f"{SAFE} status --porcelain -uall"))[1]
        (host / "status-after.txt").write_text(status_end)
        rc, cm_b64 = await self._sh(environment, "base64 < CLAUDE.md | tr -d '\\n'")
        ev["import_block_after_session"] = rc == 0 and ec.extract_import_block(base64.b64decode(cm_b64)) is not None
