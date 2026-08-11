import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SOSOverlay } from '../components/layout/SOSOverlay';
import { useQuery } from 'react-query';
import { settingsService } from '../api/settings.service';
import { AlertOctagon, Loader2 } from 'lucide-react';

interface SystemSetting {
  key: string;
  value: any;
}

export const AdminLayout = () => {
  const token = localStorage.getItem('admin_token');

  // 1. Fetch live system settings to check for Maintenance Mode
  const { data: settings, isLoading } = useQuery('currentSettings', settingsService.getSettings, {
    enabled: !!token,
    refetchInterval: 60000 // Check system status every minute
  });

  if (!token) return <Navigate to="/login" replace />;

  if (isLoading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-brand h-10 w-10" />
    </div>
  );

  const isMaintenanceActive = settings?.find((s: SystemSetting) => s.key === 'MAINTENANCE_MODE_ENABLED')?.value;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Real-time Emergency Response Layer */}
      <SOSOverlay />
      
      <Sidebar />

      <main className="flex-1 h-full overflow-hidden flex flex-col relative">
        {/* 🚨 PRODUCTION HARDENING: MAINTENANCE PROTOCOL BANNER */}
        {isMaintenanceActive && (
          <div className="bg-red-600 text-white py-2.5 px-6 flex items-center justify-center gap-4 z-[60] shadow-2xl">
             <AlertOctagon size={18} className="animate-pulse" />
             <span className="text-[11px] font-black uppercase tracking-[0.3em]">
               System Status: Maintenance Mode Active (Non-Admin Traffic Blocked)
             </span>
             <AlertOctagon size={18} className="animate-pulse" />
          </div>
        )}

        {/* Scrollable Workspace Canvas */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
};