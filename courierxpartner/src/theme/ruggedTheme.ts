import { createTheme } from '@mui/material/styles';


export const ruggedTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#0052FF', // CourierX Brand Blue
    },
    background: {
      default: '#000000',
      paper: '#8b1818',
    },
    error: {
      main: '#FF3B30',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Inter", sans-serif',
    h1: { fontWeight: 900, letterSpacing: '-0.02em' },
    h3: { fontSize: '2.5rem', fontWeight: 900 },
    h4: { fontSize: '1.8rem', fontWeight: 900 },
    caption: { fontSize: '0.65rem', letterSpacing: '0.1em' },
    button: { fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' },
  },


  shape: {
    borderRadius: 16,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          padding: '12px 24px',
          boxShadow: 'none',
          '&:active': { transform: 'scale(0.98)' },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'filled',
      },
    },
  },
});
