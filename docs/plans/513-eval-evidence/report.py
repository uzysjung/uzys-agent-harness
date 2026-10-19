"""#513 리포트 — 설계 513-eval-framework-design.md §4(종료 사유) · §5(판정, 사전 등록) · §6(증거) · §7(리포트).

   python3 -I report.py <jobs 폴더> <superlight|light|medium|heavy> <하네스 판> [--post-hoc] [--out <경로>] [--no-index]

출력 기본 = reports/deepswe-swt-v1/<판>-<단계>.md (+ reports/deepswe-swt-v1/index.md 의 그 판·단계 줄을 갱신).
jobs 폴더 = run-tier.sh 의 EVAL_JOBS_ROOT(시행마다 job 하나). 옛 형식(~/eval-513/jobs, pier_agent_b)도 읽는다 — 그때 §6 증거가 없어 C1 은 실패로 나온다.
판정 규칙·임계값은 설계 §5 그대로다. 바꾸려면 설계를 먼저 바꾼다.
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import pathlib
import random
import re
import statistics
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import eval_common as ec  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
TERMS = ("스스로 끝냄+제출", "스스로 끝냄+제출 없음", "백그라운드 대기 중 종료", "시간 상한", "턴 상한", "예산 상한", "API 오류", "설정 실패", "인프라 오류", "스크립트 세션")
SELF_FINISHED = {"스스로 끝냄+제출", "스스로 끝냄+제출 없음", "백그라운드 대기 중 종료"}
OK_EXC = {None, "AgentTimeoutError", "NonZeroAgentExitCodeError"}
DETECTION = {  # 설계 §5 검출 한계(공개 p 모의, 효과 0 오판 2–3%)
    ("deepswe", "medium"): "DeepSWE 20×3: +15%p 51% · +20%p 81%",
    ("deepswe", "heavy"): "DeepSWE 31×3: +15%p 70% · +20%p 90%",
}
HARNESS_AGENTS = {"implementer", "reviewer"}


# ── 적재 ────────────────────────────────────────────────────────────────────
def _json(p: pathlib.Path):
    try:
        return json.loads(p.read_text())
    except (OSError, ValueError):
        return None


def events(trial_dir: pathlib.Path) -> list[dict]:
    p = trial_dir / "agent" / "claude-code.txt"
    out = []
    if p.is_file():
        for line in p.read_text(errors="replace").splitlines():
            if line.startswith("{"):
                try:
                    out.append(json.loads(line))
                except ValueError:
                    pass
    return out


def arm_of(cfg: dict) -> str:
    ag = cfg.get("agent") or {}
    kw = ag.get("kwargs") or {}
    if "harness" in kw:
        return "A" if str(kw["harness"]) == "off" else "B"
    if (ag.get("import_path") or "").startswith("pier_agent_b"):
        return "B"  # 옛 형식
    if ag.get("name") == "claude-code":
        return "A"
    raise ValueError(f"팔을 판정할 수 없다: {ag}")


def load_trials(root: pathlib.Path) -> list[dict]:
    trials = []
    for job in sorted(p for p in root.iterdir() if p.is_dir() and p.name != "invalid"):
        for td in sorted(p for p in job.iterdir() if p.is_dir()):
            cfg = _json(td / "config.json")
            if not cfg or "trial_name" not in cfg:
                continue
            task_dir = pathlib.Path(cfg["task"]["path"])
            kw = (cfg.get("agent") or {}).get("kwargs") or {}
            m = re.search(r"-r(\d+)-", job.name)
            t = {
                "job": job.name,
                "dir": td,
                "task_dir": task_dir,
                "task": task_dir.name,
                "bench": kw.get("bench") or ec.bench_of_task_dir(task_dir),
                "arm": arm_of(cfg),
                "harness": str(kw.get("harness", kw.get("track", ""))),
                "rep": int(m.group(1)) if m else 1,
                "result": _json(td / "result.json"),
                "ev": _json(td / "agent" / "eval" / "evidence.json"),
                "events": events(td),
            }
            t.update(classify(t))
            trials.append(t)
    return trials


def load_invalid(root: pathlib.Path) -> list[list[str]]:
    p = root / "invalid.tsv"
    return [l.split("\t") for l in p.read_text().splitlines() if l.strip()] if p.is_file() else []


# ── 채점 패치 · 종료 사유 (§4-3 · §4-4) ─────────────────────────────────────
def swt_patch(t: dict) -> str | None:
    """SWT 채점 패치 — 실행기가 남긴 정규화 뒤 패치(없으면 검증기 출력의 `cat /root/model_test.patch` 구간)."""
    p = t["dir"] / "agent" / "eval" / "patch-normalized.diff"
    if p.is_file():
        return p.read_text(errors="replace")
    out = t["dir"] / "verifier" / "test-stdout.txt"
    if not out.is_file():
        return None
    m = re.search(r"\+ cat /root/model_test\.patch\n(.*?)\n=+\n", out.read_text(errors="replace"), re.S)
    return m.group(1) if m else None


def patch_files(patch: str) -> list[str]:
    return re.findall(r"^diff --git a/(\S+) b/", patch or "", re.M)


def is_test_path(path: str) -> bool:
    parts = path.split("/")
    base = parts[-1]
    return bool({"tests", "test", "testing"} & set(parts[:-1])) or base.startswith("test_") or base.endswith("_test.py") or base in ("tests.py", "conftest.py")


def background_killed(evs: list[dict]) -> bool:
    """메인 스레드의 마지막 assistant 메시지 뒤에 `task_updated killed` 가 있다 — 백그라운드 작업을 기다리다 -p 가 끝났다(full-partial/README.md 관측)."""
    last_main = max((i for i, e in enumerate(evs) if e.get("type") == "assistant" and not e.get("parent_tool_use_id")), default=-1)
    return any(
        e.get("type") == "system" and e.get("subtype") == "task_updated" and (e.get("patch") or {}).get("status") == "killed"
        for e in evs[last_main + 1 :]
    )


def classify(t: dict) -> dict:
    r = t["result"] or {}
    ev = t["ev"] or {}
    exc = (r.get("exception_info") or {}).get("exception_type")
    evs = t["events"]
    results = [e for e in evs if e.get("type") == "result"]
    last = results[-1] if results else None
    text = (t["dir"] / "agent" / "claude-code.txt").read_text(errors="replace") if (t["dir"] / "agent" / "claude-code.txt").is_file() else ""

    if t["bench"] == "deepswe":
        mp = t["dir"] / "artifacts" / "model.patch"
        submitted = mp.is_file() and mp.stat().st_size > 0
        patch = None
    else:
        patch = swt_patch(t)
        submitted = bool(patch and patch.strip())
    rew = ((r.get("verifier_result") or {}).get("rewards") or {}).get("reward")
    out = {
        "exc": exc,
        "reward": None if rew is None else float(rew),
        "submitted": submitted,
        "committed": ev.get("committed"),
        "test_only_violation": None,
        "session_s": (ev["session_finished_at"] - ev["session_started_at"]) if "session_started_at" in ev and "session_finished_at" in ev else _agent_exec_s(r),
        "in_tokens": (r.get("agent_result") or {}).get("n_input_tokens"),
    }
    if t["bench"] == "swtbench" and patch is not None:
        files = patch_files(patch)
        out["test_only_violation"] = any(not is_test_path(f) for f in files)
        out["patch_files"] = files

    if not r:
        term = "인프라 오류"
    elif exc == "EvalSetupError" or (exc == "RuntimeError" and "eval" in str((r.get("exception_info") or {}).get("exception_message", "")).lower()):
        term = "설정 실패"
    elif exc not in OK_EXC:
        term = "인프라 오류"
    elif exc == "AgentTimeoutError":
        term = "시간 상한"
    elif re.search(r"\[1113\]|Insufficient balance", text):
        term = "API 오류"
    elif last is None:
        term = "스크립트 세션" if str(ev.get("session", "claude")).startswith("script:") else "API 오류"
    elif last.get("terminal_reason") == "max_turns" or last.get("subtype") == "error_max_turns":
        term = "턴 상한"
    elif last.get("terminal_reason") == "budget_exhausted" or last.get("subtype") == "error_max_budget_usd":
        term = "예산 상한"
    elif last.get("is_error") or last.get("api_error_status") or last.get("terminal_reason") == "api_error":
        term = "API 오류"
    elif background_killed(evs):
        term = "백그라운드 대기 중 종료"
    else:
        term = "스스로 끝냄+제출" if submitted else "스스로 끝냄+제출 없음"
    out["term"] = term
    return out


def _agent_exec_s(r: dict):
    a = (r or {}).get("agent_execution") or {}
    try:
        return (dt.datetime.fromisoformat(a["finished_at"].replace("Z", "+00:00")) - dt.datetime.fromisoformat(a["started_at"].replace("Z", "+00:00"))).total_seconds()
    except (KeyError, TypeError, AttributeError, ValueError):
        return None


# ── §6 증거 점검 (C1) ────────────────────────────────────────────────────────
def evidence_check(t: dict) -> tuple[bool, str]:
    ev = t["ev"]
    if not ev:
        return False, "증거 없음(§6)"
    eval_dir = t["dir"] / "agent" / "eval"
    if "claude_md_before_session_sha256" not in ev:
        return False, f"설정 미완료({', '.join(ev.get('steps', []))})"
    up = eval_dir / "upstream-CLAUDE.md"
    exp_a = ec.claude_md_a(t["task_dir"], up.read_bytes() if up.is_file() else None)
    got = ev["claude_md_before_session_sha256"]
    notes = []
    if t["arm"] == "A":
        if got != ec.sha256(exp_a):
            return False, "A CLAUDE.md sha 불일치"
        if ev.get("import_block_before_session"):
            return False, "A 에 import 블록"
    else:
        if ev.get("harness_install_exit") != 0 or not (eval_dir / "harness-install-record.json").is_file():
            return False, "B 설치 기록 없음"
        pin = ec.pinned_import_block(t["harness"])
        if pin is not None:
            if got != ec.sha256(ec.claude_md_b(exp_a, pin)):
                return False, "B CLAUDE.md sha 불일치(고정 블록 기준)"
        else:
            cm = (eval_dir / "claude-md-before-session.md").read_bytes()
            blk = ec.extract_import_block(cm)
            if not (cm.startswith(exp_a) and blk and ec.HARNESS_ANCHOR_IMPORT.encode() in blk):
                return False, "B CLAUDE.md 구조 불일치"
            notes.append("고정 블록 없음 — 구조 검사")
        if ev.get("fill_placeholders"):
            return False, f"채움 틀 {ev['fill_placeholders']}개"
    if ev.get("session") == "claude":
        init = next((e for e in t["events"] if e.get("type") == "system" and e.get("subtype") == "init"), None)
        if not init:
            return False, "system/init 없음"
        agents = set(init.get("agents") or [])
        if t["arm"] == "A" and agents & HARNESS_AGENTS:
            return False, "A 에 하네스 에이전트"
        if t["arm"] == "B":
            rec = _json(eval_dir / "harness-install-record.json") or {}
            want_sk = {f["path"].split("/")[0] for f in rec.get("skillFiles", [])}
            want_ag = {pathlib.PurePosixPath(f["path"]).stem for f in rec.get("policyFiles", []) if f["path"].startswith("agents/")}
            missing = (want_sk - set(init.get("skills") or [])) | (want_ag - agents)
            if missing:
                return False, f"init 에 없음: {', '.join(sorted(missing))}"
            if not any("Session started. Branch:" in p.read_text(errors="replace") for p in (t["dir"] / "agent" / "sessions" / "projects").rglob("*.jsonl")):
                notes.append("jsonl 에 'Session started. Branch:' 없음")
                return False, "; ".join(notes)
    else:
        notes.append("세션 없음(리허설) — init 점검 생략")
    return True, "; ".join(notes) or "일치"


# ── 판정 (§5) ────────────────────────────────────────────────────────────────
def pairs(trials: list[dict]) -> list[tuple[dict | None, dict | None]]:
    by = collections.defaultdict(dict)
    for t in trials:
        by[(t["bench"], t["task"], t["rep"])][t["arm"]] = t
    return [(v.get("A"), v.get("B")) for _, v in sorted(by.items())]


def won(t: dict | None) -> bool:
    return bool(t and t["reward"] is not None and t["reward"] >= 1.0)


def valid(t: dict | None) -> bool:
    return bool(t and t["term"] not in ("인프라 오류",))


def alarms(trials: list[dict], invalid_rows: list, tier: str) -> list[tuple[str, str, str, str]]:
    A = [t for t in trials if t["arm"] == "A"]
    B = [t for t in trials if t["arm"] == "B"]
    rows = []
    bad = [t for t in B if not evidence_check(t)[0]]
    rows.append(("C1", "하네스가 실렸나", "WARN — 측정 무효" if bad else "PASS", f"B {len(B) - len(bad)}/{len(B)} 일치" + (f" · 불일치: {', '.join(t['job'] for t in bad)}" if bad else "")))
    c2 = lambda xs: [t for t in xs if t["term"] in ("스스로 끝냄+제출 없음", "백그라운드 대기 중 종료")]  # noqa: E731
    rows.append(("C2", "제출 규율", "WARN" if c2(B) else "PASS", f"B {len(c2(B))}건 · A {len(c2(A))}건(참고)"))
    pr = [(a, b) for a, b in pairs(trials) if valid(a) and valid(b)]
    a_only = [a for a, b in pr if won(a) and not won(b)]
    b_only = [b for a, b in pr if won(b) and not won(a)]
    if tier == "superlight":
        rows.append(("C3", "방해 신호", "표시만", f"A 만 성공 {len(a_only)} · B 만 성공 {len(b_only)} (갈린 과제는 아래 표)"))
    else:
        rows.append(("C3", "방해 신호", "WARN" if len(a_only) - len(b_only) >= 4 else "PASS", f"A 만 성공 {len(a_only)} − B 만 성공 {len(b_only)} = {len(a_only) - len(b_only)} (WARN ≥ 4)"))
    fin = [(a, b) for a, b in pr if a["term"] in SELF_FINISHED and b["term"] in SELF_FINISHED]
    rt = [b["session_s"] / a["session_s"] for a, b in fin if a["session_s"] and b["session_s"]]
    rk = [b["in_tokens"] / a["in_tokens"] for a, b in fin if a["in_tokens"] and b["in_tokens"]]
    mt, mk = (statistics.median(rt) if rt else None), (statistics.median(rk) if rk else None)
    c4 = (mt is not None and mt > 2.0) or (mk is not None and mk > 2.0)
    rows.append(("C4", "비용", "WARN" if c4 else ("PASS" if rt or rk else "N/A"), f"짝 {len(fin)} · 시간 B/A 중앙값 {_f(mt)} · 입력 토큰 B/A 중앙값 {_f(mk)} (WARN > 2.0)"))
    ta, tb = sum(t["term"] == "시간 상한" for t in A), sum(t["term"] == "시간 상한" for t in B)
    rows.append(("C5", "시간 상한", "WARN" if tb > ta + 1 else "PASS", f"B {tb} · A {ta} (WARN: B > A + 1)"))
    infra = [t for t in trials if t["term"] == "인프라 오류"]
    n_inv = len(invalid_rows) + len(infra)
    denom = len(trials) + len(invalid_rows)
    share = n_inv / denom if denom else 0.0
    rows.append(("C6", "측정 안정성", "WARN — 다시 돈다" if share > 0.2 else "PASS", f"무효 {n_inv}/{denom} = {share:.0%} (1113·끊김 {len(invalid_rows)} · 인프라 예외 {len(infra)}, WARN > 20%)"))
    return rows


def _f(x) -> str:
    return "—" if x is None else f"{x:.2f}"


def bootstrap(deltas: list[float], n: int = 10_000, seed: int = 513) -> tuple[float, float, float, float]:
    """과제 재표집 부트스트랩 — (평균 Δ, 2.5%, 97.5%, 양측 p)."""
    rng = random.Random(seed)
    k = len(deltas)
    means = sorted(sum(rng.choice(deltas) for _ in range(k)) / k for _ in range(n))
    lo, hi = means[int(0.025 * n)], means[int(0.975 * n) - 1]
    p = min(1.0, 2 * min(sum(m <= 0 for m in means) / n, sum(m >= 0 for m in means) / n))
    return sum(deltas) / k, lo, hi, p


def effect(trials: list[dict], tier: str) -> dict:
    out = {}
    for bench in sorted({t["bench"] for t in trials}):
        by = collections.defaultdict(lambda: {"A": [], "B": []})
        for t in trials:
            if t["bench"] == bench and valid(t):
                by[t["task"]][t["arm"]].append(1.0 if won(t) else 0.0)
        deltas = [statistics.mean(v["B"]) - statistics.mean(v["A"]) for v in by.values() if v["A"] and v["B"]]
        if not deltas:
            out[bench] = None
            continue
        mean, lo, hi, p = bootstrap(deltas)
        pass3 = {arm: sum(len(v[arm]) >= 3 and all(v[arm]) for v in by.values()) for arm in "AB"}
        out[bench] = {"n_tasks": len(deltas), "mean": mean, "lo": lo, "hi": hi, "p": p, "pass3": pass3}
    # Holm — "더 잘 푼다" 주장에만(벤치마크 둘 이상)
    cands = sorted(((v["p"], b) for b, v in out.items() if v and v["lo"] > 0), key=lambda x: x[0])
    m = sum(1 for v in out.values() if v)
    holm_ok, stop = set(), False
    for i, (p, b) in enumerate(cands):
        if not stop and p <= 0.05 / (m - i):
            holm_ok.add(b)
        else:
            stop = True
    for b, v in out.items():
        if not v:
            continue
        lim = DETECTION.get((b, tier), "SWT-bench: 라이트 관측 통과율로 산정해 미디엄 전에 적는다(미산정)" if b == "swtbench" else "미산정")
        if v["lo"] > 0 and (m < 2 or b in holm_ok):
            v["verdict"] = "더 잘 푼다"
        elif v["hi"] < 0:
            v["verdict"] = "방해한다"
        else:
            v["verdict"] = f"판별 불가(검출 한계 {lim})" + (" — CI 하한 > 0 이지만 Holm 보정 미통과" if v["lo"] > 0 else "")
        v["limit"] = lim
    return out


# ── 렌더 ────────────────────────────────────────────────────────────────────
def _tm(s) -> str:
    return "—" if s is None else f"{s / 60:.0f}m"


def _r(t) -> str:
    if not t:
        return "—"
    return "—" if t["reward"] is None else f"{t['reward']:g}"


def render(root: pathlib.Path, tier: str, harness: str, post_hoc: bool, trials: list[dict], inv: list) -> tuple[str, str]:
    lock = (root / "lock.txt").read_text() if (root / "lock.txt").is_file() else "(lock.txt 없음 — 옛 형식 jobs)\n"
    L = [f"# {harness} · {tier} — 묶음 {ec.BUNDLE}", ""]
    L.append(f"- 단계: **{tier}** ({'사후 확장 — 결과를 본 뒤 올린 단계' if post_hoc else '사전 등록'})")
    L.append(f"- jobs: `{root}` · 시행 {len(trials)} · 무효 이동 {len(inv)} · 생성 {dt.datetime.now(dt.timezone.utc):%Y-%m-%dT%H:%MZ}")
    summary = ""
    if tier in ("superlight", "light"):
        rows = alarms(trials, inv, tier)
        warn = [r[0] for r in rows if r[2].startswith("WARN")]
        summary = "경보 " + (", ".join(warn) if warn else "없음")
        L += [f"- 결론: **{summary}** (경보만 — 효과 주장 없음, 설계 §5)", "", "| # | 경보 | 판정 | 근거 |", "|---|---|---|---|"]
        L += [f"| {a} | {b} | {c} | {d} |" for a, b, c, d in rows]
    else:
        eff = effect(trials, tier)
        parts = []
        L += ["", "| 벤치마크 | 과제 | Δ(B−A) | 95% CI | p(부트스트랩) | pass^3 A·B | 결론 |", "|---|---|---|---|---|---|---|"]
        for b, v in eff.items():
            if not v:
                L.append(f"| {b} | 0 | — | — | — | — | 짝 없음 |")
                continue
            L.append(f"| {b} | {v['n_tasks']} | {v['mean']:+.3f} | [{v['lo']:+.3f}, {v['hi']:+.3f}] | {v['p']:.3f} | {v['pass3']['A']}·{v['pass3']['B']} | {v['verdict']} |")
            parts.append(f"{b} {v['mean']:+.2f} [{v['lo']:+.2f}, {v['hi']:+.2f}] {v['verdict'].split('(')[0]}")
        summary = " · ".join(parts)
        L.insert(4, f"- 결론: **{summary or '짝 없음'}**")
        L += ["", "경보(참고):", "", "| # | 경보 | 판정 | 근거 |", "|---|---|---|---|"] + [f"| {a} | {b} | {c} | {d} |" for a, b, c, d in alarms(trials, inv, tier)]
    prev = previous_row(harness, tier)
    L += ["", f"이전 판 대비: {prev or '이전 판 기록 없음'}", ""]

    for bench in sorted({t["bench"] for t in trials}):
        bt = [t for t in trials if t["bench"] == bench]
        L += [f"## {bench}", "", "| 과제 | 반복 | A 점수 | B 점수 | A 종료 | B 종료 | A 세션 | B 세션 | A 입력토큰 | B 입력토큰 |", "|---|---|---|---|---|---|---|---|---|---|"]
        diverged = []
        for a, b in pairs(bt):
            x = a or b
            if won(a) != won(b) and valid(a) and valid(b):
                diverged.append(f"{x['task']} r{x['rep']}: {'A' if won(a) else 'B'} 만 성공")
            L.append(
                f"| {x['task']} | {x['rep']} | {_r(a)} | {_r(b)} | {a['term'] if a else '—'} | {b['term'] if b else '—'} | "
                f"{_tm(a and a['session_s'])} | {_tm(b and b['session_s'])} | {(a or {}).get('in_tokens') or '—'} | {(b or {}).get('in_tokens') or '—'} |"
            )
        L += ["", "갈린 과제: " + ("; ".join(diverged) if diverged else "없음"), ""]
        L += ["종료 사유 분포:", "", "| 종료 사유 | A | B |", "|---|---|---|"]
        for term in TERMS:
            na, nb = sum(t["term"] == term for t in bt if t["arm"] == "A"), sum(t["term"] == term for t in bt if t["arm"] == "B")
            if na or nb:
                L.append(f"| {term} | {na} | {nb} |")
        if bench == "swtbench":
            L += ["", "SWT 보조: " + " · ".join(
                f"{arm} 커밋함 {sum(bool(t['committed']) for t in bt if t['arm'] == arm)} · '테스트만' 위반 {sum(bool(t['test_only_violation']) for t in bt if t['arm'] == arm)}" for arm in "AB"
            )]
        succ = {arm: [t for t in bt if t["arm"] == arm and won(t)] for arm in "AB"}
        tok = {arm: sum((t["in_tokens"] or 0) for t in bt if t["arm"] == arm) for arm in "AB"}
        L += ["", "성공 1건당 입력 토큰: " + " · ".join(f"{arm} {tok[arm] / len(succ[arm]):,.0f}" if succ[arm] else f"{arm} —" for arm in "AB")]
        if bench == "deepswe":
            L.append("DeepSWE 작업 트리 Δ: 사후 채점 미실행(artifacts/worktree.patch 수집만)")
        L += ["", "B 증거 점검(§6):", "", "| job | 팔 | 결과 | 비고 |", "|---|---|---|---|"]
        for t in bt:
            ok, why = evidence_check(t)
            L.append(f"| {t['job']} | {t['arm']} | {'일치' if ok else '불일치'} | {why} |")
        L.append("")
    L += ["## 무효·재실행", ""]
    L += [f"- {r[0]} {r[1]} {r[2] if len(r) > 2 else ''}" for r in inv] or ["- 없음"]
    L += [f"- 인프라 예외: {t['job']} ({t['exc']})" for t in trials if t["term"] == "인프라 오류"]
    L += ["", "## 잠금본", "", "```", lock.rstrip(), "```", ""]
    return "\n".join(L), summary


INDEX_HEAD = ["# 묶음 deepswe-swt-v1 — 판·단계별", "", "| 판 | 단계 | 생성 | 결론 |", "|---|---|---|---|"]


def index_path() -> pathlib.Path:
    return HERE / "reports" / ec.BUNDLE / "index.md"


def previous_row(harness: str, tier: str) -> str | None:
    p = index_path()
    if not p.is_file():
        return None
    rows = [l for l in p.read_text().splitlines() if l.startswith("| ") and not l.startswith("| 판") and f"| {tier} |" in l and not l.startswith(f"| {harness} |")]
    return rows[-1] if rows else None


def update_index(harness: str, tier: str, summary: str) -> None:
    p = index_path()
    lines = p.read_text().splitlines() if p.is_file() else list(INDEX_HEAD)
    row = f"| {harness} | {tier} | {dt.date.today()} | {summary} |"
    lines = [l for l in lines if not l.startswith(f"| {harness} | {tier} |")] + [row]
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("\n".join(lines) + "\n")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("jobs", type=pathlib.Path)
    ap.add_argument("tier", choices=["superlight", "light", "medium", "heavy"])
    ap.add_argument("harness")
    ap.add_argument("--post-hoc", action="store_true")
    ap.add_argument("--out", type=pathlib.Path)
    ap.add_argument("--no-index", action="store_true")
    a = ap.parse_args(argv)
    trials = [t for t in load_trials(a.jobs) if t["arm"] == "A" or t["harness"] in (a.harness, "base")]
    text, summary = render(a.jobs, a.tier, a.harness, a.post_hoc, trials, load_invalid(a.jobs))
    out = a.out or HERE / "reports" / ec.BUNDLE / f"{a.harness}-{a.tier}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text)
    if not a.no_index:
        update_index(a.harness, a.tier, summary)
    print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
