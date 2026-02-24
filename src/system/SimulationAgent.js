export class SimulationAgent {
    constructor(profile = {}, seed = 1) {
        this.profile = {
            profileName: profile.profileName ?? 'simulated',

            // Core behavior from AgentProfiles.js
            accuracy: profile.accuracy ?? 0.7,
            retryRate: profile.retryRate ?? 0.5,
            skipRate: profile.skipRate ?? 0.05,
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

    setLevel(level) {
        this.currentLevel = level ?? 1;
    }

    shouldSkip() {
        return this.rng() < this.profile.skipRate;
    }

    shouldRetry() {
        return this.rng() < this.profile.retryRate;
    }

    attemptOutcome() {
        return this.rng() < this.profile.accuracy;
    }

    getResponseTime() {
        const [min, max] = this.profile.responseTime;
        return Math.abs(min + this.rng() * (max - min));
    }
}
