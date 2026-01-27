import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
    Button,
    Checkbox,
    FormControl,
    FormControlLabel,
    FormGroup,
    FormLabel,
    Grid,
    MenuItem,
    Select,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';

import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import StopIcon from '@mui/icons-material/Stop';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

import { BPMS, TIME_SIGNATURES } from '../constants/TEMPOS';
import shuffleArray from '../util/shuffleArray';

import './TempoTrainer.css';

function TemposCheckboxes({ bpms, timeSignatures, handleSelection }) {
    return (
        <>
            <FormLabel component="legend">
                Choose the Tempos (BPMs) and Time Signatures
            </FormLabel>

            <FormGroup row sx={{ justifyContent: 'center' }}>
                {BPMS.map((bpm, i) => (
                    <FormControlLabel
                        key={bpm}
                        control={
                            <Checkbox
                                checked={bpms[i]}
                                onChange={handleSelection(bpm)}
                                value={bpm}
                            />
                        }
                        label={bpm}
                    />
                ))}
            </FormGroup>

            <FormGroup row sx={{ justifyContent: 'center' }}>
                {TIME_SIGNATURES.map((ts, i) => (
                    <FormControlLabel
                        key={ts}
                        control={
                            <Checkbox
                                checked={timeSignatures[i]}
                                onChange={handleSelection(ts)}
                            />
                        }
                        label={ts}
                    />
                ))}
            </FormGroup>
        </>
    );
}

TemposCheckboxes.propTypes = {
    tempos: PropTypes.arrayOf(PropTypes.bool).isRequired,
    handleSelection: PropTypes.func.isRequired,
};

function BpmsAnswerButtons({ bpmAnswers, handleBpmAnswer, selectedBpm }) {
    return (
        <Grid container spacing={2} direction="row" alignItems="center">
            {bpmAnswers.map((bpm) => (
                <Grid item key={bpm}>
                    <Button
                        variant={selectedBpm === bpm ? "outlined" : "contained"}
                        className="tempo-trainer-button"
                        onClick={() => handleBpmAnswer(bpm)}
                    >
                        {bpm}
                    </Button>
                </Grid>
            ))}
        </Grid>
    );
}

BpmsAnswerButtons.propTypes = {
    bpmAnswers: PropTypes.arrayOf(PropTypes.number).isRequired,
    handleBpmAnswer: PropTypes.func.isRequired,
    selectedBpm: PropTypes.number,
};

function TimeSignaturesAnswerButtons({ timeSignatureAnswers, handleTimeSignatureAnswer, selectedTimeSignature }) {
    return (
        <Grid container spacing={2} direction="row" alignItems="center">
            {timeSignatureAnswers.map((timeSignature) => (
                <Grid item key={timeSignature}>
                    <Button
                        variant={selectedTimeSignature === timeSignature ? "outlined" : "contained"}
                        className="tempo-trainer-button"
                        onClick={() => handleTimeSignatureAnswer(timeSignature)}
                    >
                        {timeSignature}
                    </Button>
                </Grid>
            ))}
        </Grid>
    );
}

TimeSignaturesAnswerButtons.propTypes = {
    timeSignatureAnswers: PropTypes.arrayOf(PropTypes.string).isRequired,
    handleTimeSignatureAnswer: PropTypes.func.isRequired,
    selectedTimeSignature: PropTypes.string,
};

