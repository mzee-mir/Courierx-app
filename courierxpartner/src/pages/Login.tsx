import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Button, TextField, Box, Typography,
  InputAdornment, CircularProgress, IconButton, Paper
} from '@mui/material';
import { Mail, Lock, ShieldAlert, ChevronRight, Eye, EyeOff, Terminal, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';


import { authService } from '../api/auth.service';
import { useAuthStore } from '../store/useAuthStore';


const loginSchema = z.object({
  email: z.string().email('Enter a valid business email'),
  password: z.string().min(6, 'Password required'),
});


type LoginForm = z.infer<typeof loginSchema>;


export const Login = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);


  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'expired') {
      toast.info('Session Ended', { description: 'Please enter your access key to resume your shift.' });
    }
  }, []);


  const onSubmit = async (data: LoginForm) => {
    try {
      const response = await authService.login(data.email, data.password);
      setAuth(response.user, response.token);
      toast.success('Terminal Link Established');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error('Authentication Error', { description: error.message });
    }
  };


  return (
    <Box sx={{
      minHeight: '100dvh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: '#161616',
      backgroundImage: `
        radial-gradient(circle at 10% 20%, rgba(0, 81, 255, 0.33) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(0, 81, 255, 0.21) 0%, transparent 40%)
      `,
      position: 'relative',
      overflow: 'hidden'
    }}>


      {/* 1. BACKGROUND DECORATION (The "Live Data" feel) */}
      <Box sx={{ position: 'absolute', top: 40, left: 40, opacity: 0.2, display: { xs: 'none', md: 'block' } }}>
        <Typography variant="overline" sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1, fontFamily: 'monospace' }}>
          <Activity size={14} /> SYSTEM_READY // PORT_2026_ACTIVE
        </Typography>
      </Box>


      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: '100%', maxWidth: '480px', padding: '24px', zIndex: 2 }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, md: 8 },
            borderRadius: '40px',
            bgcolor: 'rgba(15, 15, 15, 0.7)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 40px 100px -20px rgba(0, 0, 0, 0.8)',
          }}
        >
          {/* LOGO SECTION */}
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <Box sx={{
                display: 'inline-flex',
                p: 2.5,
                bgcolor: 'primary.main',
                borderRadius: '24px',
                mb: 3,
                boxShadow: '0 15px 35px rgba(0, 82, 255, 0.3)'
              }}>
                <ShieldAlert size={38} color="white" />
              </Box>
            </motion.div>


            <Typography variant="h3" sx={{ fontWeight: 900, color: 'white', letterSpacing: '-0.04em', mb: 1, fontSize: { xs: '1.75rem', md: '2.25rem' } }}>
              PARTNER<span style={{ color: '#0052FF' }}>PORTAL</span>
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.4em', textTransform: 'uppercase', fontSize: '0.65rem' }}>
              Global Logistics Terminal
            </Typography>
          </Box>


          {/* FORM SECTION */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                fullWidth
                variant="filled"
                label="Personnel Identity (Email)"
                {...register('email')}
                error={!!errors.email}
                helperText={errors.email?.message}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Mail size={20} color="rgba(255,255,255,0.2)" />
                      </InputAdornment>
                    ),
                  }
                }}
                sx={inputStyles}
              />


              <TextField
                fullWidth
                variant="filled"
                type={showPassword ? 'text' : 'password'}
                label="Security Access Key"
                {...register('password')}
                error={!!errors.password}
                helperText={errors.password?.message}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock size={20} color="rgba(255,255,255,0.2)" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          sx={{ color: 'rgba(255,255,255,0.2)' }} // 👈 Neutral
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                }}
                sx={inputStyles}
              />


              <Box sx={{ mt: 2 }}>
                <Button
                  fullWidth
                  variant="contained"
                  type="submit"
                  disabled={isSubmitting}
                  sx={{
                    py: 2.5,
                    borderRadius: '20px',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    background: 'linear-gradient(90deg, #0052FF 0%, #003db3 100%)',
                    boxShadow: '0 10px 20px rgba(0, 82, 255, 0.2)',
                    '&:hover': {
                      background: 'linear-gradient(90deg, #0052FF 20%, #0062ff 100%)',
                      boxShadow: '0 15px 30px rgba(0, 82, 255, 0.4)',
                      transform: 'translateY(-2px)'
                    },
                    '&:active': { transform: 'translateY(0)' },
                    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                >
                  {isSubmitting ? <CircularProgress size={26} color="inherit" /> : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      LOGIN <ChevronRight size={22} />
                    </Box>
                  )}
                </Button>
              </Box>
            </Box>
          </form>


          {/* METADATA FOOTER */}
          <Box sx={{ mt: 6, textAlign: 'center' }}>
            <Box sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1.5,
              py: 1, px: 3,
              borderRadius: '12px',
              bgcolor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <Terminal size={14} color="#0052FF" />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                GATEWAY: ENCRYPTED // v7.2.5
              </Typography>
            </Box>
          </Box>
        </Paper>
      </motion.div>


      {/* Decorative Corner Lines */}
      <Box sx={{ position: 'absolute', bottom: 40, right: 40, opacity: 0.1 }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <path d="M100 0 L100 100 L0 100" fill="none" stroke="white" strokeWidth="2" />
        </svg>
      </Box>
    </Box>
  );
};


const inputStyles = {
  '& .MuiFilledInput-root': {
    backgroundColor: 'transparent', // 👈 Remove intentional background
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.1)',
    transition: 'all 0.3s ease',
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.02)', // Minimal ghosting on hover
      borderColor: 'rgba(255,255,255,0.2)',
    },
    '&.Mui-focused': {
      backgroundColor: 'transparent',
      borderColor: 'rgba(255,255,255,0.5)',
      boxShadow: '0 0 20px rgba(255, 255, 255, 0.03)',
    },
    '&:before, &:after': { display: 'none' },


    // 🚨 THE FIX: Remove the Browser Autofill Blue/Yellow background
    '& input:-webkit-autofill': {
      WebkitBoxShadow: '0 0 0 1000px #050505 inset !important', // Matches your page background
      WebkitTextFillColor: '#fff !important',
      caretColor: '#fff',
      borderRadius: 'inherit',
    },
    '& input:-webkit-autofill:hover': {
      WebkitBoxShadow: '0 0 0 1000px #050505 inset !important',
    },
    '& input:-webkit-autofill:focus': {
      WebkitBoxShadow: '0 0 0 1000px #050505 inset !important',
    },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 500,
    '&.Mui-focused': { color: '#fff' }
  },
  '& .MuiInputBase-input': {
    color: 'white',
    fontWeight: 600,
    py: 2.5,
    caretColor: '#fff'
  },
  '& .MuiFormHelperText-root': {
    fontWeight: 700,
    color: '#FF3B30',
    mx: 2
  }
};

