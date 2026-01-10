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
import SkipNextIcon from '@mui/icons-material/SkipNext';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

const BPM_OPTIONS = [60, 80, 100, 120, 140, 160];
const TIME_SIGNATURES = ['2/4', '3/4', '4/4'];

class TempoTrainer extends Component {
    constructor(props) {
        super(props);

        this.state = {
            bpmEnabled: BPM_OPTIONS.map(() => true),
            timeSignatureEnabled: TIME_SIGNATURES.map(() => true),

            isStarted: false,
            tempoBpm: null,
            timeSignature: null,

            selectedBpm: null,
            selectedTimeSignature: null,

            gameStartTime: 0,
            isCorrect: false,
            lastAnswer: -1,

            questions: 0,
            skips: 0,
            attempts: 0,
            correct: 0,
            totalResponseTime: 0,
        };

        this.audioCtx = new AudioContext();
    }

    handleBpmToggle = (bpm) => (event) => {
        const bpmEnabled = [...this.state.bpmEnabled];
        bpmEnabled[BPM_OPTIONS.indexOf(bpm)] = event.target.checked;
        this.setState({ bpmEnabled });
    };

    handleTimeSignatureToggle = (ts) => (event) => {
        const timeSignatureEnabled = [...this.state.timeSignatureEnabled];
        timeSignatureEnabled[TIME_SIGNATURES.indexOf(ts)] = event.target.checked;
        this.setState({ timeSignatureEnabled });
    };

    startGame = () => {
        const tempoBpm = this.getNextBpm();
        const timeSignature = this.getNextTimeSignature();

        this.setState({
            isStarted: true,
            tempoBpm,
            timeSignature,
            selectedBpm: null,
            selectedTimeSignature: null,
            isCorrect: false,
            lastAnswer: -1,
            gameStartTime: performance.now(),
        }, this.playMetronome);
    };

    endGame = () => {
        if (this.state.lastAnswer !== 1) {
            this.setState(prev => ({ skips: prev.skips + 1 }));
        }

        this.setState({ isStarted: false });
    };

    playMetronome = () => {
        const beatInterval = 60 / this.state.tempoBpm;
        const beats = parseInt(this.state.timeSignature.split('/')[0], 10);

        for (let i = 0; i < beats; i++) {
            const osc = this.audioCtx.createOscillator();
            osc.frequency.value = i === 0 ? 1000 : 700;
            osc.connect(this.audioCtx.destination);
            osc.start(this.audioCtx.currentTime + i * beatInterval);
            osc.stop(this.audioCtx.currentTime + i * beatInterval + 0.05);
        }
    };

    handleBpmSelect = (bpm) => {
        this.setState({ selectedBpm: bpm }, this.evaluateAnswer);
    };

    handleTimeSignatureSelect = (timeSignature) => {
        this.setState({ selectedTimeSignature: timeSignature }, this.evaluateAnswer);
    };

    evaluateAnswer = () => {
        const {
            selectedBpm,
            selectedTimeSignature,
            tempoBpm,
            timeSignature,
            isCorrect
        } = this.state;

        // Only evaluate if both selections have been made
        if (!selectedBpm || !selectedTimeSignature) {
            return;
        };

        // Prevent re-evaluation if already correct
        if (this.state.isCorrect) {
            return;
        }

        const now = performance.now();

        this.setState(prev => ({
            attempts: prev.attempts + 1
        }));

        if (selectedBpm === tempoBpm && selectedTimeSignature === timeSignature) {
            this.setState(prev => ({
                isCorrect: true,
                lastAnswer: 1,
                correct: prev.correct + 1,
                totalResponseTime: prev.totalResponseTime + (now - prev.gameStartTime)
            }));
        } else {
            this.setState({
                lastAnswer: 0,
            });
        }
    };

    nextQuestion = () => {
        if (!this.state.isCorrect) {
            this.setState(prev => ({ skips: prev.skips + 1 }));
        }

        this.setState(prev => ({
            questions: prev.questions + 1
        }), this.startGame);
    };

