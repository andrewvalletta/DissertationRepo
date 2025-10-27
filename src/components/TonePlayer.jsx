import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Grid from '@mui/material/Grid';

import Piano from 'react-piano-component';
import NoteDisplay from './NoteDisplay';
import getKeyMap from '../util/getKeyMap';
import RANGES from '../constants/RANGES';

import './TonePlayer.css';

const PianoContainer = ({ children }) => (
  <div className="the-piano__piano-container" onMouseDown={(e) => e.preventDefault()}>
    {children}
  </div>
);

const getUnicodeText = (text) => {
  switch (text) {
    case 'BACKSPACE':
      return '\u232B';
    case 'ENTER':
      return '\u23CE';
    default:
      return text;
  }
};

const AccidentalKey = ({ isPlaying, text, eventHandlers }) => (
  <div className="the-piano__accidental-key__wrapper">
    <button
      className={`the-piano__accidental-key ${isPlaying ? 'the-piano__accidental-key--playing' : ''}`}
      {...eventHandlers}
    >
      <div className="the-piano__text">{getUnicodeText(text)}</div>
    </button>
  </div>
);

const NaturalKey = ({ isPlaying, text, eventHandlers }) => (
  <button
    className={`the-piano__natural-key ${isPlaying ? 'the-piano__natural-key--playing' : ''}`}
    {...eventHandlers}
  >
    <div className="the-piano__text">{getUnicodeText(text)}</div>
  </button>
);

const ThePiano = ({ startNote, endNote, handleNotePlay, handleNoteStop }) => {
  const keyMapping = getKeyMap(startNote, endNote);

  return (
    <Piano
      startNote={startNote}
      endNote={endNote}
      keyboardMap={keyMapping}
      renderPianoKey={({
        note,
        isNoteAccidental,
        isNotePlaying,
        startPlayingNote,
        stopPlayingNote,
        keyboardShortcuts,
      }) => {
        const KeyComponent = isNoteAccidental ? AccidentalKey : NaturalKey;

        const keyHandleNotePlay = () => {
          handleNotePlay(note);
          startPlayingNote();
        };

        const keyHandleNoteStop = () => {
          if (!isNotePlaying) return;
          handleNoteStop(note);
          stopPlayingNote();
        };

        const handleMouseEnter = (event) => {
          if (event.buttons) {
            handleNotePlay(note);
            startPlayingNote();
          }
        };

        const eventHandlers = {
          onMouseDown: keyHandleNotePlay,
          onMouseEnter: handleMouseEnter,
          onTouchStart: keyHandleNotePlay,
          onMouseUp: keyHandleNoteStop,
          onMouseOut: keyHandleNoteStop,
          onTouchEnd: keyHandleNoteStop,
        };

        return (
          <KeyComponent
            isPlaying={isNotePlaying}
            text={keyboardShortcuts.join(' / ')}
            eventHandlers={eventHandlers}
          />
        );
      }}
    />
  );
};

const TonePlayer = () => {
  const [range, setRange] = useState('C3-C5');
  const [startNote, setStartNote] = useState('C3');
  const [endNote, setEndNote] = useState('C5');
  const [theNote, setTheNote] = useState([]);

  const handleRangeChange = (event) => {
    const value = event.target.value;
    setRange(value);
    setStartNote(value.substring(0, 2));
    setEndNote(value.substring(3));
  };

  const handleNotePlay = (note) => {
    setTheNote((prev) => [...prev, note]);
  };

  const handleNoteStop = (note) => {
    setTheNote((prev) => prev.filter((n) => n !== note));
  };

  const renderNote = (note) => <NoteDisplay note={note} />;

  return (
    <Grid
      container
      spacing={4}
      direction="column"
      alignItems="center"
      wrap="nowrap"
      style={{ margin: 'auto', height: '90vh', width: '100%' }}
    >
      <Grid item>
        <h1>A Musical Keyboard</h1>
        <h2>Use it to practice your ears!</h2>
      </Grid>

      <Grid item>
        <form className="tone-player-form" autoComplete="off">
          <FormControl className="tone-player-range-form-control">
            <Select
              value={range}
              onChange={handleRangeChange}
              displayEmpty
              name="range"
              className="tone-player-range-select"
            >
              {RANGES.map((r) => (
                <MenuItem key={r[1]} value={r}>
                  {r}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Select the first and last note</FormHelperText>
          </FormControl>
        </form>
      </Grid>

      <Grid item>{renderNote(theNote)}</Grid>

      <Grid item>
        <Paper elevation={1}>
          <PianoContainer>
            <ThePiano
              startNote={startNote}
              endNote={endNote}
              handleNotePlay={handleNotePlay}
              handleNoteStop={handleNoteStop}
            />
          </PianoContainer>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default TonePlayer;
