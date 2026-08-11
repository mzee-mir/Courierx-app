import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, LinearProgress,
  Button, List, ListItem, Chip, Modal, TextField
} from '@mui/material';
import { Scan, AlertTriangle, CheckCircle2, History, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/axios';
import { importService } from '../../api/import.service';
import { WeightKeypad } from '../../components/ui/WeightKeypad';
import { PhotoUploader } from '../../components/ui/PhotoUploader';


export const UnsealManifestDesktop = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();


  // --- UI STATE ---
  const [activeItem, setActiveItem] = useState<any>(null); // Currently scanning
  const [weight, setWeight] = useState('');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [closingNote, setClosingNote] = useState('');
  const [evidenceRefs, setEvidenceRefs] = useState<string[]>([]);


  // 1. Fetch Manifest Details (Authority)
  const { data: auth, isLoading } = useQuery({
    queryKey: ['manifestAuthority', id],
    queryFn: () => api.get(`/partner/manifests/${id}/authority`).then(res => res.data.data)
  });


  // 2. Mutations
  const verifyMutation = useMutation({
    mutationFn: (payload: any) => importService.verifyUnsealItem(id!, payload),
    onSuccess: () => {
      toast.success('ITEM_VERIFIED');
      setActiveItem(null);
      setWeight('');
      setEvidenceRefs([]); // 👈 CRITICAL: Clear the photos for the next item!
      queryClient.invalidateQueries({ queryKey: ['manifestAuthority', id] });
    }
  });


  if (isLoading) return <Loader2 className="animate-spin text-brand m-10" />;


  const { manifest, calculatedTotalWeight } = auth;
  const verifiedCount = manifest.shipmentIds.filter((s: any) => s.status === 'READY_FOR_LOCAL_HANDOFF').length;
  const totalCount = manifest.shipmentIds.length;


  return (
    <Box sx={{ p: { xs: 2, md: 4 }, pb: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>


      {/* 1. PROGRESS HEADER */}
      <Paper sx={{ p: 4, borderRadius: '32px', bgcolor: 'primary.main', color: 'white' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 2 }}>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.8 }}>UNSEALING_PROGRESS</Typography>
            <Typography variant="h3" sx={{ fontWeight: 900 }}>{verifiedCount}<span style={{ opacity: 0.4 }}>/{totalCount}</span></Typography>
          </Box>
          <Package size={48} style={{ opacity: 0.2 }} />
        </Box>
        <LinearProgress
          variant="determinate"
          value={(verifiedCount / totalCount) * 100}
          sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }}
        />
      </Paper>


      {/* 2. LIVE CHECKLIST */}
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', ml: 1 }}>MANIFEST_CHECKLIST</Typography>
        <List sx={{ mt: 1, spaceY: 1 }}>
          {manifest.shipmentIds.map((s: any) => {
            const isVerified = s.status === 'READY_FOR_LOCAL_HANDOFF';
            return (
              <Paper key={s._id} onClick={() => !isVerified && setActiveItem(s)} sx={{
                p: 2, mb: 1, borderRadius: '16px', display: 'flex', justifyContent: 'space-between',
                bgcolor: isVerified ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                border: '1px solid', borderColor: isVerified ? '#10b981' : 'rgba(255,255,255,0.05)',
                opacity: isVerified ? 0.6 : 1
              }}>
                <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.85rem' }}>{s.externalTrackingNumber}</Typography>
                {isVerified ? <CheckCircle2 size={18} className="text-green-500" /> : <Scan size={18} className="text-gray-600" />}
              </Paper>
            );
          })}
        </List>
      </Box>


      {/* 3. FINALIZATION TRIGGER */}
      <Box sx={{ position: 'fixed', bottom: 100, left: 16, right: 16 }}>
        <Button
          fullWidth variant="contained" size="large"
          onClick={() => setIsFinalizing(true)}
          sx={{ py: 2.5, borderRadius: '20px', fontWeight: 900, background: 'linear-gradient(90deg, #333, #000)' }}
        >
          Finalize & Log Exceptions
        </Button>
      </Box>


      {/* --- VERIFICATION MODAL --- */}
      {activeItem && (
        <Modal open={!!activeItem} onClose={() => setActiveItem(null)}>
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'background.default', p: 4, overflowY: 'auto' }}>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 4 }}>VERIFY_ITEM: {activeItem.externalTrackingNumber}</Typography>


            <WeightKeypad
              label="ARRIVAL_WEIGHT"
              value={weight}
              onChange={setWeight}
              onConfirm={() => { }}
            />


            {/* Photo Uploader appears if discrepancy found or damage reported */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary' }}>AUDIT_EVIDENCE (IF_DAMAGED)</Typography>
              <PhotoUploader
                shipmentId={activeItem.id}
                onUploadComplete={(urls) => setEvidenceRefs(urls)}
                maxPhotos={1}
              />
            </Box>


            <Button
              fullWidth variant="contained"
              sx={{ mt: 4, py: 2.5, borderRadius: '20px' }}
              onClick={() => verifyMutation.mutate({
                trackingNumber: activeItem.externalTrackingNumber,
                arrivalWeight: parseFloat(weight),
                photos: evidenceRefs
              })}
            >
              Confirm Item
            </Button>
          </Box>
        </Modal>
      )}


      {/* --- CLOSING STATEMENT MODAL --- */}
      {isFinalizing && (
        <Modal open={isFinalizing} onClose={() => setIsFinalizing(false)}>
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: '400px', bgcolor: '#121212', p: 4, borderRadius: '32px' }}>
            <Typography variant="h6" sx={{ fontWeight: 900, mb: 2 }}>FINAL_CLOSURE</Typography>
            <TextField
              fullWidth multiline rows={3} placeholder="Enter warehouse notes regarding missing or damaged items..."
              value={closingNote} onChange={(e) => setClosingNote(e.target.value)}
            />
            <Button
              fullWidth variant="contained" sx={{ mt: 3, py: 2 }}
              onClick={async () => {
                await importService.finalizeUnsealing(id!, closingNote);
                navigate('/manifests');
              }}
            >Commit Unsealing</Button>
          </Box>
        </Modal>
      )}
    </Box>
  );
};
