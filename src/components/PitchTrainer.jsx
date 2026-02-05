import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
    Typography,
    Grid,
    MenuItem,
    FormControl,
    Select,
    FormGroup,
    FormLabel,
    FormControlLabel,
    Checkbox,
    Button,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
} from '@mui/material';

import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import StopIcon from '@mui/icons-material/Stop';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

import { instrument as soundfontInstrument } from 'soundfont-player';
import { OCTAVE_NUMBERS, TONES } from '../constants/NOTES';
import shuffleArray from '../util/shuffleArray';

import './PitchTrainer.css';

import { startQuestion, registerAttempt, skipQuestion } from '../system/StatsHelpers';

import { EventLogger } from '../system/EventLogger';
import { SystemEvents } from '../system/SystemEvents';
import { pitchTaskId } from '../system/taskIds';

function TonesCheckboxes({ tones, handleSelection }) {
    return (
        <>
            <FormLabel component="legend">
                Choose the notes to test, you can change anytime
            </FormLabel>
            <FormGroup row sx={{ justifyContent: 'center' }}>
                {TONES.map((t, i) => (
                    <FormControlLabel
                        key={t}
                        control={
                            <Checkbox
                                checked={tones[i]}
                                onChange={handleSelection(t)}
                                value={t}
                            />
                        }
                        label={t}
                    />
                ))}
            </FormGroup>
        </>
    );
}

TonesCheckboxes.propTypes = {
    tones: PropTypes.arrayOf(PropTypes.bool).isRequired,
    handleSelection: PropTypes.func.isRequired,
};

function TonesAnswerButtons({ answers, handleGameAnswer, selectedAnswer }) {
    return (
        <Grid container spacing={2} direction="row" alignItems="center">
            {answers.map((note) => (
                <Grid item key={note}>
                    <Button
                        variant={selectedAnswer === note ? "outlined" : "contained"}
                        className="pitch-trainer-button"
                        onClick={() => handleGameAnswer(note)}
                    >
                        {note}
                    </Button>
                </Grid>
            ))}
        </Grid>
    );
}

TonesAnswerButtons.propTypes = {
    answers: PropTypes.arrayOf(PropTypes.string).isRequired,
    handleGameAnswer: PropTypes.func.isRequired,
    selectedAnswer: PropTypes.string,
};

