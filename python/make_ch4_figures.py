"""
Chapter 4 figure generation.

Data sources (all values transcribed verbatim from ClassifiersResults.txt and the
Chapter 4 write-up; nothing is estimated):
  * validation tables  -> "<classifier> low capped 1000" blocks
  * confusion matrices  -> tri-fold "Average" rows for the cap-1000 low-accuracy runs
  * metric comparison   -> Table tab:classifier-summary
  * effect sizes        -> section 4.4 Kruskal-Wallis eps^2 values

Outputs -> python/figures/*.png  (300 dpi, framed by \fbox in LaTeX)
"""

import os
import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

plt.rcParams.update({
    "font.family": "serif",
    "font.size": 10,
    "axes.titlesize": 11,
    "axes.labelsize": 10,
    "legend.fontsize": 9,
    "xtick.labelsize": 9,
    "ytick.labelsize": 9,
    "axes.grid": True,
    "grid.alpha": 0.3,
    "grid.linewidth": 0.5,
    "figure.dpi": 300,
    "savefig.dpi": 300,
    "savefig.bbox": "tight",
})

OUT = os.path.join(os.path.dirname(__file__), "figures")
os.makedirs(OUT, exist_ok=True)

EMP_COLOR = "#333333"
MODEL_COLOR = "#1f77b4"

# ---------------------------------------------------------------------------
# Validation data: (level_t, learn_cnt, empirical_success_rate, model_success_rate)
# ---------------------------------------------------------------------------
VALIDATION = {
    "lr": {
        "name": "Logistic regression",
        "rows": [
            (1, 0, 0.489, 0.543260), (1, 1, 0.607, 0.581789), (1, 2, 0.663, 0.619479),
            (1, 3, 0.689, 0.656012), (1, 4, 0.666, 0.690610), (1, 5, 0.701, 0.723155),
            (2, 0, 0.370, 0.473492), (2, 1, 0.474, 0.492159), (2, 2, 0.570, 0.511393),
            (2, 3, 0.577, 0.530433), (2, 4, 0.581, 0.549387), (2, 5, 0.609, 0.567685),
            (2, 6, 0.622, 0.586620), (2, 7, 0.600, 0.604697), (2, 8, 0.595, 0.622857),
            (2, 9, 0.582, 0.640458),
            (3, 1, 0.382, 0.452225), (3, 2, 0.474, 0.458083), (3, 3, 0.474, 0.463832),
            (3, 4, 0.474, 0.469681), (3, 5, 0.490, 0.475553), (3, 6, 0.500, 0.481423),
            (3, 7, 0.530, 0.487153), (3, 8, 0.497, 0.493186), (3, 9, 0.497, 0.499175),
            (3, 10, 0.529, 0.504495), (3, 11, 0.492, 0.511158), (3, 12, 0.495, 0.516399),
            (3, 13, 0.501, 0.522571),
        ],
    },
    "nb": {
        "name": "Naive Bayes",
        "rows": [
            (1, 0, 0.489, 0.530247), (1, 1, 0.607, 0.585253), (1, 2, 0.663, 0.630246),
            (1, 3, 0.689, 0.665716), (1, 4, 0.666, 0.691945), (1, 5, 0.701, 0.709875),
            (2, 0, 0.370, 0.444661), (2, 1, 0.474, 0.482533), (2, 2, 0.570, 0.516267),
            (2, 3, 0.577, 0.544855), (2, 4, 0.581, 0.568380), (2, 5, 0.609, 0.586306),
            (2, 6, 0.622, 0.600194), (2, 7, 0.600, 0.608661), (2, 8, 0.595, 0.612794),
            (2, 9, 0.582, 0.612077),
            (3, 1, 0.382, 0.438177), (3, 2, 0.474, 0.451006), (3, 3, 0.474, 0.462463),
            (3, 4, 0.474, 0.472807), (3, 5, 0.490, 0.481948), (3, 6, 0.500, 0.489728),
            (3, 7, 0.530, 0.496075), (3, 8, 0.497, 0.501543), (3, 9, 0.497, 0.505642),
            (3, 10, 0.529, 0.507690), (3, 11, 0.492, 0.509890), (3, 12, 0.495, 0.509420),
            (3, 13, 0.501, 0.508493),
        ],
    },
    "dt": {
        "name": "Decision tree",
        "rows": [
            (1, 0, 0.489, 0.489030), (1, 1, 0.607, 0.606335), (1, 2, 0.663, 0.662339),
            (1, 3, 0.689, 0.688522), (1, 4, 0.666, 0.666011), (1, 5, 0.701, 0.701738),
            (2, 0, 0.370, 0.370211), (2, 1, 0.474, 0.473246), (2, 2, 0.570, 0.570009),
            (2, 3, 0.577, 0.577071), (2, 4, 0.581, 0.581753), (2, 5, 0.609, 0.609429),
            (2, 6, 0.622, 0.622054), (2, 7, 0.600, 0.599500), (2, 8, 0.595, 0.594867),
            (2, 9, 0.582, 0.582156),
            (3, 1, 0.382, 0.382139), (3, 2, 0.474, 0.474618), (3, 3, 0.474, 0.474038),
            (3, 4, 0.474, 0.474740), (3, 5, 0.490, 0.491317), (3, 6, 0.500, 0.499117),
            (3, 7, 0.530, 0.529561), (3, 8, 0.497, 0.497197), (3, 9, 0.497, 0.497511),
            (3, 10, 0.529, 0.529609), (3, 11, 0.492, 0.492837), (3, 12, 0.495, 0.494782),
            (3, 13, 0.501, 0.501005),
        ],
    },
    "rf": {
        "name": "Random forest",
        "rows": [
            (1, 0, 0.489, 0.488259), (1, 1, 0.607, 0.606163), (1, 2, 0.663, 0.661786),
            (1, 3, 0.689, 0.688951), (1, 4, 0.666, 0.667305), (1, 5, 0.701, 0.700947),
            (2, 0, 0.370, 0.370431), (2, 1, 0.474, 0.472765), (2, 2, 0.570, 0.569180),
            (2, 3, 0.577, 0.577319), (2, 4, 0.581, 0.582104), (2, 5, 0.609, 0.610116),
            (2, 6, 0.622, 0.621943), (2, 7, 0.600, 0.598427), (2, 8, 0.595, 0.595681),
            (2, 9, 0.582, 0.581830),
            (3, 1, 0.382, 0.382159), (3, 2, 0.474, 0.476102), (3, 3, 0.474, 0.474157),
            (3, 4, 0.474, 0.475593), (3, 5, 0.490, 0.490829), (3, 6, 0.500, 0.499465),
            (3, 7, 0.530, 0.527448), (3, 8, 0.497, 0.498690), (3, 9, 0.497, 0.498112),
            (3, 10, 0.529, 0.528080), (3, 11, 0.492, 0.491485), (3, 12, 0.495, 0.495487),
            (3, 13, 0.501, 0.501275),
        ],
    },
}

