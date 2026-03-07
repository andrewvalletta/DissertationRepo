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
        };

        this.profile = AGENT_PROFILES[config.profile] ?? AGENT_PROFILES['moderate_accuracy'];

        this.baseSeed = this.config.seed ?? 1;

        this.currentLevel = null;
        this.currentPools = null;
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

        const task = TaskFactory.generate({
            rng: this.agent.rng,
            type: this.config.taskType,
            pools: this.currentPools,
        });

        const taskId = task.taskId;

        // TASK_START
        EventLogger.log({
            eventType: SystemEvents.TASK_START,
            taskId,
            agentProfile: this.agent.profile.profileName,
            level: currentLevel,
        });

        // TASK_SKIP
        if (this.agent.shouldSkip()) {
            EventLogger.log({
                eventType: SystemEvents.TASK_SKIP,
                taskId,
                agentProfile: this.agent.profile.profileName,
            });

            return;
        }

        let success = false;
        let shouldRetry = false;

        do {
            const responseTime = this.agent.getResponseTime();
            success = this.agent.attemptOutcome();

            // TASK_ATTEMPT
            EventLogger.log({
                eventType: SystemEvents.TASK_ATTEMPT,
                taskId,
                agentProfile: this.agent.profile.profileName,
                success,
                responseTime,
            });

            if (success) {
                EventLogger.log({
                    eventType: SystemEvents.TASK_SUCCESS,
                    taskId,
                    agentProfile: this.agent.profile.profileName,
                    responseTime,
                });

                break;
            }

            shouldRetry = this.agent.shouldRetry();

            EventLogger.log({
                eventType: SystemEvents.TASK_FAILURE,
                taskId,
                agentProfile: this.agent.profile.profileName,
                responseTime,
                retryable: true,
            });

            if (!shouldRetry) {
                EventLogger.log({
                    eventType: SystemEvents.TASK_SKIP,
                    taskId,
                    agentProfile: this.agent.profile.profileName,
                    reason: 'retry_exhausted',
                });
            }
        } while (!success && shouldRetry);
    }

    hasSessionEnded() {
        const state = EventLogger.getGamificationState();
        return !sessionManager.getSessionId() || state.progressDelta >= 300;
    }
}
