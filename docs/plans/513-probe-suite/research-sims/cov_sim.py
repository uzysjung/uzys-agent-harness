"""Coverage of 95% CI for mean item difference: percentile bootstrap (items) vs t-interval. True mean computed from item pB-pA."""
import numpy as np
from scipy import stats
rng = np.random.default_rng(3)
def cov(n, r, delta, reps=2000, B=2000):
    cb = ct = 0; wb = wt = 0
    for _ in range(reps):
        pA = rng.uniform(0.3, 0.7, n); pB = 1/(1+np.exp(-(np.log(pA/(1-pA))+delta)))
        true = (pB-pA).mean()
        d = (rng.random((n,r))<pB[:,None]).mean(1) - (rng.random((n,r))<pA[:,None]).mean(1)
        bs = d[rng.integers(0,n,(B,n))].mean(1); lo, hi = np.quantile(bs,[.025,.975])
        cb += lo<=true<=hi; wb += hi-lo
        se = d.std(ddof=1)/np.sqrt(n); t = stats.t.ppf(.975,n-1)
        ct += d.mean()-t*se<=true<=d.mean()+t*se; wt += 2*t*se
    print(f"{n}x{r} delta={delta}: bootstrap cover {cb/reps:.3f} (width {100*wb/reps:.1f}pp) | t cover {ct/reps:.3f} (width {100*wt/reps:.1f}pp)")
for n in (6, 15, 30):
    cov(n, 3, 0.0); cov(n, 3, 1.0)
