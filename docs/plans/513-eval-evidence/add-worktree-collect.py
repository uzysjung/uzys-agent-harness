"""DeepSWE 어려운 31 과제의 로컬 task.toml 에 둘째 collect(작업 트리 패치)를 넣는다 — 설계 §4-2 · §8-2(슈퍼라이트 전에).

   python3 -I add-worktree-collect.py <deep-swe/tasks> <deepswe-hard-v1.txt>          # 적용(멱등)
   python3 -I add-worktree-collect.py <deep-swe/tasks> <deepswe-hard-v1.txt> --check  # 31 과제가 모두 적용 상태인지만(바꾸지 않는다)

원본은 처음 적용할 때 task.toml.orig 로 한 번만 백업한다(다시 돌려도 덮지 않는다). 결과 = task.toml.orig + 아래 블록(model.patch collect 바로 뒤).
되돌리기 = task.toml.orig 를 task.toml 로 복사.
"""
import pathlib
import re
import shutil
import sys
import tomllib

MARK = "# 513-eval: worktree.patch (보조 채점, 설계 §4-2)"


def block(base: str) -> str:
    cmd = f"cd /app && git add -A -N && git diff --binary {base} > /logs/artifacts/worktree.patch"
    return f'\n{MARK}\n[[verifier.collect]]\ncommand = "{cmd}"\ntimeout_sec = 300.0\n'


def patched(orig: str) -> str:
    base = tomllib.loads(orig)["metadata"]["base_commit_hash"]
    # model.patch collect 블록(첫 [[verifier.collect]] 부터 그 timeout_sec 줄까지) 바로 뒤에 넣는다
    m = re.search(r"\[\[verifier\.collect\]\]\ncommand = \"[^\n]*model\.patch\"\ntimeout_sec = [0-9.]+\n", orig)
    if not m:
        raise SystemExit("model.patch collect 블록을 못 찾았다 — 형식이 바뀌었다")
    out = orig[: m.end()] + block(base) + orig[m.end():]
    cols = tomllib.loads(out)["verifier"]["collect"]
    assert len(cols) == 2 and "model.patch" in cols[0]["command"] and "worktree.patch" in cols[1]["command"], cols
    return out


def main() -> None:
    tasks_dir, listing = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    check = "--check" in sys.argv[3:]
    ids = [l.strip() for l in listing.read_text().splitlines() if l.strip()]
    bad = 0
    for t in ids:
        toml, orig = tasks_dir / t / "task.toml", tasks_dir / t / "task.toml.orig"
        src = orig.read_text() if orig.exists() else toml.read_text()
        if MARK in src:
            raise SystemExit(f"{t}: 백업이 이미 패치된 판이다 — 원본을 확인하라")
        want = patched(src)
        if toml.read_text() == want:
            continue
        if check:
            print(f"NOT APPLIED {t}")
            bad += 1
            continue
        if not orig.exists():
            shutil.copy2(toml, orig)
        toml.write_text(want)
        print(f"applied {t}")
    print(f"{len(ids)} tasks, {'not applied ' + str(bad) if check else 'ok'}")
    sys.exit(1 if bad else 0)


main()
