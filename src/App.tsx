import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { pink, blue } from '@mui/material/colors';

import TopMenu from './components/TopMenu';
import TonePlayer from './components/TonePlayer';
import PitchTrainer from './components/PitchTrainer';
import TempoTrainer from './components/TempoTrainer';

// import { AuthProvider } from './firebase/AuthContext';
import logo from './logo.svg';
import './App.css';

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

const Home: React.FC = () => (
  <header className="App-header">
    <img src={logo} className="App-logo" alt="logo" />
    <p>
      This is a web app about music education. <br />
      Select a page on the top right corner to begin. <br /> <br />
      <strong>Tone:</strong> A virtual piano. <br />
      <strong>Pitch:</strong> Perfect pitch practice. <br />
    </p>
  </header>
);

const App: React.FC = () => {
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
                <Route path="/Tone" element={<TonePlayer />} />
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
