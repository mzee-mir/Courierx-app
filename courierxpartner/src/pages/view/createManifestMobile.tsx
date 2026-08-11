import React from 'react';
import { Box, Typography, Paper, Checkbox, Button, TextField, FormControl, Select, MenuItem, Stack } from '@mui/material';
import { Plane, Ship, MapPin, HardDrive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


export const CreateManifestMobile = (props: any) => {
    return (
        <Box sx={{ p: 2, pb: 20, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>NEW_BATCH</Typography>


            {/* MODE & HUB SELECTORS */}
            <Stack direction="row" spacing={1}>
                <Button fullWidth variant={props.mode === 'AIR' ? 'contained' : 'outlined'} onClick={() => { props.setMode('AIR'); props.setSelectedIds([]); }} startIcon={<Plane size={14} />}>AIR</Button>
                <Button fullWidth variant={props.mode === 'SEA' ? 'contained' : 'outlined'} onClick={() => { props.setMode('SEA'); props.setSelectedIds([]); }} startIcon={<Ship size={14} />}>SEA</Button>
            </Stack>


            <Paper sx={{ p: 2, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.02)' }}>
                <Typography variant="caption" sx={{ fontWeight: 900, mb: 1, display: 'block' }}>GATEWAY_TARGET</Typography>
                <Select fullWidth size="small" value={props.destHubId} onChange={(e) => props.setDestHubId(e.target.value)}>
                    {props.somaliGateways.map((loc: any) => (
                        <MenuItem key={loc.id} value={loc.id}>{loc.city}</MenuItem>
                    ))}
                </Select>
            </Paper>


            {/* ITEMS LIST */}
            <Box sx={{ mt: 1 }}>
                {props.floorItems.map((item: any) => (
                    <Paper key={item.id} onClick={() => props.toggleSelect(item.id)} sx={{ p: 2, mb: 1, borderRadius: '16px', display: 'flex', alignItems: 'center', gap: 1, border: '1px solid', borderColor: props.selectedIds.includes(item.id) ? 'primary.main' : 'transparent' }}>
                        <Checkbox checked={props.selectedIds.includes(item.id)} />
                        <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 900, fontFamily: 'monospace' }}>{item.tracking}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{item.weight}kg</Typography>
                        </Box>
                    </Paper>
                ))}
            </Box>


            {/* FLOATING ACTION BAR */}
            <AnimatePresence>
                {props.selectedIds.length > 0 && (
                    <Box component={motion.div} initial={{ y: 50 }} animate={{ y: 0 }} sx={{ position: 'fixed', bottom: 100, left: 16, right: 16, zIndex: 100 }}>
                        <Paper sx={{ p: 2, borderRadius: '24px', bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography sx={{ fontWeight: 900 }}>{props.totals.weight.toFixed(1)}kg</Typography>
                                <Typography variant="caption" sx={{ opacity: 0.8 }}>{props.totals.count} ITEMS</Typography>
                            </Box>
                            <Button onClick={props.handleSeal} variant="contained" sx={{ bgcolor: 'white', color: 'black', fontWeight: 900, borderRadius: '12px' }}>Seal Manifest</Button>
                        </Paper>
                    </Box>
                )}
            </AnimatePresence>
        </Box>
    );
};
