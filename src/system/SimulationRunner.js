import { EventLogger } from "./EventLogger";
import { SystemEvents } from "./SystemEvents";
import { sessionManager } from "./SessionManager";
import { SimulationAgent } from "./SimulationAgent";
import { AGENT_PROFILES } from "./AgentProfiles";

export class SimulationRunner {
    constructor(config = {}) {
        this.config = config;

        this.profile = AGENT_PROFILES[config.profile] ?? AGENT_PROFILES['moderate_accuracy'];

        this.baseSeed = config.seed ?? 1;
    }

    runBatch(sessionCount = 100, agentProfileName = 'moderate_accuracy') {
        EventLogger.enableSimulationMode();

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

        this.taskCounter = 0;

        // Start the session
        sessionManager.startSession();

        // Minimal simulation loop
        while (!this.hasSessionEnded()) {
            this.simulateTask();
        }

        return EventLogger.exportSessionAsJSON();
    }

    simulateTask() {
        const taskId = this.generateTaskId();

        const currentLevel = EventLogger.getGamificationState().level ?? 1;

        this.agent.setLevel(currentLevel);

        // TASK_START
        EventLogger.log({
            eventType: SystemEvents.TASK_START,
            taskId,
            agentProfile: this.agent.profile.profileName,
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

    generateTaskId() {
        this.taskCounter += 1;
        return `task_${this.taskCounter}`;
    }

    hasSessionEnded() {
        const state = EventLogger.getGamificationState();
        return !sessionManager.getSessionId() || state.progressDelta >= 300;
    }
}
