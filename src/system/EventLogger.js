import { SystemEvents } from './SystemEvents.js';
import { sessionManager } from './SessionManager.js';
import { GamificationEngine } from './GamificationEngine.js';

class EventLoggerClass {
    constructor() {
        this.events = [];
        this.sessionEnded = false;
        this.hasExported = false;
        this.pendingAutoSessionEndSummary = null;
        this.gamificationEngine = new GamificationEngine({
            onSessionEnd: (summary) => {
                this.pendingAutoSessionEndSummary = summary;
            },
        });

        this.simulationMode = false;
        this.simulationDataset = [];
    };

    log(event) {
        const sessionId = sessionManager.getSessionId();

        if (!sessionId) {
            throw new Error('No active session. Cannot log event.');
        }

        if (this.sessionEnded && event.eventType !== SystemEvents.SESSION_START) {
            return;
        }

        if (event.eventType === SystemEvents.SESSION_START) {
            this.sessionEnded = false;
            this.hasExported = false;
        }

        // Pass the raw event to the gamification engine to update state and get any deltas
        const gamificationDeltas = this.gamificationEngine.handleEvent(event);

        // Enrich the event with session info, timestamp, and gamification deltas
        const enrichedEvent = {
            ...event,
            ...(gamificationDeltas ?? {}),
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
        };

        // TEMPORARY: Also log to console for immediate visibility
        console.log('Event Logged:', enrichedEvent);

        this.events.push(enrichedEvent);

        if (this.pendingAutoSessionEndSummary && !this.sessionEnded) {
            const summary = this.pendingAutoSessionEndSummary;
            this.pendingAutoSessionEndSummary = null;
            this.handleAutoSessionEnd(summary);
        }
    };

    getEvents() {
        return [...this.events];
    };

    getGamificationState() {
        return this.gamificationEngine.getState();
    };

    clear() {
        this.events = [];
        this.sessionEnded = false;
        this.hasExported = false;
        this.pendingAutoSessionEndSummary = null;
    };

    logSessionEnd(summaryOverride = null) {
        if (this.sessionEnded) {
            return;
        }

        const sessionId = sessionManager.getSessionId();

        if (!sessionId) {
            throw new Error('No active session. Cannot log session end.');
        }

        const summary = summaryOverride ?? this.gamificationEngine.getSessionSummary();

        const event = {
            eventType: SystemEvents.SESSION_END,
            ...summary,
            sessionId,
            timestamp: new Date().toISOString(),
        };

        console.log('Session End Event Logged:', event);
        this.events.push(event);
        this.sessionEnded = true;
    };

    exportSessionAsJSON() {
        const events = this.getEvents();
        return JSON.stringify(events, null, 2);
    };

    exportSessionAsFile() {
        if (this.hasExported) {
            return;
        }

        const blob = new Blob(
            [this.exportSessionAsJSON()],
            { type: 'application/json' }
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session_${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.hasExported = true;
    };

    handleAutoSessionEnd(summary) {
        if (this.sessionEnded) {
            return;
        }

        this.logSessionEnd(summary);
        sessionManager.endSession(false);

        if (this.simulationMode) {
            // Store session data for later export instead of immediately downloading
            this.simulationDataset.push(
                JSON.parse(
                    JSON.stringify(
                        this.getEvents()
                    )
                )
            );
        } else {
            this.exportSessionAsFile();
        }
    };

    enableSimulationMode() {
        this.simulationMode = true;
        this.simulationDataset = [];
    };

    exportSimulationDataset() {
        if (!this.simulationMode) {
            throw new Error('Simulation mode is not enabled. Cannot export dataset.');
        }

        const blob = new Blob(
            [JSON.stringify(this.simulationDataset, null, 2)],
            { type: 'application/json' }
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simulation_dataset_${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
}

export const EventLogger = new EventLoggerClass();
