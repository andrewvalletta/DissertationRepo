import { pitchTaskId, tempoTaskId } from "./taskIds";

function pickRandom(array, rng) {
    const index = Math.floor(rng() * array.length);
    return array[index];
}

export class TaskFactory {
    static generate({ rng, type = "pitch", pools }) {
        if (type === "pitch") {
            const note = pickRandom(pools.notes, rng);

            return {
                type: "pitch",
                taskId: pitchTaskId(note),
                note,
            };
        }

        if (type === "tempo") {
            const bpm = pickRandom(pools.bpms, rng);
            const timeSignature = pickRandom(pools.timeSignatures, rng);

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
