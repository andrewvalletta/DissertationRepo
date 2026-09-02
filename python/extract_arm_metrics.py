"""
Stream the four 100,000-session arm exports and compute three per-session
outcome metrics, so the Chapter 4 box plots can be drawn from real
distributions rather than summary statistics.

Metrics (defined exactly as in the technical dump, section 3.15):
  completion_rate       = count(TASK_SUCCESS) / count(TASK_START)
  final_level           = SESSION_END.finalLevel
  mean_response_time_ms = mean(responseTime) over TASK_ATTEMPT + TASK_RETRY

Output -> python/figures/_arm_metrics.npz  (one 1-D array per arm per metric)
Also prints five-number summaries + Kruskal-Wallis + Dunn for cross-checking
against the dump's published H / epsilon^2 / means.
"""

import os
import time
import numpy as np
import ijson
from scipy.stats import kruskal
import scikit_posthocs as sp

DS = r"C:\Users\valdr\OneDrive - Malta College of Arts, Science & Technology\Desktop\Lvl6\Dissertation\Datasets"
FILES = {
    "Solo": "solo100000LP.json",
    "Collaborative": "coll100000LP.json",
    "Collaborative with learning": "obslrn100000LP.json",
    "ML-informed": "mllvlup100000LP.json",
}
OUT = os.path.join(os.path.dirname(__file__), "figures")
os.makedirs(OUT, exist_ok=True)


def process(path):
    comp, lvl, rt = [], [], []
    with open(path, "rb") as f:
        for session in ijson.items(f, "item", use_float=True):
            starts = succ = 0
            rts = []
            final_level = None
            for e in session:
                et = e.get("eventType")
                if et == "TASK_START":
                    starts += 1
                elif et == "TASK_SUCCESS":
                    succ += 1
                elif et == "TASK_ATTEMPT" or et == "TASK_RETRY":
                    v = e.get("responseTime")
                    if v is None:
                        v = e.get("responseTimeMs")
                    if v is not None:
                        rts.append(float(v))
                elif et == "SESSION_END":
                    fl = e.get("finalLevel")
                    if fl is not None:
                        final_level = float(fl)
            if starts > 0:
                comp.append(succ / starts)
            if final_level is not None:
                lvl.append(final_level)
            if rts:
                rt.append(sum(rts) / len(rts))
    return np.asarray(comp), np.asarray(lvl), np.asarray(rt)


def five_num(a):
    q1, med, q3 = np.percentile(a, [25, 50, 75])
    return dict(n=len(a), mean=a.mean(), std=a.std(), min=a.min(),
                q1=q1, median=med, q3=q3, max=a.max())


def main():
    data = {}
    for arm, fn in FILES.items():
        path = os.path.join(DS, fn)
        t0 = time.time()
        c, l, r = process(path)
        data[arm] = dict(completion_rate=c, final_level=l, mean_response_time_ms=r)
        print(f"[{arm:28s}] {fn:22s} sessions~{len(c):>7d}  {time.time()-t0:6.1f}s")

    npz = {}
    for arm, d in data.items():
        key = arm.replace(" ", "_")
        for metric, arr in d.items():
            npz[f"{key}__{metric}"] = arr
    np.savez_compressed(os.path.join(OUT, "_arm_metrics.npz"), **npz)
    print("saved", os.path.join(OUT, "_arm_metrics.npz"))

    for metric in ("completion_rate", "final_level", "mean_response_time_ms"):
        print(f"\n=== {metric} ===")
        samples = []
        for arm in FILES:
            a = data[arm][metric]
            samples.append(a)
            s = five_num(a)
            print(f"  {arm:28s} n={s['n']:>7d} mean={s['mean']:.4f} "
                  f"med={s['median']:.4f} std={s['std']:.4f} "
                  f"min={s['min']:.4f} Q1={s['q1']:.4f} Q3={s['q3']:.4f} max={s['max']:.4f}")
        H, p = kruskal(*samples)
        N = sum(len(a) for a in samples)
        k = len(samples)
        eps2 = (H - k + 1) / (N - k)
        print(f"  Kruskal-Wallis H={H:.3f} df={k-1} p={p:.3e} eps^2={eps2:.4f}")
        allv = np.concatenate(samples)
        grp = np.concatenate([[i] * len(a) for i, a in enumerate(samples)])
        dunn = sp.posthoc_dunn([allv[grp == i] for i in range(k)], p_adjust="bonferroni")
        print("  Dunn (Bonferroni) p-values:")
        print(dunn.to_string(float_format=lambda x: f"{x:.2e}"))


if __name__ == "__main__":
    main()
