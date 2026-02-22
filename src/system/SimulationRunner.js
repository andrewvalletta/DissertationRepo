import { EventLogger } from "./EventLogger";
import { SystemEvents } from "./SystemEvents";
import { sessionManager } from "./SessionManager";

export class SimulationRunner {
    constructor(config = {}) {
        this.config = config;
    }

    runBatch(sessionCount = 100) {
        EventLogger.enableSimulationMode();

        for (let i = 0; i < sessionCount; i++) {
            console.log(`Running session ${i + 1} of ${sessionCount}`);
            this.runSingleSession();
        }

        console.log("Dataset length: ", EventLogger.simulationDataset.length);

        EventLogger.exportSimulationDataset();
    }

    runSingleSession() {
        // Force end of any existing session to avoid conflicts
        if (sessionManager.getSessionId()) {
            sessionManager.endSession(false);
        }

        // Ensure clean state
        EventLogger.clear();

        // Start the session
        sessionManager.startSession();

        // Minimal simulation loop
        while (!this.hasSessionEnded()) {
            this.simulateTask();
        }

        return EventLogger.exportSessionAsJSON();
    }

    simulateTask() {
        const taskId = crypto.randomUUID();

        // TASK_START
        EventLogger.log({
            eventType: SystemEvents.TASK_START,
            taskId,
        });

        // (TEMPORARY) Always successful task
        EventLogger.log({
            eventType: SystemEvents.TASK_SUCCESS,
            taskId,
        });
    }

    hasSessionEnded() {
        const state = EventLogger.getGamificationState();
        return state.progressDelta >= 300;
    }
}
