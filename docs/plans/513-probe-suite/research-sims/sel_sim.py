"""Selection-bias demo under a TRUE ZERO effect. Pool of 60 items, pA=pB ~ U(0.05,0.95).
Pilot = 2 runs/arm. Select 15 items by different rules; then estimate B-A on (i) the same pilot runs, (ii) fresh 3 runs/arm."""
import numpy as np
from scipy import stats
rng = np.random.default_rng(11)
def runs(p, r): return (rng.random((len(p), r)) < p[:, None]).mean(1)
rules = {
  "diff(B-A) top15 [treatment-aware]": lambda a, b: np.argsort(-(b - a))[:15],
  "A-only hardest15 (reuse A pilot)": lambda a, b: np.argsort(a + rng.random(len(a)) * 1e-6)[:15],
  "pooled closest to .5 [blind]": lambda a, b: np.argsort(np.abs((a + b) / 2 - 0.5) + rng.random(len(a)) * 1e-6)[:15],
}
reps = 4000
for name, rule in rules.items():
    reuse, fresh, rej_reuse, rej_fresh = [], [], 0, 0
    for _ in range(reps):
        p = rng.uniform(0.05, 0.95, 60)
        a, b = runs(p, 2), runs(p, 2)
        idx = rule(a, b)
        d_reuse = b[idx] - a[idx]
        fa, fb = runs(p[idx], 3), runs(p[idx], 3)
        d_fresh = fb - fa
        reuse.append(d_reuse.mean()); fresh.append(d_fresh.mean())
        for d, key in ((d_reuse, 0), (d_fresh, 1)):
            pv = 1.0 if np.all(d == d[0]) and d[0] == 0 else (0.0 if np.all(d == d[0]) else stats.ttest_1samp(d, 0).pvalue)
            if pv < 0.05:
                if key == 0: rej_reuse += 1
                else: rej_fresh += 1
    print(f"{name}: reuse mean {100*np.mean(reuse):+.1f}pp (false+ {rej_reuse/reps:.3f}) | fresh mean {100*np.mean(fresh):+.1f}pp (false+ {rej_fresh/reps:.3f})")
