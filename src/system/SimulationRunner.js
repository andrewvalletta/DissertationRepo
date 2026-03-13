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

export class SimulationRunner {
    constructor(config = {}) {
        this.config = {
            taskType: config.taskType ?? 'pitch', // 'pitch' or 'tempo'
            seed: config.seed ?? 1,
            recentTaskBuffer: config.recentTaskBuffer ?? 5,
        };

        this.profile = AGENT_PROFILES[config.profile] ?? AGENT_PROFILES['moderate_accuracy'];

        this.baseSeed = this.config.seed ?? 1;

        this.currentLevel = null;
        this.currentPools = null;
        this.recentTasks = [];
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

    runBatch(sessionCount = 100, agentProfileName = 'moderate_accuracy', taskType = 'pitch') {
        EventLogger.enableSimulationMode();

        this.config.taskType = taskType;

        for (let i = 0; i < sessionCount; i++) {
            console.log(`Running session ${i + 1} of ${sessionCount}`);
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
        this.profile = AGENT_PROFILES[agentProfileName] ?? AGENT_PROFILES['moderate_accuracy'];
        this.agent = new SimulationAgent(this.profile, sessionSeed);
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
        const currentLevel = EventLogger.getGamificationState().level ?? 1;

        this.agent.setLevel(currentLevel);

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
            agentProfile: this.agent.profile.profileName,
            level: currentLevel,
        });

        let success = false;
        let retryCount = 0;
        const maxRetries = this.agent.getMaxRetries();

        while (true) {
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

            // If retries are exhausted, log a TASK_SKIP and exit the loop
            if (!retryable) {
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

            // Log the failure before deciding to retry
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

            const shouldRetry = this.agent.shouldRetry(retryCount);

            if (!shouldRetry) {
                EventLogger.log({
                    eventType: SystemEvents.TASK_SKIP,
                    taskId,
                    agentProfile: this.agent.profile.profileName,
                    reason: 'retry_declined',
                    retryCount,
                    maxRetries,
                });

                break;
            }

            retryCount += 1;
        }
    }

    hasSessionEnded() {
        const state = EventLogger.getGamificationState();
        return !sessionManager.getSessionId() || state.progressDelta >= 300;
    }
}
