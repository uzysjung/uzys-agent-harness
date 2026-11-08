"""measure-rule-reach.sh 의 실행 기록에서 CLI 마다 답하기 전에 읽은 `.claude/rules/` 룰 파일을 센다.

usage: python3 -I scripts/measure-rule-reach.py <out-dir>
판정: pointer(AGENTS.md 있음) 의 유효 실행 전부가 룰 파일을 빠짐없이 읽었으면 그 CLI 는 PASS.
      control(AGENTS.md 없음) 은 안내 없이 어디까지 읽는지 보는 대조군이다 — 판정에 쓰지 않고 함께 적는다.
유효 실행 = 최종 답이 있는 실행. API 오류 · 시간 초과 · 권한 거부로 답이 없으면 무효로 따로 센다(PASS 의 분모에서 뺀다).
exit: 0 = 측정한 CLI 모두 PASS · 1 = FAIL 이 있다 · 2 = 유효 실행이 없는 CLI 가 있다(판정 불가).

읽었다 = 그 룰 파일의 본문이 모델이 받은 도구 출력에 실렸다. 명령 모양(경로 · 글롭)으로 추정하지 않는다 —
`rg --files` 같은 목록 조회는 경로만 보이고, 파이썬 한 줄은 경로 문자열 없이 파일을 읽는다(첫 측정에서 오판 2건).
본문 판별 = 룰 파일의 첫 `# ` 제목 줄이 출력의 한 줄로 있는가(줄 번호 접두가 붙어도 잡는다).
CLI 별 근거: Codex = command_execution 의 aggregated_output · OpenCode = tool_use 의 output ·
Antigravity = run_command 의 output, 그리고 read_file 의 Path(이 도구는 출력에 본문 대신 줄 수만 남기고 파일 전체를 읽는다).
"""

import glob
import json
import os
import re
import sys

RULE_FILE = re.compile(r"\.claude/rules/([A-Za-z0-9_.-]+\.md)")


def lines(path):
    if not os.path.exists(path):
        return []
    out = []
    for raw in open(path, encoding="utf8", errors="replace"):
        try:
            out.append(json.loads(raw))
        except ValueError:
            continue
    return out


def headings(run, all_rules):
    """룰 파일마다 첫 `# ` 제목 줄을 출력에서 찾는 정규식."""
    out = {}
    for f in all_rules:
        for line in open(os.path.join(run, "proj", ".claude", "rules", f), encoding="utf8"):
            if line.startswith("# "):
                out[f] = re.compile(r"(?<!#)" + re.escape(line.strip()) + r"[ \t]*$", re.M)
                break
    return out


def shown(text, heads):
    return {f for f, rx in heads.items() if rx.search(text)}


def codex(events, heads, run):
    text = "\n".join(
        str((e.get("item") or {}).get("aggregated_output") or "")
        for e in events
        if e.get("type") == "item.completed" and (e.get("item") or {}).get("type") == "command_execution"
    )
    last = os.path.join(run, "last.txt")
    answered = os.path.exists(last) and open(last, encoding="utf8", errors="replace").read().strip() != ""
    return shown(text, heads), answered


def opencode(events, heads, run):
    outputs, answered = [], False
    for e in events:
        if e.get("type") == "tool_use":
            st = e.get("part", {}).get("state", {}) or {}
            if st.get("status") == "completed":
                outputs.append(str(st.get("output") or ""))
        elif e.get("type") == "text" and (e.get("part", {}).get("text") or "").strip():
            answered = True
    return shown("\n".join(outputs), heads), answered


def antigravity(events, heads, run):
    read, outputs, answered = set(), [], False
    for e in events:
        su = e.get("step_update") or {}
        if su.get("step_type") == "tool" and su.get("state") == "DONE":
            info = su.get("tool_info") or {}
            if su.get("tool_name") == "read_file":
                read |= set(RULE_FILE.findall(str((info.get("parameters") or {}).get("Path") or "")))
            elif su.get("tool_name") == "run_command":
                outputs.append(str(info.get("output") or ""))
        res = e.get("result") or {}
        if res.get("status") not in (None, "ERROR") and (res.get("response") or "").strip():
            answered = True
    return (read & set(heads)) | shown("\n".join(outputs), heads), answered


PARSERS = {"codex": codex, "opencode": opencode, "antigravity": antigravity}


def main(out):
    worst = 0
    for cli in sorted(os.listdir(out)):
        if cli not in PARSERS:
            continue
        print(f"== {cli}")
        verdict = None
        for arm in ("pointer", "control"):
            runs = sorted(glob.glob(os.path.join(out, cli, f"{arm}-*")))
            valid = full = invalid = 0
            counts = []
            for run in runs:
                all_rules = sorted(os.path.basename(p) for p in glob.glob(os.path.join(run, "proj", ".claude", "rules", "*.md")))
                heads = headings(run, all_rules)
                read, answered = PARSERS[cli](lines(os.path.join(run, "events.jsonl")), heads, run)
                read &= set(all_rules)
                if not answered:
                    invalid += 1
                    print(f"   {os.path.basename(run)}: 무효(최종 답 없음) — 읽은 룰 {len(read)}/{len(all_rules)}")
                    continue
                valid += 1
                counts.append(len(read))
                full += len(read) == len(all_rules)
                missing = sorted(set(all_rules) - read)
                print(f"   {os.path.basename(run)}: 읽은 룰 {len(read)}/{len(all_rules)}" + (f" · 안 읽음 {missing}" if missing else ""))
            if not runs:
                continue
            print(f"   [{arm}] 유효 {valid} · 전부 읽음 {full}/{valid} · 무효 {invalid}")
            if arm == "pointer":
                verdict = "판정 불가" if valid == 0 else ("PASS" if full == valid else "FAIL")
        print(f"   => {verdict}")
        worst = max(worst, {"PASS": 0, "FAIL": 1}.get(verdict, 2))
    return worst


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
