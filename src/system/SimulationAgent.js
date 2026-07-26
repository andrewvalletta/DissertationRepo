export class SimulationAgent {
    constructor(profile = {}, seed = 1) {
        this.profile = {
            profileName: profile.profileName ?? 'simulated',

            // Core behavior from AgentProfiles.js
            accuracy: profile.accuracy ?? 0.7,
            maxRetries: profile.maxRetries ?? 2,
            responseTime: profile.responseTime ?? [800, 1400],

        };

        this.initialSeed = seed;
        this.rng = this.createSeededRNG(seed);

        this.currentLevel = 1;
    }

    createSeededRNG(seed) {
        let s = seed % 2147483647;
        if (s <= 0) {
            s += 2147483646;
        }

        return function () {
            s = (s * 16807) % 2147483647;
            return (s - 1) / 2147483646;
        }
    }

    resetSeed() {
        this.rng = this.createSeededRNG(this.initialSeed);
    }

    clampProbability(value, min = 0, max = 1) {
        return Math.min(max, Math.max(min, value));
    }

    getDerivedAccuracy() {
        return this.clampProbability(Number(this.profile.accuracy) || 0);
    }

    getRetryProbability() {
        const accuracy = this.getDerivedAccuracy();
        return this.clampProbability(0.2 + (1 - accuracy) * 0.6, 0.05, 0.85);
    }

    getSkipProbability() {
        const accuracy = this.getDerivedAccuracy();
        return this.clampProbability((1 - accuracy) * 0.1, 0.01, 0.1);
    }

    getDerivedResponseTimeRange() {
        const [baseMin = 800, baseMax = 1400] = Array.isArray(this.profile.responseTime)
            ? this.profile.responseTime
            : [800, 1400];

        const accuracy = this.getDerivedAccuracy();
        const scale = this.clampProbability(1.3 - (accuracy * 0.6), 0.55, 1.15);
        const min = Math.max(0, baseMin * scale);
        const max = Math.max(min, baseMax * scale);

        return [min, max];
    }

    setLevel(level) {
        this.currentLevel = level ?? 1;
    }

    shouldSkip() {
        return this.rng() < this.getSkipProbability();
    }

    shouldRetry(retryCount = 0) {
        if (retryCount >= this.getMaxRetries()) {
            return false;
        }

        const roll = this.rng();
        const skipProbability = this.getSkipProbability();

        if (roll < skipProbability) {
            return false;
        }

        return roll < skipProbability + this.getRetryProbability();
    }

    getMaxRetries() {
        return Math.max(0, Math.floor(this.profile.maxRetries));
    }

    attemptOutcome() {
        return this.rng() < this.profile.accuracy;
    }

    getResponseTime() {
        const [min, max] = this.getDerivedResponseTimeRange();
        return Math.abs(min + this.rng() * (max - min));
    }
}
