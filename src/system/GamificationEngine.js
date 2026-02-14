import { SystemEvents } from "./SystemEvents";

export class GamificationEngine {
    constructor(config = {}) {
        this.config = {
            baseScore: config.baseScore ?? 50,
            baseXp: config.baseXp ?? 10,
            levelThresholds: config.levelThresholds ?? {
                1: 100,
                2: 200,
                3: 300,
            },
            progressDelta: config.progressDelta ?? 10,
        };

        this.resetState();
    }

    getMaxLevel() {
        const levels = Object.keys(this.config.levelThresholds).map(Number);
        return levels.length > 0 ? Math.max(...levels) : 1;
    }

    getLevelFromXp(xp) {
        const thresholds = Object.entries(this.config.levelThresholds)
            .map(([level, thresholdXp]) => ({
                level: Number(level),
                thresholdXp,
            }))
            .sort((a, b) => a.thresholdXp - b.thresholdXp);

        const maxLevel = this.getMaxLevel();
        let level = 1;

        for (const threshold of thresholds) {
            if (xp >= threshold.thresholdXp) {
                level = Math.min(maxLevel, threshold.level + 1);
            }
        }

        return level;
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
                    deltas.achievementsUnlocked = achievementsUnlocked;
                    deltas.achievementUnlocked = achievementsUnlocked[0];
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
            totalProgress: this.state.progressDelta,
            achievementsUnlocked: [...this.state.achievements],
        };
    }
}
