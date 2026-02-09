import { SystemEvents } from "./SystemEvents";

export class GamificationEngine {
    constructor(config = {}) {
        this.config = {
            baseScore: config.baseScore ?? 50,
            baseXp: config.baseXp ?? 10,
            levelThresholds: config.levelThresholds ?? {
                1: 100,
                2: 150,
                3: 200,
            },
            progressDelta: config.progressDelta ?? 10,
        };

        this.resetState();
    }

    resetState() {
        this.state = {
            score: 0,
            level: 1,
            xp: 0,
            achievements: new Set(),
            progressDelta: 0,
            consecutiveSuccesses: 0,
        };
    }

    handleEvent(event) {
        const deltas = {};

        switch (event.eventType) {
            case SystemEvents.SESSION_START: {
                this.resetState();
                break;
            }

            case SystemEvents.TASK_START: {
                const before = this.state.progressDelta;

                this.state.progressDelta = Math.min(100, this.state.progressDelta + this.config.progressDelta);

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

                const threshold = this.config.levelThresholds[this.state.level];

                if (threshold && this.state.xp >= threshold) {
                    this.state.level += 1;
                    this.state.xp = 0; // Reset XP on level up
                }

                deltas.levelBefore = levelBefore;
                deltas.levelAfter = this.state.level;

                // Achievements (e.g. 5 success streak)
                this.state.consecutiveSuccesses += 1;

                if (this.state.consecutiveSuccesses === 5 && !this.state.achievements.has('STREAK_5')) {
                    this.state.achievements.add('STREAK_5');
                    deltas.achievementUnlocked = 'STREAK_5';
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
            totalProgress: this.state.totalProgress,
            achievementsUnlocked: [...this.state.achievements],
        };
    }
}