# Tri-fold average confusion matrices (cap 1000, low-accuracy profile)
CONFUSION = {
    "Logistic regression": dict(tn=1944, fp=2479, fn=1729, tp=3514),
    "Naive Bayes":         dict(tn=1661, fp=2762, fn=1450, tp=3794),
    "Decision tree":       dict(tn=1930, fp=2493, fn=1724, tp=3519),
    "Random forest":       dict(tn=1930, fp=2493, fn=1724, tp=3519),
}

# Tri-fold average metrics (Table tab:classifier-summary)
METRICS = {
    "labels": ["Accuracy", "Precision", "Recall", "F1", "Specificity"],
    "Logistic regression": [0.560, 0.590, 0.670, 0.630, 0.440],
    "Naive Bayes":         [0.560, 0.580, 0.720, 0.640, 0.380],
    "Decision tree":       [0.560, 0.590, 0.670, 0.620, 0.440],
    "Random forest":       [0.560, 0.590, 0.670, 0.620, 0.440],
}

# Kruskal-Wallis omnibus effect sizes (section 4.4 / verified by extract_arm_metrics.py)
EFFECT_SIZES = [
    ("Mean response time", 0.841),
    ("Task completion rate", 0.496),
    ("Final level reached", 0.007),
]

ARM_ORDER = ["Solo", "Collaborative", "Collaborative with learning", "ML-informed"]
ARM_COLORS = {
    "Solo": "#8c8c8c",
    "Collaborative": "#4c72b0",
    "Collaborative with learning": "#55a868",
    "ML-informed": "#c44e52",
}
ARM_METRICS_NPZ = os.path.join(OUT, "_arm_metrics.npz")


def _load_arm_metric(metric):
    """Return {arm: 1-D array} for one metric, from extract_arm_metrics.py output."""
    if not os.path.exists(ARM_METRICS_NPZ):
        raise SystemExit(
            f"missing {ARM_METRICS_NPZ}; run python/extract_arm_metrics.py first")
    z = np.load(ARM_METRICS_NPZ)
    return {arm: z[f"{arm.replace(' ', '_')}__{metric}"] for arm in ARM_ORDER}


