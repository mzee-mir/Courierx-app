import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField,
  InputAdornment, Chip, Button, Stack, CircularProgress
} from '@mui/material';
import { Search, Package, Plane, Ship, AlertCircle, ChevronRight, Filter, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { importService } from '../../api/import.service';
import { DraftInitModal } from '../../components/DraftInitModal';


interface InventoryProps {
  items: any[];
  pagination: any;
  filters: { search: string; mode: string; page: number };
  setSearch: (val: string) => void;
  setMode: (val: any) => void;
  isLoading: boolean;
}


export const InventoryFloorDesktop = ({
  items,
  pagination,
  filters,
  setSearch,
  setMode,
  isLoading
}: InventoryProps) => {
  const navigate = useNavigate();
  const [search] = useState('');
  const [mode] = useState<'AIR' | 'SEA' | ''>(''); // Empty means all
  const [isInitModalOpen, setIsInitModalOpen] = useState(false);


  const { data: response } = useQuery({
    queryKey: ['inventory', search, mode],
    queryFn: () => importService.getInventory({ search, transportMode: mode, status: 'RECEIVED_AT_ORIGIN' }),
  });


  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>


      {/* 1. TACTICAL HEADER */}
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.05em' }}>
          FLOOR_<span style={{ color: '#0052FF' }}>INVENTORY</span>
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
          READY_FOR_CONSOLIDATION
        </Typography>
      </Box>


      {/* 2. SEARCH & MODE SELECTOR */}
      <Box sx={{ spaceY: 2 }}>
        <TextField
          fullWidth
          placeholder="Search Tracking ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><Search size={18} color="#444" /></InputAdornment>,
              sx: { borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }
            }
          }}
        />


        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <ModeTab
            active={mode === ''}
            onClick={() => setMode('')}
            label="ALL"
            icon={<Package size={14} />}
          />
          <ModeTab
            active={mode === 'AIR'}
            onClick={() => setMode('AIR')}
            label="AIR"
            icon={<Plane size={14} />}
          />
          <ModeTab
            active={mode === 'SEA'}
            onClick={() => setMode('SEA')}
            label="SEA"
            icon={<Ship size={14} />}
          />
        </Stack>
      </Box>


      {/* 3. INVENTORY CARDS */}
      <Box sx={{ flex: 1 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <AnimatePresence mode="popLayout">
            {response?.data?.map((item: any) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => navigate(`/shipments/${item.id}`)}
              >
                <Paper sx={{
                  p: 2.5, mb: 1.5, borderRadius: '20px',
                  bgcolor: 'rgba(255,255,255,0.02)',
                  border: '1px solid',
                  borderColor: item.isFlagged ? 'error.main' : 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', gap: 2,
                  cursor: 'pointer',
                  '&:active': { transform: 'scale(0.98)' }
                }}>
                  {/* Physical Indicators */}
                  <Box sx={{
                    width: 48, height: 48, borderRadius: '14px',
                    bgcolor: item.transportMode === 'AIR' ? 'rgba(0,82,255,0.1)' : 'rgba(16,185,129,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: item.transportMode === 'AIR' ? 'primary.main' : '#10b981'
                  }}>
                    {item.transportMode === 'AIR' ? <Plane size={24} /> : <Ship size={24} />}
                  </Box>


                  {/* Shipment Details */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '0.85rem' }}>
                      {item.tracking}
                    </Typography>
                    <Typography noWrap variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                      {item.description}
                    </Typography>
                  </Box>


                  {/* Action Signal */}
                  <Box sx={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: '0.9rem' }}>{item.weight}kg</Typography>
                    {item.isFlagged ? (
                      <Chip label="FROZEN" size="small" color="error" sx={{ height: 16, fontSize: '0.5rem', fontWeight: 900 }} />
                    ) : (
                      <Typography variant="caption" sx={{ fontSize: '0.55rem', fontWeight: 900, color: 'primary.main', border: '1px solid', px: 0.5, borderRadius: '4px' }}>
                        READY
                      </Typography>
                    )}
                  </Box>
                  <ChevronRight size={16} className="text-gray-700" />
                </Paper>
              </motion.div>
            ))}


            {response?.data?.length === 0 && (
              <Box sx={{ py: 10, textAlign: 'center', opacity: 0.2 }}>
                <Package size={48} style={{ margin: '0 auto 16px' }} />
                <Typography variant="button" sx={{ fontWeight: 900 }}>ZONE_EMPTY</Typography>
              </Box>
            )}
          </AnimatePresence>
        )}
      </Box>


      {/* 4. FOOTER SUMMARY */}
      {!isLoading && response?.data?.length > 0 && (
        <Box sx={{ mt: 'auto', p: 2, borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, fontFamily: 'monospace' }}>
            TOTAL_ITEMS: {response.pagination.total} // MODE: {mode || 'GLOBAL'}
          </Typography>
        </Box>
      )}


      {/* TACTICAL FAB: INITIALIZE MANIFEST */}
      <Box sx={{ position: 'fixed', bottom: 100, right: 16, zIndex: 10 }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => setIsInitModalOpen(true)}
          sx={{
            borderRadius: '24px', py: 2, px: 4,
            fontWeight: 900, fontSize: '0.8rem',
            background: 'linear-gradient(45deg, #0052FF, #003db3)',
            boxShadow: '0 10px 30px rgba(0,82,255,0.4)',
            gap: 1.5
          }}
          startIcon={<ClipboardList size={20} />}
        >
          Consolidate Floor
        </Button>
      </Box>


      <DraftInitModal
        isOpen={isInitModalOpen}
        onClose={() => setIsInitModalOpen(false)}
      />
    </Box>
  );
};


const ModeTab = ({ active, onClick, label, icon }: any) => (
  <Button
    fullWidth
    onClick={onClick}
    sx={{
      borderRadius: '12px',
      py: 1,
      bgcolor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
      border: '1px solid',
      borderColor: active ? 'primary.main' : 'rgba(255,255,255,0.05)',
      color: active ? 'primary.main' : 'text.secondary',
      fontSize: '0.65rem',
      fontWeight: 900,
      gap: 1,
      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
    }}
  >
    {icon} {label}
  </Button>
);