function PitchTrainerStatistics({ rows }) {
    return (
        <Table className="pitch-trainer-stat-table">
            <TableHead>
                <TableRow>
                    <TableCell>Notes Tested</TableCell>
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
                        <TableCell>{row.note}</TableCell>
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

PitchTrainerStatistics.propTypes = {
    rows: PropTypes.arrayOf(PropTypes.object).isRequired,
};

class PitchTrainer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            //     ['C',  'C#',  'D',  'D#',  'E',   'F',   'F#',  'G',  'G#',  'A',  'A#',  'B']
            tones: [true, false, true, false, false, false, false, true, false, true, false, false],

            isLoaded: false,
            isStarted: false,

            numChoices: 3,

            tonePlaying: 'C',
            notePlaying: 'C4',

            gameStartTime: 0,

            isCorrect: false,
            lastAnswer: -1, // -1: no ans, 0: wrong ans, 1: correct ans
            answers: [],
            selectedAnswer: null,

            isFirstGame: true,

            stats: {},
        };

        this.ac = new AudioContext();
        this._isMounted = false;
        soundfontInstrument(this.ac, 'acoustic_grand_piano', {
            soundfont: 'MusyngKite',
        }).then((instrument) => {
            this.somePiano = instrument;
            if (this._isMounted) {
                this.setState({ isLoaded: true });
            }
        });
    }

    componentDidMount() {
        this._isMounted = true;
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    handleSelection = (name) => (event) => {
        this.setState((prev) => {
            const tones = [...prev.tones];
            tones[TONES.indexOf(name)] = event.target.checked;

            const selectedCount = tones.filter(Boolean).length;
            const maxChoices = Math.max(1, selectedCount);
            const minChoices = Math.min(3, maxChoices);
            const numChoices = Math.max(minChoices, Math.min(prev.numChoices, maxChoices));

            return { tones, numChoices };
        });
    };

    handleNumChoices = (event) => {
        const { value, name } = event.target;

        this.setState((prev) => {
            const selectedCount = prev.tones.filter(Boolean).length;
            const maxChoices = Math.max(1, selectedCount);
            const minChoices = Math.min(3, maxChoices);
            const nextValue = Math.max(minChoices, Math.min(value, maxChoices));

            return { [name]: nextValue };
        });
    };

    handleGameStart = () => {
        const tone = this.getNextTone();
        const answers = this.getShuffledAnswers(this.state.tones, tone, this.state.numChoices);

        const taskId = pitchTaskId(tone);

        this.setState(prev => {
            const {
                stats: updatedStats, gameStartTime
            } = startQuestion(
                prev.stats ?? {},
                tone,
                { note: tone }
            );

            // LOG: Task start
            EventLogger.log({
                eventType: SystemEvents.TASK_START,
                taskId,
                agentProfile: 'human',
            });

            return {
                stats: updatedStats,
                gameStartTime,
                isStarted: true,
                tonePlaying: tone,
                notePlaying: this.getNextNote(tone),
                isCorrect: false,
                lastAnswer: -1,
                answers,
                selectedAnswer: null,
            };
        }, this.handlePlayNote);
    };

    handleGameStop = () => {
        const {
            tonePlaying,
            isCorrect
        } = this.state;

        // Current stats key e.g. 'C'
        const statsKey = tonePlaying;

        this.setState(prev => {
            let stats = prev.stats;

            // Finalise current question
            if (!isCorrect) {
                stats = skipQuestion(stats, statsKey);
            }

            return {
                stats,
                isStarted: false,
                isCorrect: false,
                isFirstGame: false,
                lastAnswer: -1,
                gameStartTime: 0,
                selectedAnswer: null,
            };
        });
    };

    handleNext = () => {
        const {
            tonePlaying,
            isCorrect
        } = this.state;

        const prevStatsKey = tonePlaying;

        // Select new tone
        const nextTone = this.getNextTone();

        // Set up the next question
        const newStatsKey = nextTone;

        const taskId = pitchTaskId(nextTone);

        this.setState(prev => {
            let stats = prev.stats;

            // Finalise previous question
            if (!isCorrect) {
                stats = skipQuestion(stats, prevStatsKey);
            }

            // LOG: Task skipped if not correct
            if (tonePlaying && !isCorrect) {
                EventLogger.log({
                    eventType: SystemEvents.TASK_SKIP,
                    taskId: pitchTaskId(tonePlaying),
                    agentProfile: 'human',
                });
            }

            // Start next question
            const {
                stats: updatedStats,
                gameStartTime
            } = startQuestion(
                stats,
                newStatsKey,
                { note: newStatsKey }
            );

            // LOG: Task start
            EventLogger.log({
                eventType: SystemEvents.TASK_START,
                taskId,
                agentProfile: 'human',
            });

            return {
                stats: updatedStats,

                tonePlaying: nextTone,
                notePlaying: this.getNextNote(nextTone),
                answers: this.getShuffledAnswers(prev.tones, nextTone, prev.numChoices),

                selectedAnswer: null,
                isCorrect: false,
                lastAnswer: -1,
                gameStartTime,
            };
        }, this.handlePlayNote);
    };

    handleGameAnswer = (note) => {
        if (this.state.isCorrect) {
            return;
        }

        const {
            tonePlaying,
            gameStartTime,
        } = this.state;

        const statsKey = tonePlaying;
        const isAnswerCorrect = note === tonePlaying;

        const taskId = pitchTaskId(tonePlaying);
        const responseTimeMs = performance.now() - gameStartTime;

        this.setState(prev => {
            const {
                stats: updatedStats
            } = registerAttempt(
                prev.stats ?? {},
                statsKey,
                gameStartTime,
                isAnswerCorrect
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
                selectedAnswer: note,
            };
        });
    };

    handlePlayNote = () => {
        this.somePiano.play(this.state.notePlaying);
    };

    // randomly chose a note from the tones user chooses
    getNextTone = () => {
        const available = TONES.filter((_, i) => this.state.tones[i]);
        return available[Math.floor(Math.random() * available.length)];
    };

    getNextNote = (tone) => {
        return tone + OCTAVE_NUMBERS[Math.floor(Math.random() * OCTAVE_NUMBERS.length)];
    };

    // return an array of possible tone answers
    getShuffledAnswers = (tones, correctTone, count) => {
        const available = TONES.filter((t, i) => tones[i] && t !== correctTone);
        const selected = shuffleArray(available).slice(0, count - 1);
        return shuffleArray([correctTone, ...selected]);
    };

    // return an array of objects representing rows of the stat table
    getStatRows = () => {
        const { stats } = this.state;

        return Object.keys(stats).map((key, i) => {
            const entry = stats[key];

            const averageCorrectTime = entry.correct > 0 ? (entry.totalTime / entry.correct / 1000).toFixed(4) : '0';
            const accuracy = entry.tries > 0 ? (entry.correct / entry.tries).toFixed(4) : '0';

            return {
                id: i,
                note: entry.note,
                numQ: entry.questions,
                numS: entry.skips,
                numA: entry.tries,
                averageCorrectTime,
                accuracy,
            };
        });
    };

    getChoiceMenuItems = () => {
        const selectedCount = this.state.tones.filter(Boolean).length;
        const maxChoices = Math.max(1, selectedCount);
        const minChoices = Math.min(3, maxChoices);
        const items = [];

        for (let i = minChoices; i <= maxChoices; i++) {
            items.push(<MenuItem key={i} value={i}>{i}</MenuItem>);
        }

        return items;
    };

    render() {
        const {
            isLoaded,
            isStarted,
            isCorrect,
            tones,
            numChoices,
            answers,
            notePlaying,
            lastAnswer,
            isFirstGame,
            selectedAnswer,
        } = this.state;

        return (
            <Grid container spacing={4} direction="column" alignItems="center" style={{ minHeight: '90vh', width: '100%', margin: 'auto' }}>
                <Grid item>
                    <h1>Pitch Listening Practice</h1>
                    <h2>{!isStarted ? 'Customise the training' : 'Listen and select the note played'}</h2>
                </Grid>

                <Grid item>
                    <TonesCheckboxes tones={tones} handleSelection={this.handleSelection} />
                </Grid>

                {!isStarted && (
                    <Grid item>
                        <FormControl>
                            <FormLabel>Choose number of candidates per question</FormLabel>
                            <Select
                                value={numChoices}
                                onChange={this.handleNumChoices}
                                name="numChoices"
                            >
                                {this.getChoiceMenuItems()}
                            </Select>
                        </FormControl>
                    </Grid>
                )}

                {isStarted && (
                    <>
                        <Grid item>
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Button fullWidth variant="contained" onClick={this.handlePlayNote}>
                                        <MusicNoteIcon className="leftIcon" />
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
                            <TonesAnswerButtons answers={answers} handleGameAnswer={this.handleGameAnswer} selectedAnswer={selectedAnswer} />
                        </Grid>

                        <Grid item>
                            <Typography variant="h5">
                                {lastAnswer === -1 ? 'Make a choice' : lastAnswer === 1 ? `Correct! The note is: ${notePlaying}` : 'Sorry, try again.'}
                            </Typography>
                        </Grid>
                    </>
                )}

                <Grid item>
                    {!isStarted ? (
                        <Button disabled={!isLoaded} variant="contained" color="secondary" onClick={this.handleGameStart}>
                            <ArrowRightIcon className="leftIcon" />
                            {isLoaded ? 'Start' : 'Loading'}
                        </Button>
                    ) : (
                        <Button variant="contained" color="secondary" onClick={this.handleGameStop}>
                            <StopIcon className="leftIcon" />
                            End
                        </Button>
                    )}
                </Grid>

                {!isStarted && !isFirstGame && (
                    <Grid item>
                        <h5>Statistics</h5>
                        <PitchTrainerStatistics rows={this.getStatRows()} />
                    </Grid>
                )}
            </Grid>
        );
    }
}

export default PitchTrainer;
