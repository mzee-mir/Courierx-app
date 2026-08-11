import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Button, IconButton,
  CircularProgress, Badge, Divider, List, ListItem,
  Alert
} from '@mui/material';
import {
  Plus, Trash2, Package, Save, CheckCircle2,
  ChevronLeft, Loader2, Info, X, Plane, Ship
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { importService } from '../../api/import.service';
import { toast } from 'sonner';
import api from '../../api/axios';


export const ManifestBuilderDesktop = (props: any) => {
  const navigate = useNavigate();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const { draft, floorItems, isSealing, sealManifest, handleAddItem, handleRemoveItem } = props;


  if (!draft) return (
    <Box sx={{ p: { xs: 2, md: 4 }, pb: 12 }}>
      <Alert severity="error">MANIFEST_NOT_FOUND: The draft session has expired or is invalid.</Alert>
      <Button onClick={() => navigate('/inventory')} sx={{ mt: 2 }}>Return to Floor</Button>
    </Box>
  );
  return (
    <Box sx={{ p: 2, pb: 15, display: 'flex', flexDirection: 'column', gap: 3 }}>


      {/* HEADER */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton onClick={() => navigate('/manifests')} sx={{ color: 'text.secondary' }}>
          <ChevronLeft size={20} />
        </IconButton>
        <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', letterSpacing: '0.1em' }}>
          CONSOLIDATION_BUILDER / {draft.shippingMode}
        </Typography>
      </Box>


      {/* DRAFT METADATA */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <Typography variant="h5" sx={{ fontFamily: 'monospace', fontWeight: 900 }}>{draft.manifestCode}</Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>
            DEST: {draft.destinationHub.name}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
            {draft.shipmentIds.length} ITEMS STAGED
          </Typography>
        </Box>
      </Paper>


      {/* STAGED ITEMS LIST */}
      <Box sx={{ spaceY: 2 }}>
        <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', ml: 1 }}>STAGED_INVENTORY</Typography>
        {draft.shipmentIds.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '24px' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>Builder is empty. Add items from the floor.</Typography>
          </Box>
        ) : (
          draft.shipmentIds.map((item: any) => (
            <Paper key={item.id} sx={{ p: 2, pl: 3, borderRadius: '16px', bgcolor: '#0A0A0A', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Box>
                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 800 }}>{item.externalTrackingNumber}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.5 }}>{item.intake_weight}kg</Typography>
              </Box>
              <IconButton onClick={() => handleRemoveItem(item.id)} size="small" sx={{ color: 'error.main' }}>
                <X size={18} />
              </IconButton>
            </Paper>
          ))
        )}
      </Box>


      {/* FLOATING TOOLS */}
      <Box sx={{ position: 'fixed', bottom: 100, left: 16, right: 16, display: 'flex', gap: 2, zIndex: 100 }}>
        <Button
          fullWidth variant="contained"
          onClick={() => setIsPickerOpen(true)}
          startIcon={<Plus />}
          sx={{ py: 2, borderRadius: '16px', bgcolor: 'white', color: 'black', fontWeight: 900, '&:hover': { bgcolor: '#eee' } }}
        >
          Add from Floor
        </Button>
        <Button
          fullWidth variant="contained"
          disabled={draft.shipmentIds.length === 0 || isSealing}
          onClick={() => sealManifest()}
          sx={{ py: 2, borderRadius: '16px', fontWeight: 900 }}
        >
          {isSealing ? <CircularProgress size={20} /> : 'Seal Manifest'}
        </Button>
      </Box>


      {/* --- ITEM PICKER OVERLAY --- */}
      <AnimatePresence>
        {isPickerOpen && (
          <Box
            component={motion.div}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            sx={{ position: 'fixed', inset: 0, zIndex: 200, bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}
          >
            <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>PICK_FROM_FLOOR</Typography>
              <IconButton onClick={() => setIsPickerOpen(false)}><X /></IconButton>
            </Box>


            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
              {floorItems?.map((item: any) => {
                const isAlreadyAdded = draft.shipmentIds.some((s: any) => s.id === item.id);
                return (
                  <Paper
                    key={item.id}
                    onClick={() => !isAlreadyAdded && handleAddItem(item.id)}
                    sx={{ p: 2, mb: 1.5, borderRadius: '16px', display: 'flex', justifyContent: 'space-between', opacity: isAlreadyAdded ? 0.3 : 1 }}
                  >
                    <Box>
                      <Typography sx={{ fontFamily: 'monospace', fontWeight: 800 }}>{item.tracking}</Typography>
                      <Typography variant="caption">{item.weight}kg</Typography>
                    </Box>
                    {isAlreadyAdded ? <CheckCircle2 className="text-green-500" /> : <Plus className="text-brand" />}
                  </Paper>
                );
              })}
            </Box>


            <Box sx={{ p: 3, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <Button fullWidth variant="contained" onClick={() => setIsPickerOpen(false)} sx={{ py: 2, borderRadius: '16px' }}>
                Return to Builder
              </Button>
            </Box>
          </Box>
        )}
      </AnimatePresence>
    </Box>
  );
};
