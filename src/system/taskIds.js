export function pitchTaskId(note) {
    return `pitch_${note}`;
}

export function tempoTaskId(bpm, timeSignature) {
    return `tempo_${bpm}|${timeSignature}`;
}
