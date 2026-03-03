import { LEVEL_CONFIG } from "./LevelConfig";
import { pitchTaskId, tempoTaskId } from "./taskIds";

function pickRandom(array, rng) {
    const index = Math.floor(rng() * array.length);
    return array[index];
}

export class TaskFactory {
    static generate({ level = 1, rng, type = "pitch" }) {
        const numericLevel = Number(level);
        const config = LEVEL_CONFIG[numericLevel] || LEVEL_CONFIG[1];

        if (type === "pitch") {
            const allowedNotes = config.pitch.allowedNotes;
            const note = pickRandom(allowedNotes, rng);

            return {
                type: "pitch",
                taskId: pitchTaskId(note),
                note,
            };
        }

        if (type === "tempo") {
            const allowedBpms = config.tempo.allowedBpms;
            const allowedTimeSignatures = config.tempo.allowedTimeSignatures;

            const bpm = pickRandom(allowedBpms, rng);
            const timeSignature = pickRandom(allowedTimeSignatures, rng);

            return {
                type: "tempo",
                taskId: tempoTaskId(bpm, timeSignature),
                bpm,
                timeSignature,
            };
        }

        throw new Error(`Unknown task type: ${type}`);
    }
}
