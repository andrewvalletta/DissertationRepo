import { sessionManager } from './SessionManager.js';
import { GamificationEngine } from './GamificationEngine.js';

class EventLoggerClass {
    constructor() {
        this.events = [];
        this.gamificationEngine = new GamificationEngine();
    };

    log(event) {
        const sessionId = sessionManager.getSessionId();

        if (!sessionId) {
            throw new Error('No active session. Cannot log event.');
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
    };

    getEvents() {
        return [...this.events];
    };

    clear() {
        this.events = [];
    };
}

export const EventLogger = new EventLoggerClass();
