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


const RETRY_PROFILE_ENSEMBLE = {
    low_accuracy: [
        ['low_accuracy', 'moderate_accuracy'],
        ['low_accuracy', 'moderate_accuracy', 'high_accuracy'],
    ],

    moderate_accuracy: [
        ['moderate_accuracy', 'high_accuracy'],
        ['moderate_accuracy', 'high_accuracy'],
    ],

    high_accuracy: [
        ['high_accuracy'],
        ['high_accuracy'],
    ],
};


const PROFILE_ORDER = [
    'low_accuracy',
    'moderate_accuracy',
    'high_accuracy',
];


const SIMULATION_TYPES = {
    SOLO: 'solo',
    SIMPLE_COLLAB: 'simple_collab',
    OBS_LEARN: 'obs_learn',
};


function normalizeSimulationType(value) {
    const normalized =
        String(
            value ?? SIMULATION_TYPES.SOLO
        )
            .trim()
            .toLowerCase();

    if (
        Object.values(SIMULATION_TYPES)
            .includes(normalized)
    ) {
        return normalized;
    }

    return SIMULATION_TYPES.SOLO;
}


function chooseProfileName(profileNames, rng) {
    if (
        !Array.isArray(profileNames) ||
        profileNames.length === 0
    ) {
        return null;
    }

    const selectedIndex =
        Math.floor(
            rng() * profileNames.length
        );

    return profileNames[selectedIndex] ?? null;
}


function cloneProfile(profile) {
    return {
        ...profile,

        responseTime:
            Array.isArray(profile?.responseTime)
                ? [...profile.responseTime]
                : [800, 1400],
    };
}


function getLevelAccuracyAdjustment(level) {
    const normalizedLevel =
        Math.max(
            1,
            Math.floor(Number(level) || 1)
        );

    return Math.max(
        0,
        normalizedLevel - 1
    ) * 0.1;
}


export class SimulationRunner {
    constructor(config = {}) {
        this.config = {
            taskType:
                config.taskType ?? 'pitch',

            simulationType:
                normalizeSimulationType(
                    config.simulationType
                ),

            seed:
                config.seed ?? 1,

            recentTaskBuffer:
                config.recentTaskBuffer ?? 5,
        };

        this.profile =
            AGENT_PROFILES[config.profile] ??
            AGENT_PROFILES['moderate_accuracy'];

        this.baseSeed =
            this.config.seed ?? 1;

        this.currentLevel = null;
        this.currentPools = null;
        this.recentTasks = [];
        this.sessionProfiles = {};
        this.profileLearningState = {};
    }


    getTaskSpaceSize() {
        if (this.config.taskType === 'pitch') {
            return (
                this.currentPools?.notes?.length ?? 0
            );
        }

        if (this.config.taskType === 'tempo') {
            const bpmCount =
                this.currentPools?.bpms?.length ?? 0;

            const signatureCount =
                this.currentPools
                    ?.timeSignatures
                    ?.length ?? 0;

            return bpmCount * signatureCount;
        }

        return 0;
    }


    getRecentTaskBufferSize() {
        return Math.max(
            0,
            Math.floor(
                this.config.recentTaskBuffer
            )
        );
    }


    getNextTask() {
        const taskSpaceSize =
            this.getTaskSpaceSize();

        const rawBufferSize =
            this.getRecentTaskBufferSize();

        const effectiveBufferSize =
            Math.min(
                rawBufferSize,
                Math.max(
                    0,
                    taskSpaceSize - 1
                )
            );

        if (effectiveBufferSize === 0) {
            return TaskFactory.generate({
                rng: this.agent.rng,
                type: this.config.taskType,
                pools: this.currentPools,
            });
        }

        const recentSet =
            new Set(
                this.recentTasks.slice(
                    -effectiveBufferSize
                )
            );

        let fallbackTask = null;

        for (let i = 0; i < 25; i++) {
            const candidate =
                TaskFactory.generate({
                    rng: this.agent.rng,
                    type: this.config.taskType,
                    pools: this.currentPools,
                });

            fallbackTask = candidate;

            if (
                !recentSet.has(
                    candidate.taskId
                )
            ) {
                return candidate;
            }
        }

        return fallbackTask;
    }


    rememberTask(taskId) {
        this.recentTasks.push(taskId);

        const maxRetained =
            Math.max(
                1,
                this.getRecentTaskBufferSize()
            );

        if (
            this.recentTasks.length >
            maxRetained
        ) {
            this.recentTasks =
                this.recentTasks.slice(
                    -maxRetained
                );
        }
    }


