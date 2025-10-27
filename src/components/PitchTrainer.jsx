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

function TonesCheckboxes({ tones, handleSelection }) {
    return (
        <>
            <FormLabel component="legend">
                Choose the notes to test, you can change anytime
            </FormLabel>
            <FormGroup row>
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

function TonesAnswerButtons({ answers, handleGameAnswer }) {
    return (
        <Grid container spacing={2} direction="row" alignItems="center">
            {answers.map((note) => (
                <Grid item key={note}>
                    <Button
                        variant="outlined"
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
            isFirstGame: true,
            statQuestions: Array(12).fill(0), // how many questions shown for a tone
            statSkips: Array(12).fill(0), // how many skipped questions shown for a tone
            statTries: Array(12).fill(0), // how many tries did user made for a tone
            statTriesTime: Array(12).fill(0), // how long in total for user to decide a tone, used to calc average time
            statCorrect: Array(12).fill(0), // how many correct ans in first selection, used to calc the accuracy
        };

        this.NUM_CHOICES_LIST = TONES.map((_, i) => (
            <MenuItem key={i} value={i}>{i}</MenuItem>
        )).slice(3);

        this.ac = new AudioContext();
        soundfontInstrument(this.ac, 'acoustic_grand_piano', {
            soundfont: 'MusyngKite',
        }).then((instrument) => {
            this.somePiano = instrument;
            this.setState({ isLoaded: true });
        });
    }

    handleSelection = (name) => (event) => {
        const tones = [...this.state.tones];
        tones[TONES.indexOf(name)] = event.target.checked;
        this.setState({ tones });
    };

    handleNumChoices = (event) => {
        this.setState({ [event.target.name]: event.target.value });
    };

    handleGameStart = () => {
        const tone = this.getNextTone();
        const answers = this.getShuffledAnswers(this.state.tones, tone, this.state.numChoices);
        this.setState({
            gameStartTime: performance.now(),
            isStarted: true,
            tonePlaying: tone,
            notePlaying: this.getNextNote(tone),
            isCorrect: false,
            lastAnswer: -1,
            answers,
        }, this.handlePlayNote);
    };

    handleGameStop = () => {
        const idx = TONES.indexOf(this.state.tonePlaying);
        const statQuestions = [...this.state.statQuestions];
        const statSkips = [...this.state.statSkips];
        statQuestions[idx]++;
        if (!this.state.isCorrect) statSkips[idx]++;
        this.setState({
            isStarted: false,
            isCorrect: false,
            isFirstGame: false,
            lastAnswer: -1,
            gameStartTime: 0,
            statQuestions,
            statSkips,
        });
    };

    handleNext = () => {
        const idx = TONES.indexOf(this.state.tonePlaying);
        const statQuestions = [...this.state.statQuestions];
        const statSkips = [...this.state.statSkips];
        statQuestions[idx]++;
        if (!this.state.isCorrect) statSkips[idx]++;
        const tone = this.getNextTone();
        const answers = this.getShuffledAnswers(this.state.tones, tone, this.state.numChoices);
        this.setState({
            tonePlaying: tone,
            notePlaying: this.getNextNote(tone),
            answers,
            gameStartTime: performance.now(),
            lastAnswer: -1,
            isCorrect: false,
            statQuestions,
            statSkips,
        }, this.handlePlayNote);
    };

    handleGameAnswer = (note) => {
        const now = performance.now();
        const idx = TONES.indexOf(this.state.tonePlaying);
        const statTries = [...this.state.statTries];
        statTries[idx]++;
        if (this.state.isCorrect) return;
        if (note === this.state.tonePlaying) {
            const statCorrect = [...this.state.statCorrect];
            const statTriesTime = [...this.state.statTriesTime];
            statCorrect[idx]++;
            statTriesTime[idx] += now - this.state.gameStartTime; // time in ms
            this.setState({
                isCorrect: true,
                lastAnswer: 1,
                statTries,
                statTriesTime,
                statCorrect,
            });
        } else {
            this.setState({
                statTries,
                lastAnswer: 0,
            });
        }
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
    // return an array of possible answers
    getShuffledAnswers = (tones, correctTone, count) => {
        const available = TONES.filter((t, i) => tones[i] && t !== correctTone);
        const selected = shuffleArray(available).slice(0, count - 1);
        return shuffleArray([correctTone, ...selected]);
    };
    // return an array of objects representing rows of the stat table
    getStatRows = () => {
        return TONES.map((tone, i) => {
            if (!this.state.statQuestions[i]) return null;
            const avg = (this.state.statTriesTime[i] / this.state.statCorrect[i] / 1000).toFixed(4);
            const acc = (this.state.statCorrect[i] / this.state.statTries[i]).toFixed(4);
            return {
                id: i,
                note: tone,
                numQ: this.state.statQuestions[i],
                numS: this.state.statSkips[i],
                numA: this.state.statTries[i],
                averageCorrectTime: isNaN(avg) ? 0 : avg,
                accuracy: isNaN(acc) ? 0 : acc,
            };
        }).filter(Boolean);
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
                                {this.NUM_CHOICES_LIST}
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
                            <TonesAnswerButtons answers={answers} handleGameAnswer={this.handleGameAnswer} />
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
