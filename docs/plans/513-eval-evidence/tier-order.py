"""단계(슈퍼라이트 ⊂ 라이트 ⊂ 미디엄 ⊂ 헤비) 과제 순서 — 결과를 보기 전에 고정한다(설계 513-eval-framework-design.md §3).

   python3 -I tier-order.py deepswe <trials.json> <deepswe-hard-v1.txt>   → 공개 GLM-5.3 max 에이전트 시간 중앙값 오름차순
   python3 -I tier-order.py swtbench <swtbench-verified 과제 폴더>          → 이름 정렬 뒤 Random(513) 섞기
각 단계는 이 목록의 앞 N 개다. 우리 실행 결과는 읽지 않는다.
"""
import collections, json, pathlib, random, statistics, sys

kind = sys.argv[1]
if kind == "deepswe":
    rows = json.load(open(sys.argv[2]))["rows"]
    dur = collections.defaultdict(list)
    for r in rows:
        if r.get("included_in_score") and r["config"] == "mini_swe_agent_glm_5_3_max" and r.get("agent_duration_seconds"):
            dur[r["task_name"]].append(r["agent_duration_seconds"] / 60)
    tasks = [l.strip() for l in open(sys.argv[3]) if l.strip()]
    for t in sorted(tasks, key=lambda t: (statistics.median(dur[t]), t)):
        print(f"{t}\t{statistics.median(dur[t]):.0f}")
elif kind == "swtbench":
    ids = sorted(p.name for p in pathlib.Path(sys.argv[2]).iterdir() if (p / "task.toml").is_file())
    random.Random(513).shuffle(ids)
    print("\n".join(ids))
else:
    sys.exit("kind: deepswe | swtbench")
