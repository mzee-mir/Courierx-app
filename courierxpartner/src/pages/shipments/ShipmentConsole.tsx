import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Button, Divider, Alert,
  AlertTitle, CircularProgress, IconButton, alpha,
  Grid, FormControl, InputLabel, Select, MenuItem,
  Chip
} from '@mui/material';
import {
  ShieldAlert, MapPin, History, ChevronLeft,
  Fingerprint, Package, HardDrive, Search,
  ShieldCheck,
  Printer
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import api from '../../api/axios';
import { WeightKeypad } from '../../components/ui/WeightKeypad';
import { PhotoUploader } from '../../components/ui/PhotoUploader';
import { ThermalLabel } from '../../components/ui/ThermalLabel';


export const ShipmentConsoleDesktop = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();


  const [isLocked, setIsLocked] = useState(false);
  const [weight, setWeight] = useState('');
  const [selectedManifestId, setSelectedManifestId] = useState('');
  const [evidenceRefs, setEvidenceRefs] = useState<string[]>([]);


  const handleReprint = () => {
    window.print();
  };


  const { data: auth, isLoading, isError } = useQuery({
    queryKey: ['shipmentAuthority', id],
    queryFn: async () => {
      const res = await api.get(`/partner/shipments/${id}/authority`);
      return res.data.data;
    },
    staleTime: 0,
  });


  const transitionMutation = useMutation({
    mutationFn: (payload: any) => api.patch(`/partner/shipments/${id}/transition`, payload),
    onSuccess: () => {
      toast.success('TRANSACTION_COMMITTED');
      navigate('/inventory');
    },
    onError: (err: any) => {
      toast.error('REJECTED', { description: err.response?.data?.message });
      setIsLocked(false);
    }
  });


  if (isLoading) return <Box sx={{ p: 4 }}><CircularProgress size={20} /> <Typography variant="caption">SYNCING_NODE...</Typography></Box>;
  if (isError || !auth) return <Alert severity="error">DATA_LINK_FAILURE</Alert>;


  const {
    shipment = {},
    metadata = {},
    physicalControlName = 'LOADING...',
    allowed = [],
    activity = []
  } = auth || {};


  const currentAction = allowed[0];


  const handleExecute = () => {
    if (isLocked || !currentAction) return;


    // Requirement Validation
    if (currentAction.code === 'CONSOLIDATE_ITEM' && !selectedManifestId) {
      return toast.error('INPUT_REQUIRED', { description: 'Select a target manifest.' });
    }


    if (currentAction.requires.includes('arrivalWeight') && !weight) {
      return toast.error('INPUT_REQUIRED', { description: 'Weight entry mandatory.' });
    }


    setIsLocked(true);
    transitionMutation.mutate({
      actionCode: currentAction.code,
      manifestId: selectedManifestId,
      weight: parseFloat(weight),
      evidenceIds: evidenceRefs
    });
  };


  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3, pb: 12 }}>


      {/* 1. HEADER */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton onClick={() => navigate('/inventory')} sx={{ color: 'text.secondary' }}><ChevronLeft /></IconButton>
        <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', letterSpacing: '0.15em' }}>
          CONSOLE / {shipment.status}
        </Typography>
      </Box>


      {/* 2. IDENTITY & METADATA GRID */}
      <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 900 }}><Fingerprint size={12} /> REF</Typography>
            <Typography variant="h5" sx={{ fontFamily: 'monospace', fontWeight: 900 }}>{shipment.externalTrackingNumber}</Typography>
          </Box>
          <Chip label={shipment.transportMode} size="small" sx={{ fontWeight: 900 }} />
        </Box>


        <Divider sx={{ mb: 2, opacity: 0.05 }} />


        <Grid container spacing={2}>
          <MetaField label="CATEGORY" value={metadata?.description} />
          <MetaField label="INTAKE_WEIGHT" value={`${metadata.weight}kg`} />
          <MetaField label="DESTINATION" value={metadata?.destination} />
          <MetaField label="HUB_LOCATION" value={physicalControlName} />
        </Grid>


        <Button
          startIcon={<Printer />}
          onClick={handleReprint}
          sx={{ mt: 2, color: 'primary.main', fontWeight: 900 }}
        >
          Reprint CourierX Label
        </Button>
      </Paper>


      {/* 4. EVIDENCE GALLERY (NEW) */}
      {shipment.hasPhotos && shipment.intakePhotos?.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', ml: 1, tracking: '0.1em' }}>
            FILED_EVIDENCE_ATTACHMENTS ({shipment.intakePhotos.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 1, overflowX: 'auto', pb: 1 }}>
            {shipment.intakePhotos.map((photo: any, index: number) => (
              <Paper
                key={index}
                elevation={0}
                sx={{
                  minWidth: '140px',
                  height: '140px',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.1)',
                  bgcolor: '#000',
                  cursor: 'zoom-in'
                }}
                onClick={() => window.open(photo.url, '_blank')} // Simple zoom
              >
                <img
                  src={photo.url}
                  alt="evidence"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </Paper>
            ))}
          </Box>
        </Box>
      )}


      {/* 3. DYNAMIC ACTION PANEL */}
      <Paper
        elevation={0}
        sx={{
          p: 4, borderRadius: '40px', bgcolor: '#000', border: '1px solid',
          borderColor: currentAction ? 'primary.main' : 'rgba(255,255,255,0.05)',
        }}
      >
        {currentAction ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* ... (Existing code for Execute Dispatch / Record Arrival) */}
          </Box>
        ) : auth.lockReason === 'BATCHING_REQUIRED' ? (
          /* 👈 TACTICAL REDIRECT VIEW */
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Package size={48} color="#0052FF" style={{ marginBottom: '16px', opacity: 0.5 }} />
            <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>LOOSE_INVENTORY_LOCKED</Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 4, opacity: 0.6, px: 2 }}>
              This shipment is currently loose on the floor. It must be processed via a bulk manifest to change its status.
            </Typography>
            <Button
              variant="outlined"
              onClick={() => navigate('/inventory')}
              sx={{ borderRadius: '12px', fontWeight: 900, color: 'primary.main' }}
            >
              Go to Batch Builder
            </Button>
          </Box>
        ) : (
          /* Generic Lock View (Flagged or Out of Custody) */
          <Box sx={{ textAlign: 'center', py: 2, opacity: 0.2 }}>
            <ShieldCheck size={48} style={{ margin: '0 auto 16px' }} />
            <Typography variant="button" sx={{ fontWeight: 900, display: 'block' }}>
              {auth.lockReason || 'NO_PENDING_AUTHORITY'}
            </Typography>
          </Box>
        )}
      </Paper>


      {/* 4. AUDIT LEDGER */}
      <Box sx={{ px: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <History size={16} /> IMMUTABLE_AUDIT_LEDGER
        </Typography>
        <Box sx={{ borderLeft: '1px solid rgba(255,255,255,0.05)', ml: 1, pl: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {activity.map((log: any) => (
            <Box key={log._id}>
              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>{log.newStatus}</Typography>
              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'text.secondary' }}>
                {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', mt: 0.5, fontStyle: 'italic' }}>&gt; {log.notes}</Typography>
            </Box>
          ))}
        </Box>
      </Box>


      {auth && shipment?.id && (
        <ThermalLabel data={{
          trackingId: shipment.externalTrackingNumber,
          weight: shipment.intake_weight,
          mode: shipment.transportMode,
          destination: shipment.dropoffLandmark,
          category: shipment.itemDescription,
          cxCode: metadata?.packageCode !== "N/A"
            ? metadata?.packageCode
            : (shipment.externalTrackingNumber?.slice(-6) || "000000"),
          cbm: shipment.calculatedCBM?.toString(),
          dims: shipment.dimensions ? {
            l: String(shipment.dimensions.length || '0'),
            w: String(shipment.dimensions.width || '0'),
            h: String(shipment.dimensions.height || '0')
          } : null,
          phone: metadata?.customerPhone || "NO_PHONE",
        }} />
      )}
    </Box>


  );
};


const MetaField = ({ label, value }: any) => (
  <Box>
    <Typography
      variant="caption"
      sx={{ color: 'text.secondary', fontWeight: 800, fontSize: '0.6rem', display: 'block' }}
    >
      {label}
    </Typography>
    <Typography
      noWrap // 👈 Move it here (outside sx)
      sx={{ fontWeight: 800, fontSize: '0.8rem', color: 'white' }}
    >
      {value || '---'}
    </Typography>
  </Box>
);
