"""OpenCode 실행 기록(events.jsonl)에서 룰 파일 읽기와 .tsx 쓰기의 순서를 센다.

usage: python3 analyze-oc.py <runs-dir>
판정: READ = `rules/ui-components.md` 를 읽은 첫 도구 호출 순번, TSX = .tsx 를 쓰거나 고친 첫 도구 호출 순번.
"""

import json
import os
import re
import sys

RULE = re.compile(r"rules/ui-components\.md")
TSX_PATCH = re.compile(r"\*\*\* (?:Update|Add) File: (\S+\.tsx)")


def tool_calls(path):
    out = []
    for line in open(path, encoding="utf8"):
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get("type") == "tool_use":
            p = e.get("part", {})
            st = p.get("state", {})
            out.append((p.get("tool"), st.get("input", {}) or {}, st.get("status"), str(st.get("error") or "")))
        elif e.get("type") == "error":
            out.append(("ERROR", e.get("error", {}), "error", json.dumps(e.get("error"), ensure_ascii=False)))
    return out


def tsx_targets(tool, inp):
    if tool in ("edit", "write"):
        p = str(inp.get("filePath") or inp.get("path") or "")
        return [p] if p.endswith(".tsx") else []
    if tool in ("patch", "apply_patch"):
        return TSX_PATCH.findall(str(inp.get("patchText") or inp.get("patch") or ""))
    return []


def main(runs):
    rows = []
    for name in sorted(os.listdir(runs)):
        ev = os.path.join(runs, name, "events.jsonl")
        if not os.path.exists(ev):
            continue
        calls = tool_calls(ev)
        read_at = next(
            (i for i, (t, inp, st, _) in enumerate(calls) if t == "read" and RULE.search(str(inp.get("path") or inp.get("filePath") or ""))),
            None,
        )
        rule_path = calls[read_at][1].get("path") if read_at is not None else "-"
        tsx_at = next((i for i, (t, inp, st, _) in enumerate(calls) if tsx_targets(t, inp) and st == "completed"), None)
        denied = sum(1 for (_, _, st, err) in calls if "denied" in err.lower())
        errors = [err[:80] for (t, _, _, err) in calls if t == "ERROR"]
        if read_at is not None and (tsx_at is None or read_at < tsx_at):
            verdict = "READ→TSX" if tsx_at is not None else "READ(no tsx)"
        elif read_at is None:
            verdict = "NO-READ" + ("" if tsx_at is not None else " (no tsx)")
        else:
            verdict = "TSX→READ"
        rows.append((name, verdict, read_at, tsx_at, rule_path, len(calls), denied, ";".join(errors)))
    print("run\tverdict\tread_at\ttsx_at\trule_path\tcalls\tdenied\terrors")
    for r in rows:
        print("\t".join("-" if v is None else str(v) for v in r))


if __name__ == "__main__":
    main(sys.argv[1])
