import { EventLogger } from "./EventLogger";
import { SystemEvents } from "./SystemEvents";
import { sessionManager } from "./SessionManager";
import { SimulationAgent } from "./SimulationAgent";
import { AGENT_PROFILES } from "./AgentProfiles";
import { TaskFactory } from "./TaskFactory";
import { LEVEL_CONFIG } from "./LevelConfig";

function shuffle(array, rng) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function restrictPool(array, size, rng) {
    if (size >= array.length) {
        return array;
    }

    return shuffle(array, rng).slice(0, size);
}

const RETRY_PROFILE_ENSEMBLE = {
    low_accuracy: [
        ['low_accuracy', 'moderate_accuracy'],
        ['low_accuracy', 'moderate_accuracy', 'high_accuracy'],
    ],
    moderate_accuracy: [
        ['moderate_accuracy', 'high_accuracy'],
        ['moderate_accuracy', 'high_accuracy'],
    ],
    high_accuracy: [
        ['high_accuracy'],
        ['high_accuracy']
    ],
};

const PROFILE_ORDER = ['low_accuracy', 'moderate_accuracy', 'high_accuracy'];

const SIMULATION_TYPES = {
    SOLO: 'solo',
    SIMPLE_COLLAB: 'simple_collab',
    OBS_LEARN: 'obs_learn',
};

function normalizeSimulationType(value) {
    const normalized = String(value ?? SIMULATION_TYPES.SOLO).trim().toLowerCase();

    if (Object.values(SIMULATION_TYPES).includes(normalized)) {
        return normalized;
    }

    return SIMULATION_TYPES.SOLO;
}

function chooseProfileName(profileNames, rng) {
    if (!Array.isArray(profileNames) || profileNames.length === 0) {
        return null;
    }

    const selectedIndex = Math.floor(rng() * profileNames.length);
    return profileNames[selectedIndex] ?? null;
}

function cloneProfile(profile) {
    return {
        ...profile,
        responseTime: Array.isArray(profile?.responseTime) ? [...profile.responseTime] : [800, 1400],
    };
}

function getLevelAccuracyAdjustment(level) {
    const normalizedLevel = Math.max(1, Math.floor(Number(level) || 1));
    return Math.max(0, normalizedLevel - 1) * 0.1;
}

export class SimulationRunner {
    constructor(config = {}) {
        this.config = {
            taskType: config.taskType ?? 'pitch', // 'pitch' or 'tempo'
            simulationType: normalizeSimulationType(config.simulationType),
            seed: config.seed ?? 1,
            recentTaskBuffer: config.recentTaskBuffer ?? 5,
        };

        this.profile = AGENT_PROFILES[config.profile] ?? AGENT_PROFILES['moderate_accuracy'];

        this.baseSeed = this.config.seed ?? 1;

        this.currentLevel = null;
        this.currentPools = null;
        this.recentTasks = [];
        this.sessionProfiles = {};
        this.profileLearningState = {};
    }

    getTaskSpaceSize() {
        if (this.config.taskType === 'pitch') {
            return this.currentPools?.notes?.length ?? 0;
        }

        if (this.config.taskType === 'tempo') {
            const bpmCount = this.currentPools?.bpms?.length ?? 0;
            const signatureCount = this.currentPools?.timeSignatures?.length ?? 0;
            return bpmCount * signatureCount;
        }

        return 0;
    }

    getRecentTaskBufferSize() {
        return Math.max(0, Math.floor(this.config.recentTaskBuffer));
    }

    getNextTask() {
        const taskSpaceSize = this.getTaskSpaceSize();
        const rawBufferSize = this.getRecentTaskBufferSize();
        const effectiveBufferSize = Math.min(rawBufferSize, Math.max(0, taskSpaceSize - 1));

        if (effectiveBufferSize === 0) {
            return TaskFactory.generate({
                rng: this.agent.rng,
                type: this.config.taskType,
                pools: this.currentPools,
            });
        }

        const recentSet = new Set(this.recentTasks.slice(-effectiveBufferSize));
        let fallbackTask = null;

        for (let i = 0; i < 25; i++) {
            const candidate = TaskFactory.generate({
                rng: this.agent.rng,
                type: this.config.taskType,
                pools: this.currentPools,
            });

            fallbackTask = candidate;

            if (!recentSet.has(candidate.taskId)) {
                return candidate;
            }
        }

        return fallbackTask;
    }

    rememberTask(taskId) {
        this.recentTasks.push(taskId);

        const maxRetained = Math.max(1, this.getRecentTaskBufferSize());
        if (this.recentTasks.length > maxRetained) {
            this.recentTasks = this.recentTasks.slice(-maxRetained);
        }
    }

    createPools(level) {
        const config = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];

