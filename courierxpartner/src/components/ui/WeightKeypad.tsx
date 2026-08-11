import React from 'react';
import { Box, Typography, Button, Grid, Paper } from '@mui/material';
import { Delete, Check } from 'lucide-react';
import { motion } from 'framer-motion';


interface Props {
  value: string;
  onChange: (val: string) => void;
  onConfirm: () => void;
  label: string;
}


export const WeightKeypad = ({ value, onChange, onConfirm, label }: Props) => {
  const addDigit = (digit: string) => {
    if (digit === '.' && value.includes('.')) return;
    if (value.length >= 6) return;
    onChange(value + digit);
  };


  const backspace = () => onChange(value.slice(0, -1));


  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];


  return (
    <Box sx={{ width: '100%', spaceY: 3 }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900, tracking: '0.2em' }}>
          {label} (KG)
        </Typography>
        <Typography variant="h2" sx={{ fontWeight: 900, fontFamily: 'monospace', color: 'primary.main' }}>
          {value || '0.00'}<span style={{ fontSize: '1rem', color: '#444' }}>kg</span>
        </Typography>
      </Box>


      <Grid container spacing={1.5}>
        {keys.map((key) => (
          <Grid size={4} key={key}>
            <KeyButton onClick={() => addDigit(key)} label={key} />
          </Grid>
        ))}
        <Grid size={4}>
          <KeyButton onClick={backspace} label={<Delete size={20} />} color="rgba(255,255,255,0.05)" />
        </Grid>
      </Grid>
    </Box>
  );
};


const KeyButton = ({ label, onClick, color = 'rgba(255,255,255,0.03)' }: any) => (
  <Button
    fullWidth
    component={motion.button}
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    sx={{
      height: '70px',
      borderRadius: '16px',
      bgcolor: color,
      border: '1px solid rgba(255,255,255,0.05)',
      fontSize: '1.5rem',
      fontWeight: 900,
      color: 'white'
    }}
  >
    {label}
  </Button>
);