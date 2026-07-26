export const AGENT_PROFILES = {
    high_accuracy: {
        profileName: 'high_accuracy',
        accuracy: 0.90,
        maxRetries: 2,
        responseTime: [700, 3000]
    },

    moderate_accuracy: {
        profileName: 'moderate_accuracy',
        accuracy: 0.7,
        maxRetries: 2,
        responseTime: [1200, 5000]
    },

    low_accuracy: {
        profileName: 'low_accuracy',
        accuracy: 0.50,
        maxRetries: 2,
        responseTime: [2000, 8000]
    },

    stress: {
        profileName: 'stress',
        accuracy: 0.65,
        maxRetries: 3,
        responseTime: [300, 600]
    }
};
