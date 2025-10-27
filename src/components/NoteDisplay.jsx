import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

function NoteDisplay({ note }) {
  const displayNote = note.length ? note.join(', ') : '_';

  return (
    <Card sx={{ margin: 'auto', boxShadow: 'none' }}>
      <CardContent>
        <Typography component="p">The note being played is:</Typography>
        <Typography variant="h5" component="h2">
          {displayNote}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default NoteDisplay;
