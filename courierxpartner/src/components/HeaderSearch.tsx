import React, { useState } from 'react';
import { Box, InputBase, Paper, CircularProgress, IconButton } from '@mui/material';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'sonner';


export const HeaderSearch = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();


  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;


    setLoading(true);
    try {
      const res = await api.get(`/partner/shipments/track/${query.trim()}`);
      navigate(`/shipments/${res.data.data.id}`);
      setQuery('');
    } catch (err: any) {
      toast.error('REFERENCE_MISSING', { description: 'Track ID not found in this node.' });
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box component="form" onSubmit={handleSearch} sx={{ width: '100%' }}>
      <Paper elevation={0} sx={{
        display: 'flex', alignItems: 'center',
        px: 2, py: 0.5, borderRadius: '12px',
        bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        '&:focus-within': { borderColor: 'primary.main', bgcolor: '#000' }
      }}>
        <InputBase
          placeholder="SEARCH_TRACK_ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          sx={{ flex: 1, color: 'white', fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 900 }}
        />
        {loading ? <CircularProgress size={12} thickness={6} /> : <Search size={14} className="text-gray-600" />}
      </Paper>
    </Box>
  );
};
