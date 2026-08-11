import React, { useState } from 'react';
import { Box, Typography, Button, TextField, Modal, CircularProgress } from '@mui/material';
import { Lock, Fingerprint } from 'lucide-react';
import { motion } from 'framer-motion';
import { authService } from '../api/auth.service';
import { useSudo } from '../store/SudoContext'; // 👈 Import the hook
import { toast } from 'sonner';


export const SudoChallengeModal = () => {
  // 👈 FIX: Read state from Context instead of Props
  const { isModalOpen, closeModal, authorize, actionName } = useSudo();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);


  if (!isModalOpen) return null;


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await authService.verifySudo(password);
      authorize(token); // This updates the global sudoToken and triggers the pending action
      setPassword('');
    } catch (err: any) {
      toast.error('AUTHORIZATION_DENIED', { description: 'Incorrect security key.' });
    } finally {
      setLoading(false);
    }
  };


  return (
    <Modal
      open={isModalOpen}
      onClose={closeModal}
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}
    >
      <Box
        component={motion.div}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        sx={{
          width: '100%', maxWidth: '400px', bgcolor: '#050505',
          borderRadius: '32px', border: '1px solid rgba(255,59,48,0.2)',
          outline: 'none', overflow: 'hidden'
        }}
      >
        <Box sx={{ p: 4, bgcolor: 'rgba(255,59,48,0.05)', textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 900, color: 'white', textTransform: 'uppercase' }}>
            Confirm Authority
          </Typography>
        </Box>


        <Box sx={{ p: 4 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', mb: 4 }}>
            Authorize action: <br />
            <span style={{ color: 'white', fontWeight: 800 }}>{actionName}</span>
          </Typography>


          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              fullWidth
              autoFocus
              type="password"
              placeholder="Enter Access Key"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              variant="filled"
              slotProps={{ input: { sx: { borderRadius: '16px', textAlign: 'center' }, disableUnderline: true } }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button fullWidth onClick={closeModal} sx={{ color: 'text.secondary' }}>Cancel</Button>
              <Button
                fullWidth
                type="submit"
                variant="contained"
                color="error"
                disabled={loading || !password}
                sx={{ borderRadius: '16px', fontWeight: 900 }}
              >
                {loading ? <CircularProgress size={20} /> : 'Authorize'}
              </Button>
            </Box>
          </form>
        </Box>
      </Box>
    </Modal>
  );
};

