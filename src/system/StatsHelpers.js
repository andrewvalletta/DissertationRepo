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