def _boxplot(metric, ylabel, title, fname, ylim=None, yfmt=None,
             showfliers=False, annotate_l3=False, flier_size=2, flier_alpha=0.25,
             legend_loc="lower right"):
    data = _load_arm_metric(metric)
    series = [data[a] for a in ARM_ORDER]
    fig, ax = plt.subplots(figsize=(8.5, 4.6))
    bp = ax.boxplot(series, tick_labels=ARM_ORDER, patch_artist=True,
                    widths=0.55, showmeans=True, showfliers=showfliers,
                    meanprops=dict(marker="D", markerfacecolor="white",
                                   markeredgecolor="black", markersize=5),
                    medianprops=dict(color="black", linewidth=1.4),
                    flierprops=dict(marker="o", markersize=flier_size,
                                    markerfacecolor="#555555",
                                    markeredgecolor="none", alpha=flier_alpha))
    for patch, arm in zip(bp["boxes"], ARM_ORDER):
        patch.set_facecolor(ARM_COLORS[arm])
        patch.set_alpha(0.65)
    from matplotlib.lines import Line2D
    ax.legend(handles=[
        Line2D([0], [0], marker="D", markerfacecolor="white",
               markeredgecolor="black", markersize=6, linestyle="none",
               label="Mean"),
        Line2D([0], [0], color="black", linewidth=1.4, label="Median"),
    ], loc=legend_loc, framealpha=0.95, fontsize=8)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.grid(axis="x", visible=False)
    if ylim:
        ax.set_ylim(*ylim)
    if yfmt:
        ax.yaxis.set_major_formatter(yfmt)
    if annotate_l3:
        ax.set_yticks([2, 3], ["Level 2", "Level 3"])
        for i, arm in enumerate(ARM_ORDER, start=1):
            n_lo = int(np.sum(data[arm] < 2.5))
            frac = (1 - n_lo / len(data[arm])) * 100
            ax.text(i, 3.14,
                    f"{frac:.2f}% reach L3\n({n_lo:,} of {len(data[arm]):,} at L2)",
                    ha="center", va="bottom", fontsize=8)
    path = os.path.join(OUT, fname)
    fig.savefig(path)
    plt.close(fig)
    print("wrote", path)


def completion_rate_boxplot():
    _boxplot("completion_rate", "Task completion rate",
             "Task completion rate by experimental arm\n"
             "(100,000 sessions per arm, low-accuracy profile)",
             "completion_rate_boxplot.png", ylim=(0.62, 1.06))


def final_level_boxplot():
    _boxplot("final_level", "Final level reached",
             "Final level reached by experimental arm\n"
             "(100,000 sessions per arm, low-accuracy profile)",
             "final_level_boxplot.png", ylim=(1.82, 3.62),
             showfliers=True, annotate_l3=True, flier_size=4, flier_alpha=0.5,
             legend_loc="center left")


def response_time_boxplot():
    _boxplot("mean_response_time_ms", "Mean response time (ms)",
             "Mean session response time by experimental arm\n"
             "(100,000 sessions per arm, low-accuracy profile)",
             "response_time_boxplot.png", legend_loc="lower left")

CLASSIFIER_COLORS = {
    "Logistic regression": "#1f77b4",
    "Naive Bayes":         "#d62728",
    "Decision tree":       "#2ca02c",
    "Random forest":       "#9467bd",
}


def validation_plot(key):
    info = VALIDATION[key]
    rows = np.array(info["rows"], dtype=float)
    fig, axes = plt.subplots(1, 3, figsize=(11, 3.6), sharey=True)
    for ax, lvl in zip(axes, (1, 2, 3)):
        sub = rows[rows[:, 0] == lvl]
        x = sub[:, 1]
        ax.plot(x, sub[:, 2], "o", color=EMP_COLOR, markersize=5,
                label="Empirical", zorder=3)
        ax.plot(x, sub[:, 2], "-", color=EMP_COLOR, linewidth=0.8, alpha=0.5, zorder=2)
        ax.plot(x, sub[:, 3], "-", color=MODEL_COLOR, linewidth=1.8,
                label="Model", zorder=4)
        ax.set_title(f"Level {lvl}")
        ax.set_xlabel("Observational-learning count (learn_cnt)")
        ax.set_ylim(0.30, 0.80)
        ax.set_xticks(x[::2] if lvl == 3 else x)
    axes[0].set_ylabel("Task success rate")
    axes[0].legend(loc="lower right", framealpha=0.95)
    fig.suptitle(f"{info['name']}: predicted vs. empirical success rate "
                 f"(low-accuracy profile, cap 1000)", y=1.02)
    path = os.path.join(OUT, f"{key}_validation_cap1000.png")
    fig.savefig(path)
    plt.close(fig)
    print("wrote", path)


