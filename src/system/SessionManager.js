import { EventLogger } from './EventLogger.js';
import { SystemEvents } from './SystemEvents.js';

class SessionManager {
    constructor() {
        this.sessionId = null;
        this.active = false;
    }

    startSession() {
        if (this.active) {
            return this.sessionId;
        };

        this.sessionId = crypto.randomUUID();
        this.active = true;

        EventLogger.log({
            eventType: SystemEvents.SESSION_START,
        });

        return this.sessionId;
    };

    endSession(logSessionEndEvent = true) {
        if (!this.active) {
            return;
        };

        if (logSessionEndEvent) {
            EventLogger.logSessionEnd();
        }

        this.active = false;
        this.sessionId = null;
    };

    getSessionId() {
        return this.sessionId;
    };
}

export const sessionManager = new SessionManager();
