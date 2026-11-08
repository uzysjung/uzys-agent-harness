"""Extra checks: null size of tests on unselected/extreme items; mid-p exact; group-sequential (2 looks, OBF);
betting e-process on item differences (anytime-valid, Ville threshold 1/alpha)."""
import numpy as np
from scipy import stats
import power_sim as ps

rng = np.random.default_rng(7)

def exact_midp(sB, sA, r):
    lo_tot, dist = 0, np.array([1.0])
    for a, b in zip(sA, sB):
        lo, p = ps.hyper_pmf(a + b, r)
        dist = np.convolve(dist, p); lo_tot += lo
    sup = np.arange(lo_tot, lo_tot + len(dist)); mean = (sup * dist).sum()
    dev = abs(sB.sum() - mean)
    more = dist[np.abs(sup - mean) > dev + 1e-9].sum(); eq = dist[np.abs(np.abs(sup - mean) - dev) <= 1e-9].sum()
    return more + 0.5 * eq

def draw(sampler, delta, n, r):
    pA = sampler(n); la = np.log(pA / (1 - pA)); pB = 1 / (1 + np.exp(-(la + delta)))
    return (rng.random((n, r)) < pA[:, None]).sum(1), (rng.random((n, r)) < pB[:, None]).sum(1), (pB - pA).mean()

def ttest_p(d):
    if np.all(d == d[0]): return 1.0 if d[0] == 0 else 0.0
    return stats.ttest_1samp(d, 0).pvalue

def size_checks(reps=3000):
    for name, s in (("unselected", ps.unselected), ("extreme .05/.95", lambda n: rng.choice([0.05, 0.95], n)), ("band .3-.7", ps.band(0.3, 0.7))):
        rt = rm = 0
        for _ in range(reps):
            sA, sB, _ = draw(s, 0.0, 15, 3)
            rt += ttest_p((sB - sA) / 3) < 0.05; rm += exact_midp(sB, sA, 3) < 0.05
        print(f"NULL {name} 15x3: ttest size {rt/reps:.3f} | exact mid-p size {rm/reps:.3f}")
    for d in (1.0, 1.5):
        rm = 0
        for _ in range(reps):
            sA, sB, _ = draw(ps.band(0.3, 0.7), d, 15, 3); rm += exact_midp(sB, sA, 3) < 0.05
        print(f"POWER band 15x3 d={d}: exact mid-p {rm/reps:.3f}")

def group_seq(delta, reps=3000, n1=15, n2=30, r=3):
    # O'Brien-Fleming 2 equally spaced looks, two-sided 0.05: z = 2.797, 1.977 (nominal p .0052, .048)
    rej = 0; used = 0; eff = []
    for _ in range(reps):
        sA, sB, e = draw(ps.band(0.3, 0.7), delta, n2, r); eff.append(e)
        d = (sB - sA) / r
        p1 = ttest_p(d[:n1])
        if p1 < 0.0052: rej += 1; used += n1; continue
        used += n2; rej += ttest_p(d) < 0.048
    return rej / reps, used / reps, 100 * np.mean(eff)

def eprocess(delta, reps=3000, nmax=30, r=3, alpha=0.05, lams=(0.25, 0.5, 0.75)):
    rej = 0; used = 0
    for _ in range(reps):
        sA, sB, _ = draw(ps.band(0.3, 0.7), delta, nmax, r)
        d = (sB - sA) / r
        # two-sided: average of +/- direction mixtures over lambda grid
        cp = np.cumprod(1 + np.outer(d, lams), axis=0).mean(1)
        cm = np.cumprod(1 - np.outer(d, lams), axis=0).mean(1)
        e = 0.5 * (cp + cm)
        hit = np.nonzero(e >= 1 / alpha)[0]
        if len(hit): rej += 1; used += hit[0] + 1
        else: used += nmax
    return rej / reps, used / reps

if __name__ == "__main__":
    size_checks()
    for d in (0.0, 1.0, 1.5):
        p, u, e = group_seq(d)
        print(f"GSD OBF looks@15,30 items x3 d={d}: reject {p:.3f} | E[items] {u:.1f} | mean pp {e:.1f}")
    for d in (0.0, 1.0, 1.5):
        p, u = eprocess(d)
        print(f"e-process nmax30 x3 d={d}: reject {p:.3f} | E[items] {u:.1f}")