    getNextBpm = () => {
        const available = BPM_OPTIONS.filter((_, i) => this.state.bpmEnabled[i]);

        // Safeguard against no options selected
        if (available.length === 0) {
            return BPM_OPTIONS[Math.floor(Math.random() * BPM_OPTIONS.length)];
        }

        return available[Math.floor(Math.random() * available.length)];
    };

    getNextTimeSignature = () => {
        const available = TIME_SIGNATURES.filter((_, i) => this.state.timeSignatureEnabled[i]);

        // Safeguard against no options selected
        if (available.length === 0) {
            return TIME_SIGNATURES[Math.floor(Math.random() * TIME_SIGNATURES.length)];
        }

        return available[Math.floor(Math.random() * available.length)];
    };

    render() {
        const { isStarted, lastAnswer, selectedBpm, selectedTimeSignature } = this.state;

        return (
            <Grid container spacing={4} direction="column" alignItems="center" style={{ minHeight: '90vh' }}>
                <Grid item>
                    <h1>Tempo Recognition Practice</h1>
                    <h2>{!isStarted ? 'Customise the training' : 'Listen and identify tempo & time signature'}</h2>
                </Grid>



                {!isStarted && (
                    <>
                        <Grid item>
                            <FormLabel component="legend">Choose the BPMs (Tempos)</FormLabel>
                            <FormGroup row>
                                {BPM_OPTIONS.map((bpm, i) => (
                                    <FormControlLabel
                                        key={bpm}
                                        control={
                                            <Checkbox
                                                checked={this.state.bpmEnabled[i]}
                                                onChange={this.handleBpmToggle(bpm)}
                                            />
                                        }
                                        label={bpm}
                                    />
                                ))}
                            </FormGroup>
                        </Grid>

                        <Grid item>
                            <FormLabel component="legend">Choose the Time Signatures</FormLabel>
                            <FormGroup row>
                                {TIME_SIGNATURES.map((ts, i) => (
                                    <FormControlLabel
                                        key={ts}
                                        control={
                                            <Checkbox
                                                checked={this.state.timeSignatureEnabled[i]}
                                                onChange={this.handleTimeSignatureToggle(ts)}
                                            />
                                        }
                                        label={ts}
                                    />
                                ))}
                            </FormGroup>
                        </Grid>
                    </>
                )}

                {isStarted && (
                    <>
                        <Grid item>
                            <Typography variant="h6">Select Tempo (BPM):</Typography>
                            {BPM_OPTIONS.map(bpm => (
                                <Button
                                    key={bpm}
                                    variant={selectedBpm === bpm ? 'contained' : 'outlined'}
                                    onClick={() => this.handleBpmSelect(bpm)}
                                    sx={{ m: 1 }}
                                >
                                    {bpm}
                                </Button>
                            ))}
                        </Grid>

                        <Grid item>
                            <Typography variant="h6">Select Time Signature:</Typography>
                            {TIME_SIGNATURES.map(ts => (
                                <Button
                                    key={ts}
                                    variant={selectedTimeSignature === ts ? 'contained' : 'outlined'}
                                    onClick={() => this.handleTimeSignatureSelect(ts)}
                                    sx={{ m: 1 }}
                                >
                                    {ts}
                                </Button>
                            ))}
                        </Grid>

                        <Grid item>
                            <Typography variant="h5">
                                {lastAnswer === -1 ?
                                    'Make your selections' :
                                    lastAnswer === 1 ?
                                        'Correct!' :
                                        'Incorrect, try again.'}
                            </Typography>
                        </Grid>
                    </>
                )}

                <Grid item>
                    {!isStarted ? (
                        <Button variant="contained" color="secondary" onClick={this.startGame}>
                            <ArrowRightIcon sx={{ mr: 1 }} />
                            Start
                        </Button>
                    ) : (
                        <>
                            <Button variant="contained" onClick={this.nextQuestion} sx={{ mr: 2 }}>
                                <NavigateNextIcon sx={{ mr: 1 }} />
                                Next
                            </Button>
                            <Button variant="contained" color="secondary" onClick={this.endGame}>
                                <StopIcon sx={{ mr: 1 }} />
                                End
                            </Button>
                        </>
                    )}
                </Grid>
            </Grid>
        );
    }
}

export default TempoTrainer;
