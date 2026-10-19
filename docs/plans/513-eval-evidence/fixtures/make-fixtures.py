"""test_report.py 고정 데이터 — 실측 시행에서 리포트가 읽는 줄만 뽑아 저장소에 둔다(키·대용량 없이). 다시 만들 때만 돈다.

   python3 -I make-fixtures.py        # ~/eval-513 의 원본 → fixtures/jobs/<시나리오>/<job>/<trial>/ · fixtures/tasks/<과제>/task.toml

시나리오(원본):
  old-bandit   ~/eval-513/jobs/513-deepswe-glm-5.3-B-full-bandit-structured-nosec-directives — 백그라운드 리뷰어 대기 중 종료(패치 0바이트)
  probe-nop    ~/eval-513/jobs-probe/swt-pier-nop-probe — SWT 빈 패치 → 검증기 1200초 초과 ×2(VerifierTimeoutError)
  c-off        ~/eval-513/rehearsal/c-off — 커밋 + 정규화 끔 → 빈 패치 → 검증기 1차 초과 → 재채점(exception 없음, 검증기 1212초)
  rehearsal-b  ~/eval-513/rehearsal/b — SWT A·B 리허설(정규화 켬, reward 1·1) · §6 증거
config.json 의 task.path 는 `@FIX@/tasks/<과제>` 로 바꿔 둔다 — 시험이 임시 폴더로 복사하며 실제 경로로 채운다.
claude-code.txt 는 system/init 줄 + 메인 스레드 마지막 assistant 메시지 + 그 뒤의 result · task_updated/notification · background_tasks_changed 줄만 남긴다(종료 사유 판정이 읽는 것).
verifier/test-stdout.txt 는 `++ cat /root/model_test.patch` ~ `++ echo ====` 구간과 `SWTBench report starts here` 다음 줄만 남긴다.
"""
import json
import pathlib
import re
import shutil

HOME = pathlib.Path.home() / "eval-513"
OUT = pathlib.Path(__file__).resolve().parent
SRC = {
    "old-bandit": HOME / "jobs" / "513-deepswe-glm-5.3-B-full-bandit-structured-nosec-directives",
    "probe-nop": HOME / "jobs-probe" / "swt-pier-nop-probe",
    "c-off": HOME / "rehearsal" / "c-off",
    "rehearsal-b": HOME / "rehearsal" / "b",
}
KEEP = ["config.json", "result.json", "artifacts/model.patch",
        "agent/eval/evidence.json", "agent/eval/patch-normalized.diff", "agent/eval/patch-raw.diff",
        "agent/eval/claude-md-before-session.md", "agent/eval/harness-install-record.json"]


def trim_events(text: str) -> str:
    lines = [l for l in text.splitlines() if l.startswith("{")]
    ev = [json.loads(l) for l in lines]
    init = [l for l, e in zip(lines, ev) if e.get("type") == "system" and e.get("subtype") == "init"][:1]
    last = max((i for i, e in enumerate(ev) if e.get("type") == "assistant" and not e.get("parent_tool_use_id")), default=0)
    keep = lambda e: e.get("type") == "result" or (e.get("type") == "system" and e.get("subtype") in ("task_updated", "task_notification", "background_tasks_changed"))  # noqa: E731
    return "\n".join(init + [lines[last]] + [l for l, e in zip(lines[last + 1:], ev[last + 1:]) if keep(e)]) + "\n"


def trim_verifier(text: str) -> str:
    m = re.search(r"^\+\+ cat /root/model_test\.patch\n.*?^\+\+ echo =+$", text, re.S | re.M)
    r = re.search(r"^SWTBench report starts here\n.*$", text, re.M)
    return "".join(x.group(0) + "\n" for x in (m, r) if x)


def trial_dirs(job_root: pathlib.Path):
    roots = [job_root] if (job_root / "config.json").is_file() and (job_root / "lock.json").is_file() else [p for p in job_root.iterdir() if p.is_dir() and (p / "lock.json").is_file()]
    for job in roots:
        for td in job.iterdir():
            if (td / "config.json").is_file() and "trial_name" in json.loads((td / "config.json").read_text()):
                yield job, td


def main() -> None:
    shutil.rmtree(OUT / "jobs", ignore_errors=True)
    for name, src in SRC.items():
        for job, td in trial_dirs(src):
            dst = OUT / "jobs" / name / job.name / td.name
            for rel in KEEP:
                if (td / rel).is_file():
                    (dst / rel).parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(td / rel, dst / rel)
            if (td / "agent" / "claude-code.txt").is_file():
                (dst / "agent").mkdir(parents=True, exist_ok=True)
                (dst / "agent" / "claude-code.txt").write_text(trim_events((td / "agent" / "claude-code.txt").read_text(errors="replace")))
            if (td / "verifier" / "test-stdout.txt").is_file():
                (dst / "verifier").mkdir(parents=True, exist_ok=True)
                (dst / "verifier" / "test-stdout.txt").write_text(trim_verifier((td / "verifier" / "test-stdout.txt").read_text(errors="replace")))
            cfg = json.loads((dst / "config.json").read_text())
            task = pathlib.Path(cfg["task"]["path"])
            cfg["task"]["path"] = f"@FIX@/tasks/{task.name}"
            (dst / "config.json").write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n")
            (OUT / "tasks" / task.name).mkdir(parents=True, exist_ok=True)
            src_toml = task / "task.toml.orig" if (task / "task.toml.orig").is_file() else task / "task.toml"
            shutil.copy2(src_toml, OUT / "tasks" / task.name / "task.toml")
            print(name, job.name, td.name)


main()
