import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'sonner';

// Context & Global UI
import { SudoProvider } from './store/SudoContext';
import { SudoModal } from './components/auth/SudoModal';

// Layout & Base
import { AdminLayout } from './layouts/AdminLayout';
import { Login } from './pages/Login';

// Pages
import { Dashboard } from './pages/Dashboard';
import { PendingDrivers } from './pages/drivers/PendingDrivers';
import { UserDirectory } from './pages/drivers/UserDirectory';
import { DriverDetail } from './pages/drivers/DriverDetail';
import { DriverLeaderboard } from './pages/drivers/DriverLeaderboard';
import { ActiveOrders } from './pages/orders/ActiveOrders';
import { OrderHistory } from './pages/orders/OrderHistory';
import { PendingDeposits } from './pages/finances/PendingDeposits';
import { Withdrawals } from './pages/finances/Withdrawals';
import { AuditLogs } from './pages/finances/AuditLogs';
import { LedgerAudit } from './pages/finances/LedgerAudit';
import { RevenueDashboard } from './pages/finances/RevenueDashboard';
import { CustomerInsights } from './pages/customers/CustomerInsights';
import { VIPMasterlist } from './pages/customers/VIPMasterlist';
import { DormantActionCenter } from './pages/customers/DormantActionCenter';
import { RiskInvestigation } from './pages/customers/RiskInvestigation';
import { PartnerManagement } from './pages/imports/PartnerManagement';
import { ExceptionCenter } from './pages/imports/ExceptionCenter';
import { SystemSettings } from './pages/SystemSettings/SystemSettings';
import { StaffManagement } from './pages/SystemSettings/StaffManagement';
import { BroadcastCenter } from './pages/SystemSettings/BroadcastCenter';
import { PendingApprovals } from './pages/SystemSettings/PendingApprovals';
import { StaffDetail } from './pages/SystemSettings/StaffDetail';
import { ConflictModal } from './components/ConflictModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SudoProvider>
        <BrowserRouter>
          {/* Production Hardening: Global Safety Elements */}
          <Toaster position="top-right" richColors closeButton />
          <SudoModal />
          <ConflictModal />

          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<AdminLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              
              {/* Fleet & Users */}
              <Route path="/drivers" element={<UserDirectory />} />
              <Route path="/drivers/pending" element={<PendingDrivers />} />
              <Route path="/drivers/leaderboard" element={<DriverLeaderboard />} />
              <Route path="/drivers/:id" element={<DriverDetail />} />
              
              {/* CRM & Insights */}
              <Route path="/customers" element={<CustomerInsights />} />
              <Route path="/customers/vips" element={<VIPMasterlist />} />
              <Route path="/customers/dormant" element={<DormantActionCenter />} />
              <Route path="/customers/risk" element={<RiskInvestigation />} />

              {/* Logistics Operations */}
              <Route path="/orders" element={<ActiveOrders />} />
              <Route path="/order/history" element={<OrderHistory />} />
              <Route path="/imports/partners" element={<PartnerManagement />} />
              <Route path="/imports/exceptions" element={<ExceptionCenter />} />

              {/* Financial Core */}
              <Route path="/finance/revenue" element={<RevenueDashboard />} />
              <Route path="/finance/deposits" element={<PendingDeposits />} />
              <Route path="/finance/payouts" element={<Withdrawals />} />
              <Route path="/finance/ledger" element={<LedgerAudit />} />
              <Route path="/finance/logs" element={<AuditLogs />} />

              {/* System Security & Configuration */}
              <Route path="/settings" element={<SystemSettings />} />
              <Route path="/settings/staff" element={<StaffManagement />} />
              <Route path="/settings/staff/:id" element={<StaffDetail />} />
              <Route path="/settings/broadcast" element={<BroadcastCenter />} />
              <Route path="/settings/approvals" element={<PendingApprovals />} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </SudoProvider>
    </QueryClientProvider>
  );
}

export default App;