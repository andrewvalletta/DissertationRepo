import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { pink, blue } from '@mui/material/colors';

import TopMenu from './components/TopMenu';
import PitchTrainer from './components/PitchTrainer';
import TempoTrainer from './components/TempoTrainer';

// import { AuthProvider } from './firebase/AuthContext';
import logo from './logo.svg';
import './App.css';
// import { sessionManager } from './system/SessionManager';
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
    [EventLogger.exportSessionAsJSON()],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `session_${new Date().toISOString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const Home: React.FC = () => (
  <header className="App-header">
    <img src={logo} className="App-logo" alt="logo" />
    <p>
      This is a web app about music education. <br />
      Select a page on the top right corner to begin. <br /> <br />
      <strong>Pitch:</strong> Perfect pitch practice. <br />
      <strong>Tempo:</strong> Tempo recognition practice. <br />
    </p>
    <div>
      {EventLogger.getEvents().length > 1 && (
        <button onClick={handleExportSession}>Export Session Data</button>
      )}
    </div>
  </header>
);

const App: React.FC = () => {
  useEffect(() => {
    (window as any).runSimulation = (numOfSimulations: number, agentProfileName: string, mode: string) => {
      const simulator = new SimulationRunner();
      simulator.runBatch(numOfSimulations || 100, agentProfileName || 'moderate_accuracy', mode || 'pitch');
    };

    // sessionManager.startSession();

    // return () => {
    //   sessionManager.endSession();
    // };
  }, []);

  return (
    // <AuthProvider>
    <ThemeProvider theme={theme}>
      <Router>
        <div className="App">
          <div id="dashboard">
            <TopMenu />
            <div className="content">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/Pitch" element={<PitchTrainer />} />
                <Route path="/Tempo" element={<TempoTrainer />} />
              </Routes>
            </div>
          </div>
        </div>
      </Router>
    </ThemeProvider>
    // </AuthProvider>
  );
};

export default App;
