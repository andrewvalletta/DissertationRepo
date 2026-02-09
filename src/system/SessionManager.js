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

    endSession() {
        if (!this.active) {
            return;
        };

        EventLogger.logSessionEnd();

        this.active = false;
        this.sessionId = null;
    };

    getSessionId() {
        return this.sessionId;
    };
}

export const sessionManager = new SessionManager();
