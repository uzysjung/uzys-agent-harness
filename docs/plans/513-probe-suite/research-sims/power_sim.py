"""Power simulation for paired A/B harness eval: n items x r runs per arm, binary outcome.

Tests compared (two-sided alpha=0.05):
  ttest  : paired t-test on per-item pass-rate differences (d_i = pB_hat - pA_hat)
  exact  : exact stratified conditional test (= exact CMH / within-item permutation of arm labels);
           statistic S = sum_i (B successes); null dist = convolution of per-item hypergeometrics
  mcnemar: exact McNemar on run-index-paired outcomes (run j of A with run j of B), for reference
Scenario params: baseline pA distribution, logit shift delta (mean) with item heterogeneity tau.
"""
import sys
import numpy as np
from scipy import stats

rng = np.random.default_rng(513)


def hyper_pmf(m, r):
    # B successes among m total successes when 2r runs split r/r: support k in [max(0,m-r), min(m,r)]
    lo, hi = max(0, m - r), min(m, r)
    ks = np.arange(lo, hi + 1)
    p = stats.hypergeom.pmf(ks, 2 * r, m, r)
    return lo, p


def exact_cond_p(sB, sA, r):
    lo_tot = 0
    dist = np.array([1.0])
    for a, b in zip(sA, sB):
        m = a + b
        lo, p = hyper_pmf(m, r)
        dist = np.convolve(dist, p)
        lo_tot += lo
    support = np.arange(lo_tot, lo_tot + len(dist))
    mean = (support * dist).sum()
    obs = sB.sum()
    dev = abs(obs - mean)
    return dist[np.abs(support - mean) >= dev - 1e-9].sum()


def mcnemar_p(yA, yB):
    b = int(((yB == 1) & (yA == 0)).sum())
    c = int(((yB == 0) & (yA == 1)).sum())
    n = b + c
    if n == 0:
        return 1.0
    return min(1.0, 2 * stats.binom.cdf(min(b, c), n, 0.5))


def simulate(pA_sampler, delta, tau, n, r, reps=2000, alpha=0.05):
    rej = {"ttest": 0, "exact": 0, "mcnemar": 0}
    eff = []
    disc_items = []
    for _ in range(reps):
        pA = pA_sampler(n)
        la = np.log(pA / (1 - pA))
        lb = la + delta + tau * rng.standard_normal(n)
        pB = 1 / (1 + np.exp(-lb))
        eff.append((pB - pA).mean())
        yA = rng.random((n, r)) < pA[:, None]
        yB = rng.random((n, r)) < pB[:, None]
        sA, sB = yA.sum(1), yB.sum(1)
        d = (sB - sA) / r
        disc_items.append(((sA + sB) % (2 * r) != 0).sum())
        if np.all(d == d[0]):
            pt = 1.0 if d[0] == 0 else 0.0
        else:
            pt = stats.ttest_1samp(d, 0).pvalue
        rej["ttest"] += pt < alpha
        rej["exact"] += exact_cond_p(sB, sA, r) < alpha
        rej["mcnemar"] += mcnemar_p(yA.ravel(), yB.ravel()) < alpha
    out = {k: v / reps for k, v in rej.items()}
    out["mean_pp"] = 100 * float(np.mean(eff))
    out["informative_items"] = float(np.mean(disc_items))
    return out


def fixed(p):
    return lambda n: np.full(n, p)


def band(lo, hi):
    return lambda n: rng.uniform(lo, hi, n)


def unselected(n):
    # 'hard-item' mix like superlight: 40% near floor, 20% near ceiling, 40% mid
    u = rng.random(n)
    return np.where(u < 0.4, 0.05, np.where(u < 0.6, 0.95, rng.uniform(0.3, 0.7, n)))


if __name__ == "__main__":
    reps = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
    scen = [
        ("null band0.3-0.7 15x3", band(0.3, 0.7), 0.0, 0.0, 15, 3),
        ("null band 15x3 tau0.5", band(0.3, 0.7), 0.0, 0.5, 15, 3),
        ("superlight-like 6x1 p=.5 d=1.0", fixed(0.5), 1.0, 0.0, 6, 1),
    ]
    for delta in (0.6, 0.8, 1.0, 1.2, 1.5):
        scen.append((f"band 15x3 d={delta}", band(0.3, 0.7), delta, 0.0, 15, 3))
    for delta in (1.0, 1.5):
        scen.append((f"band 15x3 tau0.5 d={delta}", band(0.3, 0.7), delta, 0.5, 15, 3))
        scen.append((f"unselected 15x3 d={delta}", unselected, delta, 0.0, 15, 3))
    # equal budget 45 runs/arm, delta=1.0
    for n, r in ((45, 1), (23, 2), (15, 3), (9, 5)):
        scen.append((f"budget45 band {n}x{r} d=1.0", band(0.3, 0.7), 1.0, 0.0, n, r))
    for n, r in ((30, 3), (15, 6), (20, 3)):
        scen.append((f"band {n}x{r} d=0.8", band(0.3, 0.7), 0.8, 0.0, n, r))
    print("scenario | ttest | exact | mcnemar(run-paired) | mean pp effect | informative items")
    for name, s, d, t, n, r in scen:
        o = simulate(s, d, t, n, r, reps=reps)
        print(f"{name} | {o['ttest']:.3f} | {o['exact']:.3f} | {o['mcnemar']:.3f} | {o['mean_pp']:.1f} | {o['informative_items']:.1f}")
