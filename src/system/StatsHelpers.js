export function initialiseStatsEntry(stats, key, metadata = {}) {
    // If the stats entry already exists, return stats as is
    if (stats[key]) {
        return stats;
    };

    // Create a new stats entry with default values and provided metadata
    const newEntry = {
        // Counters
        questions: 0,
        skips: 0,
        tries: 0,
        correct: 0,

        // Time tracking
        totalTime: 0,

        // Answer identification (note, bpm, time signature)
        ...metadata
    };

    return {
        ...stats,
        [key]: newEntry
    };
}

export function startQuestion(stats, key, metadata = {}) {
    // Ensure stats entry exists
    const withEntry = initialiseStatsEntry(stats, key, metadata);

    const entry = withEntry[key];

    // Create updated entry with incremented question count
    const updatedEntry = {
        ...entry,
        questions: entry.questions + 1
    };

    return {
        stats: {
            ...withEntry,
            [key]: updatedEntry
        },
        gameStartTime: performance.now()
    };
}

export function registerAttempt(stats, key, gameStartTime, isCorrect) {
    // Stats entry should already exist from startQuestion
    const entry = stats[key];

    if (!entry) {
        throw new Error(`Stats entry for key "${key}" does not exist.`);
    }

    const updatedEntry = {
        ...entry,
        tries: entry.tries + 1,
        correct: isCorrect ? entry.correct + 1 : entry.correct,
        totalTime: isCorrect ? entry.totalTime + (performance.now() - gameStartTime) : entry.totalTime
    };

    return {
        stats: {
            ...stats,
            [key]: updatedEntry
        }
    };
}

export function skipQuestion(stats, key) {
    const entry = stats[key];

    if (!entry) {
        throw new Error(`Stats entry for key "${key}" does not exist.`);
    }

    const updatedEntry = {
        ...entry,
        skips: entry.skips + 1
    };

    return {
        ...stats,
        [key]: updatedEntry
    };
}
