"""#513 실행기·리포트 공용 — Pier 에 의존하지 않는 순수 함수만(report.py 는 시스템 python3 로 돈다).

설계 = docs/plans/513-eval-framework-design.md (5차). 두 팔이 같은 함수로 CLAUDE.md 를 만들고, 리포트가 같은 함수로 기대값을 다시 계산한다.
"""

from __future__ import annotations

import hashlib
import pathlib
import re
import tomllib

BUNDLE = "deepswe-swt-v1"
BENCH_WORKDIR = {"deepswe": "/app", "swtbench": "/testbed"}
SWT_GOAL = "Write test cases that reproduce the reported issue (do not fix it)"
IMPORT_MARKER_START = "<!-- uzys-harness:import:start -->"  # src/project-claude-merge.ts:34
IMPORT_MARKER_END = "<!-- uzys-harness:import:end -->"
HARNESS_ANCHOR_IMPORT = "@CLAUDE-uzys-harness.md"
EXPECTED_DIR = pathlib.Path(__file__).resolve().parent / "expected"


def bench_of_task_dir(task_dir: str | pathlib.Path) -> str:
    """과제 폴더 → 벤치마크. DeepSWE 는 [metadata].repository_url 이 있고 SWT 는 swtbench 태그가 있다."""
    meta = tomllib.loads((pathlib.Path(task_dir) / "task.toml").read_text()).get("metadata", {})
    if meta.get("repository_url"):
        return "deepswe"
    if "swtbench" in (meta.get("tags") or []):
        return "swtbench"
    raise ValueError(f"벤치마크를 판정할 수 없다: {task_dir}")


def swt_repo(instance_id: str) -> str:
    """`sympy__sympy-14711` → `sympy/sympy` (SWE-bench instance id 규칙: owner__repo-번호)."""
    m = re.fullmatch(r"(.+?)__(.+)-\d+", instance_id)
    if not m:
        raise ValueError(f"SWT instance id 형식이 아니다: {instance_id}")
    return f"{m.group(1)}/{m.group(2)}"


def goal_and_stack(task_dir: str | pathlib.Path) -> tuple[str, str]:
    """설계 §3 — 과제 메타데이터에서 기계적으로. 빌드·테스트 명령은 넣지 않는다."""
    task_dir = pathlib.Path(task_dir)
    bench = bench_of_task_dir(task_dir)
    meta = tomllib.loads((task_dir / "task.toml").read_text()).get("metadata", {})
    if bench == "deepswe":
        return (f"{meta['display_title']} — {meta['display_description']}", f"{meta['language']} · {meta['repository_url']}")
    return (SWT_GOAL, f"Python · {swt_repo(task_dir.name)}")


def sections(task_dir: str | pathlib.Path) -> str:
    goal, stack = goal_and_stack(task_dir)
    return f"## Goal\n\n{goal}\n\n## Stack\n\n{stack}\n"


def claude_md_a(task_dir: str | pathlib.Path, upstream: bytes | None) -> bytes:
    """세션 직전 A 의 루트 CLAUDE.md = 두 절(+ 상류 CLAUDE.md 가 있으면 그 아래에 원문 그대로)."""
    head = sections(task_dir).encode()
    return head if upstream is None else head + b"\n" + upstream


def claude_md_b(a_content: bytes, import_block: bytes) -> bytes:
    """B = A 본문 + 하네스 import 블록. upsertHarnessImport(src/project-claude-merge.ts:351) 의 기존 파일 경로와 같은 결합."""
    body = a_content if a_content.endswith(b"\n") else a_content + b"\n"
    return body + b"\n" + import_block + b"\n"


def extract_import_block(content: bytes) -> bytes | None:
    s = content.find(IMPORT_MARKER_START.encode())
    if s == -1:
        return None
    e = content.find(IMPORT_MARKER_END.encode(), s)
    if e == -1:
        return None
    return content[s : e + len(IMPORT_MARKER_END)]


def pinned_import_block(harness: str) -> bytes | None:
    """하네스 판별 고정 import 블록(expected/import-block-<판>.txt). 없으면 None — C1 은 구조 검사로 내려간다."""
    p = EXPECTED_DIR / f"import-block-{harness}.txt"
    return p.read_bytes().rstrip(b"\n") if p.is_file() else None


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()
