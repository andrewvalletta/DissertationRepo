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

import './Trainer.css';

import { startQuestion, registerAttempt, skipQuestion } from '../system/StatsHelpers';

import { EventLogger } from '../system/EventLogger';
import { SystemEvents } from '../system/SystemEvents';
import { tempoTaskId } from '../system/taskIds';
import { LEVEL_CONFIG } from '../system/LevelConfig';

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
                        className="trainer-button"
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
                        className="trainer-button"
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
        <Table className="trainer-stat-table">
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
        const initialLevel = EventLogger.getGamificationState()?.level ?? 1;
        const levelState = this.getLevelState(initialLevel);
        this.state = {
            //    [60,   80,   100,   120,   140,   160]
            bpms: levelState.bpms,

            //              ['2/4', '3/4', '4/4', '6/8']
            timeSignatures: levelState.timeSignatures,

            isLoaded: true,
            isStarted: false,

            numBpmChoices: levelState.numBpmChoices,
            numTimeSignatureChoices: levelState.numTimeSignatureChoices,

            currentLevel: initialLevel,

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

        this.audioCtx = new AudioContext();
    }

    handleSelection = (name) => (event) => {
        this.setState((prev) => {
            const bpms = [...prev.bpms];
            const timeSignatures = [...prev.timeSignatures];

            if (BPMS.includes(name)) {
                bpms[BPMS.indexOf(name)] = event.target.checked;
            }

            if (TIME_SIGNATURES.includes(name)) {
                timeSignatures[TIME_SIGNATURES.indexOf(name)] = event.target.checked;
            }

            const maxBpmChoices = Math.max(1, bpms.filter(Boolean).length);
            const maxTsChoices = Math.max(1, timeSignatures.filter(Boolean).length);

            const minBpmChoices = Math.min(2, maxBpmChoices);
            const minTsChoices = Math.min(2, maxTsChoices);

            const numBpmChoices = Math.max(minBpmChoices, Math.min(prev.numBpmChoices, maxBpmChoices));
            const numTimeSignatureChoices = Math.max(minTsChoices, Math.min(prev.numTimeSignatureChoices, maxTsChoices));

            return {
                bpms,
                timeSignatures,
                numBpmChoices,
                numTimeSignatureChoices,
            };
        });
    };

    getActiveLevel = () => EventLogger.getGamificationState()?.level ?? this.state.currentLevel ?? 1;

    getLevelState = (level) => {
        const config = LEVEL_CONFIG[level] ?? LEVEL_CONFIG[1];
        const bpmPoolSize = Math.min(config.tempo.bpmChoices, config.tempo.allowedBpms.length);
        const timeSignaturePoolSize = Math.min(config.tempo.timeSignatureChoices, config.tempo.allowedTimeSignatures.length);
        const bpmPool = shuffleArray([...config.tempo.allowedBpms]).slice(0, bpmPoolSize);
        const timeSignaturePool = shuffleArray([...config.tempo.allowedTimeSignatures]).slice(0, timeSignaturePoolSize);
        const bpmPoolSet = new Set(bpmPool);
        const timeSignaturePoolSet = new Set(timeSignaturePool);

        return {
            bpms: BPMS.map((bpm) => bpmPoolSet.has(bpm)),
            timeSignatures: TIME_SIGNATURES.map((ts) => timeSignaturePoolSet.has(ts)),
            numBpmChoices: Math.min(config.tempo.bpmChoices, bpmPool.length),
            numTimeSignatureChoices: Math.min(config.tempo.timeSignatureChoices, timeSignaturePool.length),
            currentLevel: level,
        };
    };

    handleNumChoices = (event) => {
        const { name, value } = event.target;

        this.setState((prev) => {
            if (name === 'numBpmChoices') {
                const maxChoices = Math.max(1, prev.bpms.filter(Boolean).length);
                const minChoices = Math.min(2, maxChoices);
                const nextValue = Math.max(minChoices, Math.min(value, maxChoices));
                return { numBpmChoices: nextValue };
            }

            if (name === 'numTimeSignatureChoices') {
                const maxChoices = Math.max(1, prev.timeSignatures.filter(Boolean).length);
                const minChoices = Math.min(2, maxChoices);
                const nextValue = Math.max(minChoices, Math.min(value, maxChoices));
                return { numTimeSignatureChoices: nextValue };
            }

            return null;
        });
    };

    handleGameStart = () => {
        const level = this.getActiveLevel();
        const levelState = this.getLevelState(level);
        const bpm = this.getNextBpm(levelState.bpms);
        const timeSignature = this.getNextTimeSignature(levelState.timeSignatures);

        const statsKey = `${bpm}|${timeSignature}`;

        const bpmAnswers = this.getShuffledBpms(levelState.bpms, bpm, levelState.numBpmChoices);

        const timeSignatureAnswers = this.getShuffledTimeSignatures(levelState.timeSignatures, timeSignature, levelState.numTimeSignatureChoices);

        this.setState(prev => {
            const {
                stats: updatedStats, gameStartTime
            } = startQuestion(
                prev.stats ?? {},
                statsKey,
                { bpm, timeSignature }
            );

            // LOG: Task start
            EventLogger.log({
                eventType: SystemEvents.TASK_START,
                taskId: tempoTaskId(bpm, timeSignature),
                agentProfile: 'human',
            });

            return {
                stats: updatedStats,
                gameStartTime,
                isStarted: true,
                bpmPlaying: bpm,
                timeSignaturePlaying: timeSignature,
                selectedBpm: null,
                selectedTimeSignature: null,
                isCorrect: false,
                lastAnswer: -1,
                bpmAnswers,
                timeSignatureAnswers,
                bpms: levelState.bpms,
                timeSignatures: levelState.timeSignatures,
                numBpmChoices: levelState.numBpmChoices,
                numTimeSignatureChoices: levelState.numTimeSignatureChoices,
                currentLevel: level,
            };
        }, this.handlePlayMelody);
    };

    handleGameStop = () => {
        // Current stats key e.g. "60|4/4"
        const statsKey = this.getStatsKey();

        this.setState(prev => {
            let stats = prev.stats;

            // Finalise previous question
            if (!prev.isCorrect) {
                stats = skipQuestion(stats, statsKey);
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

        const level = this.getActiveLevel();
        const levelState = level !== this.state.currentLevel ? this.getLevelState(level) : null;
        const activeBpms = levelState ? levelState.bpms : bpms;
        const activeTimeSignatures = levelState ? levelState.timeSignatures : timeSignatures;
        const activeBpmChoices = levelState ? levelState.numBpmChoices : numBpmChoices;
        const activeTimeSignatureChoices = levelState ? levelState.numTimeSignatureChoices : numTimeSignatureChoices;

        // Select new bpm and time signature
        const nextBpm = this.getNextBpm(activeBpms);
        const nextTimeSignature = this.getNextTimeSignature(activeTimeSignatures);

        // Set up the next question
        const nextStatsKey = `${nextBpm}|${nextTimeSignature}`;

        this.setState(prev => {
            let stats = prev.stats;

            // Finalise previous question
            if (!isCorrect) {
                stats = skipQuestion(stats, prevStatsKey);
            }

            // LOG: Task skipped if not correct
            if (bpmPlaying && timeSignaturePlaying && !isCorrect) {
                EventLogger.log({
                    eventType: SystemEvents.TASK_SKIP,
                    taskId: tempoTaskId(bpmPlaying, timeSignaturePlaying),
                    agentProfile: 'human',
                });
            }

            // Start next question
            const {
                stats: updatedStats,
                gameStartTime
            } = startQuestion(
                stats,
                nextStatsKey,
                { bpm: nextBpm, timeSignature: nextTimeSignature }
            );

            // LOG: Task start
            EventLogger.log({
                eventType: SystemEvents.TASK_START,
                taskId: tempoTaskId(nextBpm, nextTimeSignature),
                agentProfile: 'human',
            });

            return {
                stats: updatedStats,

                bpmPlaying: nextBpm,
                timeSignaturePlaying: nextTimeSignature,

                bpmAnswers: this.getShuffledBpms(activeBpms, nextBpm, activeBpmChoices),
                timeSignatureAnswers: this.getShuffledTimeSignatures(activeTimeSignatures, nextTimeSignature, activeTimeSignatureChoices),

                selectedBpm: null,
                selectedTimeSignature: null,
                isCorrect: false,
                lastAnswer: -1,
                gameStartTime,
                currentLevel: level,
                ...(levelState ? {
                    bpms: levelState.bpms,
                    timeSignatures: levelState.timeSignatures,
                    numBpmChoices: levelState.numBpmChoices,
                    numTimeSignatureChoices: levelState.numTimeSignatureChoices,
                } : {}),
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

        const statsKey = this.getStatsKey();
        const isAnswerCorrect = selectedBpm === bpmPlaying && selectedTimeSignature === timeSignaturePlaying;

        const taskId = tempoTaskId(bpmPlaying, timeSignaturePlaying);
        const responseTimeMs = performance.now() - gameStartTime;

        this.setState(prev => {
            const {
                stats: updatedStats
            } = registerAttempt(
                prev.stats ?? {},
                statsKey,
                gameStartTime,
                isAnswerCorrect,
            );

            // LOG: Attempt
            EventLogger.log({
                eventType: SystemEvents.TASK_ATTEMPT,
                taskId,
                responseTimeMs,
                success: isAnswerCorrect,
                agentProfile: 'human',
            });

            // LOG: outcome
            EventLogger.log({
                eventType: isAnswerCorrect ? SystemEvents.TASK_SUCCESS : SystemEvents.TASK_FAILURE,
                taskId,
                responseTimeMs,
                agentProfile: 'human',
            });

            return {
                stats: updatedStats,
                isCorrect: isAnswerCorrect,
                lastAnswer: isAnswerCorrect ? 1 : 0,
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
    getNextBpm = (bpmSelection = this.state.bpms) => {
        const available = BPMS.filter((_, i) => bpmSelection[i]);
        return available[Math.floor(Math.random() * available.length)];
    };

    getNextTimeSignature = (timeSignatureSelection = this.state.timeSignatures) => {
        const available = TIME_SIGNATURES.filter((_, i) => timeSignatureSelection[i]);
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

    getChoiceMenuItems = (minChoices, maxChoices) => {
        const items = [];
        const start = Math.min(minChoices, maxChoices);

        for (let i = start; i <= maxChoices; i++) {
            items.push(
                <MenuItem key={i} value={i}>
                    {i}
                </MenuItem>
            );
        }

        return items;
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

        const maxBpmChoices = Math.max(1, bpms.filter(Boolean).length);
        const maxTimeSignatureChoices = Math.max(1, timeSignatures.filter(Boolean).length);

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
                                    {this.getChoiceMenuItems(2, maxBpmChoices)}
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
                                    {this.getChoiceMenuItems(2, maxTimeSignatureChoices)}
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