    createPools(level) {
        const config =
            LEVEL_CONFIG[level] ??
            LEVEL_CONFIG[1];

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
            ),
        };
    }


    /*
     * ---------------------------------------------------------------
     * RUN BATCH
     * ---------------------------------------------------------------
     *
     * This is now asynchronous so that:
     *
     * 1. each completed session can be written to the download stream;
     * 2. the session can then be discarded;
     * 3. the browser gets periodic opportunities to process the
     *    download and UI.
     */
    async runBatch(
        sessionCount = 100,
        agentProfileName = 'moderate_accuracy',
        taskType = 'pitch',
        simulationType = SIMULATION_TYPES.SOLO
    ) {
        if (
            !Number.isFinite(sessionCount) ||
            sessionCount <= 0
        ) {
            throw new Error(
                'sessionCount must be a positive number.'
            );
        }

        sessionCount =
            Math.floor(sessionCount);

        EventLogger.enableSimulationMode();

        this.config.taskType =
            taskType;

        this.config.simulationType =
            normalizeSimulationType(
                simulationType
            );

        /*
         * Start the JSON download BEFORE the simulation starts.
         *
         * This is crucial because we can then stream each session
         * directly to the file as soon as it finishes.
         */
        await EventLogger.startSimulationExport();

        console.log(
            `Starting ${sessionCount.toLocaleString()} simulations...`
        );

        const batchStart =
            performance.now();

        try {
            for (
                let i = 0;
                i < sessionCount;
                i++
            ) {
                /*
                 * Only log every 100 sessions.
                 *
                 * console.log() 100,000 times can itself become a
                 * significant performance problem in browser devtools.
                 */
                if (
                    i === 0 ||
                    (i + 1) % 100 === 0 ||
                    i === sessionCount - 1
                ) {
                    console.log(
                        `Running session ${(i + 1).toLocaleString()
                        } of ${sessionCount.toLocaleString()
                        }`
                    );
                }

                /*
                 * Run exactly one session.
                 */
                const sessionEvents =
                    this.runSingleSession(
                        i,
                        agentProfileName
                    );

                /*
                 * Immediately write this session to disk.
                 *
                 * Once this promise resolves, the writer has accepted
                 * the data and we no longer need to retain the session.
                 */
                await EventLogger.writeSimulationSession(
                    sessionEvents
                );

                /*
                 * Periodically yield to the browser.
                 *
                 * This is especially useful for Firefox, because
                 * 100,000 synchronous iterations can otherwise keep
                 * the browser's main thread occupied for a long time.
                 */
                if (
                    (i + 1) % 25 === 0
                ) {
                    await new Promise(
                        resolve =>
                            setTimeout(resolve, 0)
                    );
                }
            }

            await EventLogger.finishSimulationExport();

            const elapsedSeconds =
                (
                    performance.now() -
                    batchStart
                ) / 1000;

            const stats =
                EventLogger.getSimulationStats();

            console.log(
                'Simulation complete.'
            );

            console.log(
                `Sessions: ${stats.sessions.toLocaleString()}`
            );

            console.log(
                `Events: ${stats.events.toLocaleString()}`
            );

            console.log(
                `Time: ${elapsedSeconds.toFixed(2)} seconds`
            );

            return stats;
        } catch (error) {
            console.error(
                'Simulation batch failed:',
                error
            );

            await EventLogger.abortSimulationExport(
                error
            );

            throw error;
        } finally {
            EventLogger.disableSimulationMode();
        }
    }


    /*
     * ---------------------------------------------------------------
     * RUN SINGLE SESSION
     * ---------------------------------------------------------------
     */
    runSingleSession(
        sessionIndex = 0,
        agentProfileName = 'moderate_accuracy'
    ) {
        /*
         * Force end of any existing session.
         */
        if (sessionManager.getSessionId()) {
            sessionManager.endSession(false);
        }

        /*
         * Ensure clean state.
         */
        EventLogger.clear();

        /*
         * Create a new agent with the specified profile and seed.
         */
        const sessionSeed =
            this.baseSeed +
            sessionIndex;

        this.initialProfileName =
            agentProfileName;

        this.sessionProfiles =
            this.createSessionProfiles();

        this.profileLearningState =
            this.createProfileLearningState();

        this.profile =
            this.getSessionProfile(
                agentProfileName
            );

        this.agent =
            new SimulationAgent(
                this.profile,
                sessionSeed
            );

        this.agent.profile =
            this.profile;

        this.recentTasks = [];

        /*
         * Start session.
         */
        sessionManager.startSession();

        /*
         * Minimal simulation loop.
         */
        while (!this.hasSessionEnded()) {
            this.simulateTask();
        }

        /*
         * IMPORTANT:
         *
         * Return the completed session to runBatch().
         *
         * runBatch() immediately writes this to the streaming file
         * and then moves on to the next session.
         */
        return EventLogger.getEvents();
    }


    simulateTask() {
        const taskOwnerProfile =
            this.agent.profile;

        const currentLevel =
            EventLogger
                .getGamificationState()
                .level ?? 1;

        this.agent.setLevel(
            currentLevel
        );

        this.agent.profile =
            this.getEffectiveProfile(
                taskOwnerProfile.profileName,
                currentLevel
            );

        /*
         * Create task pools based on current level.
         */
        if (
            this.currentLevel !==
            currentLevel
        ) {
            this.currentLevel =
                currentLevel;

            this.currentPools =
                this.createPools(
                    currentLevel
                );
        }

        const task =
            this.getNextTask();

        const taskId =
            task.taskId;

        this.rememberTask(taskId);

        /*
         * TASK_START
         */
        EventLogger.log({
            eventType:
                SystemEvents.TASK_START,

            taskId,

            agentProfile:
                taskOwnerProfile.profileName,

            level:
                currentLevel,
        });

        /*
         * retryCount is the number of retries that have ALREADY
         * been performed.
         *
         * 0 = original attempt only
         * 1 = first retry has completed
         * 2 = second retry has completed
         */
        let retryCount = 0;

        const maxRetries =
            this.agent.getMaxRetries();

        let activeProfileName =
            taskOwnerProfile.profileName;

        /*
         * The first pass through the loop is always the original
         * attempt. Subsequent passes are retries.
         */
        let isRetry = false;

        while (true) {
            /*
             * -----------------------------------------------------------
             * BEFORE STARTING A RETRY
             * -----------------------------------------------------------
             *
             * This check happens BEFORE the retry starts.
             *
             * If retryCount === maxRetries, all permitted retries
             * have already happened and another retry cannot start.
             *
             * The original attempt is not subject to this check.
             */
            if (
                isRetry &&
                retryCount >= maxRetries
            ) {
                EventLogger.log({
                    eventType:
                        SystemEvents.TASK_SKIP,

                    taskId,

                    agentProfile:
                        this.agent.profile.profileName,

                    reason:
                        'retry_exhausted',

                    retryCount,

                    maxRetries,
                });

                break;
            }

            /*
             * -----------------------------------------------------------
             * PREPARE CURRENT AGENT
             * -----------------------------------------------------------
             */
            this.agent.profile =
                this.getEffectiveProfile(
                    activeProfileName,
                    currentLevel
                );

            const responseTime =
                this.agent.getResponseTime();

            /*
             * -----------------------------------------------------------
             * PERFORM THE ATTEMPT
             * -----------------------------------------------------------
             */
            const success =
                this.agent.attemptOutcome();

            /*
             * For the original attempt:
             *
             *     retryCount = 0
             *
             * For a retry:
             *
             *     currentRetryCount = retryCount + 1
             *
             * This is deliberately NOT assigned back to retryCount
             * until after the retry outcome has been registered.
             */
            const currentRetryCount =
                isRetry
                    ? retryCount + 1
                    : 0;

            /*
             * -----------------------------------------------------------
             * REGISTER THE ATTEMPT / RETRY
             * -----------------------------------------------------------
             *
             * The first attempt is TASK_ATTEMPT.
             *
             * Every subsequent attempt is TASK_RETRY.
             */
            EventLogger.log({
                eventType:
                    isRetry
                        ? SystemEvents.TASK_RETRY
                        : SystemEvents.TASK_ATTEMPT,

                taskId,

                agentProfile:
                    this.agent.profile.profileName,

                success,

                responseTime,

                retryCount:
                    currentRetryCount,
            });

            /*
             * -----------------------------------------------------------
             * RETRY HAS NOW HAPPENED
             * -----------------------------------------------------------
             *
             * Only NOW do we update retryCount.
             *
             * Therefore retryCount always represents retries that have
             * actually occurred, never a retry that is merely planned.
             */
            if (isRetry) {
                retryCount =
                    currentRetryCount;
            }

            /*
             * -----------------------------------------------------------
             * SUCCESS
             * -----------------------------------------------------------
             */
            if (success) {
                EventLogger.log({
                    eventType:
                        SystemEvents.TASK_SUCCESS,

                    taskId,

                    agentProfile:
                        this.agent.profile.profileName,

                    responseTime,

                    retryCount:
                        currentRetryCount,
                });

                break;
            }

            /*
             * -----------------------------------------------------------
             * FAILED ATTEMPT
             * -----------------------------------------------------------
             *
             * At this point retryCount accurately represents the number
             * of retries that have actually happened.
             */
            const retryable =
                retryCount <
                maxRetries;

            EventLogger.log({
                eventType:
                    SystemEvents.TASK_FAILURE,

                taskId,

                agentProfile:
                    this.agent.profile.profileName,

                responseTime,

                retryable,

                retryCount,

                maxRetries,

                attemptNumber:
                    retryCount + 1,
            });

            /*
             * -----------------------------------------------------------
             * RETRIES EXHAUSTED
             * -----------------------------------------------------------
             *
             * For example:
             *
             * retryCount = 2
             * maxRetries = 2
             *
             * Therefore:
             *
             * 2 < 2 === false
             *
             * No further retry can begin.
             */
            if (!retryable) {
                EventLogger.log({
                    eventType:
                        SystemEvents.TASK_SKIP,

                    taskId,

                    agentProfile:
                        this.agent.profile.profileName,

                    reason:
                        'retry_exhausted',

                    retryCount,

                    maxRetries,
                });

                break;
            }

            /*
             * -----------------------------------------------------------
             * PREPARE NEXT RETRY
             * -----------------------------------------------------------
             *
             * IMPORTANT:
             *
             * retryCount is NOT incremented here.
             *
             * It currently represents the number of retries that have
             * actually happened.
             *
             * The next retry will use:
             *
             *     retryCount + 1
             *
             * as its event retry number.
             */
            const nextProfileName =
                this.getRetryProfileName(
                    taskOwnerProfile,
                    retryCount
                );

            if (
                nextProfileName &&
                AGENT_PROFILES[
                nextProfileName
                ]
            ) {
                activeProfileName =
                    nextProfileName;
            } else {
                activeProfileName =
                    taskOwnerProfile.profileName;
            }

            /*
             * Learning algorithm deliberately unchanged.
             */
            if (
                this.config.simulationType ===
                SIMULATION_TYPES.OBS_LEARN
            ) {
                this.applyObservationalLearning(
                    taskOwnerProfile.profileName,
                    nextProfileName
                );
            }

            /*
             * The next loop iteration is now a retry.
             *
             * The retryCount itself remains unchanged until that retry
             * has actually been performed and its outcome registered.
             */
            isRetry = true;
        }

        this.agent.profile =
            taskOwnerProfile;
    }


    getRetryProfileName(
        taskOwnerProfile,
        retryCount
    ) {
        if (
            this.config.simulationType ===
            SIMULATION_TYPES.SOLO
        ) {
            return taskOwnerProfile.profileName;
        }

        const retryProfileNames =
            RETRY_PROFILE_ENSEMBLE[
            taskOwnerProfile.profileName
            ];

        return chooseProfileName(
            retryProfileNames?.[
            retryCount
            ] ??
            [
                taskOwnerProfile.profileName
            ],
            this.agent.rng
        );
    }


    createSessionProfiles() {
        return Object.fromEntries(
            Object.entries(
                AGENT_PROFILES
            ).map(
                ([
                    profileName,
                    profile
                ]) => [
                        profileName,
                        cloneProfile(profile)
                    ]
            )
        );
    }


    createProfileLearningState() {
        return Object.fromEntries(
            Object.keys(
                AGENT_PROFILES
            ).map(
                profileName => [
                    profileName,
                    {
                        accuracyDelta: null,
                        responseTimeMinDelta: null,
                        responseTimeMaxDelta: null,
                    },
                ]
            )
        );
    }


    getSessionProfile(profileName) {
        if (
            !profileName ||
            !this.sessionProfiles[
            profileName
            ]
        ) {
            return (
                this.sessionProfiles
                    .moderate_accuracy ??
                cloneProfile(
                    AGENT_PROFILES
                        .moderate_accuracy
                )
            );
        }

        return this.sessionProfiles[
            profileName
        ];
    }


    getEffectiveProfile(
        profileName,
        level
    ) {
        const profile =
            this.getSessionProfile(
                profileName
            );

        if (!profile) {
            return cloneProfile(
                AGENT_PROFILES
                    .moderate_accuracy
            );
        }

        const adjustedProfile =
            cloneProfile(profile);

        adjustedProfile.accuracy =
            Math.min(
                1,
                Math.max(
                    0,
                    Number(
                        profile.accuracy
                    ) -
                    getLevelAccuracyAdjustment(
                        level
                    )
                )
            );

        return adjustedProfile;
    }


    getProfileOrderIndex(profileName) {
        return PROFILE_ORDER.indexOf(
            profileName
        );
    }


    getProfileDeltaState(profileName) {
        return (
            this.profileLearningState[
            profileName
            ] ?? null
        );
    }


    getNextHigherProfileName(
        profileName
    ) {
        const index =
            this.getProfileOrderIndex(
                profileName
            );

        if (
            index < 0 ||
            index >=
            PROFILE_ORDER.length - 1
        ) {
            return null;
        }

        return (
            PROFILE_ORDER[
            index + 1
            ] ?? null
        );
    }


    /*
     * ---------------------------------------------------------------
     * LEARNING
     * ---------------------------------------------------------------
     *
     * UNCHANGED.
     *
     * The learning algorithm intentionally uses:
     *
     * First instance:
     *     (sourceValue - currentValue) / 2
     *
     * Subsequent instances:
     *     previousDelta / 2
     */
    updateLearningValue(
        currentValue,
        sourceValue,
        previousDelta
    ) {
        const nextDelta =
            previousDelta === null
                ? (sourceValue - currentValue) / 2
                : previousDelta / 2;

        return {
            value:
                currentValue +
                nextDelta,

            delta:
                nextDelta,
        };
    }


    applyProfileLearning(
        targetProfileName,
        sourceProfileName
    ) {
        const targetProfile =
            this.getSessionProfile(
                targetProfileName
            );

        const sourceProfile =
            this.getSessionProfile(
                sourceProfileName
            );

        const state =
            this.getProfileDeltaState(
                targetProfileName
            );

        if (
            !targetProfile ||
            !sourceProfile ||
            !state
        ) {
            return;
        }

        const accuracyUpdate =
            this.updateLearningValue(
                Number(
                    targetProfile.accuracy
                ) || 0,

                Number(
                    sourceProfile.accuracy
                ) || 0,

                state.accuracyDelta
            );

        const responseTimeMinUpdate =
            this.updateLearningValue(
                Number(
                    targetProfile
                        .responseTime?.[0]
                ) || 0,

                Number(
                    sourceProfile
                        .responseTime?.[0]
                ) || 0,

                state.responseTimeMinDelta
            );

        const responseTimeMaxUpdate =
            this.updateLearningValue(
                Number(
                    targetProfile
                        .responseTime?.[1]
                ) || 0,

                Number(
                    sourceProfile
                        .responseTime?.[1]
                ) || 0,

                state.responseTimeMaxDelta
            );

        targetProfile.accuracy =
            Math.min(
                1,
                Math.max(
                    0,
                    accuracyUpdate.value
                )
            );

        const responseTimeMin =
            Math.max(
                0,
                responseTimeMinUpdate.value
            );

        const responseTimeMax =
            Math.max(
                responseTimeMin,
                responseTimeMaxUpdate.value
            );

        targetProfile.responseTime = [
            responseTimeMin,
            responseTimeMax,
        ];

        state.accuracyDelta =
            accuracyUpdate.delta;

        state.responseTimeMinDelta =
            responseTimeMinUpdate.delta;

        state.responseTimeMaxDelta =
            responseTimeMaxUpdate.delta;
    }


    applyObservationalLearning(
        ownerProfileName,
        helperProfileName
    ) {
        if (
            this.config.simulationType !==
            SIMULATION_TYPES.OBS_LEARN
        ) {
            return;
        }

        if (
            !ownerProfileName ||
            !helperProfileName ||
            ownerProfileName ===
            helperProfileName
        ) {
            return;
        }

        const ownerIndex =
            this.getProfileOrderIndex(
                ownerProfileName
            );

        const helperIndex =
            this.getProfileOrderIndex(
                helperProfileName
            );

        if (
            ownerIndex < 0 ||
            helperIndex < 0 ||
            helperIndex <= ownerIndex
        ) {
            return;
        }

        for (
            let index = ownerIndex;
            index < helperIndex;
            index += 1
        ) {
            const targetProfileName =
                PROFILE_ORDER[index];

            const sourceProfileName =
                PROFILE_ORDER[index + 1];

            if (
                !targetProfileName ||
                !sourceProfileName
            ) {
                continue;
            }

            this.applyProfileLearning(
                targetProfileName,
                sourceProfileName
            );
        }
    }


    hasSessionEnded() {
        const state =
            EventLogger.getGamificationState();

        return (
            !sessionManager.getSessionId() ||
            state.progressDelta >= 300
        );
    }
}
