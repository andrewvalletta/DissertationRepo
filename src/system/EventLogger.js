import { SystemEvents } from './SystemEvents.js';
import { sessionManager } from './SessionManager.js';
import { GamificationEngine } from './GamificationEngine.js';
import streamSaver from 'streamsaver';

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

        // Normal simulation/session state
        this.simulationMode = false;
        this.simulationClockMs = null;

        /*
         * IMPORTANT:
         *
         * We no longer store the complete simulation dataset here.
         *
         * The previous implementation did:
         *
         *     simulationDataset.push(...)
         *
         * for every session.
         *
         * With 100,000 simulations that can consume enormous amounts
         * of browser memory.
         *
         * Instead, sessions are streamed directly to disk.
         */
        this.simulationSessionCount = 0;
        this.simulationEventCount = 0;

        // Streaming download state
        this.simulationStream = null;
        this.simulationWriter = null;
        this.simulationStreamStarted = false;
        this.simulationStreamClosed = false;
    }

    getResponseTimeMs(event) {
        const responseTime = Number(event?.responseTime);
        const responseTimeMs = Number(event?.responseTimeMs);

        if (Number.isFinite(responseTime) && responseTime >= 0) {
            return responseTime;
        }

        if (Number.isFinite(responseTimeMs) && responseTimeMs >= 0) {
            return responseTimeMs;
        }

        return null;
    }

    getNextTimestamp(event = null) {
        if (!this.simulationMode) {
            return new Date().toISOString();
        }

        if (
            event?.eventType === SystemEvents.SESSION_START ||
            this.simulationClockMs === null
        ) {
            this.simulationClockMs = Date.now();

            return new Date(this.simulationClockMs).toISOString();
        }

        if (
            event?.eventType === SystemEvents.TASK_ATTEMPT ||
            event?.eventType === SystemEvents.TASK_RETRY
        ) {
            const responseTimeMs = this.getResponseTimeMs(event);

            if (responseTimeMs !== null) {
                this.simulationClockMs += responseTimeMs;
            }
        }

        return new Date(this.simulationClockMs).toISOString();
    }

    log(event) {
        const sessionId = sessionManager.getSessionId();

        if (!sessionId) {
            throw new Error('No active session. Cannot log event.');
        }

        if (
            this.sessionEnded &&
            event.eventType !== SystemEvents.SESSION_START
        ) {
            return;
        }

        if (event.eventType === SystemEvents.SESSION_START) {
            this.sessionEnded = false;
            this.hasExported = false;
        }

        // Pass the raw event to the gamification engine.
        const gamificationDeltas =
            this.gamificationEngine.handleEvent(event);

        // Enrich event.
        const enrichedEvent = {
            ...event,
            ...(gamificationDeltas ?? {}),
            sessionId,
            timestamp: this.getNextTimestamp(event),
        };

        this.events.push(enrichedEvent);

        if (
            this.pendingAutoSessionEndSummary &&
            !this.sessionEnded
        ) {
            const summary = this.pendingAutoSessionEndSummary;

            this.pendingAutoSessionEndSummary = null;

            this.handleAutoSessionEnd(summary);
        }
    }

    getEvents() {
        return [...this.events];
    }

    getGamificationState() {
        return this.gamificationEngine.getState();
    }

    clear() {
        this.events = [];
        this.sessionEnded = false;
        this.hasExported = false;
        this.pendingAutoSessionEndSummary = null;
        this.simulationClockMs = null;
    }

    logSessionEnd(summaryOverride = null) {
        if (this.sessionEnded) {
            return;
        }

        const sessionId = sessionManager.getSessionId();

        if (!sessionId) {
            throw new Error(
                'No active session. Cannot log session end.'
            );
        }

        const summary =
            summaryOverride ??
            this.gamificationEngine.getSessionSummary();

        const event = {
            eventType: SystemEvents.SESSION_END,
            ...summary,
            sessionId,
            timestamp: this.getNextTimestamp({
                eventType: SystemEvents.SESSION_END,
            }),
        };

        this.events.push(event);

        this.sessionEnded = true;
    }

    exportSessionAsJSON() {
        const events = this.getEvents();

        return JSON.stringify(events, null, 2);
    }

    exportSessionAsFile() {
        if (this.hasExported) {
            return;
        }

        const blob = new Blob(
            [this.exportSessionAsJSON()],
            {
                type: 'application/json;charset=utf-8',
            }
        );

        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');

        a.href = url;
        a.download =
            `session_${new Date().toISOString()}.json`;

        document.body.appendChild(a);
        a.click();
        a.remove();

        /*
         * Don't revoke the URL immediately.
         *
         * Some browsers can cancel the download if the object URL
         * is revoked before the download has started.
         */
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

        this.hasExported = true;
    }

    /*
     * ------------------------------------------------------------------
     * SIMULATION STREAMING
     * ------------------------------------------------------------------
     */

    async startSimulationExport(filename = null) {
        if (!this.simulationMode) {
            throw new Error(
                'Simulation mode must be enabled before starting export.'
            );
        }

        if (this.simulationStreamStarted) {
            return;
        }

        const finalFilename =
            filename ??
            `simulation_dataset_${new Date()
                .toISOString()
            }.json`;

        /*
         * StreamSaver writes directly to the browser's download stream
         * instead of first creating one enormous Blob.
         */
        this.simulationStream =
            streamSaver.createWriteStream(
                finalFilename,
                {
                    /*
                     * We deliberately do not specify the final size.
                     *
                     * The total file size is not known before the
                     * simulation has completed.
                     */
                    size: undefined,
                }
            );

        this.simulationWriter =
            this.simulationStream.getWriter();

        this.simulationStreamStarted = true;
        this.simulationStreamClosed = false;

        /*
         * Start a valid JSON array.
         */
        await this.writeSimulationText('[\n');
    }

    async writeSimulationText(text) {
        if (!this.simulationWriter) {
            throw new Error(
                'Simulation export stream has not been started.'
            );
        }

        const bytes =
            new TextEncoder().encode(text);

        await this.simulationWriter.write(bytes);
    }

    async writeSimulationSession(sessionEvents) {
        if (!this.simulationMode) {
            throw new Error(
                'Simulation mode is not enabled.'
            );
        }

        if (!this.simulationStreamStarted) {
            throw new Error(
                'Simulation export stream has not been started.'
            );
        }

        if (this.simulationStreamClosed) {
            throw new Error(
                'Simulation export stream has already been closed.'
            );
        }

        /*
         * This is the only JSON.stringify operation performed for
         * this session.
         *
         * It creates a string for ONE session, rather than the entire
         * 100,000-session dataset.
         *
         * null, 2 keeps the output human-readable/prettified.
         */
        const sessionJSON =
            JSON.stringify(sessionEvents, null, 2);

        /*
         * Add a comma before every session except the first.
         */
        if (this.simulationSessionCount > 0) {
            await this.writeSimulationText(',\n');
        }

        await this.writeSimulationText(sessionJSON);

        this.simulationSessionCount += 1;
        this.simulationEventCount += sessionEvents.length;
    }

    async finishSimulationExport() {
        if (!this.simulationStreamStarted) {
            return;
        }

        if (this.simulationStreamClosed) {
            return;
        }

        /*
         * Close the JSON array.
         */
        await this.writeSimulationText('\n]\n');

        await this.simulationWriter.close();

        this.simulationStreamClosed = true;

        console.log(
            `Simulation export complete: ` +
            `${this.simulationSessionCount.toLocaleString()} sessions, ` +
            `${this.simulationEventCount.toLocaleString()} events`
        );
    }

    async abortSimulationExport(reason = null) {
        if (!this.simulationWriter) {
            return;
        }

        if (this.simulationStreamClosed) {
            return;
        }

        try {
            await this.simulationWriter.abort(
                reason ??
                new Error('Simulation export aborted.')
            );
        } catch (error) {
            console.error(
                'Failed to abort simulation export:',
                error
            );
        } finally {
            this.simulationStreamClosed = true;
        }
    }

    handleAutoSessionEnd(summary) {
        if (this.sessionEnded) {
            return;
        }

        /*
         * IMPORTANT:
         *
         * This method is called from log(), so it cannot await the
         * asynchronous stream write.
         *
         * Therefore the simulation runner uses a separate mechanism:
         * it retrieves the completed events after runSingleSession()
         * and writes them to the stream.
         *
         * We only finish the session here.
         */
        this.logSessionEnd(summary);

        sessionManager.endSession(false);

        if (!this.simulationMode) {
            this.exportSessionAsFile();
        }
    }

    enableSimulationMode() {
        this.simulationMode = true;

        this.simulationClockMs = null;

        this.simulationSessionCount = 0;
        this.simulationEventCount = 0;

        this.simulationStream = null;
        this.simulationWriter = null;
        this.simulationStreamStarted = false;
        this.simulationStreamClosed = false;
    }

    disableSimulationMode() {
        this.simulationMode = false;

        this.simulationClockMs = null;

        this.simulationStream = null;
        this.simulationWriter = null;
        this.simulationStreamStarted = false;
        this.simulationStreamClosed = false;
    }

    getSimulationStats() {
        return {
            sessions: this.simulationSessionCount,
            events: this.simulationEventCount,
        };
    }
}

export const EventLogger = new EventLoggerClass();
