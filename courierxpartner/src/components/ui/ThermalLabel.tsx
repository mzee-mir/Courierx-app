import React from 'react';
import { Box, Typography, Divider } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { Plane, Ship } from 'lucide-react';


interface LabelProps {
    data: {
        cxCode: string;
        trackingId: string;
        weight: string | number;
        mode: 'AIR' | 'SEA';
        destination: string;
        category: string;
        phone: string;
        cbm?: string | null;
        dims?: { l: string; w: string; h: string } | null;
    } | null;
}


export const ThermalLabel = ({ data }: LabelProps) => {
    if (!data) return null;


    return (
        <Box
            id="printable-label"
            sx={{
                width: '384px',
                height: '576px',
                bgcolor: 'white !important',
                color: 'black !important',
                p: 4,
                display: 'flex',
                flexDirection: 'column',
                fontFamily: '"Roboto Mono", monospace',
                boxSizing: 'border-box'
            }}
        >
            {/* HEADER: BRAND & MODE */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontWeight: 900, fontSize: '1.2rem' }}>COURIERX</Typography>
                <Box sx={{ bgcolor: 'black', color: 'white', px: 1, py: 0.5, borderRadius: '4px', display: 'flex', alignItems: 'center', gap: 1 }}>
                    {data.mode === 'AIR' ? <Plane size={16} /> : <Ship size={16} />}
                    <Typography sx={{ fontWeight: 900, fontSize: '0.8rem' }}>{data.mode}_FREIGHT</Typography>
                </Box>
            </Box>


            <Divider sx={{ borderColor: 'black', borderWidth: 2 }} />


            {/* CORE IDENTITY: CX-CODE (X-LARGE) */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 900 }}>PACKAGE_ID</Typography>
                <Typography sx={{ fontSize: '4rem', fontWeight: 900, lineHeight: 0.8 }}>
                    {data.cxCode}
                </Typography>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, border: '3px solid black', px: 2 }}>
                    {data.destination.toUpperCase()}
                </Typography>
            </Box>


            {/* SPECS BLOCK */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
                <Box>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 900 }}>MEASUREMENT</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.2rem' }}>
                        {data.mode === 'AIR' ? `${data.weight} KG` : `${data.cbm || '0.000'} CBM`}
                    </Typography>
                </Box>
                {data.mode === 'SEA' && data.dims && (
                    <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 900 }}>DIMENSIONS</Typography>
                        <Typography sx={{ fontWeight: 900, fontSize: '0.8rem' }}>
                            {data.dims?.l}x{data.dims?.w}x{data.dims?.h} cm
                        </Typography>
                    </Box>
                )}
            </Box>


            {/* CUSTOMER PHONE SECTION (NEW) */}
            <Box sx={{ bgcolor: 'black', color: 'white', p: 1, textAlign: 'center', mb: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 900, display: 'block' }}>RECIPIENT_CONTACT</Typography>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 900 }}>
                    {data.phone}
                </Typography>
            </Box>


            {/* FOOTER: QR & TRACKING */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', borderTop: '2px dashed black', pt: 2 }}>
                <QRCodeSVG value={data.trackingId} size={100} level="H" />
                <Box>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 900 }}>VENDOR_TRACKING</Typography>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, wordBreak: 'break-all' }}>{data.trackingId}</Typography>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 900, mt: 1 }}>DATE_INTAKE</Typography>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700 }}>{new Date().toLocaleDateString()}</Typography>
                </Box>
            </Box>
        </Box>
    );
};
