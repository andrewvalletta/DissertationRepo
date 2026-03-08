import { SystemEvents } from "./SystemEvents";

export class GamificationEngine {
    constructor(config = {}) {
        this.config = {
            baseScore: config.baseScore ?? 50,
            baseXp: config.baseXp ?? 10,
            levelThresholds: config.levelThresholds ?? {
                1: 0,
                2: 100,
                3: 200,
            },
            maxLevel: config.maxLevel ?? 3,
            progressDelta: config.progressDelta ?? 10,
            progressThreshold: config.progressThreshold ?? 300,
            onSessionEnd: config.onSessionEnd ?? null,
        };

        this.resetState();
    }

    getLevelFromXp(xp) {
        let level = 1;

        for (const [lvl, thresholdXp] of Object.entries(this.config.levelThresholds)) {
            if (xp >= thresholdXp) {
                level = Number(lvl);
            }
        }

        return Math.min(level, this.config.maxLevel);
    }

    resetState() {
        this.state = {
            score: 0,
            level: 1,
            xp: 0,
            achievements: new Set(),
            progressDelta: 0,
            consecutiveSuccesses: 0,
            sessionEnded: false,
        };
    }

    handleEvent(event) {
        if (this.state.sessionEnded && event.eventType !== SystemEvents.SESSION_START) {
            return null;
        }

        const deltas = {};

        switch (event.eventType) {
            case SystemEvents.SESSION_START: {
                this.resetState();
                break;
            }

            case SystemEvents.TASK_START: {
                const before = this.state.progressDelta;

                this.state.progressDelta = Math.min(300, this.state.progressDelta + this.config.progressDelta);

                deltas.progressDelta = this.state.progressDelta - before;
                deltas.totalProgress = this.state.progressDelta;
                break;
            }

            case SystemEvents.TASK_SUCCESS: {
                // Score
                this.state.score += this.config.baseScore;
                deltas.scoreDelta = this.config.baseScore;
                deltas.totalScore = this.state.score;

                // XP and Level
                const levelBefore = this.state.level;
                this.state.xp += this.config.baseXp;

                const levelAfter = this.getLevelFromXp(this.state.xp);
                this.state.level = levelAfter;

                deltas.levelBefore = levelBefore;
                deltas.levelAfter = levelAfter;

                // Achievements
                const achievementsUnlocked = [];

                this.state.consecutiveSuccesses += 1;
                const streakTargets = [5, 10, 15, 20, 30];

                for (const target of streakTargets) {
                    const key = `STREAK_${target}`;
                    if (this.state.consecutiveSuccesses === target && !this.state.achievements.has(key)) {
                        this.state.achievements.add(key);
                        achievementsUnlocked.push(key);
                    }
                }

                if (levelBefore === 1 && levelAfter === 2 && !this.state.achievements.has('LEVEL_UP')) {
                    this.state.achievements.add('LEVEL_UP');
                    achievementsUnlocked.push('LEVEL_UP');
                }

                if (achievementsUnlocked.length > 0) {
                    // Log only achievements first unlocked by this specific event.
                    deltas.achievementsUnlocked = [...achievementsUnlocked];
                }

                break;
            }

            case SystemEvents.TASK_FAILURE: {
                this.state.consecutiveSuccesses = 0; // Reset streak on failure
                break;
            }

            default:
                // Ignore other events
                break;
        }

        const canCompleteSession =
            event.eventType === SystemEvents.TASK_SUCCESS ||
            event.eventType === SystemEvents.TASK_SKIP ||
            (event.eventType === SystemEvents.TASK_FAILURE && event.retryable !== true);

        if (
            !this.state.sessionEnded &&
            canCompleteSession &&
            this.state.progressDelta >= this.config.progressThreshold
        ) {
            this.state.sessionEnded = true;

            if (typeof this.config.onSessionEnd === 'function') {
                this.config.onSessionEnd(this.getSessionSummary());
            }
        }

        return Object.keys(deltas).length > 0 ? deltas : null;
    }

    getState() {
        return {
            score: this.state.score,
            level: this.state.level,
            xp: this.state.xp,
            achievements: Array.from(this.state.achievements),
            progressDelta: this.state.progressDelta,
        };
    }

    getSessionSummary() {
        return {
            finalScore: this.state.score,
            finalLevel: this.state.level,
            totalProgress: this.state.progressDelta,
            achievementsUnlocked: [...this.state.achievements],
        };
    }
}