def confusion_matrices():
    fig, axes = plt.subplots(1, 4, figsize=(13, 3.7))
    fig.subplots_adjust(wspace=0.12)
    order = ["Logistic regression", "Naive Bayes", "Decision tree", "Random forest"]
    cell_labels = np.array([["True Negative", "False Positive"],
                            ["False Negative", "True Positive"]])
    gmax = max(max(v.values()) for v in CONFUSION.values())
    for ax, name in zip(axes, order):
        c = CONFUSION[name]
        mat = np.array([[c["tn"], c["fp"]], [c["fn"], c["tp"]]], dtype=float)
        ax.imshow(mat, cmap="Blues", vmin=0, vmax=gmax)
        for (i, j), v in np.ndenumerate(mat):
            txtcol = "white" if v > gmax * 0.55 else "black"
            ax.text(j, i, cell_labels[i, j], ha="center", va="bottom",
                    fontsize=8.5, color=txtcol)
            ax.text(j, i + 0.06, f"{int(v):,}", ha="center", va="top",
                    fontsize=12, fontweight="bold", color=txtcol)
        ax.set_xticks([])
        ax.set_yticks([])
        ax.set_title(name)
        ax.set_xticks(np.arange(-0.5, 2, 1), minor=True)
        ax.set_yticks(np.arange(-0.5, 2, 1), minor=True)
        ax.grid(which="minor", color="white", linewidth=1.5)
        ax.grid(which="major", visible=False)
        ax.tick_params(which="minor", length=0)
    fig.suptitle("Tri-fold aggregate confusion matrices (low-accuracy profile, cap 1000)",
                 y=1.04)
    path = os.path.join(OUT, "confusion_matrices_cap1000.png")
    fig.savefig(path)
    plt.close(fig)
    print("wrote", path)


def metrics_comparison():
    labels = METRICS["labels"]
    order = ["Logistic regression", "Naive Bayes", "Decision tree", "Random forest"]
    x = np.arange(len(labels))
    width = 0.2
    fig, ax = plt.subplots(figsize=(9, 4.5))
    for i, name in enumerate(order):
        vals = METRICS[name]
        bars = ax.bar(x + (i - 1.5) * width, vals, width, label=name,
                      color=CLASSIFIER_COLORS[name])
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width() / 2, v + 0.008, f"{v:.2f}",
                    ha="center", va="bottom", fontsize=7)
    ax.set_xticks(x, labels)
    ax.set_ylabel("Tri-fold average score")
    ax.set_ylim(0, 0.95)
    ax.legend(ncol=2, loc="upper left", framealpha=0.95)
    ax.set_title("Tri-fold average classification metrics "
                 "(low-accuracy profile, cap 1000)")
    ax.grid(axis="x", visible=False)
    path = os.path.join(OUT, "classifier_metrics_comparison.png")
    fig.savefig(path)
    plt.close(fig)
    print("wrote", path)


def effect_size_summary():
    names = [n for n, _ in EFFECT_SIZES]
    vals = [v for _, v in EFFECT_SIZES]
    colors = ["#b2182b", "#ef8a62", "#d1d1d1"]
    fig, ax = plt.subplots(figsize=(7.5, 4))
    bars = ax.barh(names, vals, color=colors, edgecolor="black", linewidth=0.5)
    ax.invert_yaxis()
    for b, v in zip(bars, vals):
        ax.text(v + 0.012, b.get_y() + b.get_height() / 2, f"{v:.3f}",
                va="center", fontsize=10)
    ax.set_xlim(0, 1.0)
    ax.set_xlabel(r"Effect size $\varepsilon^2$")
    ax.set_title(r"Kruskal-Wallis omnibus effect size ($\varepsilon^2$) by outcome metric")
    ax.grid(axis="y", visible=False)
    for thr, lab in [(0.01, "0.01"), (0.06, "0.06"), (0.14, "0.14")]:
        ax.axvline(thr, color="grey", linestyle=":", linewidth=0.8)
        ax.text(thr, 2.75, lab, rotation=90, va="top", ha="right",
                fontsize=7, color="grey")
    ax.text(0.30, 2.9, "dotted lines: small / medium / large thresholds",
            fontsize=7, color="grey", va="top")
    path = os.path.join(OUT, "effect_size_summary.png")
    fig.savefig(path)
    plt.close(fig)
    print("wrote", path)


if __name__ == "__main__":
    for k in ("lr", "nb", "dt", "rf"):
        validation_plot(k)
    confusion_matrices()
    metrics_comparison()
    effect_size_summary()
    completion_rate_boxplot()
    final_level_boxplot()
    response_time_boxplot()
    print("done ->", OUT)
