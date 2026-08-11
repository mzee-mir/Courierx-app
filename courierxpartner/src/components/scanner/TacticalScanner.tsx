import React, { useEffect } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';


interface Props {
  onScanSuccess: (decodedText: string) => void;
  isPaused: boolean;
}


export const TacticalScanner = ({ onScanSuccess, isPaused }: Props) => {
  useEffect(() => {
    if (isPaused) return;


    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      },
      false
    );


    scanner.render(onScanSuccess, (error) => {
      // Passive logging to avoid UI noise during focus hunting
    });


    return () => {
      scanner.clear().catch(err => console.error("Scanner cleanup failed", err));
    };
  }, [isPaused, onScanSuccess]);


  return (
    <Box sx={{ position: 'relative', width: '100%', borderRadius: '32px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)' }}>
      <div id="reader" style={{ width: '100%' }}></div>

      {/* Visual Overlay for the worker */}
      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{ width: '260px', height: '160px', border: '2px solid #0052FF', borderRadius: '16px', boxShadow: '0 0 20px rgba(0,82,255,0.3)' }}
        />
      </Box>
    </Box>
  );
};