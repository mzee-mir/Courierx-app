import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button,
  CircularProgress, Modal, Paper, InputAdornment, Grid, Divider, IconButton
} from '@mui/material';
import {
  Phone, Package, Scale, MapPin, X,
  Plane, Ship, ShieldAlert, Zap, Printer
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { importService } from '../api/import.service';


export const QuickCreateModal = ({ isOpen, onClose, trackingNumber, locationId }: any) => {
  const [form, setForm] = useState({
    phoneNumber: '',
    itemDescription: '',
    weight: '',
    mode: 'AIR',
    binLocation: ''
  });


  const createMutation = useMutation({
    mutationFn: (payload: any) => importService.quickIntake(payload),
    onSuccess: (data) => {
      toast.success('SHIPMENT_REGISTERED', { description: `Linked to ${data.resolvedFor}` });


      // TRIGGER THERMAL PRINT (Optional but recommended)
      if (data.cxCode) {
        toast.info("Generating CourierX Label...");
        // Note: window.print() logic would go here or be triggered via a prop
      }


      onClose();
    },
    onError: (err: any) => toast.error('REGISTRATION_FAILED', {
      description: err.response?.data?.message || "Check connectivity"
    })
  });


  const handleSubmit = () => {
    if (!form.phoneNumber || !form.weight || !form.binLocation) {
      toast.error("INPUT_MISSING", { description: "All logistics fields are mandatory." });
      return;
    }
    createMutation.mutate({
      ...form,
      trackingNumber,
      locationId,
      weight: parseFloat(form.weight)
    });
  };


  if (!isOpen) return null;


  return (
    <Modal open={isOpen} onClose={onClose} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box
        component={motion.div}
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        sx={{
          width: '95%', maxWidth: '500px', bgcolor: '#050505', borderRadius: '40px',
          border: '1px solid rgba(0,82,255,0.2)', overflow: 'hidden', outline: 'none'
        }}
      >
        {/* TACTICAL HAZARD HEADER */}
        <Box sx={{
          p: 3, background: 'repeating-linear-gradient(45deg, #0052FF11, #0052FF11 10px, #000 10px, #000 20px)',
          borderBottom: '1px solid #0052FF33', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <Box>
            <Typography sx={{ fontWeight: 900, color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShieldAlert size={18} className="text-amber-500" /> SYSTEM_OVERRIDE
            </Typography>
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 900, fontFamily: 'monospace' }}>
              UNREGISTERED_ID: {trackingNumber}
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'white' }}><X /></IconButton>
        </Box>


        <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>


          {/* STEP 1: RECIPIENT LINKAGE */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 900, ml: 1, color: 'text.secondary' }}>01_RECIPIENT_IDENTITY</Typography>
            <TextField
              fullWidth placeholder="+252..."
              value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              sx={tacticalInput}
              InputProps={{ startAdornment: <InputAdornment position="start"><Phone size={18} color="#0052FF" /></InputAdornment> }}
            />
          </Box>


          {/* STEP 2: LOGISTICS SPECS */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 900, ml: 1, color: 'text.secondary' }}>02_PHYSICAL_SPECS</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
              <TextField
                label="Weight (KG)" type="number" value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                sx={tacticalInput}
              />
              <TextField
                label="Bin / Shelf" placeholder="A-12" value={form.binLocation}
                onChange={(e) => setForm({ ...form, binLocation: e.target.value.toUpperCase() })}
                sx={tacticalInput}
              />
            </Box>
          </Box>


          {/* STEP 3: FREIGHT MODE TOGGLES */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 900, ml: 1, color: 'text.secondary' }}>03_TRANSIT_MODE</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
              <ModeCard
                active={form.mode === 'AIR'}
                icon={<Plane />} label="AIR_FREIGHT"
                onClick={() => setForm({ ...form, mode: 'AIR' })}
              />
              <ModeCard
                active={form.mode === 'SEA'}
                icon={<Ship />} label="SEA_FREIGHT"
                onClick={() => setForm({ ...form, mode: 'SEA' })}
              />
            </Box>
          </Box>


          <TextField
            fullWidth label="Short Description"
            placeholder="e.g. Spare Parts"
            value={form.itemDescription}
            onChange={(e) => setForm({ ...form, itemDescription: e.target.value })}
            sx={tacticalInput}
          />


          {/* ACTION BUTTON */}
          <Box sx={{ pt: 2 }}>
            <Button
              fullWidth variant="contained" size="large"
              disabled={createMutation.isPending}
              onClick={handleSubmit}
              sx={{
                py: 2.5, borderRadius: '20px', fontWeight: 900, fontSize: '1rem',
                background: 'linear-gradient(45deg, #0052FF, #003db3)',
                boxShadow: '0 10px 30px rgba(0,82,255,0.4)',
                '&:hover': { transform: 'scale(1.02)' }
              }}
            >
              {createMutation.isPending ? <CircularProgress size={24} /> : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  AUTHORIZE & REGISTER <Zap size={18} />
                </Box>
              )}
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};


// --- TACTICAL SUB-COMPONENTS ---


const ModeCard = ({ active, icon, label, onClick }: any) => (
  <Paper
    onClick={onClick}
    sx={{
      p: 2, cursor: 'pointer', textAlign: 'center', borderRadius: '16px',
      bgcolor: active ? 'rgba(0,82,255,0.1)' : 'rgba(255,255,255,0.02)',
      border: '2px solid', borderColor: active ? '#0052FF' : 'transparent',
      color: active ? 'white' : 'text.secondary',
      transition: 'all 0.2s',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1
    }}
  >
    {icon}
    <Typography sx={{ fontSize: '0.6rem', fontWeight: 900 }}>{label}</Typography>
  </Paper>
);


const tacticalInput = {
  '& .MuiFilledInput-root': {
    borderRadius: '16px',
    bgcolor: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
    '&.Mui-focused': { border: '1px solid #0052FF' }
  }
};