function TempoTrainerStatistics({ rows }) {
    return (
        <Table className="tempo-trainer-stat-table">
            <TableHead>
                <TableRow>
                    <TableCell>BPM</TableCell>
                    <TableCell>Time Signature</TableCell>
                    <TableCell align="right">Questions</TableCell>
                    <TableCell align="right">Skipped</TableCell>
                    <TableCell align="right">Attempts</TableCell>
                    <TableCell align="right">Avg Time (s)</TableCell>
                    <TableCell align="right">Accuracy</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {rows.map((row) => (
                    <TableRow key={row.id}>
                        <TableCell>{row.bpm}</TableCell>
                        <TableCell>{row.ts}</TableCell>
                        <TableCell align="right">{row.numQ}</TableCell>
                        <TableCell align="right">{row.numS}</TableCell>
                        <TableCell align="right">{row.numA}</TableCell>
                        <TableCell align="right">{isNaN(row.averageCorrectTime) ? '0' : row.averageCorrectTime}</TableCell>
                        <TableCell align="right">{isNaN(row.accuracy) ? '0' : row.accuracy}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

TempoTrainerStatistics.propTypes = {
    rows: PropTypes.arrayOf(PropTypes.object).isRequired,
};

class TempoTrainer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            //    [60,   80,   100,   120,   140,   160]
            bpms: [true, false, false, true, false, false],

            //              ['2/4', '3/4', '4/4']
            timeSignatures: [true, false, true],

            isLoaded: true,
            isStarted: false,

            numBpmChoices: 2,
            numTimeSignatureChoices: 2,

            bpmPlaying: 60,
            timeSignaturePlaying: '4/4',

            gameStartTime: 0,

            selectedBpm: null,
            selectedTimeSignature: null,

            isCorrect: false,
            lastAnswer: -1, // -1: no ans, 0: wrong ans, 1: correct ans
            bpmAnswers: [],
            timeSignatureAnswers: [],

            isFirstGame: true,

            stats: {},
        };

        this.NUM_BPM_CHOICES_LIST = BPMS.map((_, i) => (
            <MenuItem key={i} value={i}>
                {i}
            </MenuItem>
        )).slice(2); // min 2 choices

        this.NUM_TIME_SIGNATURE_CHOICES_LIST = TIME_SIGNATURES.map((_, i) => (
            <MenuItem key={i} value={i}>
                {i}
            </MenuItem>
        )).slice(2); // min 2 choices

        this.audioCtx = new AudioContext();
    }

    handleSelection = (name) => (event) => {
        if (BPMS.includes(name)) {
            const bpms = [...this.state.bpms];
            bpms[BPMS.indexOf(name)] = event.target.checked;
            this.setState({ bpms });
            return;
        } else if (TIME_SIGNATURES.includes(name)) {
            const timeSignatures = [...this.state.timeSignatures];
            timeSignatures[TIME_SIGNATURES.indexOf(name)] = event.target.checked;
            this.setState({ timeSignatures });
            return;
        }
    };

    handleNumChoices = (event) => {
        this.setState({ [event.target.name]: event.target.value });
    };

    handleGameStart = () => {
        const bpm = this.getNextBpm();
        const timeSignature = this.getNextTimeSignature();

        const bpmAnswers = this.getShuffledBpms(this.state.bpms, bpm, this.state.numBpmChoices);

        const timeSignatureAnswers = this.getShuffledTimeSignatures(this.state.timeSignatures, timeSignature, this.state.numTimeSignatureChoices);

        const statsKey = `${bpm}|${timeSignature}`;

        this.setState(prev => {
            const stats = { ...prev.stats };

            if (!stats[statsKey]) {
                stats[statsKey] = {
                    bpm,
                    timeSignature,
                    questions: 0,
                    skips: 0,
                    tries: 0,
                    correct: 0,
                    totalTime: 0,
                };
            }

            const entry = { ...stats[statsKey] };
            entry.questions++;
            stats[statsKey] = entry;

            return {
                stats,
                gameStartTime: performance.now(),
                isStarted: true,
                bpmPlaying: bpm,
                timeSignaturePlaying: timeSignature,
                selectedBpm: null,
                selectedTimeSignature: null,
                isCorrect: false,
                lastAnswer: -1,
                bpmAnswers,
                timeSignatureAnswers,
            };
        }, this.handlePlayMelody);
    };

    handleGameStop = () => {
        // Current stats key e.g. "60|4/4"
        const statsKey = this.getStatsKey();

        this.setState(prev => {
            const stats = { ...prev.stats };

            // Safeguard in case stats entry does not exist
            if (!stats[statsKey]) {
                stats[statsKey] = {
                    bpm: prev.bpmPlaying,
                    timeSignature: prev.timeSignaturePlaying,
                    questions: 0,
                    skips: 0,
                    tries: 0,
                    correct: 0,
                    totalTime: 0,
                };
            }

            // Increment skips if the previous question was not answered correctly
            if (!prev.isCorrect) {
                const entry = { ...stats[statsKey] };
                entry.skips++;
                stats[statsKey] = entry;
            }

            return {
                stats,
                isStarted: false,
                isCorrect: false,
                lastAnswer: -1,
                gameStartTime: 0,
                isFirstGame: false,
                selectedBpm: null,
                selectedTimeSignature: null,
            };
        });
    };

    handleNext = () => {
        const {
            bpmPlaying,
            timeSignaturePlaying,
            isCorrect,
            bpms,
            timeSignatures,
            numBpmChoices,
            numTimeSignatureChoices,
        } = this.state;

        const prevStatsKey = `${bpmPlaying}|${timeSignaturePlaying}`;

        this.setState(prev => {
            const stats = { ...prev.stats };

            // Safeguard in case stats entry does not exist
            if (!stats[prevStatsKey]) {
                stats[prevStatsKey] = {
                    bpm: bpmPlaying,
                    timeSignature: timeSignaturePlaying,
                    questions: 0,
                    skips: 0,
                    tries: 0,
                    correct: 0,
                    totalTime: 0,
                };
            }

            // Increment skips if the previous question was not answered correctly
            if (!isCorrect) {
                const prevEntry = { ...stats[prevStatsKey] };
                prevEntry.skips++;
                stats[prevStatsKey] = prevEntry;
            }

            // Select new bpm and time signature
            const nextBpm = this.getNextBpm();
            const nextTimeSignature = this.getNextTimeSignature();

            const newStatsKey = `${nextBpm}|${nextTimeSignature}`;

            // Ensure stats entry exists for the new question
            if (!stats[newStatsKey]) {
                stats[newStatsKey] = {
                    bpm: nextBpm,
                    timeSignature: nextTimeSignature,
                    questions: 0,
                    skips: 0,
                    tries: 0,
                    correct: 0,
                    totalTime: 0,
                };
            }

            // Increment question count for the new combination i.e. question
            const newEntry = { ...stats[newStatsKey] };
            newEntry.questions++;
            stats[newStatsKey] = newEntry;

            return {
                stats,
                bpmPlaying: nextBpm,
                timeSignaturePlaying: nextTimeSignature,
                bpmAnswers: this.getShuffledBpms(bpms, nextBpm, numBpmChoices),
                timeSignatureAnswers: this.getShuffledTimeSignatures(timeSignatures, nextTimeSignature, numTimeSignatureChoices),
                selectedBpm: null,
                selectedTimeSignature: null,
                isCorrect: false,
                lastAnswer: -1,
                gameStartTime: performance.now(),
            };
        }, this.handlePlayMelody);
    };

    handleBpmAnswer = (bpm) => {
        if (this.state.isCorrect) {
            return;
        }

        this.setState({ selectedBpm: bpm }, this.handleGameAnswer);
    };

    handleTimeSignatureAnswer = (timeSignature) => {
        if (this.state.isCorrect) {
            return;
        }

        this.setState({ selectedTimeSignature: timeSignature }, this.handleGameAnswer);
    };

    handleGameAnswer = () => {
        const {
            selectedBpm,
            selectedTimeSignature,
            bpmPlaying,
            timeSignaturePlaying,
            isCorrect,
            gameStartTime,
        } = this.state;

        if (selectedBpm == null || selectedTimeSignature == null || isCorrect) {
            return;
        }

        const now = performance.now();
        const statsKey = this.getStatsKey();

        this.setState(prev => {
            const stats = { ...prev.stats };
            const entry = { ...stats[statsKey] };  // Create a copy of the entry
            stats[statsKey] = entry;                // Replace the reference

            entry.tries++;

            if (selectedBpm === bpmPlaying && selectedTimeSignature === timeSignaturePlaying) {
                entry.correct++;
                entry.totalTime += now - gameStartTime;

                return {
                    stats,
                    isCorrect: true,
                    lastAnswer: 1,
                };
            }

            return {
                stats,
                lastAnswer: 0,
            };
        });
    };

    handlePlayMelody = () => {
        const beatInterval = 60 / this.state.bpmPlaying;
        const beats = parseInt(this.state.timeSignaturePlaying.split('/')[0], 10);

        for (let i = 0; i < beats; i++) {
            const osc = this.audioCtx.createOscillator();
            osc.frequency.value = i === 0 ? 1000 : 700;
            osc.connect(this.audioCtx.destination);
            osc.start(this.audioCtx.currentTime + i * beatInterval);
            osc.stop(this.audioCtx.currentTime + i * beatInterval + 0.05);
        }
    };

    // randomly choose a bpm from the bpms user chooses
    getNextBpm = () => {
        const available = BPMS.filter((_, i) => this.state.bpms[i]);
        return available[Math.floor(Math.random() * available.length)];
    };

    getNextTimeSignature = () => {
        const available = TIME_SIGNATURES.filter((_, i) => this.state.timeSignatures[i]);
        return available[Math.floor(Math.random() * available.length)];
    };

    // return an array of possible bpm answers
    getShuffledBpms = (bpms, correctBpm, numBpmChoices) => {
        const availableBpms = BPMS.filter((_, i) => bpms[i] && BPMS[i] !== correctBpm);

        const selectedBpm = shuffleArray(availableBpms).slice(0, numBpmChoices - 1);

        return shuffleArray([correctBpm, ...selectedBpm]);
    };

    // return an array of possible time signature answers
    getShuffledTimeSignatures = (timeSignatures, correctTimeSignature, numTimeSignatureChoices) => {
        const availableTimeSignatures = TIME_SIGNATURES.filter((_, i) => timeSignatures[i] && TIME_SIGNATURES[i] !== correctTimeSignature);

        const selectedTimeSignatures = shuffleArray(availableTimeSignatures).slice(0, numTimeSignatureChoices - 1);

        return shuffleArray([correctTimeSignature, ...selectedTimeSignatures]);
    };

    ensureStatsEntry = (key) => {
        if (!this.state.stats[key]) {
            this.state.stats[key] = {
                questions: 0,
                skips: 0,
                tries: 0,
                correct: 0,
                totalTime: 0,
            };
        }
    };

    getStatsKey = () => {
        const { bpmPlaying, timeSignaturePlaying } = this.state;
        return `${bpmPlaying}|${timeSignaturePlaying}`;
    };

    getStatRows = () => {
        const { stats } = this.state;

        return Object.keys(stats).map((key, i) => {
            const entry = stats[key];

            const averageCorrectTime = entry.correct > 0 ? (entry.totalTime / entry.correct / 1000).toFixed(4) : '0';

            const accuracy = entry.tries > 0 ? (entry.correct / entry.tries).toFixed(4) : '0';

            return {
                id: i,
                bpm: entry.bpm,
                ts: entry.timeSignature,
                numQ: entry.questions,
                numS: entry.skips,
                numA: entry.tries,
                averageCorrectTime,
                accuracy,
            };
        });
    };

    render() {
        const {
            isLoaded,
            isStarted,
            isCorrect,
            bpms,
            timeSignatures,
            numBpmChoices,
            numTimeSignatureChoices,
            bpmAnswers,
            timeSignatureAnswers,
            bpmPlaying,
            timeSignaturePlaying,
            lastAnswer,
            isFirstGame,
            selectedBpm,
            selectedTimeSignature,
        } = this.state;

        return (
            <Grid container spacing={4} direction="column" alignItems="center" style={{ minHeight: '90vh', width: '100%', margin: 'auto' }}>
                <Grid item>
                    <h1>Tempo Recognition Practice</h1>
                    <h2>{!isStarted ? 'Customise the training' : 'Listen and identify tempo & time signature played'}</h2>
                </Grid>

                <Grid item>
                    <TemposCheckboxes
                        bpms={bpms}
                        timeSignatures={timeSignatures}
                        handleSelection={this.handleSelection}
                    />
                </Grid>

                {!isStarted && (
                    <Grid item container spacing={4} justifyContent="center">
                        <Grid item>
                            <FormControl>
                                <FormLabel>Number of Tempo (BPM) Choices:</FormLabel>
                                <Select
                                    value={numBpmChoices}
                                    onChange={this.handleNumChoices}
                                    name="numBpmChoices"
                                >
                                    {this.NUM_BPM_CHOICES_LIST}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item>
                            <FormControl>
                                <FormLabel>Number of Time Signature Choices:</FormLabel>
                                <Select
                                    value={numTimeSignatureChoices}
                                    onChange={this.handleNumChoices}
                                    name="numTimeSignatureChoices"
                                >
                                    {this.NUM_TIME_SIGNATURE_CHOICES_LIST}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                )}

                {isStarted && (
                    <>
                        <Grid item>
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Button fullWidth variant='contained' onClick={this.handlePlayMelody}><MusicNoteIcon className='leftIcon' />
                                        Play
                                    </Button>
                                </Grid>
                                <Grid item xs={6}>
                                    <Button fullWidth variant="contained" onClick={this.handleNext}>
                                        {isCorrect ? <NavigateNextIcon className="leftIcon" /> : <SkipNextIcon className="leftIcon" />}
                                        {isCorrect ? 'Next' : 'Skip'}
                                    </Button>
                                </Grid>
                            </Grid>
                        </Grid>

                        <Grid item>
                            <Grid container direction='column' spacing={2} alignItems="center">
                                <Grid item>
                                    <BpmsAnswerButtons
                                        bpmAnswers={bpmAnswers}
                                        handleBpmAnswer={this.handleBpmAnswer}
                                        selectedBpm={selectedBpm}
                                    />
                                </Grid>

                                <Grid item>
                                    <TimeSignaturesAnswerButtons
                                        timeSignatureAnswers={timeSignatureAnswers}
                                        handleTimeSignatureAnswer={this.handleTimeSignatureAnswer}
                                        selectedTimeSignature={selectedTimeSignature}
                                    />
                                </Grid>
                            </Grid>
                        </Grid>

                        <Grid item>
                            <Typography variant="h5">
                                {lastAnswer === -1 ? 'Make your selections' : lastAnswer === 1 ? `Correct! The tempo is ${bpmPlaying} and the time signature is ${timeSignaturePlaying}.` : 'Sorry, try again.'}
                            </Typography>
                        </Grid>
                    </>
                )}

                <Grid item>
                    {!isStarted ? (
                        <Button disabled={!isLoaded} variant="contained" color="secondary" onClick={this.handleGameStart}>
                            <ArrowRightIcon className="leftIcon" />
                            {isLoaded ? 'Start' : 'Loading...'}
                        </Button>
                    ) : (
                        <Button variant="contained" color="secondary" onClick={this.handleGameStop}>
                            <StopIcon className="leftIcon" />
                            End
                        </Button>
                    )}
                </Grid>

                {
                    !isStarted && !isFirstGame && (
                        <Grid item>
                            <h5>Statistics</h5>
                            <TempoTrainerStatistics rows={this.getStatRows()} />
                        </Grid>
                    )
                }
            </Grid >
        );
    }
}

export default TempoTrainer;
