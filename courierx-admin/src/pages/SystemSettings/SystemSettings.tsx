import { useQuery, useMutation, useQueryClient } from 'react-query';
import { ShieldAlert, Save, Loader2, Info, Lock, Power } from 'lucide-react';
import { toast } from 'sonner';
import { settingsService } from '../../api/settings.service';
import { useSudo } from '../../store/SudoContext';

export const SystemSettings = () => {
  const queryClient = useQueryClient();
  const { requireSudo } = useSudo();
  
  // 1. Fetch the Schema (The Source of Truth)
  const { data: schema, isLoading: loadingSchema } = useQuery('settingsSchema', settingsService.getSchema);
  const { data: currentSettings } = useQuery('currentSettings', settingsService.getSettings);

  const updateMutation = useMutation(
    ({ key, value, reason }: any) => settingsService.updateSetting(key, value, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('currentSettings');
        toast.success('Setting update submitted for 2-Man review');
      },
      onError: (err: any) => toast.error(err.response?.data?.message || 'Update rejected')
    }
  );

  const toggleMaintenance = (currentStatus: boolean) => {
    requireSudo(() => {
      updateMutation.mutate({
        key: 'MAINTENANCE_MODE_ENABLED',
        value: !currentStatus,
        reason: `Maintenance mode manually ${!currentStatus ? 'activated' : 'deactivated'} via Admin Dashboard.`
      });
    });
  };

  const isMaintenanceActive = currentSettings?.find((s: any) => s.key === 'MAINTENANCE_MODE_ENABLED')?.value;

  if (loadingSchema) return <Loader2 className="animate-spin mx-auto mt-20" />;

  return (
    <div className="space-y-8 p-6">
      
      {/* --- CRITICAL CONTROL: MAINTENANCE MODE --- */}
      <div className={`p-8 rounded-[2.5rem] border-2 transition-all ${
        isMaintenanceActive 
        ? 'bg-red-50 border-red-200 shadow-xl shadow-red-100' 
        : 'bg-white border-gray-100'
      }`}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-3xl ${isMaintenanceActive ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
              <Power size={32} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter">Maintenance Protocol</h2>
              <p className="text-sm text-gray-500 max-w-md">
                {isMaintenanceActive 
                  ? "SYSTEM IS OFFLINE. All non-admin traffic is currently blocked." 
                  : "System is live. Toggle this to block all public interactions during upgrades."}
              </p>
            </div>
          </div>

          <button 
            onClick={() => toggleMaintenance(!!isMaintenanceActive)}
            className={`px-10 py-4 rounded-2xl font-black uppercase tracking-widest transition-all ${
              isMaintenanceActive 
              ? 'bg-white text-red-600 border-2 border-red-200 hover:bg-red-100' 
              : 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-100'
            }`}
          >
            {isMaintenanceActive ? 'Disable Maintenance' : 'Enable Maintenance'}
          </button>
        </div>
      </div>

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Parameters</h1>
          <p className="text-sm text-gray-500">Live configuration of the CourierX core engine.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {Object.entries(schema || {}).map(([key, config]: [string, any]) => {
          const isImplemented = config.isImplemented;
          const currentValue = currentSettings?.find((s: any) => s.key === key)?.value;

          return (
            <div 
              key={key} 
              className={`p-6 rounded-3xl border transition-all ${
                isImplemented 
                ? 'bg-white border-gray-100 shadow-sm' 
                : 'bg-gray-50 border-gray-200 opacity-60 grayscale-[0.5]'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    {key.replace(/_/g, ' ')}
                    {!isImplemented && <span className="text-[9px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded uppercase font-black tracking-widest">Planned</span>}
                  </h3>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </div>
                {!isImplemented && <Lock size={16} className="text-gray-400" />}
              </div>

              <div className="flex items-center gap-3">
                <input 
                  type="text"
                  disabled={!isImplemented}
                  defaultValue={currentValue}
                  placeholder={isImplemented ? "Enter value..." : "Logic not yet wired"}
                  className="flex-1 p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand disabled:cursor-not-allowed text-sm font-mono"
                />
                
                <button 
                  disabled={!isImplemented || updateMutation.isLoading}
                  onClick={() => {
                    const newValue = prompt('Enter new value for ' + key + ':');
                    if (newValue !== null) {
                      const parsed = parseFloat(newValue);
                      if (!isNaN(parsed)) {
                        updateMutation.mutate({ key, value: parsed, reason });
                      } else {
                        toast.error('Invalid number');
                      }
                    }
                  }}
                  className="p-3 bg-brand text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                >
                  <Save size={18} />
                </button>
              </div>
              
              {!isImplemented && (
                <div className="mt-4 flex items-center gap-2 text-[10px] text-amber-600 font-bold bg-amber-50 p-2 rounded-lg">
                  <Info size={12} />
                  This input is disabled to prevent "System Drift." Logic is being developed.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};