import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes
} from 'react-router-dom';

import {
  ThemeProvider,
  createTheme
} from '@mui/material/styles';

import {
  pink,
  blue
} from '@mui/material/colors';

import TopMenu from './components/TopMenu';
import PitchTrainer from './components/PitchTrainer';
import TempoTrainer from './components/TempoTrainer';

import logo from './logo.svg';
import './App.css';

import { EventLogger } from './system/EventLogger';
import { SimulationRunner } from './system/SimulationRunner';


// Material UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: blue[500],
    },

    secondary: {
      main: pink[500],
    },
  },

  typography: {},
});


const handleExportSession = () => {
  const blob = new Blob(
    [
      EventLogger.exportSessionAsJSON()
    ],
    {
      type:
        'application/json;charset=utf-8',
    }
  );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement('a');

  a.href = url;

  a.download =
    `session_${new Date()
      .toISOString()
    }.json`;

  document.body.appendChild(a);

  a.click();

  a.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};


const Home: React.FC = () => (
  <header className="App-header">
    <img
      src={logo}
      className="App-logo"
      alt="logo"
    />

    <p>
      This is a web app about music education.
      <br />

      Select a page on the top right corner
      of the screen.
      <br />
      <br />

      <strong>
        Pitch:
      </strong>{' '}
      Perfect pitch practice.
      <br />

      <strong>
        Tempo:
      </strong>{' '}
      Tempo recognition practice.
      <br />
    </p>

    <div>
      {EventLogger.getEvents().length > 1 && (
        <button
          onClick={
            handleExportSession
          }
        >
          Export Session Data
        </button>
      )}
    </div>
  </header>
);


const App: React.FC = () => {
  useEffect(() => {
    /*
     * Expose the simulation runner through the browser console.
     *
     * Example:
     *
     * runSimulation(
     *     100000,
     *     'moderate_accuracy',
     *     'pitch',
     *     'solo'
     * )
     *
     * Valid simulationType values: 'solo', 'simple_collab',
     * 'obs_learn', 'ml_level_up'.
     */
    (window as any).runSimulation =
      async (
        numOfSimulations: number,
        agentProfileName: string,
        mode: string,
        simulationType: string,
      ) => {
        const simulator =
          new SimulationRunner();

        return simulator.runBatch(
          numOfSimulations || 100,
          agentProfileName ||
          'moderate_accuracy',
          mode ||
          'pitch',
          simulationType ||
          'solo',
        );
      };

    /*
     * Optional convenience function.
     *
     * This lets you inspect the current streaming statistics
     * from the browser console while debugging.
     */
    (window as any).simulationStats =
      () => {
        return EventLogger
          .getSimulationStats();
      };
  }, []);


  return (
    <ThemeProvider
      theme={theme}
    >
      <Router>
        <div className="App">
          <div id="dashboard">
            <TopMenu />

            <div className="content">
              <Routes>
                <Route
                  path="/"
                  element={
                    <Home />
                  }
                />

                <Route
                  path="/Pitch"
                  element={
                    <PitchTrainer />
                  }
                />

                <Route
                  path="/Tempo"
                  element={
                    <TempoTrainer />
                  }
                />
              </Routes>
            </div>
          </div>
        </div>
      </Router>
    </ThemeProvider>
  );
};


export default App;