        return {
            notes: restrictPool(
                config.pitch.allowedNotes,
                config.pitch.numNotesInPool,
                this.agent.rng
            ),
            bpms: restrictPool(
                config.tempo.allowedBpms,
                config.tempo.bpmChoices,
                this.agent.rng
            ),
            timeSignatures: restrictPool(
                config.tempo.allowedTimeSignatures,
                config.tempo.timeSignatureChoices,
                this.agent.rng
            )
        };
    }

    runBatch(sessionCount = 100, agentProfileName = 'moderate_accuracy', taskType = 'pitch', simulationType = SIMULATION_TYPES.SOLO) {
        EventLogger.enableSimulationMode();

        this.config.taskType = taskType;
        this.config.simulationType = normalizeSimulationType(simulationType);

        for (let i = 0; i < sessionCount; i++) {
            console.log(`Running session ${i + 1} of ${sessionCount} [${this.config.simulationType}]`);
            this.runSingleSession(i, agentProfileName);
        }

        console.log("Dataset length: ", EventLogger.simulationDataset.length);

        EventLogger.exportSimulationDataset();
    }

    runSingleSession(sessionIndex = 0, agentProfileName = 'moderate_accuracy') {
        // Force end of any existing session to avoid conflicts
        if (sessionManager.getSessionId()) {
            sessionManager.endSession(false);
        }

        // Ensure clean state
        EventLogger.clear();

        // Create a new agent with the specified profile and seed
        const sessionSeed = this.baseSeed + sessionIndex;
        this.initialProfileName = agentProfileName;
        this.sessionProfiles = this.createSessionProfiles();
        this.profileLearningState = this.createProfileLearningState();
        this.profile = this.getSessionProfile(agentProfileName);
        this.agent = new SimulationAgent(this.profile, sessionSeed);
        this.agent.profile = this.profile;
        this.recentTasks = [];

        // Start the session
        sessionManager.startSession();

        // Minimal simulation loop
        while (!this.hasSessionEnded()) {
            this.simulateTask();
        }

        return EventLogger.exportSessionAsJSON();
    }

    simulateTask() {
        const taskOwnerProfile = this.agent.profile;
        const currentLevel = EventLogger.getGamificationState().level ?? 1;

        this.agent.setLevel(currentLevel);
        this.agent.profile = this.getEffectiveProfile(taskOwnerProfile.profileName, currentLevel);

        // Create task pools based on the current level configuration
        if (this.currentLevel !== currentLevel) {
            this.currentLevel = currentLevel;
            this.currentPools = this.createPools(currentLevel);
        }

        const task = this.getNextTask();

        const taskId = task.taskId;
        this.rememberTask(taskId);

        // TASK_START
        EventLogger.log({
            eventType: SystemEvents.TASK_START,
            taskId,
            agentProfile: taskOwnerProfile.profileName,
            level: currentLevel,
        });

        let success = false;
        let retryCount = 0;
        const maxRetries = this.agent.getMaxRetries();
        let activeProfileName = taskOwnerProfile.profileName;

        while (true) {
            this.agent.profile = this.getEffectiveProfile(activeProfileName, currentLevel);

            const responseTime = this.agent.getResponseTime();
            success = this.agent.attemptOutcome();

            // First attempt is TASK_ATTEMPT; subsequent attempts are TASK_RETRY
            EventLogger.log({
                eventType: retryCount === 0 ? SystemEvents.TASK_ATTEMPT : SystemEvents.TASK_RETRY,
                taskId,
                agentProfile: this.agent.profile.profileName,
                success,
                responseTime,
                retryCount,
            });

            if (success) {
                EventLogger.log({
                    eventType: SystemEvents.TASK_SUCCESS,
                    taskId,
                    agentProfile: this.agent.profile.profileName,
                    responseTime,
                    retryCount,
                });

                break;
            }

            const retryable = retryCount < maxRetries;

            // If retries are exhausted, log the final failure, then TASK_SKIP and exit the loop
            if (!retryable) {
                EventLogger.log({
                    eventType: SystemEvents.TASK_FAILURE,
                    taskId,
                    agentProfile: this.agent.profile.profileName,
                    responseTime,
                    retryable,
                    retryCount,
                    maxRetries,
                    attemptNumber: retryCount + 1,
                });

                EventLogger.log({
                    eventType: SystemEvents.TASK_SKIP,
                    taskId,
                    agentProfile: this.agent.profile.profileName,
                    reason: 'retry_exhausted',
                    retryCount,
                    maxRetries,
                });

                break;
            }

            // Log the failure before deciding whether another attempt is available
            EventLogger.log({
                eventType: SystemEvents.TASK_FAILURE,
                taskId,
                agentProfile: this.agent.profile.profileName,
                responseTime,
                retryable,
                retryCount,
                maxRetries,
                attemptNumber: retryCount + 1,
            });

            const nextProfileName = this.getRetryProfileName(taskOwnerProfile, retryCount);

            if (nextProfileName && AGENT_PROFILES[nextProfileName]) {
                activeProfileName = nextProfileName;
            } else {
                activeProfileName = taskOwnerProfile.profileName;
            }

            if (this.config.simulationType === SIMULATION_TYPES.OBS_LEARN) {
                this.applyObservationalLearning(taskOwnerProfile.profileName, nextProfileName);
            }

            retryCount += 1;
        }

        this.agent.profile = taskOwnerProfile;
    }

    getRetryProfileName(taskOwnerProfile, retryCount) {
        if (this.config.simulationType === SIMULATION_TYPES.SOLO) {
            return taskOwnerProfile.profileName;
        }

        const retryProfileNames = RETRY_PROFILE_ENSEMBLE[taskOwnerProfile.profileName];

        return chooseProfileName(
            retryProfileNames?.[retryCount] ?? [taskOwnerProfile.profileName],
            this.agent.rng
        );
    }

    createSessionProfiles() {
        return Object.fromEntries(
            Object.entries(AGENT_PROFILES).map(([profileName, profile]) => [profileName, cloneProfile(profile)])
        );
    }

    createProfileLearningState() {
        return Object.fromEntries(
            Object.keys(AGENT_PROFILES).map((profileName) => [profileName, {
                accuracyDelta: null,
                responseTimeMinDelta: null,
                responseTimeMaxDelta: null,
            }])
        );
    }

    getSessionProfile(profileName) {
        if (!profileName || !this.sessionProfiles[profileName]) {
            return this.sessionProfiles.moderate_accuracy ?? cloneProfile(AGENT_PROFILES.moderate_accuracy);
        }

        return this.sessionProfiles[profileName];
    }

    getEffectiveProfile(profileName, level) {
        const profile = this.getSessionProfile(profileName);

        if (!profile) {
            return cloneProfile(AGENT_PROFILES.moderate_accuracy);
        }

        const adjustedProfile = cloneProfile(profile);
        adjustedProfile.accuracy = Math.min(1, Math.max(0, Number(profile.accuracy) - getLevelAccuracyAdjustment(level)));

        return adjustedProfile;
    }

    getProfileOrderIndex(profileName) {
        return PROFILE_ORDER.indexOf(profileName);
    }

    getProfileDeltaState(profileName) {
        return this.profileLearningState[profileName] ?? null;
    }

    getNextHigherProfileName(profileName) {
        const index = this.getProfileOrderIndex(profileName);

        if (index < 0 || index >= PROFILE_ORDER.length - 1) {
            return null;
        }

        return PROFILE_ORDER[index + 1] ?? null;
    }

    updateLearningValue(currentValue, sourceValue, previousDelta) {
        const nextDelta = previousDelta === null ? (sourceValue - currentValue) / 4 : previousDelta / 4;
        return {
            value: currentValue + nextDelta,
            delta: nextDelta,
        };
    }

    applyProfileLearning(targetProfileName, sourceProfileName) {
        const targetProfile = this.getSessionProfile(targetProfileName);
        const sourceProfile = this.getSessionProfile(sourceProfileName);
        const state = this.getProfileDeltaState(targetProfileName);

        if (!targetProfile || !sourceProfile || !state) {
            return;
        }

        const accuracyUpdate = this.updateLearningValue(
            Number(targetProfile.accuracy) || 0,
            Number(sourceProfile.accuracy) || 0,
            state.accuracyDelta
        );

        const responseTimeMinUpdate = this.updateLearningValue(
            Number(targetProfile.responseTime?.[0]) || 0,
            Number(sourceProfile.responseTime?.[0]) || 0,
            state.responseTimeMinDelta
        );

        const responseTimeMaxUpdate = this.updateLearningValue(
            Number(targetProfile.responseTime?.[1]) || 0,
            Number(sourceProfile.responseTime?.[1]) || 0,
            state.responseTimeMaxDelta
        );

        targetProfile.accuracy = Math.min(1, Math.max(0, accuracyUpdate.value));
        const responseTimeMin = Math.max(0, responseTimeMinUpdate.value);
        const responseTimeMax = Math.max(responseTimeMin, responseTimeMaxUpdate.value);

        targetProfile.responseTime = [responseTimeMin, responseTimeMax];

        state.accuracyDelta = accuracyUpdate.delta;
        state.responseTimeMinDelta = responseTimeMinUpdate.delta;
        state.responseTimeMaxDelta = responseTimeMaxUpdate.delta;
    }

    applyObservationalLearning(ownerProfileName, helperProfileName) {
        if (this.config.simulationType !== SIMULATION_TYPES.OBS_LEARN) {
            return;
        }

        if (!ownerProfileName || !helperProfileName || ownerProfileName === helperProfileName) {
            return;
        }

        const ownerIndex = this.getProfileOrderIndex(ownerProfileName);
        const helperIndex = this.getProfileOrderIndex(helperProfileName);

        if (ownerIndex < 0 || helperIndex < 0 || helperIndex <= ownerIndex) {
            return;
        }

        for (let index = ownerIndex; index < helperIndex; index += 1) {
            const targetProfileName = PROFILE_ORDER[index];
            const sourceProfileName = PROFILE_ORDER[index + 1];

            if (!targetProfileName || !sourceProfileName) {
                continue;
            }

            this.applyProfileLearning(targetProfileName, sourceProfileName);
        }
    }

    hasSessionEnded() {
        const state = EventLogger.getGamificationState();
        return !sessionManager.getSessionId() || state.progressDelta >= 300;
    }
}
