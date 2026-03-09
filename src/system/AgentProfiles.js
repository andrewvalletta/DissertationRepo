export const AGENT_PROFILES = {
    high_accuracy: {
        profileName: 'high_accuracy',
        accuracy: 0.95,
        retryRate: 0.2,
        skipRate: 0.01,
        maxRetries: 1,
        responseTime: [700, 3000]
    },

    moderate_accuracy: {
        profileName: 'moderate_accuracy',
        accuracy: 0.7,
        retryRate: 0.5,
        skipRate: 0.05,
        maxRetries: 2,
        responseTime: [1200, 5000]
    },

    low_accuracy: {
        profileName: 'low_accuracy',
        accuracy: 0.45,
        retryRate: 0.8,
        skipRate: 0.1,
        maxRetries: 2,
        responseTime: [2000, 8000]
    },

    stress: {
        profileName: 'stress',
        accuracy: 0.65,
        retryRate: 0.9,
        skipRate: 0.0,
        maxRetries: 3,
        responseTime: [300, 600]
    }
};
