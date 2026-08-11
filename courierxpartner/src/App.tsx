import { ThemeProvider, CssBaseline, Box, CircularProgress, Typography } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Suspense, lazy } from 'react';


// Theme & Global Styles
import { ruggedTheme } from './theme/ruggedTheme';


// Layouts & Shells
import { PartnerLayout } from './layouts/PartnerLayout';


// Core Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';


// Tactical Operational Pages
import { IntakeScanner } from './brains/intakeScanner';
import { InventoryFloor } from './brains/inventoryFloor';
import { ShipmentConsole } from './brains/shipmentConsole';


// Batch Consolidation Pages
import { CreateManifest } from './brains/CreateManifest';
import { ManifestBuilder } from './brains/ManifestBuilder';
import { UnsealManifest } from './brains/unsealManifest';
import { TerminalSettings } from './pages/settings/TerminalSettings';
import { StaffManager } from './brains/staffManager';
import { SudoChallengeModal } from './components/SudoChallengeModal';
import { SudoProvider } from './store/SudoContext';
import { ManifestDirectory } from './brains/ManifestDirectory';
import { AuditTrail } from './brains/AuditTrail';
import { DispatchTerminal } from './brains/DispatchTerminal';
import { FinanceTerminal } from './brains/FinanceTerminal';
import { ExceptionQueue } from './brains/ExceptionQueue';
import { PartnerProfile } from './brains/PartnerProfile';
import { StaffSettings } from './brains/staffSetting';
import { ManifestControl } from './brains/ManifestController';


/**
 * 1. React Query Client Configuration
 * Optimized for High-Frequency Logistics Updates (30s stale time)
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds
    },
  },
});


/**
 * 2. Operational Loading Fallback
 * Designed to match the industrial aesthetic during code-splitting transitions
 */
const TerminalLoader = () => (
  <Box sx={{
    height: '100dvh', w: '100vw', bgcolor: '#000',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 2
  }}>
    <CircularProgress size={24} thickness={6} sx={{ color: '#0052FF' }} />
    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#444', fontWeight: 900, tracking: '0.2em' }}>
      DECRYPTING_NODE_DATA...
    </Typography>
  </Box>
);


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SudoProvider>
        <ThemeProvider theme={ruggedTheme}>
          {/* Reset browser defaults to industrial dark mode */}
          <CssBaseline />


          {/* Production-grade notifications */}
          <Toaster position="top-center" theme="dark" richColors expand={false} />


          <BrowserRouter>
            <Suspense fallback={<TerminalLoader />}>
              <SudoChallengeModal />
              <Routes>
                {/* --- 🔓 PUBLIC ENTRY --- */}
                <Route path="/login" element={<Login />} />


                {/* --- 🔒 PROTECTED OPERATIONAL TERMINAL --- */}
                <Route element={<PartnerLayout />}>


                  {/* 1. Briefing Dashboard */}
                  <Route path="/dashboard" element={<Dashboard />} />


                  {/* 2. Micro-Ops: Inbound Leg */}
                  <Route path="/intake" element={<IntakeScanner />} />
                  <Route path="/inventory" element={<InventoryFloor />} />
                  <Route path="/shipments/:id" element={<ShipmentConsole />} />


                  {/* 3. Macro-Ops: Consolidation Leg */}
                  <Route path="/manifests/directory" element={<ManifestDirectory />} />
                  <Route path="/manifests/builder/:id" element={<ManifestBuilder />} />


                  {/* 1. Specific sub-path first */}
                  <Route path="/manifests/unseal/:id" element={<UnsealManifest />} />


                  {/* 2. Generic ID second */}
                  <Route path="/manifests/:id" element={<ManifestControl />} />


                  {/* 3. Empty base last */}
                  <Route path="/manifests" element={<CreateManifest />} />


                  <Route path="/dispatch" element={<DispatchTerminal />} />


                  <Route path="/exceptions" element={<ExceptionQueue />} />


                  {/* 4. Management & Reporting (Phase 2) */}
                  <Route path="/staff" element={<StaffManager />} />
                  <Route path="/finance" element={<FinanceTerminal />} />
                  <Route path="/settings" element={<TerminalSettings />} />
                  <Route path="/history" element={<AuditTrail />} />
                  <Route path="/profile/public" element={<PartnerProfile />} />
                  <Route path="/my-settings" element={<StaffSettings />} />
                  {/* --- 🔄 REDIRECTS --- */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />


                </Route>


                {/* Default landing redirect */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ThemeProvider>
      </SudoProvider>
    </QueryClientProvider>
  );
}


export default App;
