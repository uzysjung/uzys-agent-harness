# python3 summ.py <scene>... — 장면 기록에서 판정에 필요한 부분만
import sys, re, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scenes")
NOISE = re.compile(r"^(  ▸|              ·|━|    ✓|  ━━|  →|                 )")
for name in sys.argv[1:]:
    s = open(os.path.join(D, name + ".txt")).read()
    print("=" * 20, name)
    print(s.splitlines()[0])
    def section(a, b):
        i = s.find(a)
        if i < 0: return ""
        j = s.find(b, i + len(a)) if b else -1
        return s[i:j if j > 0 else len(s)]
    pre = section("# pre-install", "\n$ ")
    if pre: print(pre)
    ed = section("# installer edits", "\n# log before")
    if ed: print(ed)
    body = section("# log before", "$ branch list")
    print("\n".join(l for l in body.splitlines() if not NOISE.match(l) and l.strip()))
    for l in s.splitlines():
        if "QUIET CHECK" in l: print(l)
    qi = s.find("# UPDATE QUIET CHECK 1: CHANGED")
    if qi >= 0:
        blk = s[qi:].split("\n$ ")[0].splitlines()[1:40]
        print("\n".join(blk))
    ra = section("$ [re-add]", "\n$ [ref]")
    if ra: print("\n".join(l for l in ra.splitlines() if not NOISE.match(l) and l.strip())[:3000])
    cmpb = section("# COMPARE", None)
    print("\n".join(l[:260] for l in cmpb.splitlines()))
