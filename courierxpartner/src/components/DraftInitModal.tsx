import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Button,
  Modal, Fade, Backdrop, CircularProgress,
  MenuItem, Select, FormControl
} from '@mui/material';
import { Plane, Ship, MapPin, ChevronRight, X } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { importService } from '../api/import.service';
import { useAuthStore } from '../store/useAuthStore';


interface Props {
  isOpen: boolean;
  onClose: () => void;
}


export const DraftInitModal = ({ isOpen, onClose }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // 1. DATA: Fetch all authorized physical locations
  const { data: locations, isLoading: loadingLocations } = useQuery({
    queryKey: ['myLocations'],
    queryFn: () => importService.getLocations(),
    enabled: isOpen // Only fetch when modal is opened
  });


  // 2. UI STATE
  const [mode, setMode] = useState<'AIR' | 'SEA'>('AIR');
  const [destinationId, setDestinationId] = useState('');


  // 3. AUTO-SELECT LOGIC: Default to the first Somalia (SO) node found
  useEffect(() => {
    if (locations && locations.length > 0) {
      const somaliaLoc = locations.find((l: any) => l.country === 'SO');
      if (somaliaLoc) setDestinationId(somaliaLoc.id);
    }
  }, [locations]);


  // 4. AUTHORITY: Derive Origin Hub from logged-in session
  const currentWarehouseId = user?.assignedLocations?.[0];


  // 5. MUTATION: Initialize the persistent Draft in DB
  const initMutation = useMutation({
    mutationFn: importService.initializeDraft,
    onSuccess: (draftId) => {
      toast.success('DRAFT_INITIALIZED', { description: 'Secure workspace created.' });
      onClose();
      navigate(`/manifests/builder/${draftId}`);
    },
    onError: (err: any) => {
      toast.error('VALIDATION_ERROR', {
        description: err.response?.data?.message || "Invalid location identifiers."
      });
    }
  });


  const handleOpenBuilder = () => {
    // SECURITY CHECK: Ensure Origin exists
    if (!currentWarehouseId) {
      toast.error("SECURITY_ERROR", { description: "User has no physical warehouse assigned." });
      return;
    }


    // VALIDATION CHECK: Ensure Destination is selected
    if (!destinationId) {
      toast.error("VALIDATION_ERROR", { description: "Please select a Somalia destination hub." });
      return;
    }


    initMutation.mutate({
      shippingMode: mode,
      destinationHub: destinationId,
      originHub: currentWarehouseId
    });
  };


  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{ backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' } } }}
    >
      <Fade in={isOpen}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '95%', maxWidth: '440px', bgcolor: '#0A0A0A', borderRadius: '40px',
          border: '1px solid rgba(255,255,255,0.1)', p: 4, outline: 'none',
          display: 'flex', flexDirection: 'column', gap: 4
        }}>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 900, fontStyle: 'italic', color: 'white' }}>
              NEW_CONSOLIDATION
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: '0.1em' }}>
              DEFINE_LOGISTICS_LANE
            </Typography>
          </Box>


          {/* TRANSPORT MODE SELECTOR */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <ModeOption active={mode === 'AIR'} onClick={() => setMode('AIR')} icon={<Plane size={24} />} label="AIR_FREIGHT" />
            <ModeOption active={mode === 'SEA'} onClick={() => setMode('SEA')} icon={<Ship size={24} />} label="SEA_FREIGHT" />
          </Box>


          {/* DESTINATION HUB PICKER */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 900, ml: 1, color: 'text.secondary' }}>
              DESTINATION_TERMINAL (SOMALIA)
            </Typography>

            <FormControl fullWidth>
              <Select
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value)}
                displayEmpty
                disabled={loadingLocations}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.02)',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                  fontWeight: 800,
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
                }}
              >
                {loadingLocations ? (
                  <MenuItem disabled><CircularProgress size={14} sx={{ mr: 1 }} /> Loading Hubs...</MenuItem>
                ) : (
                  locations?.filter((l: any) => l.country === 'SO').map((loc: any) => (
                    <MenuItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.city})
                    </MenuItem>
                  ))
                )}
                {locations
                  ?.filter((l: any) => l.country?.toUpperCase() === 'SO')
                  .map((loc: any) => (
                    <MenuItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.city})
                    </MenuItem>
                  ))
                }
              </Select>
            </FormControl>
          </Box>


          {/* ACTION CONTROLS */}
          <Box sx={{ pt: 2, display: 'flex', gap: 2 }}>
            <Button
              fullWidth
              onClick={onClose}
              sx={{ py: 2, color: 'text.secondary', fontWeight: 900, borderRadius: '16px' }}
            >
              Cancel
            </Button>
            <Button
              fullWidth
              variant="contained"
              disabled={initMutation.isPending || !destinationId}
              onClick={handleOpenBuilder}
              sx={{
                py: 2, borderRadius: '16px', fontWeight: 900,
                background: 'linear-gradient(90deg, #0052FF 0%, #003db3 100%)'
              }}
              endIcon={initMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <ChevronRight size={18} />}
            >
              Open Builder
            </Button>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
};


// --- HELPER COMPONENT: MODE CARD ---
const ModeOption = ({ active, onClick, icon, label }: any) => (
  <Paper
    onClick={onClick}
    sx={{
      p: 3, cursor: 'pointer', borderRadius: '24px', textAlign: 'center',
      bgcolor: active ? 'rgba(0,82,255,0.1)' : 'rgba(255,255,255,0.02)',
      border: '2px solid',
      borderColor: active ? 'primary.main' : 'transparent',
      transition: 'all 0.2s ease',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1
    }}
  >
    <Box sx={{ color: active ? 'primary.main' : 'text.secondary' }}>{icon}</Box>
    <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: active ? 'white' : 'text.secondary' }}>{label}</Typography>
  </Paper>
);
