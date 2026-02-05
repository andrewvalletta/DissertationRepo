import { sessionManager } from './SessionManager.js';

class EventLoggerClass {
    constructor() {
        this.events = [];
    };

    log(event) {
        const sessionId = sessionManager.getSessionId();

        if (!sessionId) {
            throw new Error('No active session. Cannot log event.');
        }

        const enrichedEvent = {
            ...event,
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
        };

        // TEMPORARY: Also log to console for immediate visibility
        console.log('Event Logged:', enrichedEvent);

        this.events.push(enrichedEvent);
    };

    getEvents() {
        return [...this.events];
    };

    clear() {
        this.events = [];
    };
}

export const EventLogger = new EventLoggerClass();
