import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { Link } from 'react-router-dom';

const TopMenu: React.FC = () => {
    return (
        <Box sx={{ flexGrow: 1, height: '10vh' }}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" align='left' component="div" sx={{ flexGrow: 1 }}>
                        Gamified Music Platform
                    </Typography>

                    <Box>
                        <Button color="inherit" component={Link} to="/">
                            Home
                        </Button>
                        <Button color="inherit" component={Link} to="/tone">
                            Tone
                        </Button>
                        <Button color="inherit" component={Link} to="/pitch">
                            Pitch
                        </Button>
                        <Button color="inherit" component={Link} to="/tempo">
                            Tempo
                        </Button>
                    </Box>
                </Toolbar>
            </AppBar>
        </Box>
    );
};

export default TopMenu;
