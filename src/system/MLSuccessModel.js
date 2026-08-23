/*
 * Predicted success rate for the low-accuracy agent, keyed by
 * (level_t, learn_cnt), as produced by a decision tree classifier
 * trained on observational-learning simulation data (low agent,
 * 100,000 sessions, level/learn_cnt combinations capped at 1000
 * observations each).
 *
 * Source: python/decision_tree_capped.ipynb 
 *         making use of
 *         python/output/obs100000LP_capped1000.csv (model_success_rate column).
 */
const MODEL_SUCCESS_RATES = {
    1: [
        { learnCount: 0, rate: 0.489030 },
        { learnCount: 1, rate: 0.606335 },
        { learnCount: 2, rate: 0.662339 },
        { learnCount: 3, rate: 0.688522 },
        { learnCount: 4, rate: 0.666011 },
        { learnCount: 5, rate: 0.701738 },
    ],

    2: [
        { learnCount: 0, rate: 0.370211 },
        { learnCount: 1, rate: 0.473246 },
        { learnCount: 2, rate: 0.570009 },
        { learnCount: 3, rate: 0.577071 },
        { learnCount: 4, rate: 0.581753 },
        { learnCount: 5, rate: 0.609429 },
        { learnCount: 6, rate: 0.622054 },
        { learnCount: 7, rate: 0.599500 },
        { learnCount: 8, rate: 0.594867 },
        { learnCount: 9, rate: 0.582156 },
    ],

    3: [
        { learnCount: 1, rate: 0.382139 },
        { learnCount: 2, rate: 0.474618 },
        { learnCount: 3, rate: 0.474038 },
        { learnCount: 4, rate: 0.474740 },
        { learnCount: 5, rate: 0.491317 },
        { learnCount: 6, rate: 0.499117 },
        { learnCount: 7, rate: 0.529561 },
        { learnCount: 8, rate: 0.497197 },
        { learnCount: 9, rate: 0.497511 },
        { learnCount: 10, rate: 0.529609 },
        { learnCount: 11, rate: 0.492837 },
        { learnCount: 12, rate: 0.494782 },
        { learnCount: 13, rate: 0.501005 },
    ],
};


/*
 * Returns the model's predicted success rate for a given level and
 * learn_cnt.
 *
 * If the exact (level, learn_cnt) pair was never observed in the capped
 * training data (e.g. level 3 has no learn_cnt = 0 row, and every
 * level's learn_cnt stops at a capped maximum), this clamps to the
 * nearest learn_cnt row available for that level rather than failing
 * or extrapolating.
 */
export function getPredictedSuccessRate(level, learnCount) {
    const normalizedLevel =
        Math.min(
            3,
            Math.max(
                1,
                Math.floor(Number(level) || 1)
            )
        );

    const rows =
        MODEL_SUCCESS_RATES[normalizedLevel] ??
        MODEL_SUCCESS_RATES[1];

    const normalizedLearnCount =
        Math.max(
            0,
            Math.floor(Number(learnCount) || 0)
        );

    let closestRow = rows[0];
    let closestDistance =
        Math.abs(
            rows[0].learnCount - normalizedLearnCount
        );

    for (const row of rows) {
        const distance =
            Math.abs(row.learnCount - normalizedLearnCount);

        if (distance < closestDistance) {
            closestRow = row;
            closestDistance = distance;
        }
    }

    return closestRow.rate;
}
