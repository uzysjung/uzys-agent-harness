"""deepswe-hard-v1 선정 — DeepSWE 공개 시행 결과(trials.json)만 쓴다. 우리 실행 결과는 읽지 않는다(설계 513-eval-framework-design.md §1).

   python3 -I select-hard.py <trials.json>   → 과제 이름을 한 줄씩(정렬) 출력
"""
import collections, json, statistics, sys

rows = [r for r in json.load(open(sys.argv[1]))["rows"] if r.get("included_in_score")]
passed = lambda r: 1 if (r["score_value"] or 0) >= 1 else 0
glm, other = collections.defaultdict(list), collections.defaultdict(list)
for r in rows:
    (glm if r["config"] == "mini_swe_agent_glm_5_3_max" else other)[r["task_name"]].append(passed(r))
other_mean = {t: sum(v) / len(v) for t, v in other.items()}
median = statistics.median(other_mean.values())
print(f"# configs={len({r['config'] for r in rows})} other-median={median:.3f}", file=sys.stderr)
for t in sorted(t for t, v in glm.items() if 1 <= sum(v) <= 3 and other_mean[t] <= median):
    print(t)
