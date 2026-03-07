export const LEVEL_CONFIG = {
    1: {
        pitch: {
            // Natural notes only, no sharps
            allowedNotes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
            // Number of notes to choose from when generating a question
            numNotesInPool: 4,
            // Number of answer choices to present to the user
            answerChoices: 3,
        },

        tempo: {
            // Allowed BPMs and Time Signatures for tempo questions
            allowedBpms: [60, 80, 100, 120, 140, 160],
            allowedTimeSignatures: ['2/4', '3/4', '4/4', '6/8'],

            // Number of BPM and Time Signature answer choices to present to the user / bmps and time signatures to choose from when generating a question
            bpmChoices: 2,
            timeSignatureChoices: 2,
        },
    },

    2: {
        pitch: {
            // Natural notes only, no sharps
            allowedNotes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
            // Number of notes to choose from when generating a question
            numNotesInPool: 6,
            // Number of answer choices to present to the user
            answerChoices: 5,
        },

        tempo: {
            // Allowed BPMs and Time Signatures for tempo questions
            allowedBpms: [60, 80, 100, 120, 140, 160],
            allowedTimeSignatures: ['2/4', '3/4', '4/4', '6/8'],

            // Number of BPM and Time Signature answer choices to present to the user / bmps and time signatures to choose from when generating a question
            bpmChoices: 3,
            timeSignatureChoices: 3,
        },
    },

    3: { // Full difficulty
        pitch: {
            // All notes including sharps
            allowedNotes: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
            // Number of notes to choose from when generating a question
            numNotesInPool: 12,
            // Number of answer choices to present to the user
            answerChoices: 12,
        },

        tempo: {
            // Allowed BPMs and Time Signatures for tempo questions
            allowedBpms: [60, 80, 100, 120, 140, 160],
            allowedTimeSignatures: ['2/4', '3/4', '4/4', '6/8'],

            // Number of BPM and Time Signature answer choices to present to the user / bmps and time signatures to choose from when generating a question
            bpmChoices: 6,
            timeSignatureChoices: 4,
        },
    },
};
