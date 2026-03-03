import { EventLogger } from "./EventLogger";
import { SystemEvents } from "./SystemEvents";
import { sessionManager } from "./SessionManager";
import { SimulationAgent } from "./SimulationAgent";
import { AGENT_PROFILES } from "./AgentProfiles";
import { TaskFactory } from "./TaskFactory";

export class SimulationRunner {
    constructor(config = {}) {
        this.config = {
            taskType: config.taskType ?? 'pitch', // 'pitch' or 'tempo'
            seed: config.seed ?? 1,
        };

        this.profile = AGENT_PROFILES[config.profile] ?? AGENT_PROFILES['moderate_accuracy'];

        this.baseSeed = this.config.seed ?? 1;
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

        const task = TaskFactory.generate({
            level: currentLevel,
            rng: this.agent.rng,
            type: this.config.taskType,
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
